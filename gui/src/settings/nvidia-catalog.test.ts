import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NvidiaCatalogPanel } from "./nvidia-catalog-panel.js";

test("provider panel explains Free Endpoint and write-only API key", () => {
  const html = renderToStaticMarkup(createElement(NvidiaCatalogPanel));
  assert.match(html, /NVIDIA Build/u);
  assert.match(html, /write only/u);
  assert.match(html, /NGC credits/u);
  assert.match(html, /Image endpoint/u);
});
