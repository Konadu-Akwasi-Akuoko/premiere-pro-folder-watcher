import React, { useState, useCallback } from "react";
import type { WatchedFolder } from "../types/watcher";

interface WatchListItemProps {
  folder: WatchedFolder;
  onRemove: (id: string) => Promise<void>;
}

/**
 * Formats a date into relative time string.
 */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";

  const date = new Date(isoString);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Truncates a folder name if too long.
 */
function truncateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 3) + "...";
}

export function WatchListItem({ folder, onRemove }: WatchListItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = useCallback(async () => {
    console.log("[WatchListItem] Remove clicked for:", folder.id);
    setIsRemoving(true);
    try {
      await onRemove(folder.id);
    } finally {
      setIsRemoving(false);
    }
  }, [folder.id, onRemove]);

  return (
    <li className="watch-list-item">
      <div className="watch-list-item-info">
        <span className="watch-list-item-name" title={folder.name}>
          {truncateName(folder.name)}
        </span>
        <span className="watch-list-item-badge">{folder.fileCount}</span>
      </div>
      <div className="watch-list-item-meta">
        <span className="watch-list-item-sync">
          {formatRelativeTime(folder.lastSyncAt)}
        </span>
        <button
          className="watch-list-item-remove"
          onClick={handleRemove}
          disabled={isRemoving}
          title="Remove folder"
        >
          {isRemoving ? "..." : "X"}
        </button>
      </div>
    </li>
  );
}
