import { getProjectInfo } from "../api/premierepro";
import { uxp } from "../globals";
import { WatchedFolder } from "../types/watcher";

interface StorageData {
  [projectPath: string]: WatchedFolder[];
}

const STORAGE_FILE = "watched-folders.json";

/**
 * Get current project path
 * @throws Error if no project is open
 */
async function getCurrentProjectPath(): Promise<string> {
  const { path: projectPath } = await getProjectInfo();
  if (!projectPath) {
    throw new Error("No project is currently open");
  }
  return projectPath;
}

/**
 * Get data folder, folder storing the watcher file paths
 */
async function getDataFolder() {
  const fs = uxp.storage.localFileSystem;
  return await fs.getDataFolder();
}

/**
 * Load all storage data from disk
 * @returns empty object if file doesn't exist or is corrupt
 */
async function loadStorageData(): Promise<StorageData> {
  const dataFolder = await getDataFolder();
  const file = await dataFolder.getEntry(STORAGE_FILE);

  if (file) {
    try {
      const contents = await file.read({ format: uxp.storage.formats.utf8 });
      const data = JSON.parse(contents);
      return data;
    } catch (error) {
      console.warn("Failed to parse storage data, returning empty:", error);
      return {};
    }
  }

  return {};
}

/**
 * Save all storage data to disk
 */
async function saveStorageData(data: StorageData) {
  const dataFolder = await getDataFolder();

  const file = await dataFolder.createFile("watched-folders.json", {
    overwrite: true,
  });

  const contents = JSON.stringify(data);
  await file.write(contents, { format: uxp.storage.formats.utf8 });
}

/**
 * Get watched folders for the current project
 */
export async function getWatchedFolders(): Promise<WatchedFolder[]> {
  const projectPath = await getCurrentProjectPath();
  const storageData = await loadStorageData();
  return storageData[projectPath] ?? [];
}

/**
 * Save watched folders for the current project
 */
export async function saveWatchedFolders(
  folders: WatchedFolder[],
): Promise<void> {
  const path = await getCurrentProjectPath();
  const storageData = await loadStorageData();
  storageData[path] = folders;
  await saveStorageData(storageData);
}

/**
 * Add a single folder to the watch list
 */
export async function addWatchedFolder(folder: WatchedFolder): Promise<void> {
  const watchedFolders = await getWatchedFolders();
  watchedFolders.push(folder);
  await saveWatchedFolders(watchedFolders);
}

/**
 * Remove a folder by ID
 */
export async function removeWatchedFolder(id: string): Promise<void> {
  const watchedFolders = await getWatchedFolders();
  const updatedFolders = watchedFolders.filter((folder) => folder.id !== id);
  await saveWatchedFolders(updatedFolders);
}
