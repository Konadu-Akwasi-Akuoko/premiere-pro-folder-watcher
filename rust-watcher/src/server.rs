use crate::protocol::{Command, Event};
use crate::watcher::WatchManager;
use log::{debug, error, info, warn};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tungstenite::{accept, Message, WebSocket};

pub struct Server {
    port: u16,
    debounce_ms: u64,
}

impl Server {
    pub fn new(port: u16, debounce_ms: u64) -> Self {
        Self { port, debounce_ms }
    }

    pub fn run(&self) -> Result<(), String> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener =
            TcpListener::bind(&addr).map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        info!("WebSocket server listening on ws://{}", addr);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    info!("New client connection");
                    if let Err(e) = self.handle_client(stream) {
                        error!("Client handler error: {}", e);
                    }
                    info!("Client disconnected");
                }
                Err(e) => {
                    error!("Connection error: {}", e);
                }
            }
        }

        Ok(())
    }

    fn handle_client(&self, stream: TcpStream) -> Result<(), String> {
        let websocket =
            accept(stream).map_err(|e| format!("WebSocket handshake failed: {}", e))?;

        let ws = Arc::new(Mutex::new(websocket));
        let shutdown_flag = Arc::new(AtomicBool::new(false));

        let (event_tx, event_rx) = crate::watcher::create_event_channel();
        let watch_manager = Arc::new(Mutex::new(WatchManager::new(
            event_tx.clone(),
            self.debounce_ms,
        )));

        let ws_sender = Arc::clone(&ws);
        let shutdown_sender = Arc::clone(&shutdown_flag);
        let sender_handle = thread::spawn(move || {
            event_sender_loop(ws_sender, event_rx, shutdown_sender);
        });

        let ws_reader = Arc::clone(&ws);
        let shutdown_reader = Arc::clone(&shutdown_flag);
        let manager = Arc::clone(&watch_manager);
        command_reader_loop(ws_reader, manager, event_tx, shutdown_reader);

        {
            let mut manager = watch_manager.lock().unwrap();
            manager.shutdown();
        }

        let _ = sender_handle.join();

        Ok(())
    }
}

fn command_reader_loop(
    ws: Arc<Mutex<WebSocket<TcpStream>>>,
    watch_manager: Arc<Mutex<WatchManager>>,
    event_tx: Sender<Event>,
    shutdown_flag: Arc<AtomicBool>,
) {
    loop {
        if shutdown_flag.load(Ordering::Relaxed) {
            break;
        }

        let msg = {
            let mut ws_guard = match ws.lock() {
                Ok(guard) => guard,
                Err(e) => {
                    error!("Failed to lock WebSocket for reading: {}", e);
                    break;
                }
            };

            match ws_guard.read() {
                Ok(msg) => msg,
                Err(tungstenite::Error::ConnectionClosed) => {
                    info!("Connection closed by client");
                    break;
                }
                Err(tungstenite::Error::AlreadyClosed) => {
                    info!("Connection already closed");
                    break;
                }
                Err(e) => {
                    error!("Error reading from WebSocket: {}", e);
                    break;
                }
            }
        };

        match msg {
            Message::Text(text) => {
                debug!("Received: {}", text);
                handle_command(&text, &watch_manager, &event_tx, &shutdown_flag);
            }
            Message::Close(_) => {
                info!("Received close frame");
                shutdown_flag.store(true, Ordering::Relaxed);
                break;
            }
            Message::Ping(data) => {
                if let Ok(mut ws_guard) = ws.lock() {
                    let _ = ws_guard.send(Message::Pong(data));
                }
            }
            _ => {}
        }
    }

    shutdown_flag.store(true, Ordering::Relaxed);
}

fn handle_command(
    text: &str,
    watch_manager: &Arc<Mutex<WatchManager>>,
    event_tx: &Sender<Event>,
    shutdown_flag: &Arc<AtomicBool>,
) {
    let command: Command = match serde_json::from_str(text) {
        Ok(cmd) => cmd,
        Err(e) => {
            warn!("Failed to parse command: {} - {}", text, e);
            let _ = event_tx.send(Event::Error {
                message: format!("Invalid command: {}", e),
                watch_id: None,
            });
            return;
        }
    };

    match command {
        Command::AddWatch { path, id } => {
            let mut manager = watch_manager.lock().unwrap();
            if let Err(e) = manager.add_watch(id.clone(), path) {
                let _ = event_tx.send(Event::Error {
                    message: e,
                    watch_id: Some(id),
                });
            }
        }
        Command::RemoveWatch { id } => {
            let mut manager = watch_manager.lock().unwrap();
            if let Err(e) = manager.remove_watch(&id) {
                let _ = event_tx.send(Event::Error {
                    message: e,
                    watch_id: Some(id),
                });
            }
        }
        Command::ListWatches => {
            let manager = watch_manager.lock().unwrap();
            let watches = manager.list_watches();
            let _ = event_tx.send(Event::WatchList { watches });
        }
        Command::Shutdown => {
            info!("Received shutdown command");
            shutdown_flag.store(true, Ordering::Relaxed);
        }
    }
}

fn event_sender_loop(
    ws: Arc<Mutex<WebSocket<TcpStream>>>,
    event_rx: Receiver<Event>,
    shutdown_flag: Arc<AtomicBool>,
) {
    loop {
        if shutdown_flag.load(Ordering::Relaxed) {
            break;
        }

        match event_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => {
                let json = match serde_json::to_string(&event) {
                    Ok(j) => j,
                    Err(e) => {
                        error!("Failed to serialize event: {}", e);
                        continue;
                    }
                };

                debug!("Sending: {}", json);

                let mut ws_guard = match ws.lock() {
                    Ok(guard) => guard,
                    Err(e) => {
                        error!("Failed to lock WebSocket for writing: {}", e);
                        break;
                    }
                };

                if let Err(e) = ws_guard.send(Message::Text(json.into())) {
                    if !matches!(
                        e,
                        tungstenite::Error::ConnectionClosed | tungstenite::Error::AlreadyClosed
                    ) {
                        error!("Failed to send event: {}", e);
                    }
                    break;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                info!("Event channel disconnected");
                break;
            }
        }
    }
}
