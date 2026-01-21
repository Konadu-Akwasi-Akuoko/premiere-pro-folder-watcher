# Premiere Pro Folder Watch Plugin - Implementation Plan

## Overview

Build a folder-watching plugin for Adobe Premiere Pro 25.6+ that mirrors filesystem directory structures into Premiere Pro bins and imports new media files. Uses a **polling-based approach** with a manual "Sync Now" button - no external binary required.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                  Premiere Pro 25.6+                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              UXP Panel (React + TypeScript)               │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │                    Watch Manager                     │ │ │
│  │  │  - Stores list of watched folders                    │ │ │
│  │  │  - Tracks previously seen files per folder           │ │ │
│  │  │  - Persists config to plugin-data:/                  │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                          │                                │ │
│  │                          ▼                                │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │              Scanner (on "Sync Now" click)           │ │ │
│  │  │  - Reads folder contents with fs.readdir()           │ │ │
│  │  │  - Recursively scans subfolders                      │ │ │
│  │  │  - Filters for media file extensions                 │ │ │
│  │  │  - Compares against previous scan → finds new files  │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                          │                                │ │
│  │                          ▼                                │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │                    Importer                          │ │ │
│  │  │  - Creates bin hierarchy (mirrors folder structure)  │ │ │
│  │  │  - Imports new media files to target bins            │ │ │
│  │  │  - Uses app.project.importFiles() + createBin()      │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### User Workflow

1. User opens the plugin panel in Premiere Pro
2. User clicks "Add Folder" → folder picker opens
3. User selects a folder to watch → folder added to watch list
4. User clicks "Sync Now" → plugin scans all watched folders
5. New files are detected and imported automatically
6. Bin hierarchy is created to mirror the folder structure

---

## Core Features

1. **Add Watch Folder** - Folder picker dialog via UXP localFileSystem
2. **Remove Watch Folder** - Remove from watch list
3. **Sync Now Button** - Manually trigger scan and import
4. **Bin Mirroring** - Directory structure → Premiere bins
5. **File Type Filtering** - Import only media files (video, audio, images)
6. **Activity Log** - Show recent imports with timestamps
7. **Persistence** - Remember watched folders between sessions

---

## File Structure

```
src/
├── main.tsx                    # Main App component (UPDATE)
├── index-react.tsx             # React entry point
├── app.css                     # Dark theme styles (UPDATE)
├── globals.ts                  # UXP/Premiere Pro requires
├── api/
│   ├── premierepro.ts         # Premiere Pro API wrappers (UPDATE)
│   ├── uxp.ts                 # UXP API wrappers
│   └── filesystem.ts          # NEW: Path utilities, extension filtering
├── services/
│   ├── scanner.ts             # NEW: Folder scanner (fs.readdir recursive)
│   ├── differ.ts              # NEW: Compare scans, find new files
│   ├── importer.ts            # NEW: Import files, create bins in Premiere
│   └── storage.ts             # NEW: Persist watched folders (plugin-data:/)
├── components/
│   ├── WatchList.tsx          # NEW: Watch folder list with remove button
│   ├── AddFolderButton.tsx    # NEW: Folder picker trigger
│   ├── SyncButton.tsx         # NEW: "Sync Now" button with loading state
│   └── ActivityLog.tsx        # NEW: Import activity feed
├── hooks/
│   └── useWatchFolders.ts     # NEW: Watch folder state management
└── types/
    ├── ppro.d.ts              # Premiere Pro type definitions (exists)
    └── watcher.ts             # NEW: Type definitions
```

---

## Type Definitions

```typescript
// types/watcher.ts

interface WatchedFolder {
  id: string;                    // Unique ID (e.g., "watch-1")
  path: string;                  // Absolute path to folder
  name: string;                  // Display name (folder name)
  addedAt: number;               // Timestamp when added
  lastSyncAt: number | null;     // Timestamp of last sync
  fileCount: number;             // Number of files seen
}

interface FileEntry {
  path: string;                  // Absolute path
  relativePath: string;          // Path relative to watch root
  name: string;                  // File name with extension
  extension: string;             // File extension (lowercase)
  isDirectory: boolean;
}

interface ScanResult {
  watchId: string;
  files: FileEntry[];
  directories: string[];         // Relative paths of all subdirectories
  scannedAt: number;
}

interface ImportResult {
  file: FileEntry;
  success: boolean;
  binPath: string;               // Where it was imported
  error?: string;
}

interface ActivityLogEntry {
  id: string;
  type: 'import' | 'error' | 'sync';
  message: string;
  timestamp: number;
  details?: string;
}
```

---

## Storage Design (Per-Project)

Watched folders are stored in `plugin-data:/` but keyed by the active project path. This means:
- Each Premiere project has its own set of watched folders
- Switching projects automatically shows/hides relevant watched folders
- Settings persist across Premiere restarts

```typescript
// services/storage.ts - Storage structure

interface StorageData {
  [projectPath: string]: WatchedFolder[];
}

// Example stored data in plugin-data:/watched-folders.json
{
  "/Users/john/Projects/Documentary.prproj": [
    { "id": "watch-1", "path": "/Volumes/Media/Documentary/Footage", ... }
  ],
  "/Users/john/Projects/Commercial.prproj": [
    { "id": "watch-2", "path": "/Volumes/Media/Commercial/Assets", ... }
  ]
}

// Get current project path for keying
const project = await app.Project.getActiveProject();
const projectPath = project.path;  // Native path to .prproj file
```

---

## Key UXP APIs

```typescript
// Folder picker
const { localFileSystem } = require('uxp').storage;
const folder = await localFileSystem.getFolder();
const path = folder.nativePath;

// File system read (recursive)
const fs = require('fs');
const entries = await fs.readdir(path, { withFileTypes: true });

// Premiere Pro - Get project
const { app } = require('premierepro');
const project = await app.Project.getActiveProject();
const root = await project.getRootItem();

// Premiere Pro - Create bin
await project.executeTransaction((tx) => {
  tx.addAction(root.createBinAction("BinName", true));
}, "Create Bin");

// Premiere Pro - Import files
await app.project.importFiles([filePath], true, targetBin, false);
// Parameters: filePaths[], suppressUI, targetBin, importAsStills
```

---

## Implementation Steps

### Phase 1: Core Infrastructure

- [ ] 1. Create type definitions (`types/watcher.ts`)
- [ ] 2. Implement storage service - save/load watched folders (`services/storage.ts`)
     - Uses `plugin-data:/` with project path as key for per-project storage
     - Storage format: `{ "projectPath": WatchedFolder[] }`
- [ ] 3. Implement media extension constants and filter (`api/filesystem.ts`)
- [ ] 4. Implement folder scanner - recursive readdir (`services/scanner.ts`)
- [ ] 5. Implement differ - compare scans to find new files (`services/differ.ts`)

### Phase 2: Premiere Pro Integration

- [ ] 6. Implement bin finder - find existing bin by path (`services/importer.ts`)
- [ ] 7. Implement bin creator - create nested bin hierarchy
- [ ] 8. Implement file importer - importFiles with target bin
- [ ] 9. Update premierepro.ts with new helper functions

### Phase 3: UI Components

- [ ] 10. Build AddFolderButton component (folder picker)
- [ ] 11. Build WatchList component (display folders, remove button)
- [ ] 12. Build SyncButton component (with loading/disabled states)
- [ ] 13. Build ActivityLog component (scrollable list)
- [ ] 14. Create useWatchFolders hook (state management)

### Phase 4: Integration & Polish

- [ ] 15. Wire up main App component with all pieces
- [ ] 16. Add error handling and user feedback
- [ ] 17. Style components with Premiere Pro dark theme
- [ ] 18. Test full workflow end-to-end

---

## Supported Media Extensions

```typescript
// api/filesystem.ts

export const MEDIA_EXTENSIONS = {
  video: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'mxf', 'r3d', 'braw', 'ari'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'aiff', 'aif', 'wma'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'psd', 'ai', 'eps', 'webp', 'exr', 'dpx', 'tga'],
  project: ['prproj', 'mogrt', 'xml', 'aaf', 'edl'],
};

export const ALL_MEDIA_EXTENSIONS = [
  ...MEDIA_EXTENSIONS.video,
  ...MEDIA_EXTENSIONS.audio,
  ...MEDIA_EXTENSIONS.image,
  ...MEDIA_EXTENSIONS.project,
];

export function isMediaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALL_MEDIA_EXTENSIONS.includes(ext);
}
```

---

## Verification Plan

1. Load plugin in Premiere Pro via UXP Developer Tool
2. Click "Add Folder" → verify folder picker opens
3. Select a folder with media files → verify folder appears in watch list
4. Click "Sync Now" → verify files are imported to Premiere
5. Verify bin hierarchy is created matching folder structure
6. Add new file to watched folder externally
7. Click "Sync Now" again → verify only new file is imported (no duplicates)
8. Remove watched folder → verify it's removed from list
9. Close and reopen Premiere → verify watched folders persist
10. Test with nested subfolders → verify nested bins are created

---

## Development Commands

```bash
# UXP Plugin
npm run dev              # Watch mode with hot reload
npm run build            # Production build
npm run ccx              # Package as .ccx file
```

---

## Development Requirements

- **Premiere Pro**: v25.6 or later
- **UXP Developer Tool**: v2.2.1 or later
- **Premiere Pro Developer Mode**: Enable in Settings > Plugins > Enable developer mode
- **Node.js**: v18+ (for UXP plugin development)

---

## Comparison with Competitors

| Feature | Watchtower | Pro IO | Our Plugin |
|---------|------------|--------|------------|
| Sync method | Polling + Manual | Polling + Manual | Manual (Sync Now) |
| Auto-sync interval | Yes | Yes | No (future enhancement) |
| Subfolder mirroring | Yes | Yes | Yes |
| Flatten option | Yes | Yes | No (mirror only) |
| External binary | No | No | No |
| Price | $40 | $29 | Free |

---

## Future Enhancements (Optional)

- [ ] Auto-sync on interval (every N seconds)
- [ ] Flatten subfolders option
- [ ] File type filter settings
- [ ] Import progress indicator
- [ ] Duplicate file handling options

---

## References

- [Premiere Pro UXP Documentation](https://developer.adobe.com/premiere-pro/uxp/)
- [Premiere Pro UXP API Reference](https://developer.adobe.com/premiere-pro/uxp/ppro_reference/)
- [UXP Plugin Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples)
- [Watchtower (competitor)](https://knightsoftheeditingtable.com/watchtower)
- [Pro IO (competitor)](https://aescripts.com/pro-io/)
