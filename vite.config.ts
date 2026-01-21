import { defineConfig } from "vite";
import { runAction, uxp } from "vite-uxp-plugin";
import react from "@vitejs/plugin-react";

import { config } from "./uxp.config";

const action = process.env.BOLT_ACTION;
const mode = process.env.MODE;
process.env.VITE_BOLT_MODE = mode;

if (action) runAction(config, action);

export default defineConfig({
  plugins: [
    uxp(config, mode),
    react(),
  ],
  build: {
    sourcemap: mode && ["dev", "build"].includes(mode) ? true : false,
    minify: false,
    emptyOutDir: true,
    rollupOptions: {
      external: [
        "premierepro",
        "uxp",
        "fs",
        "os",
        "path",
        "process",
        "shell",
      ],
      output: {
        format: "iife",
      },
    },
  },
  publicDir: "public",
});
