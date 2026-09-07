import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { startSessionControlProvider } from "../dist/test/fixtures/session-control-provider.js";
import { WireClient } from "../dist/test/fixtures/gui-wire-client.js";

const packageRoot = resolve(process.argv[2] || "missing-package"), clientRoot = resolve(process.argv[3] || "missing-client");
const require = createRequire(join(clientRoot, "package.json"));
const Module = require("node:module"), originalLoad = Module._load;
let CoreRuntimeHost;
try {
  Module._load = function (id, ...args) { return id === "electron" ? { app: {}, ipcMain: {}, BrowserWindow: { getAllWindows: () => [] } } : originalLoad.call(this, id, ...args); };
  ({ CoreRuntimeHost } = require(join(clientRoot, "electron/core-runtime-host.cjs")));
} finally { Module._load = originalLoad; }
const { normalizeManifest } = require(join(clientRoot, "electron/brain-discovery.cjs"));
const manifest = normalizeManifest(JSON.parse(readFileSync(join(packageRoot, "agent007.brain.json"), "utf8")), join(packageRoot, "agent007.brain.json"));
assert.equal(manifest.config.command, join(packageRoot, "runtime", process.platform === "win32" ? "node.exe" : "node"));
assert.ok(manifest.config.args[0].startsWith(packageRoot));
assert.equal(existsSync(join(packageRoot, "AGENTS.md")), false);
assert.equal(existsSync(join(packageRoot, ".env.local")), false);
assert.equal(existsSync(join(packageRoot, "docs/prompts")), false);
const fixture = mkdtempSync(join(tmpdir(), "a008-extracted-"));
const workspace = join(fixture, "workspace"); mkdirSync(workspace);
const command = process.platform === "win32" ? "Set-Content -LiteralPath 'package-proof.txt' -Value 'extracted engine'; Get-Content -LiteralPath 'package-proof.txt'" : "printf 'extracted engine' > package-proof.txt; cat package-proof.txt";
const provider = await startSessionControlProvider(payload => {
  if (payload.messages.at(-1)?.role === "tool") return { role: "assistant", content: "Verified the extracted engine tool result." };
  let user = payload.messages.at(-1)?.content || "";
  try { user = JSON.parse(user).message; } catch {}
  if (user === "PACKAGE-TOOL") return { role: "assistant", content: null, tool_calls: [{ id: "package-call", type: "function", function: { name: "exec_command", arguments: JSON.stringify({ cmd: command }) } }] };
});
const savedEnv = { ...process.env };
Object.assign(process.env, { NVIDIA_API_KEY: "synthetic-fixture-key", NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
  A008_SETTINGS_PATH: join(fixture, "settings.json"), A008_ENGINE_DATA_PATH: join(fixture, "engine-data"),
  A008_DEBUG_TRACE: "off", A008_ENGINE_LEGACY_CWD: "" });
const host = new CoreRuntimeHost({ config: manifest.config });
const changes = new Set();
host.broadcast = (_channel, payload) => { for (const listener of changes) listener(payload); };
function waitFor(check, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { changes.delete(onChange); reject(new Error("Engine proof timed out.")); }, timeoutMs);
    const onChange = () => { const value = check(); if (value) { clearTimeout(timeout); changes.delete(onChange); resolve(value); } };
    changes.add(onChange); onChange();
  });
}
let wire, origin;
try {
  host.start();
  await waitFor(() => host.status().protocolVerified);
  const caps = await host.request("memory/capabilities", { protocol: "A007_MEMORY_V1", version: 1 });
  assert.equal(caps.projectSelection, "session-or-absolute-cwd");
  const session = await host.request("session/new", { cwd: workspace });
  const panel = host.status().panels[0]; assert.equal(panel.sessionId, session.sessionId);
  const url = new URL(panel.url); origin = url.origin;
  const access = new URLSearchParams(url.hash.slice(1)).get("engine");
  assert.equal((await fetch(`${origin}/`)).status, 200);
  assert.match(await (await fetch(`${origin}/`)).text(), /assets\//);
  wire = await WireClient.open(Number(url.port), access);
  wire.send({ type: "session/new", requestId: "attach" });
  const attached = await wire.until("session/new/ok"); assert.equal(attached.sessionId, session.sessionId);
  const run = host.request("session/prompt", { sessionId: session.sessionId, prompt: [{ type: "text", text: "PACKAGE-TOOL" }] });
  const permission = await waitFor(() => host.status().permissions[0]);
  assert.equal(existsSync(join(workspace, "package-proof.txt")), false);
  host.resolveToolPermission(permission.token, "allow-once");
  assert.equal((await run).stopReason, "end_turn");
  assert.equal(readFileSync(join(workspace, "package-proof.txt"), "utf8").trim(), "extracted engine");
  assert.ok(provider.requests.some(p => p.messages.some(m => m.role === "tool" && m.content.includes("extracted engine"))));
  wire.send({ type: "session/control", requestId: "inspect", sessionId: session.sessionId, control: { action: "inspect" } });
  const state = (await wire.until("session/control/ok", "inspect")).state;
  assert.equal(state.messages.length, 2); assert.equal(state.messages[1].content, "Verified the extracted engine tool result.");
  const upload = await fetch(`${origin}/v1/upload`, { method: "POST", headers: { authorization: `Bearer ${access}`, "content-type": "application/octet-stream", "x-a008-filename": "package.txt" }, body: "Synthetic package source." });
  assert.equal(upload.status, 200);
  const memory = await (await fetch(`${origin}/v1/memory`, { headers: { authorization: `Bearer ${access}` } })).json();
  assert.ok(memory.summary.total > 0);
  wire.socket.close(); wire = undefined;
  await host.request("session/prompt", { sessionId: session.sessionId, prompt: [{ type: "text", text: "After panel close" }] });
  const child = host.child;
  const stopped = once(child, "exit"); host.stop(); await stopped;
  assert.deepEqual(host.status().panels, []);
  await assert.rejects(fetch(`${origin}/health`));
  console.log("PASS: extracted portable engine → client discovery → ACP → shared panel/history → explicit approval → actual command/result → upload/memory → panel disconnect → graceful process stop.");
} finally {
  wire?.socket.close();
  if (host.child) { const child = host.child; const stopped = once(child, "exit"); host.stop(); await stopped; }
  await provider.close();
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  rmSync(fixture, { recursive: true, force: true });
}
