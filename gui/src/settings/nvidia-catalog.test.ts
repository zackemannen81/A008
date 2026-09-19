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
  assert.match(html, /kie.ai/u);
  assert.match(html, /OpenAI/u);
  assert.match(html, /GPT-5.6 Luna/u);
  assert.match(html, /GPT-5.6 Terra/u);
  assert.match(html, /native.*OpenAI Responses/u);
  assert.match(html, /sk-…/u);
  assert.match(html, /docs.kie.ai/u);
  assert.match(html, /async Market jobs/u);
});
