import type { FolderItem } from "../types/ppro";
import type { FileEntry, ImportResult, ScanResult } from "../types/watcher";
import {
  getRootBin,
  findChildBin,
  createBinInParent,
  importFilesToBin,
} from "../api/premierepro";

/**
 * Finds or creates a bin hierarchy from a path like "Footage/Interview/Day1".
 * Creates any missing bins along the path.
 * @param binPath - Forward-slash separated path segments (e.g., "Root/Sub/Deep")
 * @returns The deepest bin in the path
 */
export async function findOrCreateBinPath(binPath: string): Promise<FolderItem> {
  const segments = binPath.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) {
    return getRootBin();
  }

  let current = await getRootBin();

  for (const segment of segments) {
    const existing = await findChildBin(current, segment);
    if (existing) {
      current = existing;
    } else {
      current = await createBinInParent(current, segment);
    }
  }

  return current;
}

/**
 * Extracts the directory portion from a relative file path.
 * E.g., "subfolder/deep/file.mp4" -> "subfolder/deep"
 * E.g., "file.mp4" -> ""
 */
function getDirectoryFromRelativePath(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }
  return relativePath.substring(0, lastSlash);
}

/**
 * Imports a single file into the correct bin hierarchy.
 * Creates bins matching the file's relative path under the root bin name.
 * @param file - The file entry to import
 * @param rootBinName - Name of the top-level bin for this watch folder
 * @returns ImportResult with success/error status
 */
export async function importFileWithBinHierarchy(
  file: FileEntry,
  rootBinName: string
): Promise<ImportResult> {
  const directoryPath = getDirectoryFromRelativePath(file.relativePath);
  const binPath = directoryPath
    ? `${rootBinName}/${directoryPath}`
    : rootBinName;

  try {
    const targetBin = await findOrCreateBinPath(binPath);
    const success = await importFilesToBin([file.path], targetBin);

    return {
      file,
      success,
      binPath,
      error: success ? undefined : "Import returned false",
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      file,
      success: false,
      binPath,
      error: errorMessage,
    };
  }
}

/**
 * Imports all files from a scan result into Premiere Pro.
 * Creates bin hierarchies matching the scanned folder structure.
 * @param scanResult - Result from folder scanning
 * @param rootBinName - Name of the top-level bin for this watch folder
 * @returns Array of ImportResult for each file
 */
export async function importScanResult(
  scanResult: ScanResult,
  rootBinName: string
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const file of scanResult.files) {
    const result = await importFileWithBinHierarchy(file, rootBinName);
    results.push(result);
  }

  return results;
}
