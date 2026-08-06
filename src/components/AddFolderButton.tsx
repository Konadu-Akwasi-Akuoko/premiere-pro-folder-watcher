import React, { useState, useCallback } from "react";

interface AddFolderButtonProps {
  onAdd: () => Promise<void>;
  disabled?: boolean;
}

export function AddFolderButton({ onAdd, disabled }: AddFolderButtonProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleClick = useCallback(async () => {
    console.log("[AddFolderButton] clicked");
    setIsAdding(true);
    try {
      await onAdd();
    } finally {
      setIsAdding(false);
    }
  }, [onAdd]);

  const isDisabled = disabled || isAdding;

  return (
    <button
      className="add-folder-btn"
      onClick={handleClick}
      disabled={isDisabled}
    >
      {isAdding ? "Adding..." : "Add Folder"}
    </button>
  );
}
