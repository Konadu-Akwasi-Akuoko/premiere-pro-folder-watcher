import React from "react";
import type { ActivityLogEntry } from "../types/watcher";

interface ActivityLogItemProps {
  entry: ActivityLogEntry;
}

/**
 * Formats a timestamp to HH:MM format.
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Maps entry type to CSS class for color coding.
 */
function getIndicatorClass(type: ActivityLogEntry["type"]): string {
  switch (type) {
    case "import":
      return "activity-indicator-import";
    case "error":
      return "activity-indicator-error";
    case "sync":
      return "activity-indicator-sync";
    default:
      return "";
  }
}

export function ActivityLogItem({ entry }: ActivityLogItemProps) {
  return (
    <li className="activity-log-item">
      <span className={`activity-indicator ${getIndicatorClass(entry.type)}`} />
      <span className="activity-time">{formatTime(entry.timestamp)}</span>
      <span className="activity-message">{entry.message}</span>
    </li>
  );
}
