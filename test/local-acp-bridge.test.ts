import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EngineHost } from "../src/engine/engine-host.js";
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


test("standalone workspace restores project A across switches and restart without leaking into B", async () => {
  const provider = await startSessionControlProvider();
  const f = isolatedMemoryEnv({
    NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
  });
  const aPath = join(f.directory, "restore-a");
  const bPath = join(f.directory, "restore-b");
  mkdirSync(aPath);
  mkdirSync(bPath);
  const envA = {
    ...f.env,
    A008_PROJECT_ID:
      "A008_v1_project_40000000-0000-4000-8000-000000000147",
  };
  const envB = {
    ...f.env,
    A008_PROJECT_ID:
      "A008_v1_project_40000000-0000-4000-8000-000000000148",
  };
  let registry = new ProjectRuntimeRegistry({ env: f.env });
  let bridge = createLocalAcpBridge({ registry, env: envA, cwd: aPath });
  let firstSessionId = "";
  let requestsAfterTurn = 0;
  try {
    const first = await bridge.newSession();
    firstSessionId = first.sessionId;
    await bridge.prompt(
      first.sessionId,
      "Persist project A conversation.",
      { onThought() {}, onAnswer() {} },
      new AbortController().signal,
    );
    const committed = await bridge.controlSession!(first.sessionId, {
      action: "inspect",
    });
    assert.deepEqual(
      committed.messages.map((message) => message.role),
      ["user", "assistant"],
    );
    requestsAfterTurn = provider.requests.length;
    await bridge.close();

    bridge = createLocalAcpBridge({ registry, env: envB, cwd: bPath });
    const b = await bridge.newSession();
    assert.equal(
      (await bridge.controlSession!(b.sessionId, { action: "inspect" })).messages
        .length,
      0,
    );
    await bridge.close();

    bridge = createLocalAcpBridge({ registry, env: envA, cwd: aPath });
    const reopened = await bridge.newSession();
    assert.notEqual(reopened.sessionId, firstSessionId);
    const restored = await bridge.controlSession!(reopened.sessionId, {
      action: "inspect",
    });
    assert.deepEqual(restored.messages, committed.messages);
    assert.equal(provider.requests.length, requestsAfterTurn);

    const genericHost = new EngineHost({
      env: envA,
      registry,
      createPanels: false,
    });
    try {
      const generic = await genericHost.newSession({
        cwd: aPath,
        mcpServers: [],
      });
      assert.equal(
        genericHost.control(generic.sessionId, { action: "inspect" }).messages
          .length,
        0,
        "generic EngineHost sessions must not inherit workspace conversation state",
      );
    } finally {
      await genericHost.close();
    }

    await bridge.close();
    registry.close();

    registry = new ProjectRuntimeRegistry({ env: f.env });
    bridge = createLocalAcpBridge({ registry, env: envA, cwd: aPath });
    const restarted = await bridge.newSession();
    assert.notEqual(restarted.sessionId, reopened.sessionId);
    const afterRestart = await bridge.controlSession!(restarted.sessionId, {
      action: "inspect",
    });
    assert.deepEqual(afterRestart.messages, committed.messages);
    assert.equal(provider.requests.length, requestsAfterTurn);

    const changed = await bridge.controlSession!(restarted.sessionId, {
      action: "model",
      model: "gpt-5.6-terra",
    });
    assert.equal(changed.model, "gpt-5.6-terra");
    assert.equal(changed.messages.length, 0);
    await bridge.close();

    bridge = createLocalAcpBridge({ registry, env: envA, cwd: aPath });
    const afterModelChange = await bridge.newSession();
    const freshConversation = await bridge.controlSession!(
      afterModelChange.sessionId,
      { action: "inspect" },
    );
    assert.equal(freshConversation.model, "gpt-5.6-terra");
    assert.equal(freshConversation.messages.length, 0);
    assert.equal(provider.requests.length, requestsAfterTurn);
  } finally {
    await bridge.close().catch(() => undefined);
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
