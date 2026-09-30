import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "renderer"),
  build: { outDir: resolve(__dirname, ".vite/renderer/main_window"), emptyOutDir: true },
  server: { port: 5174 },
});