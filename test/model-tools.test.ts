import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ChatSession } from "../src/core/chat-session.js";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import { ModelToolSession, boundedToolText, type ToolActivity } from "../src/tools/model-tools.js";
import { DEFAULT_RUNTIME_BUDGETS as budgets } from "../src/core/runtime-preferences.js";
import { RuntimePreferencesStore } from "../src/runtime/runtime-preferences-store.js";
import { runTerminalCommand } from "../src/tools/terminal.js";
import { prepareAcpTools } from "../src/tools/acp-tools.js";

const command = process.platform === "win32" ? "Set-Content -LiteralPath 'result.txt' -Value 'real execution'; Get-Content -LiteralPath 'result.txt'" : "printf 'real execution' > result.txt; cat result.txt";
const call = { id: "call-proof", name: "exec_command", arguments: JSON.stringify({ cmd: command }) };
const providerCall = { id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } };

test("JSON tool-only completion executes after approval and actual result continues the provider turn without polluting history", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-"));
  const tools = new ModelToolSession({ cwd, env: { ...process.env, NVIDIA_API_KEY: "test-secret-not-in-child" } });
  const requests: any[] = [], activity: ToolActivity[] = [];
  const transport = new NvidiaChatTransport({ apiKey: "synthetic", fetch: async (_url, init) => {
    const payload = JSON.parse(String(init?.body)); requests.push(payload);
    const next = requests.length === 1 ? { content: null, tool_calls: [providerCall] } : { content: "I read the real result." };
    return Response.json({ choices: [{ message: { role: "assistant", ...next }, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] });
  } });
  try {
    const port = await tools.prepare(budgets, { approve: async () => { assert.equal(existsSync(join(cwd, "result.txt")), false); return true; }, update: async a => { activity.push(a); } }, new AbortController().signal);
    const chat = new ChatSession({ model: "fixture", transport, generation: { stream: false } });
    const deltas: string[] = [];
    await chat.send("Write and inspect a fixture.", { tools: port, onDelta: d => { if (d.type === "content") deltas.push(d.text); } });
    assert.equal(readFileSync(join(cwd, "result.txt"), "utf8").trim(), "real execution");
    assert.equal(requests[0].tools[0].function.name, "exec_command");
    assert.equal(requests[1].messages.at(-1).role, "tool");
    assert.equal(requests[1].messages.at(-1).tool_call_id, call.id);
    assert.match(requests[1].messages.at(-1).content, /real execution/);
    assert.deepEqual(activity.map(a => a.status), ["pending", "in_progress", "completed"]);
    assert.deepEqual(chat.messages.map(m => m.content), ["Write and inspect a fixture.", "I read the real result."]);
    assert.deepEqual(deltas, ["I read the real result."]);
  } finally { await tools.close(); rmSync(cwd, { recursive: true, force: true }); }
});

test("streamed function fragments assemble into one typed call; prose and duplicate ids never become tools", async () => {
  const chunks = [
    { index: 0, id: "call-sse", type: "function", function: { name: "exec_", arguments: '{"cmd":' } },
    { index: 0, function: { name: "command", arguments: '"echo fixture"}' } },
  ];
  const body = chunks.map(c => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [c] } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  const transport = new NvidiaChatTransport({ apiKey: "synthetic", fetch: async () => new Response(body) });
  const completion = await transport.complete({ model: "fixture", messages: [] });
  assert.deepEqual(completion.toolCalls, [{ id: "call-sse", name: "exec_command", arguments: '{"cmd":"echo fixture"}' }]);
  const chat = new ChatSession({ model: "fixture", transport: { complete: async () => ({ message: { role: "assistant", content: "I will run /shell echo fixture" } }) } });
  await chat.send("Hello");
  assert.equal(chat.messages.length, 2);
  const invalid = new NvidiaChatTransport({ apiKey: "synthetic", fetch: async () => Response.json({ choices: [{ message: { content: null, tool_calls: [providerCall, providerCall] } }] }) });
  await assert.rejects(invalid.complete({ model: "fixture", messages: [], options: { stream: false } }), /duplicate/);
});

test("denial and invalid arguments execute nothing; tool loop budget stops repeated work", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-denied-"));
  const tools = new ModelToolSession({ cwd, env: process.env }); let approvals = 0;
  try {
    const port = await tools.prepare(budgets, { approve: async () => { approvals++; return false; }, update: async () => undefined }, new AbortController().signal);
    assert.equal(JSON.parse(await port.execute(call)).status, "denied");
    assert.equal(JSON.parse(await port.execute({ ...call, arguments: '{"cmd":"echo x", "cwd":"/"}' })).status, "invalid_arguments");
    assert.equal(approvals, 1); assert.equal(existsSync(join(cwd, "result.txt")), false);
    let round = 0;
    const chat = new ChatSession({ model: "fixture", transport: { complete: async () => ({ message: { role: "assistant", content: "" }, toolCalls: [{ ...call, id: `round-${++round}` }] }) } });
    await assert.rejects(chat.send("Keep calling", { tools: { ...port, maximumCalls: 1 } }), /Tool call budget/);
    assert.equal(chat.messages.length, 0); assert.equal(round, 2);
  } finally { await tools.close(); rmSync(cwd, { recursive: true, force: true }); }
});

test("cancelled ACP approval settles without waiting for an unresponsive client and no command runs", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-cancel-"));
  const tools = new ModelToolSession({ cwd, env: process.env }); const controller = new AbortController();
  try {
    const port = await prepareAcpTools(tools, "fixture-session", budgets, controller.signal, async () => undefined, async () => {
      controller.abort(); return new Promise(() => undefined);
    });
    await assert.rejects(port.execute(call, controller.signal), /abort|cancel/i);
    assert.equal(existsSync(join(cwd, "result.txt")), false);
  } finally { await tools.close(); rmSync(cwd, { recursive: true, force: true }); }
});

test("real shell timeout and cancellation terminate execution; UTF-8 observation truncation is explicit", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-timeout-"));
  const sleep = process.platform === "win32" ? "Start-Sleep -Seconds 30" : "sleep 30";
  try {
    const result = await runTerminalCommand({ command: sleep, cwd, shell: "powershell", timeoutMs: 200 });
    assert.equal(result.timedOut, true); assert.notEqual(result.exitCode, 0);
    const signal = AbortSignal.timeout(200);
    await assert.rejects(runTerminalCommand({ command: sleep, cwd, shell: "powershell", signal }), /cancelled/);
    const bounded = boundedToolText("å🙂".repeat(30), 13);
    assert.equal(bounded.truncated, true); assert.ok(Buffer.byteLength(bounded.text) <= 13); assert.equal(bounded.text.includes("�"), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("approved stdio MCP server is discovered, schema validated, executed and closed in the project", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-mcp-"));
  const tools = new ModelToolSession({ cwd, env: process.env, mcpServers: [{ name: "fixture", command: process.execPath, args: [resolve("dist/test/fixtures/tool-mcp.js")], env: [] }] });
  try {
    const port = await tools.prepare(budgets, { approve: async () => true, update: async () => undefined }, new AbortController().signal);
    const name = port.definitions.find(d => d.name !== "exec_command")!.name;
    const output = await port.execute({ id: "mcp-proof", name, arguments: '{"text":"mcp proof"}' });
    assert.match(output, /MCP fixture written/);
    assert.equal(readFileSync(join(cwd, "mcp-fixture.txt"), "utf8"), "mcp proof");
  } finally { await tools.close(); rmSync(cwd, { recursive: true, force: true }); }
});

test("existing version 1 global settings migrate without losing instructions, budgets or revision protection", () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-settings-v1-"));
  const path = join(cwd, "settings.json");
  const oldBudgets = { ...budgets } as Record<string, number>;
  for (const key of ["maximumToolCalls", "maximumToolDefinitions", "toolOutputBytes", "toolTimeoutMs"]) delete oldBudgets[key];
  oldBudgets.chatInputBytes = 76543;
  writeFileSync(path, JSON.stringify({ version: 1, settings: { instructions: "User-owned instruction.", budgets: oldBudgets } }));
  try {
    const store = new RuntimePreferencesStore({ A008_SETTINGS_PATH: path }, 180000);
    const first = store.snapshot();
    assert.equal(first.settings.instructions, "User-owned instruction."); assert.equal(first.settings.budgets.chatInputBytes, 76543);
    assert.equal(first.settings.budgets.maximumToolCalls, budgets.maximumToolCalls);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 1);
    store.save(first.settings, first.revision);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 2);
    assert.throws(() => store.save(first.settings, first.revision), /changed elsewhere/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("tool schemas and observations consume the input budget and failed continuations do not commit history", async () => {
  let executed = 0, requests = 0;
  const chat = new ChatSession({ model: "fixture", transport: { complete: async () => {
    requests++; return { message: { role: "assistant", content: "" }, toolCalls: [call] };
  } } });
  const tools = { definitions: [{ name: call.name, description: "fixture", parameters: { type: "object" } }], maximumCalls: 2,
    execute: async () => { executed++; return "x".repeat(2000); } };
  await assert.rejects(chat.send("Fixture", { tools, invocation: { budget: { maximum: 1000, measurer: { unit: "utf8-bytes", measure: value => Buffer.byteLength(value) } } } }), /budget/i);
  assert.equal(requests, 1); assert.equal(executed, 1); assert.equal(chat.messages.length, 0);
});
