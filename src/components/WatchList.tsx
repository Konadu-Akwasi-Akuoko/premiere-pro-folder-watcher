import React from "react";
import type { WatchedFolder } from "../types/watcher";
import { WatchListItem } from "./WatchListItem";

interface WatchListProps {
  folders: WatchedFolder[];
  onRemove: (id: string) => Promise<void>;
  isLoading: boolean;
}

export function WatchList({ folders, onRemove, isLoading }: WatchListProps) {
  if (isLoading) {
    return (
      <div className="watch-list">
        <p className="empty-state">Loading...</p>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="watch-list">
        <p className="empty-state">No folders being watched</p>
      </div>
    );
  }

  return (
    <div className="watch-list">
      <ul className="watch-list-items">
        {folders.map((folder) => (
          <WatchListItem key={folder.id} folder={folder} onRemove={onRemove} />
        ))}
      </ul>
    </div>
  );
}
