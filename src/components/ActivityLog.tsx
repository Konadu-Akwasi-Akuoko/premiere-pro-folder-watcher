import React from "react";
import type { ActivityLogEntry } from "../types/watcher";
import { ActivityLogItem } from "./ActivityLogItem";

interface ActivityLogProps {
  entries: ActivityLogEntry[];
  onClear?: () => void;
}

export function ActivityLog({ entries, onClear }: ActivityLogProps) {
  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <span className="activity-log-title">Activity</span>
        {onClear && entries.length > 0 && (
          <button className="activity-log-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="activity-log-empty">No activity yet</p>
      ) : (
        <ul className="activity-log-items">
          {entries.map((entry) => (
            <ActivityLogItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
