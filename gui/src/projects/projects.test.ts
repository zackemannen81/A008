import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerExistingProject } from "./bootstrap-client.js";
import { ProjectsPage } from "./projects-page.js";

const here = dirname(fileURLToPath(import.meta.url));

test("Projects wizard renders New, Recent and continuity controls", () => {
  const html = renderToStaticMarkup(createElement(ProjectsPage, { onOpened() {} }));
  assert.match(html, />New project</u);
  assert.match(html, />Add existing</u);
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
  assert.match(source, /\/v1\/projects\/register/u);
});



test("existing-project client posts only registration JSON to the host", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const project = {
    projectId: "A008_v1_project_00000000-0000-4000-8000-000000000001",
    name: "Existing", rootFolder: "C:\\code\\existing", createdAt: "2026-09-15T00:00:00.000Z",
    repository: { initialize: false, name: "existing" },
    continuity: { docsFirst: false, multiAgent: { enabled: false as const } },
    memory: { useGlobalA008Memory: true },
  };
  const result = await registerExistingProject(
    { projectName: "Existing", rootFolder: "C:\\code\\existing", memory: { useGlobalA008Memory: true } },
    async (input, init) => { observedUrl = String(input); observedInit = init; return Response.json(project); },
  );
  assert.equal(observedUrl, "/v1/projects/register");
  assert.equal(observedInit?.method, "POST");
  assert.deepEqual(JSON.parse(String(observedInit?.body)), {
    projectName: "Existing", rootFolder: "C:\\code\\existing", memory: { useGlobalA008Memory: true },
  });
  assert.deepEqual(result, project);
});
