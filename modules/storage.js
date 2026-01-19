const { storage } = require("uxp");
const { localFileSystem } = storage;

const CONFIG_FILE = "folder-watcher-config.json";

class StorageManager {
    constructor() {
        this.config = {
            watches: [],
            settings: {
                port: 9847,
                debounceMs: 500,
            },
        };
        this.dataFolder = null;
    }

    async init() {
        try {
            this.dataFolder = await localFileSystem.getDataFolder();
            await this.load();
        } catch (error) {
            console.error("Failed to initialize storage:", error);
        }
    }

    async load() {
        if (!this.dataFolder) {
            return;
        }

        try {
            const entries = await this.dataFolder.getEntries();
            const configEntry = entries.find((e) => e.name === CONFIG_FILE);

            if (configEntry) {
                const content = await configEntry.read();
                const parsed = JSON.parse(content);
                this.config = { ...this.config, ...parsed };
                console.log("Configuration loaded");
            }
        } catch (error) {
            console.log("No existing configuration found, using defaults");
        }
    }

    async save() {
        if (!this.dataFolder) {
            console.error("Data folder not initialized");
            return;
        }

        try {
            const file = await this.dataFolder.createFile(CONFIG_FILE, {
                overwrite: true,
            });
            await file.write(JSON.stringify(this.config, null, 2));
            console.log("Configuration saved");
        } catch (error) {
            console.error("Failed to save configuration:", error);
        }
    }

    getWatches() {
        return this.config.watches;
    }

    addWatch(id, path, name) {
        const existingIndex = this.config.watches.findIndex((w) => w.id === id);
        const watch = { id, path, name };

        if (existingIndex >= 0) {
            this.config.watches[existingIndex] = watch;
        } else {
            this.config.watches.push(watch);
        }

        this.save();
        return watch;
    }

    removeWatch(id) {
        const index = this.config.watches.findIndex((w) => w.id === id);
        if (index >= 0) {
            this.config.watches.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    getSettings() {
        return this.config.settings;
    }

    updateSettings(settings) {
        this.config.settings = { ...this.config.settings, ...settings };
        this.save();
    }
}

window.StorageManager = StorageManager;
