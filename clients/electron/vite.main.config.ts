import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "node:child_process", "node:fs", "node:net", "node:path", "node:url"],
    },
    outDir: ".vite/build",
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: { alias: { "@electron-root": resolve(__dirname) } },
});