// Isolated visual check: node gui/test/memory-map-preview.mjs
// Only this test runner exposes the preview route; it starts no host/provider.
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  server: { host: "127.0.0.1", port: 5194, strictPort: true, proxy: {} },
  plugins: [
    {
      name: "isolated-memory-preview",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url?.split("?")[0] !== "/__memory-map-check")
            return next();
          const theme =
            new URL(request.url, "http://127.0.0.1").searchParams.get("theme") ===
            "deep-space"
              ? "deep-space"
              : "neutral";
          const html = await server.transformIndexHtml(
            request.url,
            `<!doctype html><html data-a008-theme="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>A008 synthetic memory map check</title></head><body><div id="root"></div><script type="module" src="/test/memory-map-preview.tsx"></script></body></html>`,
          );
          response.setHeader("Content-Type", "text/html");
          response.end(html);
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Synthetic memory preview: http://127.0.0.1:5194/__memory-map-check",
);
