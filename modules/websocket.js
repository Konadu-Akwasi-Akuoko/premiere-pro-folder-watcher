class WebSocketClient {
    constructor(port = 9847) {
        this.port = port;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.handlers = {
            onOpen: null,
            onClose: null,
            onError: null,
            onMessage: null,
            onStatusChange: null,
        };
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.updateStatus("connecting");

        const url = `ws://127.0.0.1:${this.port}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("WebSocket connected");
            this.reconnectAttempts = 0;
            this.updateStatus("connected");
            if (this.handlers.onOpen) {
                this.handlers.onOpen();
            }
        };

        this.ws.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason);
            this.updateStatus("disconnected");
            if (this.handlers.onClose) {
                this.handlers.onClose(event);
            }
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (this.handlers.onError) {
                this.handlers.onError(error);
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (this.handlers.onMessage) {
                    this.handlers.onMessage(data);
                }
            } catch (e) {
                console.error("Failed to parse message:", e);
            }
        };
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log("Max reconnect attempts reached");
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                this.connect();
            }
        }, delay);
    }

    updateStatus(status) {
        if (this.handlers.onStatusChange) {
            this.handlers.onStatusChange(status);
        }
    }

    send(command) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket not connected");
            return false;
        }

        const message = JSON.stringify(command);
        this.ws.send(message);
        return true;
    }

    addWatch(path, id) {
        return this.send({
            cmd: "ADD_WATCH",
            path: path,
            id: id,
        });
    }

    removeWatch(id) {
        return this.send({
            cmd: "REMOVE_WATCH",
            id: id,
        });
    }

    listWatches() {
        return this.send({
            cmd: "LIST_WATCHES",
        });
    }

    shutdown() {
        return this.send({
            cmd: "SHUTDOWN",
        });
    }

    disconnect() {
        this.maxReconnectAttempts = 0;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    onOpen(handler) {
        this.handlers.onOpen = handler;
    }

    onClose(handler) {
        this.handlers.onClose = handler;
    }

    onError(handler) {
        this.handlers.onError = handler;
    }

    onMessage(handler) {
        this.handlers.onMessage = handler;
    }

    onStatusChange(handler) {
        this.handlers.onStatusChange = handler;
    }
}

window.WebSocketClient = WebSocketClient;
