# Premiere Pro Folder Watch Plugin - Implementation Plan

## Overview

Build a lightweight folder-watching plugin for Adobe Premiere Pro 25.6+ that mirrors filesystem directory structures into Premiere Pro bins and automatically imports new media files. The architecture uses a Rust binary for efficient file system watching combined with a UXP (Unified Extensibility Platform) panel for Premiere Pro integration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Premiere Pro 25.6+                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UXP Panel (UI)                         │  │
│  │  - HTML/CSS/JS interface (ES6+, Spectrum UI)              │  │
│  │  - Spawns Rust binary via UXP shell API                   │  │
│  │  - Receives file events via WebSocket                     │  │
│  │  - Direct access to Premiere Pro APIs (no ExtendScript)   │  │
│  │  - app.project.importFiles() / rootItem.createBin()       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │ WebSocket (localhost:9847)
                               │
┌─────────────────────────────────────────────────────────────────┐
│                 Rust Binary (folder-watcher)                    │
│  - Uses `notify` crate for cross-platform FS events             │
│  - Runs WebSocket server via `tungstenite`                      │
│  - Debounces events with `notify-debouncer-mini`                │
│  - Sends JSON messages: {type, path, relative_path}             │
│  - ~2-5 MB binary size (release build)                          │
│  - ~1-3 MB RAM usage while watching                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Rust Binary (`folder-watcher`)

**Purpose**: Efficient, cross-platform file system watching with minimal resource usage.

**Crates**:
| Crate | Version | Purpose |
|-------|---------|---------|
| `notify` | 8.2 | Cross-platform FS event notifications (inotify/FSEvents/ReadDirectoryChangesW) |
| `notify-debouncer-mini` | 0.7 | Debounce rapid file events |
| `tungstenite` | 0.28 | Lightweight WebSocket server (sync, no tokio needed) |
| `serde` | 1.0 | JSON serialization |
| `serde_json` | 1.0 | JSON encoding/decoding |
| `clap` | 4.5 | CLI argument parsing |
| `log` | 0.4 | Logging facade |
| `env_logger` | 0.11 | Logger implementation |

**Features**:
- Accept commands via WebSocket: `ADD_WATCH`, `REMOVE_WATCH`, `LIST_WATCHES`, `SHUTDOWN`
- Send events via WebSocket: `FILE_ADDED`, `DIR_ADDED`, `FILE_REMOVED`, `DIR_REMOVED`, `ERROR`
- Recursive watching with configurable depth
- Filter by file extension (media files only)
- Ignore hidden files/folders (configurable)
- Debounce window: 500ms-2000ms (configurable)
- Graceful shutdown on WebSocket disconnect or SIGTERM

**Message Protocol** (JSON):
```json
// Commands (UXP → Rust)
{"cmd": "ADD_WATCH", "path": "/path/to/folder", "id": "watch-1"}
{"cmd": "REMOVE_WATCH", "id": "watch-1"}
{"cmd": "LIST_WATCHES"}
{"cmd": "SHUTDOWN"}

// Events (Rust → UXP)
{"event": "FILE_ADDED", "watch_id": "watch-1", "path": "/full/path/to/file.mp4", "relative": "subfolder/file.mp4"}
{"event": "DIR_ADDED", "watch_id": "watch-1", "path": "/full/path/to/subfolder", "relative": "subfolder"}
{"event": "READY", "watch_id": "watch-1"}
{"event": "ERROR", "message": "Permission denied", "watch_id": "watch-1"}
```

**Binary Size Optimization**:
```toml
[profile.release]
opt-level = "z"      # Optimize for size
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit
panic = "abort"      # No unwinding
strip = true         # Strip symbols
```

---

### 2. UXP Panel

**Purpose**: User interface and bridge between Rust watcher and Premiere Pro.

**Files**:
```
manifest.json         # UXP plugin manifest (v5)
index.html            # Panel UI
index.js              # Main logic: WebSocket client, spawn binary, Premiere API calls
styles.css            # Spectrum-compatible dark theme
icons/
  icon.png            # Plugin icon
```

**Key Responsibilities**:

1. **Spawn Rust Binary**
   ```javascript
   const { shell } = require('uxp');
   const process = await shell.spawn(binaryPath, ['--port', '9847']);
   ```

2. **WebSocket Communication**
   ```javascript
   const ws = new WebSocket('ws://127.0.0.1:9847');
   ws.onmessage = (event) => handleWatcherEvent(JSON.parse(event.data));
   ```

3. **Direct Premiere Pro API Calls** (no ExtendScript bridge needed)
   ```javascript
   const { app } = require('premierepro');

   // Import files directly
   await app.project.importFiles([filePath], true, targetBin, false);

   // Create bins
   const newBin = await parentBin.createBin(binName);
   ```

4. **Lifecycle Management**
   - Start watcher on panel open
   - Stop watcher on panel close / PPro quit
   - Persist watch configurations via UXP file storage

---

### 3. UXP Premiere Pro API Usage

**Purpose**: Direct Premiere Pro automation via UXP APIs (replaces ExtendScript).

**Key Differences from ExtendScript**:
- Modern JavaScript (ES6+)
- Async operations (though properties feel synchronous)
- Direct API access without eval bridge
- Better performance and lower memory footprint

**Functions**:

```javascript
const { app } = require('premierepro');

// Open folder picker dialog
async function selectFolder() {
    const { localFileSystem } = require('uxp').storage;
    const folder = await localFileSystem.getFolder();
    return folder ? folder.nativePath : null;
}

// Create bin hierarchy from path like "RootBin/Sub1/Sub2"
async function ensureBinExists(binPath) {
    const parts = binPath.split('/');
    let parent = app.project.rootItem;

    for (const name of parts) {
        let found = findBinByName(parent, name);
        if (!found) {
            found = await parent.createBin(name);
        }
        parent = found;
    }
    return parent;
}

// Find bin by name within parent
function findBinByName(parent, name) {
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (child.type === 2 && child.name === name) { // type 2 = BIN
            return child;
        }
    }
    return null;
}

// Import file into specific bin
async function importFileToBin(filePath, binPath) {
    const targetBin = await ensureBinExists(binPath);
    const result = await app.project.importFiles([filePath], true, targetBin, false);
    return result;
}
```

---

## Cross-Compilation Strategy

The Rust binary must be compiled for both Windows and macOS.

### Target Triples
| Platform | Target Triple | Notes |
|----------|---------------|-------|
| Windows x64 | `x86_64-pc-windows-gnu` | Use MinGW toolchain |
| macOS x64 (Intel) | `x86_64-apple-darwin` | Requires osxcross or native Mac |
| macOS ARM64 (Apple Silicon) | `aarch64-apple-darwin` | Requires osxcross or native Mac |

### Option A: Native Compilation (Recommended for macOS)
- Build Windows binary on any platform with MinGW
- Build macOS binaries on a Mac (easiest, avoids osxcross complexity)

### Option B: Cross-Compile Everything from Linux
- Windows: `cargo build --target x86_64-pc-windows-gnu` (needs `mingw-w64`)
- macOS: Use `cross` tool with Docker + osxcross images (complex, requires Xcode SDK)

### Build Script (build.sh)
```bash
#!/bin/bash
# Windows
cargo build --release --target x86_64-pc-windows-gnu

# macOS (run on Mac)
cargo build --release --target x86_64-apple-darwin
cargo build --release --target aarch64-apple-darwin

# Universal macOS binary
lipo -create \
  target/x86_64-apple-darwin/release/folder-watcher \
  target/aarch64-apple-darwin/release/folder-watcher \
  -output target/folder-watcher-macos
```

---

## File Structure

```
premiere-folder-watch/
├── manifest.json           # UXP plugin manifest (v5)
├── index.html              # Panel UI
├── index.js                # Main logic: WebSocket, Premiere API, UI
├── styles.css              # Spectrum-compatible styles
├── icons/
│   ├── icon.png            # Plugin icon (various sizes)
│   └── icon@2x.png
├── bin/
│   ├── win/
│   │   └── folder-watcher.exe
│   └── mac/
│       └── folder-watcher
├── rust-watcher/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── src/
│       └── main.rs
├── package.json            # npm for build tooling (optional)
├── PLAN.md
├── CLAUDE.md
└── README.md
```

---

## UXP Manifest (manifest.json)

```json
{
    "manifestVersion": 5,
    "id": "com.yourcompany.folder-watcher",
    "name": "Folder Watcher",
    "version": "1.0.0",
    "main": "index.html",
    "host": {
        "app": "PProHeadless",
        "minVersion": "25.6"
    },
    "entrypoints": [
        {
            "type": "panel",
            "id": "folderWatcherPanel",
            "label": {
                "default": "Folder Watcher"
            },
            "icons": [
                { "width": 24, "height": 24, "path": "icons/icon.png" }
            ],
            "minimumSize": { "width": 300, "height": 400 }
        }
    ],
    "requiredPermissions": {
        "localFileSystem": "fullAccess",
        "network": {
            "domains": ["ws://127.0.0.1"]
        },
        "launchProcess": {
            "schemes": ["file"],
            "extensions": ["exe", ""]
        }
    }
}
```

---

## Implementation Steps

### Phase 1: Rust Binary
1. [ ] Set up Cargo project with dependencies
2. [ ] Implement file watcher with `notify` crate
3. [ ] Add debouncing with `notify-debouncer-mini`
4. [ ] Implement WebSocket server with `tungstenite`
5. [ ] Define JSON message protocol
6. [ ] Add CLI argument parsing (port, log level)
7. [ ] Implement media file filtering
8. [ ] Test on Windows and macOS
9. [ ] Optimize binary size

### Phase 2: UXP Panel
1. [ ] Create manifest.json for Premiere Pro 25.6+
2. [ ] Build HTML/CSS UI (Spectrum-compatible dark theme)
3. [ ] Implement WebSocket client in JavaScript
4. [ ] Add shell.spawn logic for Rust binary
5. [ ] Implement configuration persistence (UXP file storage)
6. [ ] Handle panel lifecycle (open/close/quit)
7. [ ] Add activity logging UI

### Phase 3: Premiere Pro API Integration
1. [ ] Implement folder picker via UXP localFileSystem
2. [ ] Implement bin creation/navigation via app.project API
3. [ ] Implement file import function
4. [ ] Handle edge cases (duplicate files, missing permissions)
5. [ ] Test with various media formats

### Phase 4: Cross-Platform Build
1. [ ] Set up Windows cross-compilation (MinGW)
2. [ ] Set up macOS builds (native or osxcross)
3. [ ] Create universal macOS binary
4. [ ] Test on both platforms
5. [ ] Create build/package scripts

### Phase 5: Packaging & Distribution
1. [ ] Package plugin with UXP Developer Tool
2. [ ] Test installation via UDT
3. [ ] Submit to Adobe Marketplace (optional)
4. [ ] Write installation instructions
5. [ ] Create README with usage guide

---

## Supported Media Formats

The watcher will filter for Premiere Pro compatible formats:

**Video**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.wmv`, `.flv`, `.webm`, `.m4v`, `.mpg`, `.mpeg`, `.mxf`, `.r3d`, `.braw`, `.ari`

**Audio**: `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.aiff`, `.aif`, `.wma`

**Image**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.tif`, `.psd`, `.ai`, `.eps`, `.webp`, `.exr`, `.dpx`, `.tga`

**Project**: `.prproj`, `.mogrt`, `.xml`, `.aaf`, `.edl`

---

## UXP vs CEP Comparison

| Metric | CEP (Old) | UXP (Current) |
|--------|-----------|---------------|
| JS Engine | Chromium + Node.js | Adobe's lightweight engine |
| API Bridge | ExtendScript (sync, blocks UI) | Direct access (async) |
| Memory Usage | 30-50 MB | ~10-15 MB |
| Startup Time | 200-500ms | 50-100ms |
| UI Framework | Custom HTML/CSS | Spectrum design system |
| Future Support | CEP 12 is final version | Actively developed |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| macOS cross-compilation complexity | High | Build on native Mac or use GitHub Actions with macOS runner |
| WebSocket port conflicts | Medium | Use configurable port, fallback to random port |
| UXP shell.spawn limitations | Medium | Test binary spawning thoroughly; fallback to manual start if needed |
| Premiere Pro API gaps | Low | UXP API mirrors ExtendScript; importFiles/createBin are supported |
| Binary signing requirements | Low | Unsigned binaries work locally; sign for distribution |

---

## Testing Checklist

- [ ] Watch single folder, add file → imports correctly
- [ ] Watch nested folders, add file to subfolder → creates bin hierarchy
- [ ] Add non-media file → ignored
- [ ] Remove watch → stops watching
- [ ] Rapid file additions → debounced correctly
- [ ] Panel close → Rust process terminates
- [ ] Premiere Pro quit → Rust process terminates
- [ ] Panel reopen → restores previous watches
- [ ] Large folder (1000+ files) → handles without lag
- [ ] Windows: all features work
- [ ] macOS Intel: all features work
- [ ] macOS Apple Silicon: all features work

---

## Development Requirements

- **Premiere Pro**: v25.6 or later
- **UXP Developer Tool**: v2.2.1 or later
- **Premiere Pro Developer Mode**: Enable in Settings > Plugins > Enable developer mode

---

## References

- [Premiere Pro UXP Documentation](https://developer.adobe.com/premiere-pro/uxp/)
- [Premiere Pro UXP API Reference](https://developer.adobe.com/premiere-pro/uxp/ppro_reference/)
- [UXP Plugin Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples)
- [notify crate documentation](https://docs.rs/notify/latest/notify/)
- [tungstenite WebSocket library](https://github.com/snapview/tungstenite-rs)
- [Cross-compilation with cross](https://github.com/cross-rs/cross)
- [Rust release profile optimization](https://doc.rust-lang.org/cargo/reference/profiles.html)
