import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  escapeHtml,
  highlightCode,
  MAX_HIGHLIGHT_BYTES,
  resolveHighlightLanguage,
} from "./highlight.js";
import { HighlightedCode } from "./highlighted-code.js";
import { HighlightedEditor } from "./highlighted-editor.js";

test("javascript highlighting marks keywords and escapes markup", () => {
  const result = highlightCode("const x = 1; // hi", "js");
  assert.equal(result.language, "javascript");
  assert.match(result.html, /hljs-keyword/u);
  assert.equal(result.html.includes("<script>"), false);
});

test("html fences keep tags escaped", () => {
  const result = highlightCode(
    '<canvas id="demo"></canvas><script>alert(1)</script>',
    "html",
  );
  assert.equal(result.language, "xml");
  assert.equal(result.html.includes("<canvas"), false);
  assert.equal(result.html.includes("<script>alert"), false);
  assert.match(result.html, /&lt;/u);
  assert.match(result.html, /hljs-(?:tag|name)/u);
});

test("unknown or unlabeled fences stay escaped plaintext", () => {
  assert.equal(resolveHighlightLanguage("not-a-lang"), undefined);
  assert.equal(
    highlightCode("<b>plain</b>", "not-a-lang").html,
    escapeHtml("<b>plain</b>"),
  );
  assert.equal(highlightCode("const x = 1;").html, escapeHtml("const x = 1;"));
});

test("highlighted code component renders escaped html", () => {
  const html = renderToStaticMarkup(
    createElement(HighlightedCode, {
      language: "html",
      code: '<canvas id="demo"></canvas>',
    }),
  );
  assert.match(html, /a008-hl/u);
  assert.equal(html.includes("<canvas"), false);
  assert.match(html, /&lt;/u);
  assert.match(html, /hljs-(?:tag|name|attr)/u);
});

test("highlighted editor overlays escaped source", () => {
  const html = renderToStaticMarkup(
    createElement(HighlightedEditor, {
      language: "html",
      value: "<script>alert(1)</script>",
      onChange() {},
      "aria-label": "HTML artifact source",
    }),
  );
  assert.match(html, /a008-hl-editor/u);
  assert.match(html, /a008-hl-backdrop/u);
  assert.equal(html.includes("<script>alert"), false);
  assert.match(html, /&lt;script/u);
  assert.match(html, /aria-label="HTML artifact source"/u);
});

test("oversized blocks stay escaped plaintext", () => {
  const code = "x".repeat(MAX_HIGHLIGHT_BYTES + 1);
  const result = highlightCode(code, "js");
  assert.equal(result.html, escapeHtml(code));
  assert.equal(result.html.includes("hljs-"), false);
});
