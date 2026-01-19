const { shell } = require("uxp");
const os = require("os");
const path = require("path");

class BinaryManager {
    constructor(port = 9847, debounceMs = 500) {
        this.port = port;
        this.debounceMs = debounceMs;
        this.process = null;
        this.pluginPath = this.getPluginPath();
    }

    getPluginPath() {
        const currentScript = document.currentScript;
        if (currentScript && currentScript.src) {
            const url = new URL(currentScript.src);
            return path.dirname(url.pathname);
        }
        return __dirname || ".";
    }

    getBinaryPath() {
        const platform = os.platform();
        let binaryName;
        let subdir;

        if (platform === "win32") {
            subdir = "win";
            binaryName = "folder-watcher.exe";
        } else if (platform === "darwin") {
            subdir = "mac";
            binaryName = "folder-watcher";
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        return path.join(this.pluginPath, "bin", subdir, binaryName);
    }

    async start() {
        if (this.process) {
            console.log("Binary already running");
            return true;
        }

        const binaryPath = this.getBinaryPath();
        console.log(`Starting binary: ${binaryPath}`);

        try {
            const args = ["--port", String(this.port), "--debounce-ms", String(this.debounceMs)];

            this.process = await shell.spawn(binaryPath, args);

            console.log("Binary started successfully");
            return true;
        } catch (error) {
            console.error("Failed to start binary:", error);
            this.process = null;
            return false;
        }
    }

    async stop() {
        if (!this.process) {
            return;
        }

        console.log("Stopping binary");

        try {
            this.process.kill();
        } catch (error) {
            console.error("Error stopping binary:", error);
        }

        this.process = null;
    }

    isRunning() {
        return this.process !== null;
    }
}

window.BinaryManager = BinaryManager;
