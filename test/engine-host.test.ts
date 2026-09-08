import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { EngineHost } from "../src/engine/engine-host.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { WireClient } from "./fixtures/gui-wire-client.js";
import type { SessionNotification } from "@agentclientprotocol/sdk";
import { MEMORY_CONTEXT_SYSTEM_INSTRUCTION } from "../src/orchestration/memory-prompt-composer.js";

test("engine panel shares external session, settings, stream and project memory; closing panel keeps session", async () => {
  const provider = await startSessionControlProvider();
  const f = isolatedMemoryEnv({ NVIDIA_BASE_URL: provider.endpoint });
  // The runtime endpoint override uses the full chat-completions URL.
  f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
  f.env.A008_ENGINE_DATA_PATH = join(f.directory, "engine");
  const workspace = join(f.directory, "project"); mkdirSync(workspace);
  const engine = new EngineHost({ env: f.env, staticDir: resolve("gui/dist") });
  let wire: WireClient | undefined;
  let origin = "";
  try {
    const created = await engine.newSession({ cwd: workspace, mcpServers: [] });
    const panel = created._meta["engine.panels"][0]!;
    const url = new URL(panel.url); origin = url.origin;
    const token = new URLSearchParams(url.hash.slice(1)).get("engine")!;
    const headers = { authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${origin}/v1/memory`)).status, 401);
    assert.equal((await fetch(`${origin}/v1/models`, { headers })).status, 200);
    wire = await WireClient.open(Number(url.port), token);
    wire.send({ type: "session/new", requestId: "attach" });
    const attached = await wire.until("session/new/ok");
    assert.equal(attached.sessionId, created.sessionId);
    assert.equal(attached.state.runtime.cwd, realpathSync(workspace));
    const old = attached.state.runtimePreferences;
    wire.send({ type: "session/control", requestId: "settings", sessionId: created.sessionId,
      control: { action: "configureRuntime", revision: old.revision, settings: { ...old.settings, instructions: "Engine instruction fixture." } } });
    assert.equal((await wire.until("session/control/ok", "settings")).state.runtimePreferences.settings.instructions, "Engine instruction fixture.");
    const notifications: SessionNotification[] = [];
    await engine.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "Native client question." }] }, async n => { notifications.push(n); });
    const finished = await wire.until("session/activity");
    assert.equal(finished.type, "session/activity");
    const state = engine.control(created.sessionId, { action: "inspect" });
    assert.equal(state.messages.length, 2);
    assert.ok(notifications.some(n => n.update.sessionUpdate === "agent_message_chunk"));
    const configured = provider.requests.find(r => r.messages.some((m: any) => m.role === "system" && m.content.includes("Engine instruction fixture.")));
    assert.ok(configured);
    assert.deepEqual(configured.messages.filter((m: any) => m.role === "system"), [{
      role: "system", content: `Engine instruction fixture.\n\n${MEMORY_CONTEXT_SYSTEM_INSTRUCTION}`,
    }]);
    const upload = await fetch(`${origin}/v1/upload`, { method: "POST", headers: { ...headers, "content-type": "application/octet-stream", "x-a008-filename": "engine.txt" }, body: "Engine upload fixture." });
    assert.equal(upload.status, 200);
    const memory = await (await fetch(`${origin}/v1/memory`, { headers })).json() as any;
    assert.equal(memory.projectId, state.runtime.projectId);
    assert.ok(memory.summary.total > 0);
    wire.socket.close(); wire = undefined;
    await engine.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "After panel close." }] }, async () => undefined);
    assert.equal(engine.control(created.sessionId, { action: "inspect" }).messages.length, 4);
    assert.ok(readFileSync(f.env.A008_SETTINGS_PATH!, "utf8").includes("Engine instruction fixture."));
  } finally { wire?.socket.close(); await engine.close(); await provider.close(); rmSync(f.directory, { recursive: true, force: true }); }
  await assert.rejects(fetch(`${origin}/health`));
});

test("engine project selection isolates runtime identities and memory and rejects ambiguous memory access", async () => {
  const f = isolatedMemoryEnv(); f.env.A008_ENGINE_DATA_PATH = join(f.directory, "data");
  const engine = new EngineHost({ env: f.env });
  try {
    const first = join(f.directory, "first"), second = join(f.directory, "second"); mkdirSync(first); mkdirSync(second);
    const a = await engine.newSession({ cwd: first, mcpServers: [] });
    const b = await engine.newSession({ cwd: second, mcpServers: [] });
    const a2 = await engine.newSession({ cwd: first, mcpServers: [] });
    const sa = engine.control(a.sessionId, { action: "inspect" });
    const sb = engine.control(b.sessionId, { action: "inspect" });
    assert.notEqual(sa.runtime.projectId, sb.runtime.projectId);
    assert.notEqual(sa.runtime.memoryPath, sb.runtime.memoryPath);
    assert.equal(engine.control(a2.sessionId, { action: "inspect" }).runtime.projectId, sa.runtime.projectId);
    assert.throws(() => engine.projectAgent({}), /Select a project/);
    await assert.rejects(engine.newSession({ cwd: ".", mcpServers: [] }), /absolute/);
    await engine.closeSession(a.sessionId);
    assert.throws(() => engine.sessionAgent(a.sessionId), /Unknown/);
    assert.equal(engine.control(a2.sessionId, { action: "inspect" }).messages.length, 0);
  } finally { await engine.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("explicit legacy attachment preserves its store and reports model and close changes to the client", async () => {
  const f = isolatedMemoryEnv();
  const workspace = join(f.directory, "legacy"); mkdirSync(workspace);
  f.env.A008_ENGINE_LEGACY_CWD = workspace;
  f.env.A008_SOURCE_STORE_PATH = join(f.directory, "sources");
  f.env.A008_ENGINE_DATA_PATH = join(f.directory, "engine");
  const notifications: SessionNotification[] = [];
  const engine = new EngineHost({ env: f.env });
  try {
    assert.equal(engine.sharedMemoryCapabilities({ protocol: "A007_MEMORY_V1", version: 1 }).projectId, null);
    const created = await engine.newSession({ cwd: workspace, mcpServers: [] }, { notify: async n => { notifications.push(n); } });
    assert.equal(engine.control(created.sessionId, { action: "inspect" }).runtime.memoryPath, f.env.A008_MEMORY_SQLITE_PATH);
    assert.equal(engine.projectAgent({ projectId: `local:${workspace}` }), engine.sessionAgent(created.sessionId));
    engine.control(created.sessionId, { action: "model", model: "moonshotai/kimi-k3" });
    assert.ok(notifications.some(n => n.update.sessionUpdate === "config_option_update"));
    await engine.closeSession(created.sessionId);
    assert.ok(notifications.some(n => n.update._meta?.["engine.closed"] === true));
  } finally { await engine.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
