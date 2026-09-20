import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { McpServersPanel } from "./mcp-servers-panel.js";

test("MCP settings panel communicates stdio-only approval and new-session lifecycle", () => {
  const html = renderToStaticMarkup(createElement(McpServersPanel));
  assert.match(html, /approved local stdio servers/u);
  assert.match(html, /still needs approval/u);
  assert.match(html, /new session/u);
  assert.match(html, /Environment \(non-secret/u);
});
