import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrowserPane, normalizeUrl } from "./browser-pane.js";

test("browser only accepts http(s) addresses", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("https://docs.nvidia.com/foo"), "https://docs.nvidia.com/foo");
  assert.equal(normalizeUrl("javascript:alert(1)"), undefined);
  assert.equal(normalizeUrl("file:///etc/passwd"), undefined);
  assert.equal(normalizeUrl("   "), undefined);
});

test("browser pane sandboxes the frame and does not grant model tools", () => {
  const html = renderToStaticMarkup(createElement(BrowserPane));
  assert.match(html, /aria-label="Browser"/u);
  assert.match(html, /sandbox="/u);
  assert.match(html, /does not grant the model browser tools/u);
  assert.equal(html.includes("allow-same-origin"), false);
});
