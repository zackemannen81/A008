import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatSession } from "../src/core/chat-session.js";
import { RuntimeToolContext, SELECT_TOOLS } from "../src/core/runtime-tool-context.js";
import type { ChatRequest, ChatToolDefinition } from "../src/core/types.js";
import { EmbeddedAcmeChatTransport } from "../src/providers/acme/embedded-acme-chat-transport.js";
import { contextItemsForModel, contextItemsForWorker } from "../src/memory/serialization.js";
import { ModelBackedPostOutputKnowledgeAnalyzer } from "../src/orchestration/semantic-json-model.js";

const workingContext = { maximumRequestBytes: 100_000, maximumStateBytes: 16_384, reducerInputBytes: 100_000, reducerOutputTokens: 1024 };
const definitions: ChatToolDefinition[] = Array.from({ length: 106 }, (_, i) => ({
  name: `tool_${i}`, description: `Tool ${i} purpose`, strict: i !== 1,
  parameters: { type: "object", properties: { value: { type: "string", description: "schema detail ".repeat(60) } }, required: ["value"], additionalProperties: false },
}));

test("working reduction receives the actual question and carries concrete findings across schema selection", async () => {
  const objective = "How can I add a short trail to both projectile kinds?";
  const finding = "src/projectiles.js: updateProjectiles(dt) moves both kinds; renderProjectiles(view) updates bounded instances; MAX_PROJECTILES=64.";
  let round = 0, reductions = 0, reads = 0;
  const session = new ChatSession({ model: "fixture", transport: { async complete(request) {
    if (!request.tools) {
      const input = JSON.parse(request.messages[1]!.content);
      assert.equal(input.objective, objective);
      const observed = JSON.stringify(input.interactions).includes("MAX_PROJECTILES=64");
      const prior = input.previous?.verifiedFacts ?? [];
      if (reductions++ > 1) assert.equal(prior[0]?.statement, finding);
      return { message: { role: "assistant", content: JSON.stringify({
        version: "a008_run_continuation_state_v1", runId: input.runId,
        verifiedFacts: observed ? [{ id: "integration", statement: finding, sourceRefs: input.interactions.map((i: { id: string }) => i.id) }] : prior,
        hypotheses: [], completedActions: [{ id: "done", statement: "The source was inspected; schema selection grants no new file observations.", sourceRefs: input.requiredSourceRefs }],
      }) } };
    }
    round++;
    if (round === 5) {
      assert.ok(request.messages.some(m => m.content.includes(finding)));
      assert.equal(request.messages.filter(m => m.role === "tool").length, 1);
      assert.equal(request.tools[1]?.name, "tool_2");
      return { message: { role: "assistant", content: "Use bounded trail segments updated by updateProjectiles(dt)." } };
    }
    const selection = round !== 2;
    return { message: { role: "assistant", content: "" }, toolCalls: [{
      id: `call-${round}`, name: selection ? SELECT_TOOLS : "tool_1",
      arguments: selection ? JSON.stringify({ names: [round < 3 ? "tool_1" : "tool_2"] }) : '{"value":"src/projectiles.js"}',
    }] };
  } } });
  await session.send(objective, { tools: { definitions, maximumCalls: 8, workingContext, async execute() { reads++; return finding; } } });
  assert.equal(reads, 1);
  assert.equal(reductions, 3);
});

test("106-tool runtime discovers once and sends compact current work after ten effects", async () => {
  const requests: ChatRequest[] = [];
  let rounds = 0;
  let effects = 0;
  let reductions = 0;
  const session = new ChatSession({ model: "fixture", transport: {
    async complete(request) {
      if (!request.tools) {
        reductions++;
        const input = JSON.parse(request.messages[1]!.content);
        const sourceRefs = [...(input.previous?.completedActions[0]?.sourceRefs ?? []), ...input.interactions.map((item: { id: string }) => item.id)];
        return { message: { role: "assistant", content: JSON.stringify({ version: "a008_run_continuation_state_v1", runId: input.runId, verifiedFacts: [], hypotheses: [], completedActions: [{ id: "done", statement: "Verified earlier effects completed; continue remaining work", sourceRefs }] }) } };
      }
      requests.push(structuredClone(request));
      const n = rounds++;
      if (n > 10) return { message: { role: "assistant", content: "done" } };
      return { message: { role: "assistant", content: "" }, toolCalls: [{ id: `call_${n}`, name: n === 0 ? SELECT_TOOLS : "tool_1", arguments: n === 0 ? '{"names":["tool_1"]}' : '{"value":"x"}' }] };
    },
  } });
  await session.send("perform ten steps", { tools: { definitions, maximumCalls: 20, workingContext, async execute() { effects++; return `verified result ${effects}: ${"data".repeat(1500)}`; } } });
  assert.equal(effects, 10);
  assert.equal(reductions, 10);
  assert.deepEqual(requests[0]!.tools!.map(tool => tool.name), [SELECT_TOOLS]);
  assert.ok(requests[0]!.messages[0]!.content.includes("tool_105"));
  assert.ok(!JSON.stringify(requests[0]).includes("schema detail"));
  assert.deepEqual(requests[1]!.tools![1], definitions[1]);
  for (const request of requests.slice(1)) {
    assert.ok(request.messages.filter(message => message.role === "tool").length <= 1);
    assert.equal(JSON.stringify(request).includes('"sourceRefs"'), false);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(requests.at(-1))) < Buffer.byteLength(JSON.stringify({ tools: definitions })) / 3);
  assert.deepEqual(session.messages.map(message => message.content), ["perform ten steps", "done"]);
});

test("selection is exact, atomic, replaceable, and never invents schema authority", () => {
  const context = new RuntimeToolContext(definitions);
  const select = (arguments_: string) => JSON.parse(context.select({ id: "selection", name: SELECT_TOOLS, arguments: arguments_ }));
  assert.ok(select('{"names":["tool_1"]}').selected);
  assert.ok(select('{"names":["tool_2","unknown"]}').error);
  assert.deepEqual(context.definitions[1], definitions[1]);
  assert.ok(select('{"names":["tool_2","tool_2"]}').error);
  assert.ok(select('{"names":["tool_2"],"extra":true}').error);
  select('{"names":["tool_2"]}');
  assert.deepEqual(context.definitions.map(tool => tool.name), [SELECT_TOOLS, "tool_2"]);
  assert.throws(() => new RuntimeToolContext([definitions[0]!, definitions[0]!]));
});

test("unloaded tools cannot execute; oversized selected schemas stop before another provider call", async () => {
  for (const hidden of [true, false]) {
    let requests = 0;
    let effects = 0;
    const session = new ChatSession({ model: "fixture", transport: { async complete() {
      requests++;
      return { message: { role: "assistant", content: "" }, toolCalls: [{ id: "one", name: hidden ? "large" : SELECT_TOOLS, arguments: hidden ? "{}" : '{"names":["large"]}' }] };
    } } });
    await assert.rejects(session.send("go", { tools: {
      definitions: [{ name: "large", description: "large", parameters: { description: "x".repeat(5000) } }], maximumCalls: 5,
      workingContext: { ...workingContext, maximumRequestBytes: 3000 }, async execute() { effects++; return "effect"; },
    } }), hidden ? /unavailable/ : /byte budget/);
    assert.equal(requests, 1);
    assert.equal(effects, 0);
    assert.equal(session.messages.length, 0);
  }
});

test("label projection parity keeps reinforcement and state-address identities internal", async () => {
  const item = { id: "long-private-identity", semanticAddress: "widget.color", evidenceId: "private-evidence", label: "Widget is blue", currentState: "blue", proposition: "blue", kind: "state", tags: [], scope: [], authority: 1 };
  let input = "";
  const analyzer = new ModelBackedPostOutputKnowledgeAnalyzer({ async generate(request) {
    input = request.serializedInput;
    return { reinforcements: [{ knowledgeId: "1" }], state_updates: [{ semanticAddress: "1", proposition: "Widget is red" }], new_knowledge: [], relation_updates: [] };
  } });
  const result = await analyzer.analyze({ kind: "dialogue", retrievedContext: { items: [item] }, userMessage: "change", responseText: "changed" });
  assert.deepEqual(contextItemsForModel([item]), [{ label: "Widget is blue" }]);
  assert.deepEqual(contextItemsForWorker([item]), JSON.parse(input).retrievedContext.items);
  assert.ok(!input.includes(item.id) && !input.includes(item.semanticAddress) && !input.includes(item.evidenceId));
  const resolved = result as unknown as { reinforcements: { knowledgeId: string }[]; state_updates: { semanticAddress: string }[] };
  assert.equal(resolved.reinforcements[0]!.knowledgeId, item.id);
  assert.equal(resolved.state_updates[0]!.semanticAddress, item.semanticAddress);
});

for (const stream of [false, true]) test(`real embedded Responses preserves opaque reasoning and exact call IDs (stream=${stream})`, async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-context-wire-"));
  const wire: string[] = [];
  const opaque = { type: "reasoning", id: "rs_native", summary: [], encrypted_content: "opaque-encrypted-fixture" };
  const call = { type: "function_call", id: "fc_native", call_id: "call_native", name: "inspect", arguments: "{}", status: "completed" };
  try {
    const transport = new EmbeddedAcmeChatTransport({ env: { OPENAI_API_KEY: "sk-fixture" }, catalogPath: join(directory, "catalog.json"), fetch: async (_url, init) => {
      wire.push(String(init?.body));
      const response = { id: `resp_${wire.length}`, model: "gpt-5.6-luna", status: "completed", output: wire.length === 1 ? [opaque, call] : [{ type: "message", content: [{ type: "output_text", text: "done" }] }] };
      return stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } }) : Response.json(response);
    } });
    const initial: ChatRequest = { model: "gpt-5.6-luna", messages: [{ role: "user", content: "inspect" }], options: { stream, maxTokens: 500 } };
    const completion = await transport.complete(initial);
    assert.deepEqual(completion.responseItems, [opaque, call]);
    const next: ChatRequest = { ...initial, messages: [...initial.messages, { role: "assistant", content: "", toolCalls: completion.toolCalls!, responseItems: completion.responseItems! }, { role: "tool", toolCallId: "call_native", content: "verified" }] };
    const measured = transport.measureRequest(next);
    await transport.complete(next);
    assert.equal(measured.serializedBytes, Buffer.byteLength(wire[1]!));
    const body = JSON.parse(wire[1]!);
    assert.deepEqual(body.input.slice(1, 3), [opaque, call]);
    assert.equal(body.input[3].call_id, "call_native");
    assert.equal(body.store, false);
    assert.ok(body.include.includes("reasoning.encrypted_content"));
    assert.equal(body.previous_response_id, undefined); // Complete manual context, no orphaned server-side chain.
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("invalid or cancelled compaction cannot dispatch more work or replay completed effects", async () => {
  for (const cancel of [false, true]) {
    const controller = new AbortController();
    let effects = 0, mainCalls = 0;
    const session = new ChatSession({ model: "fixture", transport: { async complete(request) {
      if (!request.tools) {
        if (cancel) {
          const input = JSON.parse(request.messages[1]!.content);
          controller.abort();
          return { message: { role: "assistant", content: JSON.stringify({
            version: "a008_run_continuation_state_v1", runId: input.runId,
            verifiedFacts: [], hypotheses: [], completedActions: [{ id: "done", statement: "Earlier work completed", sourceRefs: input.interactions.map((item: { id: string }) => item.id) }],
          }) } };
        }
        return { message: { role: "assistant", content: "invalid summary" } };
      }
      mainCalls++;
      return { message: { role: "assistant", content: "" }, toolCalls: [{ id: `call-${mainCalls}`, name: mainCalls === 1 ? SELECT_TOOLS : "tool_1", arguments: mainCalls === 1 ? '{"names":["tool_1"]}' : '{"value":"x"}' }] };
    } } });
    await assert.rejects(session.send("work", { signal: controller.signal, tools: {
      definitions, maximumCalls: 10, workingContext, async execute() { effects++; return "completed external effect"; },
    } }));
    assert.equal(effects, 1);
    assert.equal(mainCalls, 2);
    assert.equal(session.messages.length, 0);
  }
});

import type { RunContinuationCheckpointWrite, RunContinuationRecovery } from "../src/core/chat-continuation.js";
import { reduceWorkingState } from "../src/core/working-state-reducer.js";

test("durable reduction exhaustion resumes the same completed work without replay", async () => {
  let saved: RunContinuationCheckpointWrite | undefined;
  let effects = 0, reducerCalls = 0, rounds = 0;
  let malformed = true;
  const transport = { async complete(request: ChatRequest) {
    if (!request.tools) {
      reducerCalls++;
      if (malformed) return { message: { role: "assistant" as const, content: "broken" } };
      const input = JSON.parse(request.messages[1]!.content);
      return { message: { role: "assistant" as const, content: JSON.stringify({ version: "a008_run_continuation_state_v1", runId: input.runId, verifiedFacts: [], hypotheses: [], completedActions: [{ id: "done", statement: "completed", sourceRefs: input.requiredSourceRefs }] }) } };
    }
    rounds++;
    if (rounds > 2) return { message: { role: "assistant" as const, content: "done" } };
    return { message: { role: "assistant" as const, content: "" }, toolCalls: [{ id: `call_${rounds}`, name: rounds === 1 ? SELECT_TOOLS : "tool_1", arguments: rounds === 1 ? '{"names":["tool_1"]}' : '{"value":"x"}' }] };
  } };
  const persist = async (checkpoint: RunContinuationCheckpointWrite) => {
    assert.equal(checkpoint.expectedGeneration, saved?.recovery?.reduction?.generation ?? 0);
    saved = structuredClone(checkpoint);
  };
  const makeTools = (resume?: RunContinuationRecovery) => ({ definitions, maximumCalls: 10, workingContext,
    durableWorkingContext: { persist, recovery: { ...(resume ? { resume } : {}), beforeEffect: async () => {} } },
    async execute() { effects++; return "completed effect"; },
  });
  await assert.rejects(new ChatSession({ model: "fixture", transport }).send("work", { tools: makeTools() }), /reduction paused/);
  assert.equal(effects, 1); assert.equal(reducerCalls, 2);
  assert.equal(saved!.recovery!.reduction!.attempts, 2);
  assert.equal(saved!.recovery!.recentInteractions.length, 2);
  // Process replacement alone cannot reset exhausted attempt accounting.
  await assert.rejects(new ChatSession({ model: "fixture", transport }).send("work", { tools: makeTools(saved!.recovery) }), /reduction paused/);
  assert.equal(reducerCalls, 2); assert.equal(effects, 1);
  // Host-authorized resume resets only the reducer attempt allowance.
  malformed = false;
  const resume = structuredClone(saved!.recovery!);
  const authorized = { ...resume, reduction: { ...resume.reduction!, attempts: 0 } };
  const result = await new ChatSession({ model: "fixture", transport }).send("work", { tools: makeTools(authorized) });
  assert.equal(result.message.content, "done");
  assert.equal(effects, 1); assert.equal(rounds, 3);
  assert.equal(saved!.recovery!.reduction!.phase, "ready");
});

for (const failure of ["truncation", "syntax", "sources", "oversized"] as const) {
  test(`reducer bounds retry and validates ${failure}`, async () => {
    const tokens: number[] = [];
    const state = { version: "a008_run_continuation_state_v1", runId: "run", verifiedFacts: [], hypotheses: [], completedActions: [{ id: "one", statement: "done", sourceRefs: ["run:1"] }] };
    const result = await reduceWorkingState({ model: "fixture", runId: "run", objective: "Inspect the fixture", previous: null, interactions: [], maximumStateBytes: 1000, inputBytes: 10000, outputTokens: 4096, validSourceRefs: new Set(["run:1"]), requiredSourceRefs: new Set(["run:1"]), attempts: 0, truncated: false, beforeAttempt: async () => {}, transport: { async complete(request) {
      tokens.push(request.options!.maxTokens!);
      return { message: { role: "assistant", content: tokens.length > 1 ? JSON.stringify(state) : failure === "syntax" || failure === "truncation" ? "{" : JSON.stringify({ ...state, completedActions: [{ ...state.completedActions[0], ...(failure === "sources" ? { sourceRefs: ["invented"] } : { statement: "x".repeat(2000) }) }] }) }, ...(failure === "truncation" && tokens.length === 1 ? { finishReason: "length" } : {}) };
    } } });
    assert.equal(result.runId, "run");
    assert.deepEqual(tokens, failure === "truncation" ? [2048, 4096] : [2048, 2048]);
  });
}
