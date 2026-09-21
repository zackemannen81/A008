import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@a008/protocol": fileURLToPath(
        new URL("../packages/protocol/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/health": "http://127.0.0.1:8787",
      // `ws` is required: the session client resolves its socket from
      // `location.host`, so in dev it upgrades `/v1/session` through this
      // proxy. Without it the ACP bridge is unreachable from `vite dev`.
      "/v1": { target: "http://127.0.0.1:8787", ws: true },
    },
  },
});
