import { UXP_Manifest, UXP_Config } from "vite-uxp-plugin";
import { version } from "./package.json";

const extraPrefs = {
  hotReloadPort: 8080,
  copyZipAssets: ["public-zip/*"],
};

export const id = "com.folderwatcher.uxp";
const name = "Folder Watcher";

const manifest: UXP_Manifest = {
  id,
  name,
  version,
  main: "index.html",
  manifestVersion: 6,
  host: [
    {
      app: "premierepro",
      minVersion: "25.6",
    },
  ],
  entrypoints: [
    {
      type: "panel",
      id: `${id}.main`,
      label: {
        default: name,
      },
      minimumSize: { width: 230, height: 200 },
      maximumSize: { width: 2000, height: 2000 },
      preferredDockedSize: { width: 230, height: 300 },
      preferredFloatingSize: { width: 450, height: 400 },
      icons: [
        {
          width: 23,
          height: 23,
          path: "icons/dark.png",
          scale: [1, 2],
          theme: ["darkest", "dark", "medium"],
        },
        {
          width: 23,
          height: 23,
          path: "icons/light.png",
          scale: [1, 2],
          theme: ["lightest", "light"],
        },
      ],
    },
  ],
  featureFlags: {
    enableAlerts: true,
  },
  requiredPermissions: {
    localFileSystem: "fullAccess",
    clipboard: "readAndWrite",
    ipc: {
      enablePluginCommunication: true,
    },
    network: {
      domains: [
        `ws://localhost:${extraPrefs.hotReloadPort}`, // Required for hot reload
      ],
    },
  },
  icons: [
    {
      width: 48,
      height: 48,
      path: "icons/plugin-icon.png",
      scale: [1, 2],
      theme: ["darkest", "dark", "medium", "lightest", "light", "all"],
      species: ["pluginList"],
    },
  ],
};

export const config: UXP_Config = {
  manifest,
  ...extraPrefs,
};
