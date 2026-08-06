import React from "react";
import { useWatchFolders } from "./hooks/useWatchFolders";
import { WatchList } from "./components/WatchList";
import { AddFolderButton } from "./components/AddFolderButton";
import { SyncButton } from "./components/SyncButton";
import { ActivityLog } from "./components/ActivityLog";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "uxp-panel": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { panelid?: string },
        HTMLElement
      >;
    }
  }
}

export const App = () => {
  const {
    folders,
    isLoading,
    isSyncing,
    activityLog,
    addFolder,
    removeFolder,
    syncAll,
    clearLog,
  } = useWatchFolders();

  return (
    <main>
      <h1>Folder Watcher</h1>
      <WatchList
        folders={folders}
        onRemove={removeFolder}
        isLoading={isLoading}
      />
      <div className="button-group">
        <AddFolderButton onAdd={addFolder} disabled={isSyncing} />
        <SyncButton
          onSync={syncAll}
          isSyncing={isSyncing}
          disabled={folders.length === 0}
        />
      </div>
      <ActivityLog entries={activityLog} onClear={clearLog} />
    </main>
  );
};
