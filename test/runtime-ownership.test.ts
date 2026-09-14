import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAcpRuntime } from "../src/acp/server.js";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import { isolatedMemoryEnv, TEST_PROJECT_ID } from "./helpers.js";

function processOwner() {
  const child = fork(new URL("./fixtures/runtime-owner-process.js", import.meta.url), [], { silent: true });
  // Attach immediately so a fast exit can never be missed by cleanup.
  const exited = once(child, "exit");
  return {
    async open(env: NodeJS.ProcessEnv, cwd: string, existing?: { projectId: string; sqlitePath: string }) {
      const result = once(child, "message", { signal: AbortSignal.timeout(10_000) });
      child.send({ action: "open", env, cwd, existing });
      return (await result)[0] as { ok: boolean; projectId: string; error?: string };
    },
    async close(crash = false) {
      if (child.exitCode === null && child.signalCode === null) {
        if (crash) child.kill("SIGKILL");
        else child.send({ action: "close" });
      }
      await exited;
    },
  };
}

test("process ownership rejects canonical aliases before creation and releases on close or crash", async () => {
  const f = isolatedMemoryEnv(); f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const cwd = join(f.directory, "project"), alias = join(f.directory, "alias"); mkdirSync(cwd);
  symlinkSync(cwd, alias, process.platform === "win32" ? "junction" : "dir");
  try {
    for (const crash of [false, true]) {
      const child = processOwner(); let created = 0;
      const contender = new ProjectRuntimeRegistry({ env: f.env, createRuntime(options) { created++; return createAcpRuntime(options); } });
      try {
        const first = await child.open(f.env, cwd); assert.equal(first.ok, true, first.error);
        assert.throws(() => contender.openEngine(alias), /process owner/u);
        assert.equal(created, 0);
        await child.close(crash);
        const next = contender.openEngine(alias);
        assert.equal(next.runtime.projectId, first.projectId);
      } finally { await child.close(true); contender.close(); }
    }
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("process namespace leases allow separate projects in one SQLite file and preserve seeded data", async () => {
  const f = isolatedMemoryEnv(), a = join(f.directory, "a"), b = join(f.directory, "b"); mkdirSync(a); mkdirSync(b);
  const second = "A008_v1_project_40000000-0000-4000-8000-000000000098";
  for (const id of [TEST_PROJECT_ID, second]) {
    const seed = createAcpRuntime({ env: { ...f.env, A008_PROJECT_ID: id }, cwd: a, stderr: process.stderr });
    seed.runtime.writeSharedMemory({ content: `Seeded namespace ${id}` }); seed.runtime.close();
  }
  const child = processOwner(), registry = new ProjectRuntimeRegistry({ env: f.env });
  try {
    const first = await child.open(f.env, a, { projectId: TEST_PROJECT_ID, sqlitePath: f.sqlitePath }); assert.equal(first.ok, true, first.error);
    const before = readFileSync(f.sqlitePath);
    assert.throws(() => registry.attachExisting({ cwd: a, projectId: TEST_PROJECT_ID, sqlitePath: f.sqlitePath }), /process owner/u);
    assert.deepEqual(readFileSync(f.sqlitePath), before);
    const other = registry.attachExisting({ cwd: b, projectId: second, sqlitePath: f.sqlitePath });
    assert.ok(other.runtime.inspectMemory().records.some(row => row.detail.includes(second)));
    assert.ok(!other.runtime.inspectMemory().records.some(row => row.detail.includes(TEST_PROJECT_ID)));
  } finally { await child.close(true); registry.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("simultaneous first opens select one sidecar identity and one process owner", async () => {
  const f = isolatedMemoryEnv(); f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const cwd = join(f.directory, "project"); mkdirSync(cwd);
  const a = processOwner(), b = processOwner();
  try {
    const results = await Promise.all([a.open(f.env, cwd), b.open(f.env, cwd)]);
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.match(results.find(result => !result.ok)!.error!, /process owner/u);
    await Promise.all([a.close(true), b.close(true)]);
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    try { assert.equal(registry.openEngine(cwd).runtime.projectId, results.find(result => result.ok)!.projectId); }
    finally { registry.close(); }
  } finally { await Promise.all([a.close(true), b.close(true)]); rmSync(f.directory, { recursive: true, force: true }); }
});
