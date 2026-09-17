import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrowserPane, BrowserViewport, normalizeUrl } from "./browser-pane.js";

test("browser only accepts http(s) addresses", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(
    normalizeUrl("https://docs.nvidia.com/foo"),
    "https://docs.nvidia.com/foo",
  );
  assert.equal(normalizeUrl("javascript:alert(1)"), undefined);
  assert.equal(normalizeUrl("file:///etc/passwd"), undefined);
  assert.equal(normalizeUrl("   "), undefined);
});

test("browser pane sandboxes the frame and does not grant model tools", () => {
  const html = renderToStaticMarkup(createElement(BrowserPane));
  assert.match(html, /aria-label="Browser"/u);
  assert.match(html, /Open/u);
  assert.match(html, /does not grant the model browser tools/u);
});

test("framed viewport is sandboxed without same-origin", () => {
  const html = renderToStaticMarkup(
    createElement(BrowserViewport, {
      url: "https://docs.nvidia.com/",
      mode: "framed",
    }),
  );
  assert.match(html, /sandbox="/u);
  assert.match(html, /https:\/\/docs\.nvidia\.com\//u);
  assert.equal(html.includes("allow-same-origin"), false);
});

test("blocked viewport does not iframe the page", () => {
  const html = renderToStaticMarkup(
    createElement(BrowserViewport, {
      url: "https://chatgpt.com/",
      mode: "blocked",
      reason: "frame-ancestors",
    }),
  );
  assert.equal(html.includes("<iframe"), false);
  assert.match(html, /chatgpt\.com/u);
  assert.match(html, /frame-ancestors/u);
  assert.match(html, /Open in browser/u);
});
