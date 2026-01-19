# Premiere Pro Folder Watcher

A UXP plugin for Adobe Premiere Pro that watches folders on your filesystem and automatically imports new media files into matching bin structures in your project.

## Features

- **Automatic folder watching** - Monitor any folder for new files
- **Bin mirroring** - Automatically creates bins that mirror your folder structure
- **Smart media filtering** - Only imports supported media formats (video, audio, images, project files)
- **Real-time imports** - New files are imported within seconds of being added
- **Multiple watch folders** - Watch as many folders as you need simultaneously
- **Persistent configuration** - Watch folders are remembered between sessions
- **Activity logging** - See what's happening in real-time through the panel
- **Cross-platform** - Works on macOS (Intel and Apple Silicon) and Windows

## Supported Media Formats

| Category | Extensions |
|----------|------------|
| **Video** | mp4, mov, avi, mkv, wmv, flv, webm, m4v, mpg, mpeg, mxf, r3d, braw, ari |
| **Audio** | mp3, wav, aac, flac, ogg, m4a, aiff, aif, wma |
| **Image** | jpg, jpeg, png, gif, bmp, tiff, tif, psd, ai, eps, webp, exr, dpx, tga, raw, cr2 |
| **Project** | prproj, mogrt, xml, aaf, edl |

## Requirements

- Adobe Premiere Pro 25.5 or later
- UXP Developer Tool 2.2.1 or later (for development/loading)
- Rust toolchain (for building the watcher binary)

## Installation

### Option 1: Build from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/Konadu-Akwasi-Akuoko/premiere-pro-folder-watcher.git
   cd premiere-pro-folder-watcher
   ```

2. **Build the Rust binary**
   ```bash
   # Development build (current platform)
   ./scripts/build.sh dev

   # Or release build for macOS universal binary
   ./scripts/build.sh mac
   ```

3. **Enable Premiere Pro Developer Mode**
   - Open Premiere Pro
   - Go to Settings > Plugins
   - Enable "Developer mode"
   - Restart Premiere Pro

4. **Load the plugin**
   - Open UXP Developer Tool
   - Click "Add Plugin"
   - Select the `manifest.json` file from this project
   - Click "Load" or "Load & Watch"

5. **Open the panel**
   - In Premiere Pro: Window > UXP Plugins > Folder Watcher

### Option 2: Pre-built Release (Coming Soon)

Pre-built releases will be available on the [Releases](https://github.com/Konadu-Akwasi-Akuoko/premiere-pro-folder-watcher/releases) page.

## Usage

1. **Open the Folder Watcher panel** in Premiere Pro (Window > UXP Plugins > Folder Watcher)

2. **Wait for connection** - The status indicator should turn green showing "Connected"

3. **Add a watch folder**
   - Click the "Add Folder" button
   - Select a folder from the file picker
   - The folder will appear in the watch list

4. **Drop files into watched folders**
   - Any media files added to the watched folder (or subfolders) will be automatically imported
   - Subfolders become bins in your project
   - The bin structure mirrors your folder structure

5. **Remove a watch**
   - Click the "Remove" button next to any watched folder

## How It Works

The plugin uses a two-component architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Premiere Pro 25.5+                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UXP Panel (UI)                         │  │
│  │  - Spawns Rust binary on panel open                       │  │
│  │  - Receives file events via WebSocket                     │  │
│  │  - Calls Premiere Pro APIs to import files                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │ WebSocket (localhost:9847)
                               │
┌─────────────────────────────────────────────────────────────────┐
│                 Rust Binary (folder-watcher)                    │
│  - Uses native OS file system APIs for efficient watching       │
│  - Debounces rapid file events (500ms default)                  │
│  - Filters for media files only                                 │
│  - Sends JSON events over WebSocket                             │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket Protocol

**Commands** (Panel to Watcher):
```json
{"cmd": "ADD_WATCH", "path": "/path/to/folder", "id": "watch-1"}
{"cmd": "REMOVE_WATCH", "id": "watch-1"}
{"cmd": "LIST_WATCHES"}
{"cmd": "SHUTDOWN"}
```

**Events** (Watcher to Panel):
```json
{"event": "FILE_ADDED", "watch_id": "watch-1", "path": "/full/path", "relative": "subfolder/file.mp4"}
{"event": "DIR_ADDED", "watch_id": "watch-1", "path": "/full/path", "relative": "subfolder"}
{"event": "READY", "watch_id": "watch-1"}
{"event": "ERROR", "message": "...", "watch_id": "watch-1"}
```

## Project Structure

```
premiere-pro-folder-watcher/
├── manifest.json              # UXP plugin manifest
├── index.html                 # Panel UI markup
├── index.js                   # Main orchestration logic
├── styles.css                 # Spectrum dark theme styles
├── modules/
│   ├── websocket.js           # WebSocket client with reconnection
│   ├── premiere.js            # Premiere Pro API wrapper
│   ├── binary.js              # Rust binary spawning
│   └── storage.js             # Configuration persistence
├── icons/
│   ├── icon.png               # 24x24 panel icon
│   └── icon@2x.png            # 48x48 panel icon (Retina)
├── bin/
│   ├── mac/                   # macOS binary location
│   └── win/                   # Windows binary location
├── rust-watcher/
│   ├── Cargo.toml             # Rust dependencies
│   └── src/
│       ├── main.rs            # CLI entry point
│       ├── lib.rs             # Library exports
│       ├── protocol.rs        # JSON message types
│       ├── filter.rs          # Media file extension filtering
│       ├── watcher.rs         # File system watch manager
│       └── server.rs          # WebSocket server
├── scripts/
│   └── build.sh               # Build automation script
├── CLAUDE.md                  # AI assistant instructions
└── PLAN.md                    # Implementation plan
```

## Build Commands

```bash
# Development build (debug, current platform only)
./scripts/build.sh dev

# macOS universal binary (Intel + Apple Silicon)
./scripts/build.sh mac

# Windows binary (requires mingw-w64)
./scripts/build.sh win

# Run tests
./scripts/build.sh test

# Run linter (clippy)
./scripts/build.sh lint

# Build all platforms
./scripts/build.sh all
```

## Configuration

Configuration is stored automatically by the UXP plugin. Settings include:

- **Port**: WebSocket server port (default: 9847)
- **Debounce**: Event debounce duration in milliseconds (default: 500)
- **Watch folders**: List of folders being watched

Configuration persists across Premiere Pro sessions.

## Troubleshooting

### Panel shows "Disconnected"

1. Check if the binary exists in `bin/mac/folder-watcher` (or `bin/win/folder-watcher.exe`)
2. Run `./scripts/build.sh dev` to build the binary
3. Reload the plugin in UXP Developer Tool

### Files not importing

1. Verify the file extension is in the supported formats list
2. Check that a project is open in Premiere Pro
3. Look at the Activity Log in the panel for error messages
4. Ensure the folder path doesn't contain special characters

### Binary won't start

1. On macOS, you may need to allow the binary in System Preferences > Security & Privacy
2. Ensure the binary has execute permissions: `chmod +x bin/mac/folder-watcher`

### WebSocket connection issues

1. Check if port 9847 is available: `lsof -i :9847`
2. Ensure no firewall is blocking localhost connections
3. Try restarting Premiere Pro

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [UXP Developer Tool](https://developer.adobe.com/uxp/)
- Adobe Premiere Pro 25.5+

### Running in Development

1. Build the debug binary:
   ```bash
   ./scripts/build.sh dev
   ```

2. Load the plugin in UXP Developer Tool with "Load & Watch" for hot reload

3. Make changes to JavaScript files - they'll reload automatically

4. For Rust changes, rebuild and reload:
   ```bash
   ./scripts/build.sh dev
   # Then reload plugin in UDT
   ```

### Running Tests

```bash
# Rust unit tests
./scripts/build.sh test

# Or directly with cargo
cargo test --manifest-path rust-watcher/Cargo.toml
```

## Dependencies

### Rust

| Crate | Version | Purpose |
|-------|---------|---------|
| notify | 8.2 | Cross-platform file system notifications |
| notify-debouncer-mini | 0.7 | Event debouncing |
| tungstenite | 0.28 | WebSocket server |
| serde / serde_json | 1.0 | JSON serialization |
| clap | 4.5 | CLI argument parsing |
| log / env_logger | 0.4 / 0.11 | Logging |

### UXP

- Premiere Pro UXP APIs (`require('premierepro')`)
- UXP Storage APIs (`require('uxp').storage`)
- UXP Shell APIs (`require('uxp').shell`)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [notify](https://github.com/notify-rs/notify) - Cross-platform file system notification library
- [tungstenite](https://github.com/snapview/tungstenite-rs) - Lightweight WebSocket library
- Adobe UXP team for the Premiere Pro UXP APIs
