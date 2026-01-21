import React, { useState } from "react";

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
  const [watchFolders, setWatchFolders] = useState<string[]>([]);

  return (
    <main>
      <h1>Folder Watcher</h1>
      <p>Watch folders and auto-import media to Premiere Pro</p>

      <div className="watch-list">
        {watchFolders.length === 0 ? (
          <p className="empty-state">No folders being watched</p>
        ) : (
          <ul>
            {watchFolders.map((folder, i) => (
              <li key={i}>{folder}</li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={() => console.log("Add folder clicked")}>
        Add Folder
      </button>
    </main>
  );
};
