import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectsPage } from "./projects-page.js";

const here = dirname(fileURLToPath(import.meta.url));

test("Projects wizard renders New, Recent and continuity controls", () => {
  const html = renderToStaticMarkup(createElement(ProjectsPage, { onOpened() {} }));
  assert.match(html, />New project</u);
  assert.match(html, />Recent</u);
  assert.match(html, /Docs-First Continuity Protocol/u);
  assert.match(html, /Multi-Agent Orchestrator Add-on/u);
  assert.match(html, /Use global A008 memory/u);
  assert.match(html, />Create project</u);
  assert.equal(html.includes("worker-01"), false);
});

test("GUI bootstrap client module does not import node:fs", () => {
  const source = readFileSync(join(here, "bootstrap-client.ts"), "utf8");
  assert.equal(source.includes("node:fs"), false);
  assert.match(source, /\/v1\/projects/u);
});

