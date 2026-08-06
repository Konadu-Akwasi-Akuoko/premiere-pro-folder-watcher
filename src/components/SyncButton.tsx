import React, { useCallback } from "react";

interface SyncButtonProps {
  onSync: () => Promise<void>;
  isSyncing: boolean;
  disabled?: boolean;
}

export function SyncButton({ onSync, isSyncing, disabled }: SyncButtonProps) {
  const handleClick = useCallback(() => {
    console.log("[SyncButton] clicked");
    onSync();
  }, [onSync]);

  const isDisabled = disabled || isSyncing;

  return (
    <button
      className="sync-btn"
      onClick={handleClick}
      disabled={isDisabled}
    >
      {isSyncing ? "Syncing..." : "Sync All"}
    </button>
  );
}
