import { useState, useEffect, useCallback } from "react";
import type { WatchedFolder, ActivityLogEntry, ScanResult } from "../types/watcher";
import {
  getWatchedFolders,
  saveWatchedFolders,
  removeWatchedFolder as removeFromStorage,
} from "../services/storage";
import { pickAndScanFolder, scanFolder } from "../services/scanner";
import { importScanResult } from "../services/importer";
import { uxp } from "../globals";

type UxpFolder = Awaited<
  ReturnType<typeof uxp.storage.localFileSystem.getFolder>
>;

export interface UseWatchFoldersReturn {
  folders: WatchedFolder[];
  isLoading: boolean;
  isSyncing: boolean;
  activityLog: ActivityLogEntry[];
  addFolder: () => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
  syncAll: () => Promise<void>;
  clearLog: () => void;
}

/**
 * Generates a unique ID for a watch folder.
 */
function generateId(): string {
  return `watch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates an activity log entry.
 */
function createLogEntry(
  type: ActivityLogEntry["type"],
  message: string,
  details?: string
): ActivityLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    message,
    timestamp: new Date(),
    details,
  };
}

/**
 * Hook for managing watched folders state and operations.
 */
export function useWatchFolders(): UseWatchFoldersReturn {
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Load folders from storage on mount
  useEffect(() => {
    async function loadFolders() {
      console.log("[useWatchFolders] Loading folders from storage...");
      try {
        const stored = await getWatchedFolders();
        console.log("[useWatchFolders] Loaded folders:", stored.length);
        setFolders(stored);
      } catch (err) {
        // Silently handle initial load failure - expected on first run or timing issues
        console.warn("[useWatchFolders] Could not load folders:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFolders();
  }, []);

  const addFolder = useCallback(async () => {
    console.log("[useWatchFolders] addFolder called");
    const watchId = generateId();

    try {
      const pickerResult = await pickAndScanFolder(watchId);

      if (!pickerResult) {
        console.log("[useWatchFolders] User cancelled folder picker");
        return;
      }

      const { folderPath, folderName, scanResult } = pickerResult;

      console.log(
        "[useWatchFolders] Folder scanned:",
        folderPath,
        "Files found:",
        scanResult.files.length
      );

      const newFolder: WatchedFolder = {
        id: watchId,
        path: folderPath,
        name: folderName,
        lastSyncAt: null,
        fileCount: scanResult.files.length,
      };

      const updatedFolders = [...folders, newFolder];
      setFolders(updatedFolders);
      await saveWatchedFolders(updatedFolders);

      setActivityLog((prev) => [
        createLogEntry(
          "sync",
          `Added folder: ${newFolder.name}`,
          `${scanResult.files.length} media files found`
        ),
        ...prev,
      ]);

      console.log("[useWatchFolders] Folder added successfully:", newFolder.id);
    } catch (err) {
      console.error("[useWatchFolders] Failed to add folder:", err);
      setActivityLog((prev) => [
        createLogEntry(
          "error",
          "Failed to add folder",
          err instanceof Error ? err.message : String(err)
        ),
        ...prev,
      ]);
    }
  }, [folders]);

  const removeFolder = useCallback(
    async (id: string) => {
      console.log("[useWatchFolders] removeFolder called, id:", id);
      try {
        await removeFromStorage(id);
        const removedFolder = folders.find((f) => f.id === id);
        setFolders((prev) => prev.filter((f) => f.id !== id));

        if (removedFolder) {
          setActivityLog((prev) => [
            createLogEntry("sync", `Removed folder: ${removedFolder.name}`),
            ...prev,
          ]);
        }

        console.log("[useWatchFolders] Folder removed successfully:", id);
      } catch (err) {
        console.error("[useWatchFolders] Failed to remove folder:", err);
        setActivityLog((prev) => [
          createLogEntry(
            "error",
            "Failed to remove folder",
            err instanceof Error ? err.message : String(err)
          ),
          ...prev,
        ]);
      }
    },
    [folders]
  );

  const syncAll = useCallback(async () => {
    console.log("[useWatchFolders] syncAll called, folders:", folders.length);
    if (folders.length === 0) {
      console.log("[useWatchFolders] No folders to sync");
      return;
    }

    setIsSyncing(true);
    setActivityLog((prev) => [
      createLogEntry("sync", `Starting sync of ${folders.length} folder(s)...`),
      ...prev,
    ]);

    const updatedFolders = [...folders];

    for (let i = 0; i < updatedFolders.length; i++) {
      const folder = updatedFolders[i];
      console.log("[useWatchFolders] Syncing folder:", folder.name, folder.path);

      try {
        // Get folder reference from path
        const folderEntry = await uxp.storage.localFileSystem.getEntryWithUrl(
          `file://${folder.path}`
        );

        if (!folderEntry || !folderEntry.isFolder) {
          console.error(
            "[useWatchFolders] Could not access folder:",
            folder.path
          );
          setActivityLog((prev) => [
            createLogEntry(
              "error",
              `Cannot access folder: ${folder.name}`,
              "Folder may have been moved or deleted"
            ),
            ...prev,
          ]);
          continue;
        }

        const scanResult: ScanResult = await scanFolder(
          folderEntry as NonNullable<UxpFolder>,
          folder.id
        );

        console.log(
          "[useWatchFolders] Scan complete:",
          folder.name,
          "Files:",
          scanResult.files.length
        );

        // Import files
        const importResults = await importScanResult(scanResult, folder.name);
        const successCount = importResults.filter((r) => r.success).length;
        const errorCount = importResults.filter((r) => !r.success).length;

        console.log(
          "[useWatchFolders] Import complete:",
          folder.name,
          "Success:",
          successCount,
          "Errors:",
          errorCount
        );

        // Update folder stats
        updatedFolders[i] = {
          ...folder,
          lastSyncAt: new Date().toISOString(),
          fileCount: scanResult.files.length,
        };

        // Log results
        if (successCount > 0) {
          setActivityLog((prev) => [
            createLogEntry(
              "import",
              `Imported ${successCount} file(s) from ${folder.name}`
            ),
            ...prev,
          ]);
        }

        if (errorCount > 0) {
          setActivityLog((prev) => [
            createLogEntry(
              "error",
              `Failed to import ${errorCount} file(s) from ${folder.name}`
            ),
            ...prev,
          ]);
        }
      } catch (err) {
        console.error("[useWatchFolders] Sync failed for folder:", folder.name, err);
        setActivityLog((prev) => [
          createLogEntry(
            "error",
            `Sync failed: ${folder.name}`,
            err instanceof Error ? err.message : String(err)
          ),
          ...prev,
        ]);
      }
    }

    setFolders(updatedFolders);
    await saveWatchedFolders(updatedFolders);

    setActivityLog((prev) => [
      createLogEntry("sync", "Sync complete"),
      ...prev,
    ]);

    setIsSyncing(false);
    console.log("[useWatchFolders] syncAll complete");
  }, [folders]);

  const clearLog = useCallback(() => {
    console.log("[useWatchFolders] clearLog called");
    setActivityLog([]);
  }, []);

  return {
    folders,
    isLoading,
    isSyncing,
    activityLog,
    addFolder,
    removeFolder,
    syncAll,
    clearLog,
  };
}
