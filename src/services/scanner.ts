import { isMediaFile } from "../api/filesystem";
import { uxp } from "../globals";
import type { FileEntry, ScanResult } from "../types/watcher";

type Folder = Awaited<
  ReturnType<typeof uxp.storage.localFileSystem.getFolder>
>;
type Entry = Awaited<ReturnType<NonNullable<Folder>["getEntries"]>>[number];

/**
 * Extracts the lowercase file extension from a filename.
 * @returns Empty string if no extension present
 */
function getExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Calculates the relative path from a root path.
 * Normalizes path separators to forward slashes.
 */
function getRelativePath(absolutePath: string, rootPath: string): string {
  let relative = absolutePath;

  if (absolutePath.startsWith(rootPath)) {
    relative = absolutePath.slice(rootPath.length);
  }

  // Remove leading separator
  if (relative.startsWith("/") || relative.startsWith("\\")) {
    relative = relative.slice(1);
  }

  // Normalize to forward slashes
  return relative.replace(/\\/g, "/");
}

/**
 * Recursively scans a directory, collecting media files and subdirectories.
 */
async function scanDirectory(
  folder: NonNullable<Folder>,
  rootPath: string,
  files: FileEntry[],
  directories: string[],
): Promise<void> {
  const entries = await folder.getEntries();

  for (const entry of entries) {
    const entryPath = (entry as Entry & { nativePath: string }).nativePath;
    const relativePath = getRelativePath(entryPath, rootPath);

    if (entry.isFolder) {
      directories.push(relativePath);
      await scanDirectory(
        entry as NonNullable<Folder>,
        rootPath,
        files,
        directories,
      );
    } else if (isMediaFile(entry.name)) {
      files.push({
        path: entryPath,
        relativePath,
        name: entry.name,
        extension: getExtension(entry.name),
        isDirectory: false,
      });
    }
  }
}

/**
 * Scans a folder recursively for media files.
 * @param folder - UXP Folder object to scan
 * @param watchId - Identifier for this watch operation
 * @returns ScanResult containing all discovered media files and directories
 */
export async function scanFolder(
  folder: NonNullable<Folder>,
  watchId: string,
): Promise<ScanResult> {
  const files: FileEntry[] = [];
  const directories: string[] = [];
  const rootPath = (folder as NonNullable<Folder> & { nativePath: string })
    .nativePath;

  await scanDirectory(folder, rootPath, files, directories);

  return {
    watchId,
    files,
    directories,
    scannedAt: new Date(),
  };
}

/**
 * Opens a folder picker and scans the selected folder for media files.
 * @param watchId - Identifier for this watch operation
 * @returns ScanResult or null if user cancels the picker
 */
export async function pickAndScanFolder(
  watchId: string,
): Promise<ScanResult | null> {
  const folder = await uxp.storage.localFileSystem.getFolder();

  if (!folder) {
    return null;
  }

  return scanFolder(folder, watchId);
}
