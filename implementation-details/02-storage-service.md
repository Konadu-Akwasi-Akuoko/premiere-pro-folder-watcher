# Storage Service Implementation Guide

## Overview

Implement `src/services/storage.ts` - persists watched folders to `plugin-data:/` keyed by project path.

---

## 1. UXP File System APIs

```typescript
// Access the data folder (plugin-data:/)
import { uxp } from "../globals";

const fs = uxp.storage.localFileSystem;

// Get the plugin's data folder
const dataFolder = await fs.getDataFolder();
```

---

## 2. File Operations

### Reading a file

```typescript
// getEntry returns null if file doesn't exist (no throw)
const file = await dataFolder.getEntry("watched-folders.json");

if (file) {
  const contents = await file.read({ format: uxp.storage.formats.utf8 });
  const data = JSON.parse(contents);
}
```

### Writing a file

```typescript
// createFile with overwrite: true replaces existing
const file = await dataFolder.createFile("watched-folders.json", {
  overwrite: true,
});

await file.write(JSON.stringify(data, null, 2), {
  format: uxp.storage.formats.utf8,
});
```

---

## 3. Get Current Project Path

You already have this in `premierepro.ts`:

```typescript
import { getProjectInfo } from "../api/premierepro";

const { path: projectPath } = await getProjectInfo();
// projectPath = "/Users/john/Projects/MyProject.prproj"
```

---

## 4. Storage Data Structure

```typescript
// Add to types/watcher.ts or define in storage.ts

interface StorageData {
  [projectPath: string]: WatchedFolder[];
}

// Example on disk:
// {
//   "/path/to/Project1.prproj": [{ id: "watch-1", ... }],
//   "/path/to/Project2.prproj": [{ id: "watch-2", ... }]
// }
```

---

## 5. Functions to Implement

```typescript
// services/storage.ts

const STORAGE_FILE = "watched-folders.json";

/**
 * Load all storage data from disk
 * Returns empty object if file doesn't exist
 */
async function loadStorageData(): Promise<StorageData> {
  // TODO: Use getDataFolder, getEntry, read, JSON.parse
  // Handle: file doesn't exist yet (return {})
  // Handle: JSON parse error (return {}, log warning)
}

/**
 * Save all storage data to disk
 */
async function saveStorageData(data: StorageData): Promise<void> {
  // TODO: Use getDataFolder, createFile, write, JSON.stringify
}

/**
 * Get watched folders for the current project
 */
export async function getWatchedFolders(): Promise<WatchedFolder[]> {
  // TODO:
  // 1. Get current project path
  // 2. Load storage data
  // 3. Return data[projectPath] or empty array
}

/**
 * Save watched folders for the current project
 */
export async function saveWatchedFolders(folders: WatchedFolder[]): Promise<void> {
  // TODO:
  // 1. Get current project path
  // 2. Load existing storage data
  // 3. Update data[projectPath] = folders
  // 4. Save back to disk
}

/**
 * Add a single folder to the watch list
 */
export async function addWatchedFolder(folder: WatchedFolder): Promise<void> {
  // TODO: Load current, append, save
}

/**
 * Remove a folder by ID
 */
export async function removeWatchedFolder(id: string): Promise<void> {
  // TODO: Load current, filter out by id, save
}
```

---

## 6. Date Serialization Gotcha

`WatchedFolder.lastSyncAt` is `Date | null`, but JSON doesn't support Date objects.

**Option A**: Store as ISO string, parse on load

```typescript
// When saving
const toStore = {
  ...folder,
  lastSyncAt: folder.lastSyncAt?.toISOString() ?? null,
};

// When loading
const folder = {
  ...stored,
  lastSyncAt: stored.lastSyncAt ? new Date(stored.lastSyncAt) : null,
};
```

**Option B**: Store as timestamp (number)

```typescript
lastSyncAt: folder.lastSyncAt?.getTime() ?? null;
// Load: stored.lastSyncAt ? new Date(stored.lastSyncAt) : null
```

---

## 7. Error Handling Considerations

- **No project open**: `getProjectInfo()` may throw - decide how to handle
- **Corrupt JSON**: Wrap parse in try/catch, return empty data
- **File write failure**: Let it throw (caller handles UI feedback)

---

## 8. Testing Tip

You can manually inspect the stored data at:

- **macOS**: `~/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO/<plugin-id>/PluginData/watched-folders.json`
- **Windows**: `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<plugin-id>\PluginData\watched-folders.json`
