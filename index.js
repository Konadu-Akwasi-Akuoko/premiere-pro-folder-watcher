const PORT = 9847;
const DEBOUNCE_MS = 500;

let binaryManager = null;
let wsClient = null;
let storageManager = null;
let watches = new Map();

const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const watchList = document.getElementById("watchList");
const emptyState = document.getElementById("emptyState");
const addWatchBtn = document.getElementById("addWatchBtn");
const logContainer = document.getElementById("logContainer");
const clearLogBtn = document.getElementById("clearLogBtn");

document.addEventListener("DOMContentLoaded", init);

async function init() {
    storageManager = new StorageManager();
    await storageManager.init();

    const settings = storageManager.getSettings();

    binaryManager = new BinaryManager(settings.port || PORT, settings.debounceMs || DEBOUNCE_MS);

    wsClient = new WebSocketClient(settings.port || PORT);
    setupWebSocketHandlers();

    addWatchBtn.addEventListener("click", handleAddWatch);
    clearLogBtn.addEventListener("click", clearLog);

    await startSystem();
}

async function startSystem() {
    addLog("info", "Starting folder watcher system...");

    const started = await binaryManager.start();
    if (!started) {
        addLog("error", "Failed to start watcher binary");
        return;
    }

    await delay(500);

    wsClient.connect();
}

function setupWebSocketHandlers() {
    wsClient.onStatusChange((status) => {
        updateStatus(status);
    });

    wsClient.onOpen(() => {
        addLog("info", "Connected to watcher");
        restoreSavedWatches();
    });

    wsClient.onClose(() => {
        addLog("info", "Disconnected from watcher");
    });

    wsClient.onError((error) => {
        addLog("error", "Connection error: " + (error.message || "Unknown error"));
    });

    wsClient.onMessage((event) => {
        handleEvent(event);
    });
}

function handleEvent(event) {
    switch (event.event) {
        case "FILE_ADDED":
            handleFileAdded(event);
            break;
        case "DIR_ADDED":
            handleDirAdded(event);
            break;
        case "FILE_REMOVED":
            handleFileRemoved(event);
            break;
        case "DIR_REMOVED":
            handleDirRemoved(event);
            break;
        case "READY":
            handleReady(event);
            break;
        case "WATCH_LIST":
            handleWatchList(event);
            break;
        case "ERROR":
            handleError(event);
            break;
        default:
            console.log("Unknown event:", event);
    }
}

async function handleFileAdded(event) {
    const { watch_id, path, relative } = event;
    addLog("file", "Importing: " + relative);

    if (!PremiereAPI.hasOpenProject()) {
        addLog("error", "No project open");
        return;
    }

    try {
        await PremiereAPI.importFileToBin(path, relative, watch_id);
        addLog("file", "Imported: " + relative);
    } catch (error) {
        addLog("error", "Failed to import " + relative + ": " + error.message);
    }
}

async function handleDirAdded(event) {
    const { watch_id, relative } = event;
    if (relative) {
        addLog("dir", "Directory: " + relative);

        if (PremiereAPI.hasOpenProject()) {
            try {
                await PremiereAPI.ensureBinExists(relative + "/", watch_id);
            } catch (error) {
                console.error("Failed to create bin:", error);
            }
        }
    }
}

function handleFileRemoved(event) {
    const { relative } = event;
    addLog("info", "File removed: " + relative);
}

function handleDirRemoved(event) {
    const { relative } = event;
    addLog("info", "Directory removed: " + relative);
}

function handleReady(event) {
    const { watch_id } = event;
    addLog("info", "Watch ready: " + watch_id);
}

function handleWatchList(event) {
    const { watches: watchInfoList } = event;
    console.log("Current watches:", watchInfoList);
}

function handleError(event) {
    const { message, watch_id } = event;
    const prefix = watch_id ? "[" + watch_id + "] " : "";
    addLog("error", prefix + message);
}

async function handleAddWatch() {
    if (!wsClient.isConnected()) {
        addLog("error", "Not connected to watcher");
        return;
    }

    const folderPath = await PremiereAPI.selectFolder();
    if (!folderPath) {
        return;
    }

    const watchId = generateWatchId(folderPath);
    const watchName = getLastPathSegment(folderPath);

    if (watches.has(watchId)) {
        addLog("error", "Already watching: " + watchName);
        return;
    }

    addLog("info", "Adding watch: " + watchName);

    const sent = wsClient.addWatch(folderPath, watchId);
    if (sent) {
        const watchData = {
            id: watchId,
            path: folderPath,
            name: watchName,
        };
        watches.set(watchId, watchData);
        storageManager.addWatch(watchId, folderPath, watchName);
        renderWatchList();
    }
}

function removeWatch(watchId) {
    const watch = watches.get(watchId);
    if (!watch) {
        return;
    }

    wsClient.removeWatch(watchId);
    watches.delete(watchId);
    storageManager.removeWatch(watchId);
    PremiereAPI.clearWatchBinCache(watchId);
    renderWatchList();

    addLog("info", "Removed watch: " + watch.name);
}

function restoreSavedWatches() {
    const savedWatches = storageManager.getWatches();

    for (const watch of savedWatches) {
        if (!watches.has(watch.id)) {
            wsClient.addWatch(watch.path, watch.id);
            watches.set(watch.id, watch);
        }
    }

    renderWatchList();
}

function renderWatchList() {
    while (watchList.firstChild) {
        watchList.removeChild(watchList.firstChild);
    }

    if (watches.size === 0) {
        watchList.appendChild(createEmptyState());
        return;
    }

    for (const [id, watch] of watches) {
        const item = createWatchItem(watch);
        watchList.appendChild(item);
    }
}

function createEmptyState() {
    const div = document.createElement("div");
    div.className = "empty-state";

    const p1 = document.createElement("p");
    p1.textContent = "No folders being watched";
    div.appendChild(p1);

    const p2 = document.createElement("p");
    p2.className = "hint";
    p2.textContent = 'Click "Add Folder" to start watching a directory';
    div.appendChild(p2);

    return div;
}

function createWatchItem(watch) {
    const item = document.createElement("div");
    item.className = "watch-item";

    const infoDiv = document.createElement("div");
    infoDiv.className = "watch-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "watch-name";
    nameSpan.textContent = watch.name;
    infoDiv.appendChild(nameSpan);

    const pathSpan = document.createElement("span");
    pathSpan.className = "watch-path";
    pathSpan.textContent = watch.path;
    infoDiv.appendChild(pathSpan);

    item.appendChild(infoDiv);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-secondary btn-small btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeWatch(watch.id));
    item.appendChild(removeBtn);

    return item;
}

function updateStatus(status) {
    statusIndicator.className = "status-indicator";
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    if (status === "connected") {
        statusIndicator.classList.add("connected");
    } else if (status === "connecting") {
        statusIndicator.classList.add("connecting");
    }
}

function addLog(type, message) {
    const logEmpty = logContainer.querySelector(".log-empty");
    if (logEmpty) {
        logEmpty.remove();
    }

    const entry = document.createElement("div");
    entry.className = "log-entry";

    const time = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const typeLabel = type.toUpperCase().padEnd(5);

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = time;
    entry.appendChild(timeSpan);

    const typeSpan = document.createElement("span");
    typeSpan.className = "log-type " + type;
    typeSpan.textContent = typeLabel;
    entry.appendChild(typeSpan);

    const msgSpan = document.createElement("span");
    msgSpan.className = "log-message";
    msgSpan.textContent = message;
    entry.appendChild(msgSpan);

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    const maxEntries = 100;
    while (logContainer.children.length > maxEntries) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

function clearLog() {
    while (logContainer.firstChild) {
        logContainer.removeChild(logContainer.firstChild);
    }
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "log-empty";
    emptyDiv.textContent = "No activity yet";
    logContainer.appendChild(emptyDiv);
}

function generateWatchId(path) {
    const name = getLastPathSegment(path);
    const hash = simpleHash(path);
    return name + "-" + hash;
}

function getLastPathSegment(path) {
    return path.split(/[/\\]/).filter((p) => p).pop() || "root";
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 6);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

window.addEventListener("unload", async () => {
    if (wsClient) {
        wsClient.shutdown();
        wsClient.disconnect();
    }

    if (binaryManager) {
        await binaryManager.stop();
    }
});
