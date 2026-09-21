import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { createAcpRuntime } from "../src/acp/server.js";
import {
  addUserChatModel,
  loadUserCatalog,
  saveUserCatalog,
} from "../src/core/user-catalog.js";
import { EngineHost } from "../src/engine/engine-host.js";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import { isolatedMemoryEnv, TEST_PROJECT_ID } from "./helpers.js";

test("canonical aliases and concurrent callers reuse one engine runtime, disposed once", async () => {
  const f = isolatedMemoryEnv();
  f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const cwd = join(f.directory, "project"),
    alias = join(f.directory, "alias");
  mkdirSync(cwd);
  symlinkSync(cwd, alias, process.platform === "win32" ? "junction" : "dir");
  let created = 0,
    closed = 0;
  const registry = new ProjectRuntimeRegistry({
    env: f.env,
    createRuntime(options) {
      created++;
      const runtime = createAcpRuntime(options);
      const dispose = runtime.runtime.close.bind(runtime.runtime);
      runtime.runtime.close = () => {
        closed++;
        dispose();
      };
      return runtime;
    },
  });
  try {
    const results = await Promise.all(
      [cwd, alias, join(cwd, "."), cwd].map((path) =>
        Promise.resolve().then(() => registry.openEngine(path)),
      ),
    );
    assert.ok(results.every((result) => result === results[0]));
    assert.equal(created, 1);
    if (process.platform === "win32")
      assert.equal(registry.openEngine(cwd.toUpperCase()), results[0]);
    const projectId = results[0]!.runtime.projectId;
    registry.close();
    registry.close();
    assert.equal(closed, 1);
    assert.throws(() => registry.openEngine(cwd), /stopping/u);
    const reopened = new ProjectRuntimeRegistry({ env: f.env });
    try {
      assert.equal(reopened.openEngine(cwd).runtime.projectId, projectId);
    } finally {
      reopened.close();
    }
  } finally {
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("strict existing attachment preserves seeded knowledge and rejects missing or conflicting bindings before creation", () => {
  const f = isolatedMemoryEnv(),
    cwd = join(f.directory, "project"),
    sources = join(f.directory, "sources");
  mkdirSync(cwd);
  mkdirSync(sources);
  const seed = createAcpRuntime({
    env: { ...f.env, A008_SOURCE_STORE_PATH: sources },
    cwd,
    stderr: process.stderr,
  });
  const stored = seed.runtime.writeSharedMemory({
    content: "Existing project knowledge must survive attachment.",
  });
  seed.runtime.close();
  let created = 0;
  const registry = new ProjectRuntimeRegistry({
    env: f.env,
    createRuntime(options) {
      created++;
      return createAcpRuntime(options);
    },
  });
  const input = {
    cwd,
    projectId: TEST_PROJECT_ID,
    sqlitePath: f.sqlitePath,
    sourceStorePath: sources,
  };
  try {
    const before = readFileSync(f.sqlitePath);
    const missing = join(f.directory, "missing", "memory.sqlite");
    assert.throws(
      () => registry.attachExisting({ ...input, sqlitePath: missing }),
      /existing absolute SQLite/u,
    );
    assert.equal(existsSync(missing), false);
    assert.throws(
      () =>
        registry.attachExisting({
          ...input,
          sourceStorePath: join(f.directory, "absent"),
        }),
      /source-store/u,
    );
    assert.throws(
      () =>
        registry.attachExisting({
          ...input,
          projectId: "A008_v1_project_40000000-0000-4000-8000-000000000099",
        }),
      /namespace is absent/u,
    );
    assert.equal(created, 0);
    assert.deepEqual(readFileSync(f.sqlitePath), before);
    const project = registry.attachExisting(input);
    assert.equal(registry.attachExisting(input), project);
    assert.equal(registry.openEngine(cwd), project);
    assert.equal(project.runtime.projectId, TEST_PROJECT_ID);
    assert.ok(
      project.runtime
        .inspectMemory()
        .records.some((row) => row.sourceId === stored.id),
    );
    const anotherSources = join(f.directory, "another-sources");
    mkdirSync(anotherSources);
    assert.throws(
      () =>
        registry.attachExisting({ ...input, sourceStorePath: anotherSources }),
      /different runtime binding/u,
    );
    const competing = new ProjectRuntimeRegistry({ env: f.env });
    try {
      assert.throws(
        () => competing.attachExisting(input),
        /directory already has/u,
      );
      const anotherCwd = join(f.directory, "other");
      mkdirSync(anotherCwd);
      assert.throws(
        () => competing.attachExisting({ ...input, cwd: anotherCwd }),
        /namespace already has/u,
      );
    } finally {
      competing.close();
    }
    assert.equal(created, 1);
    registry.close();
    const reopened = new ProjectRuntimeRegistry({ env: f.env });
    try {
      assert.ok(
        reopened
          .attachExisting(input)
          .runtime.inspectMemory()
          .records.some((row) => row.sourceId === stored.id),
      );
    } finally {
      reopened.close();
    }
  } finally {
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("different existing namespaces can share a global SQLite file without sharing project state", () => {
  const f = isolatedMemoryEnv();
  const secondId = "A008_v1_project_40000000-0000-4000-8000-000000000098";
  const workspaces = [join(f.directory, "a"), join(f.directory, "b")];
  workspaces.forEach((path) => mkdirSync(path));
  for (const [index, id] of [TEST_PROJECT_ID, secondId].entries()) {
    const seed = createAcpRuntime({
      env: { ...f.env, A008_PROJECT_ID: id },
      cwd: workspaces[index]!,
      stderr: process.stderr,
    });
    seed.runtime.writeSharedMemory({
      content: `Only project ${index} owns this fixture.`,
    });
    seed.runtime.close();
  }
  const registry = new ProjectRuntimeRegistry({ env: f.env });
  try {
    const a = registry.attachExisting({
      cwd: workspaces[0]!,
      projectId: TEST_PROJECT_ID,
      sqlitePath: f.sqlitePath,
    });
    const b = registry.attachExisting({
      cwd: workspaces[1]!,
      projectId: secondId,
      sqlitePath: f.sqlitePath,
    });
    assert.notEqual(a, b);
    assert.equal(a.binding.sqlitePath, b.binding.sqlitePath);
    assert.ok(
      a.runtime
        .inspectMemory()
        .records.some((row) => row.detail.includes("Only project 0")),
    );
    assert.ok(
      !a.runtime
        .inspectMemory()
        .records.some((row) => row.detail.includes("Only project 1")),
    );
    b.runtime.writeSharedMemory({ content: "Second project added evidence." });
    assert.ok(
      !a.runtime
        .inspectMemory()
        .records.some((row) => row.detail.includes("Second project")),
    );
  } finally {
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("failed initialization releases claims, and disposal refuses sessions while fencing new work", () => {
  const f = isolatedMemoryEnv();
  f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const cwd = join(f.directory, "project");
  mkdirSync(cwd);
  let attempt = 0;
  const registry = new ProjectRuntimeRegistry({
    env: f.env,
    createRuntime(options) {
      if (++attempt === 1) throw new Error("synthetic initialization failure");
      return createAcpRuntime(options);
    },
  });
  try {
    assert.throws(() => registry.openEngine(cwd), /synthetic/u);
    const project = registry.openEngine(cwd);
    assert.equal(attempt, 2);
    const session = project.agent.newSession({ cwd, mcpServers: [] });
    assert.throws(() => registry.close(), /Close project sessions/u);
    assert.throws(() => registry.openEngine(cwd), /stopping/u);
    project.agent.closeSession({ sessionId: session.sessionId });
    registry.close();
  } finally {
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("two engine hosts borrow the same runtime without taking disposal ownership", async () => {
  const f = isolatedMemoryEnv();
  f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const cwd = join(f.directory, "project");
  mkdirSync(cwd);
  const registry = new ProjectRuntimeRegistry({ env: f.env });
  const a = new EngineHost({
    env: f.env,
    registry,
    staticDir: resolve("gui/dist"),
  });
  const b = new EngineHost({
    env: f.env,
    registry,
    staticDir: resolve("gui/dist"),
  });
  try {
    const [sa, sb] = await Promise.all([
      a.newSession({ cwd, mcpServers: [] }),
      b.newSession({ cwd, mcpServers: [] }),
    ]);
    assert.equal(a.sessionAgent(sa.sessionId), b.sessionAgent(sb.sessionId));
    await a.close();
    assert.equal(
      b.control(sb.sessionId, { action: "inspect" }).runtime.projectId,
      registry.openEngine(cwd).runtime.projectId,
    );
    await b.close();
    registry.close();
  } finally {
    await a.close();
    await b.close();
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});


test("ACP runtime resolves user-catalog models added after runtime startup", () => {
  const f = isolatedMemoryEnv({
    OPENROUTER_API_KEY: "openrouter-fixture",
  });
  const catalogPath = join(f.directory, "catalog.json");
  f.env.A008_CATALOG_PATH = catalogPath;
  const opened = createAcpRuntime({
    env: f.env,
    cwd: f.directory,
    stderr: process.stderr,
  });
  try {
    assert.throws(
      () => opened.runtime.sessionParameters("thinkingmachines/inkling:free"),
      /Unknown model/u,
    );

    saveUserCatalog(
      catalogPath,
      addUserChatModel(loadUserCatalog(catalogPath), {
        id: "thinkingmachines/inkling:free",
        name: "Inkling Free",
        provider: "openrouter",
        inputModalities: ["text"],
        baseUrl: "https://openrouter.ai/api/v1",
        apiStyle: "openai-chat-completions",
      }),
    );

    const parameters = opened.runtime.sessionParameters(
      "thinkingmachines/inkling:free",
    );
    assert.equal(parameters.maxTokens, 16_384);
    assert.equal(parameters.stream, true);

    const created = opened.agent.newSession(
      { cwd: f.directory, mcpServers: [] },
      { initialModel: "thinkingmachines/inkling:free" },
    );
    assert.match(created.sessionId, /^A008_v1_acp_session_/u);
  } finally {
    for (const id of opened.agent.openSessionIds()) {
      opened.agent.closeSession({ sessionId: id });
    }
    opened.runtime.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});
