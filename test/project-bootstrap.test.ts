import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { executeProjectBootstrap, previewProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "a008-bootstrap-"));
}

function config(overrides: Record<string, unknown> = {}) {
  const root =
    typeof overrides.rootFolder === "string" ? overrides.rootFolder : join(tempDir(), "app");
  return parseProjectBootstrapConfig({
    projectName: "North Star",
    repository: { initialize: false },
    continuity: { docsFirst: true, multiAgent: { enabled: false } },
    memory: { useGlobalA008Memory: true },
    ...overrides,
    rootFolder: root,
  });
}

test("unknown or relative paths and worker roots inside the project fail closed", () => {
  assert.throws(() => parseProjectBootstrapConfig({ projectName: "", rootFolder: "C:\\code\\x" }), /required/u);
  assert.throws(
    () => parseProjectBootstrapConfig({ projectName: "X", rootFolder: "relative" }),
    /absolute/u,
  );
  const nested = join(tempDir(), "proj");
  assert.throws(
    () =>
      parseProjectBootstrapConfig({
        projectName: "X",
        rootFolder: nested,
        continuity: {
          docsFirst: true,
          multiAgent: {
            enabled: true,
            maxWorkers: 2,
            workerCloneRoot: join(nested, "workers"),
          },
        },
      }),
    /outside the project tree/u,
  );
});

test("multi-agent without docs-first fails; enabling the add-on requires continuity", () => {
  assert.throws(
    () =>
      parseProjectBootstrapConfig({
        projectName: "X",
        rootFolder: join(tempDir(), "proj"),
        continuity: {
          docsFirst: false,
          multiAgent: { enabled: true, workerCloneRoot: join(tempDir(), "workers") },
        },
      }),
    /required for the multi-agent/u,
  );
});

test("preview matches the files execute writes", () => {
  const parsed = config();
  const store = { registryPath: join(tempDir(), "projects.json") };
  const preview = previewProjectBootstrap(parsed, store);
  const executed = executeProjectBootstrap(parsed, store, preview.projectId);
  assert.equal(executed.plan.projectId, preview.projectId);
  assert.deepEqual(
    executed.plan.mutations.map((item) => item.path),
    preview.mutations.map((item) => item.path),
  );
  assert.equal(readFileSync(join(parsed.rootFolder, "AGENTS.md"), "utf8").includes("North Star"), true);
  assert.equal(executed.project.memory.useGlobalA008Memory, true);
});

test("non-empty unexpected folders are refused", () => {
  const root = join(tempDir(), "dirty");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "readme.txt"), "nope");
  const parsed = config({ rootFolder: root });
  assert.throws(
    () => executeProjectBootstrap(parsed, { registryPath: join(tempDir(), "projects.json") }),
    /not empty/u,
  );
});

test("git init and docs-first flags are independently honored", () => {
  const parsed = config({
    repository: { initialize: true, name: "north-star" },
    continuity: { docsFirst: false, multiAgent: { enabled: false } },
  });
  const executed = executeProjectBootstrap(parsed, { registryPath: join(tempDir(), "projects.json") });
  assert.equal(executed.plan.mutations.some((item) => item.kind === "git-init"), true);
  assert.equal(executed.plan.mutations.some((item) => item.kind === "write"), false);
});

test("add-on records policy and worker root without creating worker clones", () => {
  const root = join(tempDir(), "app");
  const workers = join(tempDir(), "workers");
  const parsed = parseProjectBootstrapConfig({
    projectName: "North Star",
    rootFolder: root,
    repository: { initialize: false },
    continuity: {
      docsFirst: true,
      multiAgent: { enabled: true, maxWorkers: 3, workerCloneRoot: workers },
    },
    memory: { useGlobalA008Memory: true },
  });
  const executed = executeProjectBootstrap(parsed, { registryPath: join(tempDir(), "projects.json") });
  assert.equal(executed.plan.multiAgent.enabled, true);
  if (executed.plan.multiAgent.enabled) {
    assert.equal(executed.plan.multiAgent.maxWorkers, 3);
    assert.equal(readFileSync(join(root, "docs/MULTIAGENT.md"), "utf8").includes(workers.replaceAll("\\", "\\\\")) || readFileSync(join(root, "docs/MULTIAGENT.md"), "utf8").includes(workers), true);
  }
  assert.equal(readFileSync(join(root, "docs/MULTIAGENT.md"), "utf8").includes("worker-01"), false);
  assert.equal(existsSync(join(workers, "worker-01")), false);
});
