import { WireClient } from "./fixtures/gui-wire-client.js";
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import {
  defaultModelRegistry,
  DEFAULT_MODEL_ID,
} from "../src/core/model-registry.js";
import {
  defaultSessionParameters,
  parseSessionParameters,
  chatGeneration,
  generationCapabilities,
} from "../src/core/generation-controls.js";
import type { SessionSnapshot } from "../src/core/session-control.js";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { parseClientMessage } from "../src/gui-host/protocol.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";

const defaults = defaultSessionParameters(
  defaultModelRegistry.require(DEFAULT_MODEL_ID),
);

test("all registered model defaults conform to their controls, including effort-only models", () => {
  assert.equal(
    generationCapabilities("unverified-model").verifiedOn,
    "unverified",
  );
  assert.equal(generationCapabilities("unverified-model").maxTokens, 16384);
  for (const profile of defaultModelRegistry.list()) {
    const parameters = defaultSessionParameters(profile);
    assert.deepEqual(
      parseSessionParameters(parameters, profile.id),
      parameters,
    );
  }
  assert.deepEqual(
    generationCapabilities("moonshotai/kimi-k3").reasoningEfforts,
    ["low", "high", "max"],
  );
  assert.equal(
    defaultSessionParameters(defaultModelRegistry.require("moonshotai/kimi-k3"))
      .enableThinking,
    null,
  );
  assert.deepEqual(
    generationCapabilities("gpt-5.6-terra").reasoningEfforts,
    ["none", "low", "medium", "high", "xhigh", "max"],
  );
  assert.equal(generationCapabilities("gpt-5.6-terra").maxTokens, 128000);
});

test("parameter validation refuses invalid, unsupported and excessive values atomically", () => {
  for (const patch of [
    { temperature: 1.01 },
    { temperature: -1 },
    { temperature: "1" },
    { maxTokens: 0 },
    { maxTokens: 32769 },
    { maxTokens: 1.5 },
    { reasoningBudget: 16385, maxTokens: 16384 },
    { reasoningBudget: -2 },
    { seed: Number.MAX_SAFE_INTEGER + 1 },
    { stop: [""] },
    { stop: Array(5).fill("stop") },
    { stream: "true" },
    { reasoningEffort: "high" },
    { extra: true },
  ]) {
    assert.throws(() =>
      parseSessionParameters({ ...defaults, ...patch }, DEFAULT_MODEL_ID),
    );
  }
  assert.throws(() => parseSessionParameters({}, DEFAULT_MODEL_ID));
  const kimi = defaultSessionParameters(
    defaultModelRegistry.require("moonshotai/kimi-k3"),
  );
  assert.throws(
    () => parseSessionParameters({ ...kimi, topP: 0.5 }, "moonshotai/kimi-k3"),
    /not supported/,
  );
  assert.throws(
    () =>
      parseSessionParameters(
        { ...kimi, reasoningEffort: "none" },
        "moonshotai/kimi-k3",
      ),
    /Unsupported/,
  );
  assert.equal(
    parseSessionParameters({ ...defaults, temperature: 0 }, DEFAULT_MODEL_ID)
      .temperature,
    0,
  );
});

test("adapter maps null omissions, effort, reasoning off, seed and stop onto actual JSON", async () => {
  const payloads: Record<string, any>[] = [];
  const transport = new NvidiaChatTransport({
    apiKey: "fixture",
    fetch: async (_url, init) => {
      payloads.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  await transport.complete({
    model: DEFAULT_MODEL_ID,
    messages: [{ role: "user", content: "fixture" }],
    options: chatGeneration({
      ...defaults,
      stream: false,
      temperature: null,
      topP: null,
      enableThinking: false,
      seed: 42,
      stop: ["END"],
    }),
  });
  assert.equal("temperature" in payloads[0]!, false);
  assert.equal("top_p" in payloads[0]!, false);
  assert.equal("reasoning_budget" in payloads[0]!, false);
  assert.deepEqual(payloads[0]!.chat_template_kwargs, {
    enable_thinking: false,
  });
  assert.equal(payloads[0]!.seed, 42);
  assert.deepEqual(payloads[0]!.stop, ["END"]);
  await transport.complete({
    model: "deepseek-ai/deepseek-v4-pro-0813",
    messages: [],
    options: { stream: false, enableThinking: false },
  });
  assert.deepEqual(payloads[1]!.chat_template_kwargs, { thinking: false });
  await transport.complete({
    model: "moonshotai/kimi-k3",
    messages: [],
    options: { stream: false, reasoningEffort: "low", enableThinking: null },
  });
  assert.equal(payloads[2]!.reasoning_effort, "low");
  assert.equal("chat_template_kwargs" in payloads[2]!, false);
});

test("session controls require routing identifiers and validate the action", () => {
  for (const value of [
    { type: "session/control" },
    {
      type: "session/control",
      requestId: "r",
      sessionId: "s",
      control: { action: "exec" },
    },
  ]) {
    assert.ok("error" in parseClientMessage(JSON.stringify(value)));
  }
});

test(
  "real GUI host → spawned ACP → runtime → provider proves commands, payloads and history",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider();
    const isolated = isolatedMemoryEnv({
      NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
      A008_CHAT_TEMPERATURE: "0.7",
      A008_CHAT_REASONING_BUDGET: "4096",
    });
    const host = await startGuiHost({
      env: isolated.env,
      port: 0,
      cwd: process.cwd(),
    });
    const client = await WireClient.open(host.port);
    const other = await WireClient.open(host.port);
    let nextId = 0;
    try {
      client.send({
        type: "session/new",
        requestId: "new",
        model: DEFAULT_MODEL_ID,
      });
      const opened = await client.until("session/new/ok");
      assert.equal(opened.type, "session/new/ok", JSON.stringify(opened));
      const sessionId = opened.sessionId;
      assert.equal(opened.state.parameters.temperature, 0.7);
      assert.equal(opened.state.runtime.memoryPath, isolated.sqlitePath);
      assert.equal(provider.requests.length, 0);
      const control = async (action: Record<string, unknown>) => {
        const requestId = `control-${++nextId}`;
        client.send({
          type: "session/control",
          sessionId,
          requestId,
          control: action,
        });
        return await client.until("session/control/ok", requestId);
      };
      const prompt = async (text: string) => {
        const requestId = `prompt-${++nextId}`;
        client.send({ type: "prompt", requestId, sessionId, text });
        return await client.until("prompt/ok", requestId);
      };
      other.send({
        type: "session/control",
        requestId: "foreign",
        sessionId,
        control: { action: "reset" },
      });
      assert.equal((await other.next()).type, "error");
      const parameters = {
        ...opened.state.parameters,
        temperature: null,
        topP: null,
        stream: false,
        maxTokens: 900,
        reasoningBudget: 300,
        seed: 42,
        stop: ["END"],
      };
      assert.equal(
        (await control({ action: "configure", parameters })).type,
        "session/control/ok",
      );
      const first = await prompt("First synthetic question");
      assert.equal(first.type, "prompt/ok", JSON.stringify(first));
      assert.deepEqual(
        first.state.messages.map((m: any) => m.role),
        ["user", "assistant"],
      );
      assert.equal(
        JSON.stringify(first.state.messages).includes("Display-only"),
        false,
      );
      const chat = provider.requests.find(
        (p) => !String(p.messages.at(-1).content).includes('"operation"'),
      )!;
      assert.equal(chat.max_tokens, 900);
      assert.equal(chat.reasoning_budget, 300);
      assert.equal(chat.stream, false);
      assert.equal(chat.seed, 42);
      assert.equal("temperature" in chat, false);
      assert.equal("top_p" in chat, false);
      const semantics = provider.requests.filter((p) =>
        String(p.messages.at(-1).content).includes('"operation"'),
      );
      assert.ok(semantics.length > 0);
      for (const request of semantics) {
        assert.equal(request.temperature, 0);
        assert.equal(request.max_tokens, 16384);
        assert.equal("seed" in request, false);
      }
      const invalid = await control({
        action: "configure",
        parameters: { ...parameters, temperature: 2 },
      });
      assert.equal(invalid.type, "error");
      assert.deepEqual(
        (await control({ action: "inspect" })).state.parameters,
        parameters,
      );
      const failed = await prompt("FAIL-TURN");
      assert.equal(failed.type, "error");
      assert.equal(
        (await control({ action: "inspect" })).state.messages.length,
        2,
      );
      const undone = await control({ action: "undo" });
      assert.equal(undone.state.undone, true);
      assert.equal(undone.state.messages.length, 0);
      assert.equal((await control({ action: "undo" })).state.undone, false);
      await prompt("Second synthetic question");
      const reset = await control({ action: "reset" });
      assert.equal(reset.state.messages.length, 0);
      assert.deepEqual(reset.state.parameters, parameters);
      await prompt("After reset");
      const afterReset = provider.requests.findLast(
        (p) => !String(p.messages.at(-1).content).includes('"operation"'),
      )!;
      assert.equal(afterReset.messages[0].role, "system");
      assert.equal(
        JSON.stringify(afterReset.messages).includes(
          "Second synthetic question",
        ),
        false,
      );
      const badModel = await control({ action: "model", model: "unknown" });
      assert.equal(badModel.type, "error");
      assert.equal(
        (await control({ action: "inspect" })).state.messages.length,
        2,
      );
      const switched = await control({
        action: "model",
        model: "moonshotai/kimi-k3",
      });
      assert.equal(switched.state.messages.length, 0);
      assert.equal(switched.state.parameters.reasoningEffort, "max");
      await control({
        action: "configure",
        parameters: {
          ...switched.state.parameters,
          reasoningEffort: "low",
          stream: true,
        },
      });
      await prompt("Kimi fixture");
      const kimi = provider.requests.findLast(
        (p) =>
          p.model === "moonshotai/kimi-k3" &&
          !String(p.messages.at(-1).content).includes('"operation"'),
      )!;
      assert.equal(kimi.reasoning_effort, "low");
      assert.equal("top_p" in kimi, false);
      assert.equal("chat_template_kwargs" in kimi, false);
      assert.ok(client.frames.some((f) => f.type === "thought"));
      assert.ok(client.frames.some((f) => f.type === "answer"));
      client.send({
        type: "prompt",
        requestId: "waiting",
        sessionId,
        text: "WAIT-TURN",
      });
      await client.until("thought");
      assert.equal((await control({ action: "reset" })).type, "error");
      client.send({ type: "cancel", requestId: "cancel", sessionId });
      assert.equal(
        (await client.until("prompt/ok", "waiting")).state.messages.length,
        2,
      );
      const closed = await control({ action: "close" });
      assert.equal(closed.state.closed, true);
      assert.equal((await control({ action: "inspect" })).type, "error");
      assert.equal(
        JSON.stringify(client.frames).includes(isolated.env.NVIDIA_API_KEY!),
        false,
      );
    } finally {
      client.socket.close();
      other.socket.close();
      await host.close();
      await provider.close();
      rmSync(isolated.directory, { recursive: true, force: true });
    }
  },
);
