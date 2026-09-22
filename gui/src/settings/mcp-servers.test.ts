import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { McpServerList, McpServersPanel } from "./mcp-servers-panel.js";

const server = {
  name: "agent-browser",
  command: "agent-browser",
  args: ["mcp"],
  env: [],
  enabled: true,
};

test("MCP settings panel communicates stdio-only approval and new-session lifecycle", () => {
  const html = renderToStaticMarkup(createElement(McpServersPanel));
  assert.match(html, /approved local stdio servers/u);
  assert.match(html, /still needs approval/u);
  assert.match(html, /new session/u);
  assert.match(html, /temporary process/u);
  assert.match(html, /Environment \(non-secret/u);
});

test("MCP server row shows ready, failed, and restart-required probe state", () => {
  const testedAt = new Date("2026-09-22T14:34:00").toISOString();
  const ready = renderToStaticMarkup(
    createElement(McpServerList, {
      servers: [server],
      busy: false,
      health: {
        restartRequired: false,
        servers: [
          {
            name: "agent-browser",
            status: "ready",
            toolCount: 29,
            testedAt,
            lines: ["29 tools discovered"],
          },
        ],
      },
      onEdit: () => undefined,
      onToggle: () => undefined,
      onRemove: () => undefined,
      onTest: () => undefined,
    }),
  );
  assert.match(ready, /● READY/u);
  assert.match(ready, /agent-browser mcp/u);
  assert.match(ready, /29 tools discovered/u);
  assert.match(ready, /Tested 14:34/u);
  assert.match(ready, /Reload &amp; Test/u);
  const failed = renderToStaticMarkup(
    createElement(McpServerList, {
      servers: [server],
      busy: false,
      health: {
        restartRequired: false,
        servers: [
          {
            name: "agent-browser",
            status: "failed",
            stage: "handshake",
            lines: ["process started", "MCP handshake failed"],
          },
        ],
      },
      onEdit: () => undefined,
      onToggle: () => undefined,
      onRemove: () => undefined,
      onTest: () => undefined,
    }),
  );
  assert.match(failed, /● FAILED/u);
  assert.match(failed, /process started/u);
  assert.match(failed, /MCP handshake failed/u);
  const restart = renderToStaticMarkup(
    createElement(McpServerList, {
      servers: [server],
      busy: false,
      health: {
        restartRequired: true,
        servers: [
          {
            name: "agent-browser",
            status: "restart_required",
            lines: [
              "configuration saved",
              "active chat still uses previous MCP catalog",
            ],
          },
        ],
      },
      onEdit: () => undefined,
      onToggle: () => undefined,
      onRemove: () => undefined,
      onTest: () => undefined,
    }),
  );
  assert.match(restart, /● RESTART REQUIRED/u);
  assert.match(restart, /configuration saved/u);
  assert.match(restart, /active chat still uses previous MCP catalog/u);
});
