export interface WatchedFolder {
  id: string;
  path: string;
  name: string;
  lastSyncAt: string | null; // ISO 8601 string
  fileCount: number;
}

export interface FileEntry {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  isDirectory: boolean;
}

export interface ScanResult {
  watchId: string;
  files: FileEntry[];
  directories: string[]; // Relative paths of all subdirectories
  scannedAt: Date;
}

export interface ImportResult {
  file: FileEntry;
  success: boolean;
  binPath: string; // Where it was imported
  error?: string;
}

export interface ActivityLogEntry {
  id: string;
  type: "import" | "error" | "sync";
  message: string;
  timestamp: Date;
  details?: string;
}
