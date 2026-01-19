# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Premiere Pro folder-watching plugin that mirrors filesystem directory structures into Premiere Pro bins and automatically imports new media files. Uses a Rust binary for efficient file system watching combined with a UXP (Unified Extensibility Platform) panel for Premiere Pro integration.

## Architecture

Two main components communicate via WebSocket (localhost:9847):

1. **Rust Binary** (`rust-watcher/`): File system watcher using `notify` crate, WebSocket server via `tungstenite`, JSON message protocol
2. **UXP Panel**: HTML/CSS/JS (ES6+) UI that spawns the Rust binary, communicates via WebSocket, and calls Premiere Pro APIs directly (no ExtendScript)

## Build Commands

### Rust Binary

```bash
# Development build
cargo build --manifest-path rust-watcher/Cargo.toml

# Release build (optimized for size)
cargo build --release --manifest-path rust-watcher/Cargo.toml

# Run tests
cargo test --manifest-path rust-watcher/Cargo.toml

# Run single test
cargo test --manifest-path rust-watcher/Cargo.toml test_name

# Cross-compile for Windows (requires mingw-w64)
cargo build --release --target x86_64-pc-windows-gnu --manifest-path rust-watcher/Cargo.toml

# macOS universal binary (run on Mac)
cargo build --release --target x86_64-apple-darwin --manifest-path rust-watcher/Cargo.toml
cargo build --release --target aarch64-apple-darwin --manifest-path rust-watcher/Cargo.toml
lipo -create target/x86_64-apple-darwin/release/folder-watcher target/aarch64-apple-darwin/release/folder-watcher -output bin/mac/folder-watcher
```

### Linting

```bash
cargo clippy --manifest-path rust-watcher/Cargo.toml -- -D warnings
cargo fmt --manifest-path rust-watcher/Cargo.toml --check
```

## Key Dependencies (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| `notify` | 8.2 | Cross-platform FS event notifications |
| `notify-debouncer-mini` | 0.7 | Debounce rapid file events |
| `tungstenite` | 0.28 | Sync WebSocket server |
| `serde` | 1.0 | Serialization framework |
| `serde_json` | 1.0 | JSON serialization |
| `clap` | 4.5 | CLI argument parsing |
| `log` | 0.4 | Logging facade |
| `env_logger` | 0.11 | Logger implementation |

## WebSocket Protocol

Commands (UXP to Rust):
- `{"cmd": "ADD_WATCH", "path": "/path/to/folder", "id": "watch-1"}`
- `{"cmd": "REMOVE_WATCH", "id": "watch-1"}`
- `{"cmd": "LIST_WATCHES"}`
- `{"cmd": "SHUTDOWN"}`

Events (Rust to UXP):
- `{"event": "FILE_ADDED", "watch_id": "watch-1", "path": "/full/path", "relative": "subfolder/file.mp4"}`
- `{"event": "DIR_ADDED", "watch_id": "watch-1", "path": "/full/path", "relative": "subfolder"}`
- `{"event": "READY", "watch_id": "watch-1"}`
- `{"event": "ERROR", "message": "...", "watch_id": "watch-1"}`

## Media File Extensions

Filter imports by these extensions:
- **Video**: mp4, mov, avi, mkv, wmv, flv, webm, m4v, mpg, mpeg, mxf, r3d, braw, ari
- **Audio**: mp3, wav, aac, flac, ogg, m4a, aiff, aif, wma
- **Image**: jpg, jpeg, png, gif, bmp, tiff, tif, psd, ai, eps, webp, exr, dpx, tga
- **Project**: prproj, mogrt, xml, aaf, edl

## Binary Size Optimization

Release profile settings for minimal binary size:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

## UXP Plugin Notes

- Requires Premiere Pro v25.6+ and UXP Developer Tool v2.2.1+
- Enable Developer Mode: Settings > Plugins > Enable developer mode
- Manifest version 5 (`manifest.json`)
- Direct Premiere Pro API access via `require('premierepro')`
- No ExtendScript bridge needed - APIs are async but properties feel synchronous
- Spawn Rust binary via `require('uxp').shell.spawn()`
- File picker via `require('uxp').storage.localFileSystem.getFolder()`

## Key UXP APIs

```javascript
const { app } = require('premierepro');

// Import files
await app.project.importFiles([filePath], suppressUI, targetBin, importAsStills);

// Create bin
const newBin = await parentBin.createBin(name);

// Access project root
const root = app.project.rootItem;
```

## Development Setup

1. Install UXP Developer Tool (UDT) v2.2.1+
2. Enable Premiere Pro Developer Mode
3. Load plugin via UDT pointing to `manifest.json`
4. Use "Load & Watch" for hot reload during development
