const { app } = require("premierepro");

const BIN_TYPE = 2;

const watchBins = new Map();

async function ensureBinExists(relativePath, watchId) {
    if (!relativePath) {
        return getOrCreateWatchBin(watchId);
    }

    const watchBin = await getOrCreateWatchBin(watchId);
    const parts = relativePath.split(/[/\\]/).filter((p) => p.length > 0);

    if (parts.length === 0) {
        return watchBin;
    }

    const fileName = parts.pop();

    let parent = watchBin;
    for (const name of parts) {
        const found = findBinByName(parent, name);
        if (found) {
            parent = found;
        } else {
            parent = await parent.createBin(name);
        }
    }

    return parent;
}

async function getOrCreateWatchBin(watchId) {
    if (watchBins.has(watchId)) {
        const cachedBin = watchBins.get(watchId);
        const root = app.project.rootItem;
        for (let i = 0; i < root.children.length; i++) {
            const child = root.children[i];
            if (child.nodeId === cachedBin.nodeId) {
                return cachedBin;
            }
        }
        watchBins.delete(watchId);
    }

    const root = app.project.rootItem;
    let watchBin = findBinByName(root, watchId);

    if (!watchBin) {
        watchBin = await root.createBin(watchId);
    }

    watchBins.set(watchId, watchBin);
    return watchBin;
}

function findBinByName(parent, name) {
    if (!parent || !parent.children) {
        return null;
    }

    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (child.type === BIN_TYPE && child.name === name) {
            return child;
        }
    }
    return null;
}

async function importFileToBin(filePath, relativePath, watchId) {
    const targetBin = await ensureBinExists(relativePath, watchId);

    const existingItem = findItemByPath(targetBin, filePath);
    if (existingItem) {
        console.log(`File already imported: ${filePath}`);
        return existingItem;
    }

    const suppressUI = true;
    const importAsStills = false;

    const result = await app.project.importFiles(
        [filePath],
        suppressUI,
        targetBin,
        importAsStills
    );

    return result;
}

function findItemByPath(bin, filePath) {
    if (!bin || !bin.children) {
        return null;
    }

    for (let i = 0; i < bin.children.length; i++) {
        const child = bin.children[i];
        if (child.type !== BIN_TYPE) {
            const mediaPath = child.getMediaPath ? child.getMediaPath() : null;
            if (mediaPath && normalizePath(mediaPath) === normalizePath(filePath)) {
                return child;
            }
        }
    }
    return null;
}

function normalizePath(path) {
    return path.replace(/\\/g, "/").toLowerCase();
}

async function selectFolder() {
    const { localFileSystem } = require("uxp").storage;
    const folder = await localFileSystem.getFolder();
    return folder ? folder.nativePath : null;
}

function clearWatchBinCache(watchId) {
    if (watchId) {
        watchBins.delete(watchId);
    } else {
        watchBins.clear();
    }
}

function hasOpenProject() {
    return app.project && app.project.rootItem;
}

window.PremiereAPI = {
    ensureBinExists,
    importFileToBin,
    selectFolder,
    clearWatchBinCache,
    hasOpenProject,
};
