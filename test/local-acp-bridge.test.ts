import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import { createLocalAcpBridge } from "../src/gui-host/local-acp-bridge.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { WireClient } from "./fixtures/gui-wire-client.js";

test("fixed project bridges isolate sessions while sharing project knowledge and borrowing lifetime", async () => {
  const provider = await startSessionControlProvider();
  const f = isolatedMemoryEnv({
    NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
  });
  const aPath = join(f.directory, "a"),
    bPath = join(f.directory, "b");
  mkdirSync(aPath);
  mkdirSync(bPath);
  const registry = new ProjectRuntimeRegistry({ env: f.env });
  const a = createLocalAcpBridge({ registry, env: f.env, cwd: aPath });
  const a2 = createLocalAcpBridge({ registry, env: f.env, cwd: aPath });
  const b = createLocalAcpBridge({
    registry,
    env: {
      ...f.env,
      A008_PROJECT_ID: "A008_v1_project_40000000-0000-4000-8000-000000000098",
    },
    cwd: bPath,
  });
  try {
    const [sa, sa2, sb] = await Promise.all([
      a.newSession(),
      a2.newSession(),
      b.newSession(),
    ]);
    await assert.rejects(
      b.controlSession!(sa.sessionId, { action: "inspect" }),
      /Unknown project session/u,
    );
    await assert.rejects(
      a2.closeSession(sa.sessionId),
      /Unknown project session/u,
    );
    let answer = "";
    await a.prompt(
      sa.sessionId,
      "First project fixture.",
      {
        onThought() {},
        onAnswer: (text) => {
          answer += text;
        },
      },
      new AbortController().signal,
    );
    assert.ok(answer.includes("Fixture answer"));
    assert.equal(
      (await a2.controlSession!(sa2.sessionId, { action: "inspect" })).messages
        .length,
      0,
    );
    assert.equal(
      (await b.controlSession!(sb.sessionId, { action: "inspect" })).messages
        .length,
      0,
    );
    registry
      .openConfigured(aPath, f.env)
      .runtime.writeSharedMemory({ content: "Shared fixture knowledge." });
    await a.close();
    assert.ok(
      (await a2.inspectMemory!({})).records.some((row) =>
        row.detail.includes("Shared fixture"),
      ),
    );
    assert.ok(
      !(await b.inspectMemory!({})).records.some((row) =>
        row.detail.includes("Shared fixture"),
      ),
    );
    const abort = new AbortController();
    let started!: () => void;
    const streaming = new Promise<void>((resolve) => {
      started = resolve;
    });
    const prompt = a2.prompt(
      sa2.sessionId,
      "WAIT-TURN",
      { onThought: started, onAnswer() {} },
      abort.signal,
    );
    await streaming;
    abort.abort();
    await prompt;
    assert.equal(
      (await a2.controlSession!(sa2.sessionId, { action: "inspect" })).messages
        .length,
      0,
    );
    assert.equal(
      (await b.controlSession!(sb.sessionId, { action: "inspect" })).messages
        .length,
      0,
    );
  } finally {
    await a.close();
    await a2.close();
    await b.close();
    registry.close();
    await provider.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("two real hosts borrow one memory-off runtime and closing one leaves the other usable", async () => {
  const f = isolatedMemoryEnv({ A008_MEMORY_SQLITE_PATH: ":memory:" });
  const cwd = join(f.directory, "project");
  mkdirSync(cwd);
  const registry = new ProjectRuntimeRegistry({ env: f.env });
  const a = await startGuiHost({
    env: f.env,
    cwd,
    port: 0,
    projectRegistry: registry,
  });
  const b = await startGuiHost({
    env: f.env,
    cwd,
    port: 0,
    projectRegistry: registry,
  });
  const wa = await WireClient.open(a.port),
    wb = await WireClient.open(b.port);
  let aClosed = false;
  try {
    wa.send({ type: "session/new", requestId: "a" });
    wb.send({ type: "session/new", requestId: "b" });
    const sa = await wa.until("session/new/ok"),
      sb = await wb.until("session/new/ok");
    assert.equal(sa.type, "session/new/ok", sa.message);
    assert.equal(sb.type, "session/new/ok", sb.message);
    assert.equal(sa.state.runtime.memoryPath, ":memory:");
    assert.equal(sa.state.runtime.projectId, sb.state.runtime.projectId);
    await a.close();
    aClosed = true;
    wb.send({
      type: "session/control",
      requestId: "inspect",
      sessionId: sb.sessionId,
      control: { action: "inspect" },
    });
    const state = await wb.until("session/control/ok", "inspect");
    assert.equal(state.type, "session/control/ok", state.message);
  } finally {
    wa.socket.close();
    wb.socket.close();
    if (!aClosed) await a.close();
    await b.close();
    registry.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});
