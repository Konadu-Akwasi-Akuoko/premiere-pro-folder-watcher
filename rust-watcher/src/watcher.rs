use crate::filter::{is_hidden, is_media_file};
use crate::protocol::{Event, WatchInfo};
use log::{debug, error, info, warn};
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind, Debouncer};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::Duration;

pub struct WatchEntry {
    pub id: String,
    pub path: PathBuf,
    pub debouncer: Debouncer<RecommendedWatcher>,
}

pub struct WatchManager {
    watches: HashMap<String, WatchEntry>,
    event_tx: Sender<Event>,
    debounce_duration: Duration,
}

impl WatchManager {
    pub fn new(event_tx: Sender<Event>, debounce_ms: u64) -> Self {
        Self {
            watches: HashMap::new(),
            event_tx,
            debounce_duration: Duration::from_millis(debounce_ms),
        }
    }

    pub fn add_watch(&mut self, id: String, path: String) -> Result<(), String> {
        if self.watches.contains_key(&id) {
            return Err(format!("Watch with id '{}' already exists", id));
        }

        let watch_path = PathBuf::from(&path);
        if !watch_path.exists() {
            return Err(format!("Path does not exist: {}", path));
        }
        if !watch_path.is_dir() {
            return Err(format!("Path is not a directory: {}", path));
        }

        let watch_id = id.clone();
        let base_path = watch_path.clone();
        let tx = self.event_tx.clone();

        let debouncer = new_debouncer(self.debounce_duration, move |res| {
            handle_debounced_events(res, &watch_id, &base_path, &tx);
        })
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

        let mut entry = WatchEntry {
            id: id.clone(),
            path: watch_path.clone(),
            debouncer,
        };

        entry
            .debouncer
            .watcher()
            .watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching: {}", e))?;

        info!("Started watching '{}' with id '{}'", path, id);
        self.watches.insert(id.clone(), entry);

        if let Err(e) = self.event_tx.send(Event::Ready {
            watch_id: id.clone(),
        }) {
            warn!("Failed to send READY event: {}", e);
        }

        self.scan_existing_files(&id, &watch_path);

        Ok(())
    }

    fn scan_existing_files(&self, watch_id: &str, base_path: &Path) {
        info!("Scanning existing files in '{}'", base_path.display());

        if let Err(e) = self.scan_directory_recursive(watch_id, base_path, base_path) {
            error!("Error scanning directory: {}", e);
        }
    }

    fn scan_directory_recursive(
        &self,
        watch_id: &str,
        base_path: &Path,
        current_path: &Path,
    ) -> Result<(), std::io::Error> {
        for entry in std::fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();

            if is_hidden(&path) {
                continue;
            }

            let relative = path
                .strip_prefix(base_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            if path.is_dir() {
                if let Err(e) = self.event_tx.send(Event::DirAdded {
                    watch_id: watch_id.to_string(),
                    path: path.to_string_lossy().to_string(),
                    relative: relative.clone(),
                }) {
                    warn!("Failed to send DIR_ADDED event: {}", e);
                }
                self.scan_directory_recursive(watch_id, base_path, &path)?;
            } else if is_media_file(&path) {
                if let Err(e) = self.event_tx.send(Event::FileAdded {
                    watch_id: watch_id.to_string(),
                    path: path.to_string_lossy().to_string(),
                    relative,
                }) {
                    warn!("Failed to send FILE_ADDED event: {}", e);
                }
            }
        }
        Ok(())
    }

    pub fn remove_watch(&mut self, id: &str) -> Result<(), String> {
        if let Some(entry) = self.watches.remove(id) {
            info!("Removed watch '{}'", id);
            drop(entry);
            Ok(())
        } else {
            Err(format!("Watch with id '{}' not found", id))
        }
    }

    pub fn list_watches(&self) -> Vec<WatchInfo> {
        self.watches
            .values()
            .map(|entry| WatchInfo {
                id: entry.id.clone(),
                path: entry.path.to_string_lossy().to_string(),
            })
            .collect()
    }

    pub fn shutdown(&mut self) {
        info!("Shutting down watch manager");
        self.watches.clear();
    }
}

fn handle_debounced_events(
    res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>,
    watch_id: &str,
    base_path: &Path,
    tx: &Sender<Event>,
) {
    match res {
        Ok(events) => {
            for event in events {
                let path = &event.path;

                if is_hidden(path) {
                    continue;
                }

                let relative = path
                    .strip_prefix(base_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();

                let full_path = path.to_string_lossy().to_string();

                match event.kind {
                    DebouncedEventKind::Any => {
                        if path.exists() {
                            if path.is_dir() {
                                debug!("Directory added: {}", full_path);
                                if let Err(e) = tx.send(Event::DirAdded {
                                    watch_id: watch_id.to_string(),
                                    path: full_path,
                                    relative,
                                }) {
                                    warn!("Failed to send DIR_ADDED event: {}", e);
                                }
                            } else if is_media_file(path) {
                                debug!("File added: {}", full_path);
                                if let Err(e) = tx.send(Event::FileAdded {
                                    watch_id: watch_id.to_string(),
                                    path: full_path,
                                    relative,
                                }) {
                                    warn!("Failed to send FILE_ADDED event: {}", e);
                                }
                            }
                        } else if is_media_file(path) {
                            debug!("File removed: {}", full_path);
                            if let Err(e) = tx.send(Event::FileRemoved {
                                watch_id: watch_id.to_string(),
                                path: full_path,
                                relative,
                            }) {
                                warn!("Failed to send FILE_REMOVED event: {}", e);
                            }
                        } else {
                            debug!("Directory removed: {}", full_path);
                            if let Err(e) = tx.send(Event::DirRemoved {
                                watch_id: watch_id.to_string(),
                                path: full_path,
                                relative,
                            }) {
                                warn!("Failed to send DIR_REMOVED event: {}", e);
                            }
                        }
                    }
                    DebouncedEventKind::AnyContinuous => {}
                    _ => {}
                }
            }
        }
        Err(e) => {
            error!("Watch error: {:?}", e);
            if let Err(send_err) = tx.send(Event::Error {
                message: format!("Watch error: {}", e),
                watch_id: Some(watch_id.to_string()),
            }) {
                error!("Failed to send error event: {}", send_err);
            }
        }
    }
}

pub fn create_event_channel() -> (Sender<Event>, Receiver<Event>) {
    mpsc::channel()
}
