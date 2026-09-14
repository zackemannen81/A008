import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { executeProjectBootstrap, previewProjectBootstrap, registerExistingProject } from "../src/bootstrap/service.js";
import { readProjectRegistry } from "../src/bootstrap/registry.js";
import { parseExistingProjectRegistration, parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";

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


test("existing non-empty project registers without mutating its tree", () => {
  const root = join(tempDir(), "existing");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "README.md"), "keep-me\n", "utf8");
  writeFileSync(join(root, "AGENTS.md"), "existing agents\n", "utf8");
  writeFileSync(join(root, "docs", "TASK_WORKFLOW.md"), "existing workflow\n", "utf8");
  const before = {
    readme: readFileSync(join(root, "README.md"), "utf8"),
    agents: readFileSync(join(root, "AGENTS.md"), "utf8"),
    workflow: readFileSync(join(root, "docs", "TASK_WORKFLOW.md"), "utf8"),
  };
  const registryPath = join(tempDir(), "projects.json");
  const parsed = parseExistingProjectRegistration({
    projectName: "Existing North Star", rootFolder: root,
    memory: { useGlobalA008Memory: true },
  });
  const project = registerExistingProject(parsed, { registryPath });
  assert.match(project.projectId, /^A008_v1_project_[0-9a-f-]+$/u);
  assert.equal(project.name, "Existing North Star");
  assert.equal(project.repository.initialize, false);
  assert.equal(project.continuity.docsFirst, true);
  assert.deepEqual(project.continuity.multiAgent, { enabled: false });
  assert.equal(project.memory.useGlobalA008Memory, true);
  assert.deepEqual({
    readme: readFileSync(join(root, "README.md"), "utf8"),
    agents: readFileSync(join(root, "AGENTS.md"), "utf8"),
    workflow: readFileSync(join(root, "docs", "TASK_WORKFLOW.md"), "utf8"),
  }, before);
  assert.equal(existsSync(join(root, ".git")), false);
  const registry = readProjectRegistry(registryPath);
  assert.equal(registry.currentId, project.projectId);
  assert.deepEqual(registry.projects, [project]);
});


test("existing project registration refuses invalid and duplicate roots", () => {
  assert.throws(
    () => parseExistingProjectRegistration({ projectName: "X", rootFolder: "relative", memory: { useGlobalA008Memory: true } }),
    /absolute/u,
  );
  const missing = join(tempDir(), "missing");
  assert.throws(
    () => registerExistingProject(parseExistingProjectRegistration({ projectName: "X", rootFolder: missing, memory: { useGlobalA008Memory: true } }), { registryPath: join(tempDir(), "projects.json") }),
    /existing directory/u,
  );
  const fileRoot = join(tempDir(), "file.txt");
  writeFileSync(fileRoot, "not a directory", "utf8");
  assert.throws(
    () => registerExistingProject(parseExistingProjectRegistration({ projectName: "X", rootFolder: fileRoot, memory: { useGlobalA008Memory: false } }), { registryPath: join(tempDir(), "projects.json") }),
    /existing directory/u,
  );
  const root = join(tempDir(), "existing"); mkdirSync(root);
  const registryPath = join(tempDir(), "projects.json");
  const first = parseExistingProjectRegistration({ projectName: "One", rootFolder: root, memory: { useGlobalA008Memory: false } });
  registerExistingProject(first, { registryPath });
  assert.throws(
    () => registerExistingProject({ ...first, projectName: "Two" }, { registryPath }),
    /already registered.*Recent/iu,
  );
});
