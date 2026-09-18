import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AcmeModelRuntime } from "acme-engine";
import { ChatError } from "../src/core/errors.js";
import {
  addUserChatModel,
  loadUserCatalog,
  saveUserCatalog,
} from "../src/core/user-catalog.js";
import {
  buildEmbeddedAcmeRuntimeConfig,
  EmbeddedAcmeChatTransport,
} from "../src/providers/acme/embedded-acme-chat-transport.js";
import { parseLocalRuntimeConfig } from "../src/runtime/local-runtime-config.js";

function fixtureRuntime(
  execute: AcmeModelRuntime["execute"],
  providers: readonly string[] = ["nvidia"],
): AcmeModelRuntime {
  return {
    engine: {} as AcmeModelRuntime["engine"],
    providers,
    execute,
  };
}

function succeeded(
  text = "done",
): Awaited<ReturnType<AcmeModelRuntime["execute"]>> {
  return {
    status: "succeeded",
    modelExecutionId: "model_execution_fixture",
    replayed: false,
    response: {
      provider: "nvidia",
      model: "fixture",
      receivedAt: "2026-09-18T00:00:00.000Z",
      finishReason: "stop",
      text,
      usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
      metadata: {},
    },
    usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
    diagnostic: { kind: "completed", finishReason: "stop" },
  };
}

function tempCatalog(): {
  readonly directory: string;
  readonly path: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "a008-0127-"));
  return { directory, path: join(directory, "catalog.json") };
}

test("embedded ACME config is derived from A008 model ownership", () => {
  const { directory, path } = tempCatalog();
  try {
    const catalog = loadUserCatalog(path);
    const config = buildEmbeddedAcmeRuntimeConfig({
      env: {
        NVIDIA_API_KEY: "nvapi-fixture",
        OPENAI_API_KEY: "sk-fixture",
        KIE_API_KEY: "kie-fixture",
      },
      catalog,
    });

    const kimi = config.nvidia?.profiles.find(
      (profile) => profile.model === "moonshotai/kimi-k3",
    );
    assert.ok(kimi);
    assert.equal(kimi.selection.providerHint, "nvidia");
    assert.equal(kimi.capabilities?.vision, true);
    assert.equal(kimi.controls?.reasoningEffort, true);
    assert.equal(kimi.controls?.enableThinking, false);

    const nemotron = config.nvidia?.profiles.find(
      (profile) =>
        profile.model === "nvidia/nemotron-3.5-lightning-30b-a3b",
    );
    assert.ok(nemotron);
    assert.equal(nemotron.controls?.enableThinking, "enable_thinking");

    const luna = config.openAi?.profiles.find(
      (profile) => profile.model === "gpt-5.6-luna",
    );
    assert.ok(luna);
    assert.equal(luna.selection.providerHint, "openai");
    assert.equal(luna.capabilities?.vision, true);

    const kie = config.compatible?.find(
      (route) => route.providerHint === "kie:gemini-3-flash",
    );
    assert.ok(kie);
    assert.equal(kie.profiles[0]?.capabilities?.tools, false);
    assert.equal(kie.profiles[0]?.capabilities?.vision, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("local runtime defaults to embedded ACME without sidecar URL", () => {
  const config = parseLocalRuntimeConfig(
    { A008_MEMORY_SQLITE_PATH: ":memory:" },
    { surface: "cli", repositoryRoot: process.cwd() },
  );
  assert.equal(config.chatTransport.mode, "embedded-acme");

  const direct = parseLocalRuntimeConfig(
    {
      A008_MEMORY_SQLITE_PATH: ":memory:",
      A008_CHAT_TRANSPORT: "direct",
    },
    { surface: "cli", repositoryRoot: process.cwd() },
  );
  assert.equal(direct.chatTransport.mode, "direct");

  const remote = parseLocalRuntimeConfig(
    {
      A008_MEMORY_SQLITE_PATH: ":memory:",
      A008_CHAT_TRANSPORT: "acme",
      A008_ACME_MODEL_RUNTIME_URL: "http://127.0.0.1:8790",
    },
    { surface: "cli", repositoryRoot: process.cwd() },
  );
  assert.equal(remote.chatTransport.mode, "acme");
  assert.equal(remote.chatTransport.baseUrl, "http://127.0.0.1:8790");
});

test("embedded transport maps transient vision, tools, stream and execution evidence", async () => {
  const { directory, path } = tempCatalog();
  let captured: Parameters<AcmeModelRuntime["execute"]>[0] | undefined;
  const deltas: string[] = [];
  try {
    const transport = new EmbeddedAcmeChatTransport({
      env: { NVIDIA_API_KEY: "nvapi-fixture" },
      catalogPath: path,
      requestKey: () => "request-fixture",
      runtimeFactory: () =>
        fixtureRuntime(async (request, options) => {
          captured = request;
          await options?.onEvent?.({
            type: "reasoning-delta",
            sequence: 0,
            text: "think",
          });
          await options?.onEvent?.({
            type: "content-delta",
            sequence: 1,
            text: "done",
          });
          return succeeded("done");
        }),
    });

    const completion = await transport.complete(
      {
        model: "moonshotai/kimi-k3",
        messages: [{ role: "user", content: "what is this?" }],
        imageAttachments: [
          { mediaType: "image/png", dataRef: "data:image/png;base64,AAAA" },
        ],
        tools: [
          {
            name: "inspect",
            description: "Inspect.",
            parameters: { type: "object", properties: {} },
          },
        ],
        options: { maxTokens: 128, reasoningEffort: "max", stream: true },
      },
      { onDelta: (delta) => deltas.push(`${delta.type}:${delta.text}`) },
    );

    assert.ok(captured);
    assert.deepEqual(captured.requiredCapabilities, {
      tools: true,
      vision: true,
    });
    const user = captured.request.messages.find(
      (message) => message.role === "user",
    );
    assert.ok(user);
    assert.equal(
      user.content.some(
        (part) =>
          part.type === "image" &&
          part.dataRef === "data:image/png;base64,AAAA",
      ),
      true,
    );
    assert.deepEqual(deltas, ["reasoning:think", "content:done"]);
    assert.equal(completion.message.content, "done");
    assert.equal(completion.reasoning, "think");
    assert.equal(completion.execution?.id, "model_execution_fixture");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("same embedded transport rebuilds runtime after catalog change", async () => {
  const { directory, path } = tempCatalog();
  const configs: Parameters<
    NonNullable<
      ConstructorParameters<typeof EmbeddedAcmeChatTransport>[0]["runtimeFactory"]
    >
  >[0]["config"][] = [];
  try {
    saveUserCatalog(path, loadUserCatalog(path));
    const transport = new EmbeddedAcmeChatTransport({
      env: { NVIDIA_API_KEY: "nvapi-fixture" },
      catalogPath: path,
      runtimeFactory: (options) => {
        configs.push(options.config);
        return fixtureRuntime(async () => succeeded());
      },
    });

    await transport.complete({
      model: "moonshotai/kimi-k3",
      messages: [{ role: "user", content: "first" }],
    });
    assert.equal(configs.length, 1);

    const updated = addUserChatModel(loadUserCatalog(path), {
      id: "vendor/new-model",
      name: "New Model",
      provider: "nvidia",
      inputModalities: ["text"],
    });
    saveUserCatalog(path, updated);

    await transport.complete({
      model: "vendor/new-model",
      messages: [{ role: "user", content: "second" }],
    });

    assert.equal(configs.length, 2);
    assert.equal(
      configs[1]?.nvidia?.profiles.some(
        (profile) => profile.model === "vendor/new-model",
      ),
      true,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("embedded transport preserves ACME failure classification", async () => {
  const { directory, path } = tempCatalog();
  try {
    const transport = new EmbeddedAcmeChatTransport({
      env: { NVIDIA_API_KEY: "nvapi-fixture" },
      catalogPath: path,
      runtimeFactory: () =>
        fixtureRuntime(async () =>
          ({
            status: "failed",
            modelExecutionId: "model_execution_rate",
            error: {
              code: "MODEL_RATE_LIMIT",
              message: "busy",
              stage: "calling-model",
              retryable: true,
            },
            diagnostic: {
              kind: "rate-limit",
              delivery: "sent",
              httpStatus: 429,
            },
          }) as Awaited<ReturnType<AcmeModelRuntime["execute"]>>,
        ),
    });

    await assert.rejects(
      () =>
        transport.complete({
          model: "moonshotai/kimi-k3",
          messages: [{ role: "user", content: "hello" }],
        }),
      (error: unknown) => {
        assert.ok(error instanceof ChatError);
        assert.equal(error.code, "rate_limit");
        assert.match(error.message, /modelExecutionId=model_execution_rate/u);
        return true;
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});



test("embedded transport calls the provider directly through real acme-engine", async () => {
  const { directory, path } = tempCatalog();
  const urls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  try {
    const transport = new EmbeddedAcmeChatTransport({
      env: { NVIDIA_API_KEY: "nvapi-fixture" },
      catalogPath: path,
      requestKey: () => "real-runtime-fixture",
      fetch: async (input, init) => {
        urls.push(String(input));
        bodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        const lines = [
          `data: ${JSON.stringify({
            id: "chatcmpl_embedded",
            model: "nvidia/nemotron-3.5-lightning-30b-a3b",
            choices: [{ index: 0, delta: { reasoning_content: "plan" } }],
          })}`,
          `data: ${JSON.stringify({
            choices: [{ index: 0, delta: { content: "Hello" } }],
          })}`,
          `data: ${JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
          })}`,
          "data: [DONE]",
          "",
        ].join("\n\n");
        return new Response(lines, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        });
      },
    });

    const completion = await transport.complete({
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      messages: [{ role: "user", content: "hello" }],
      options: { stream: true },
    });

    assert.deepEqual(urls, [
      "https://integrate.api.nvidia.com/v1/chat/completions",
    ]);
    assert.equal(
      urls.some(
        (url) =>
          url.includes("127.0.0.1") ||
          url.includes("/v1/model/execute") ||
          url.includes("/v1/model/compatibility"),
      ),
      false,
    );
    assert.equal(
      bodies[0]?.model,
      "nvidia/nemotron-3.5-lightning-30b-a3b",
    );
    assert.equal(bodies[0]?.stream, true);
    assert.equal(completion.message.content, "Hello");
    assert.equal(completion.reasoning, "plan");
    assert.equal(completion.usage?.totalTokens, 9);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

