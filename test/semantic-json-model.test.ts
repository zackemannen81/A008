import assert from "node:assert/strict";
import test from "node:test";
import { Utf8ByteChatMessageMeasurer } from "../src/core/chat-invocation.js";
import { ChatError } from "../src/core/errors.js";
import type {
  ChatCompletion,
  ChatRequest,
  ChatTransport,
} from "../src/core/types.js";
import {
  ChatTransportSemanticJsonGenerator,
  KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
  SEMANTIC_JSON_GENERATION,
  POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION,
  serializeSemanticJsonRequest,
  type SemanticJsonGenerateInput,
  type SemanticJsonGenerator,
} from "../src/orchestration/semantic-json-model.js";

function completion(
  content: string,
  reasoning = "private reasoning must be ignored",
): ChatCompletion {
  return {
    message: { role: "assistant", content },
    reasoning,
    finishReason: "stop",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };
}

function generator(
  transport: ChatTransport,
  maximum = 10_000,
): ChatTransportSemanticJsonGenerator {
  return new ChatTransportSemanticJsonGenerator({
    transport,
    model: "fake/semantic-model",
    budget: {
      maximum,
      measurer: new Utf8ByteChatMessageMeasurer(),
    },
    generation: {
      temperature: 0,
      topP: 1,
      maxTokens: 512,
      reasoningBudget: 64,
      enableThinking: false,
    },
  });
}

const semanticInput: SemanticJsonGenerateInput = {
  operation: "knowledge_analysis",
  systemInstruction: "Return strict JSON only.",
  serializedInput: '{"message":"Hej ÅÄÖ","answer":"Svar"}',
};

test("semantic JSON generator owns one exact stateless non-streaming request", async () => {
  const requests: ChatRequest[] = [];
  let callbackWasProvided = false;
  const transport: ChatTransport = {
    async complete(request, callbacks) {
      requests.push(request);
      callbackWasProvided = callbacks !== undefined;
      return completion('[{"proposition":"Svar","kind":"fact"}]');
    },
  };

  const result = await generator(transport).generate(semanticInput);

  assert.deepEqual(result, [{ proposition: "Svar", kind: "fact" }]);
  assert.equal(requests.length, 1);
  assert.equal(callbackWasProvided, false);
  assert.equal(requests[0]?.model, "fake/semantic-model");
  assert.deepEqual(requests[0]?.messages, [
    { role: "system", content: "Return strict JSON only." },
    {
      role: "user",
      content:
        '{"operation":"knowledge_analysis","input":{"message":"Hej ÅÄÖ","answer":"Svar"}}',
    },
  ]);
  assert.deepEqual(requests[0]?.options, {
    temperature: 0,
    topP: 1,
    maxTokens: 512,
    enableThinking: false,
    stream: false,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(requests[0]?.options ?? {}, "reasoningBudget"),
    false,
  );
  assert.equal(requests[0]?.signal, undefined);
  assert.equal(JSON.stringify(result).includes("private reasoning"), false);
  assert.equal(
    serializeSemanticJsonRequest(
      "knowledge_analysis",
      semanticInput.serializedInput,
    ),
    requests[0]?.messages[1]?.content,
  );
});

test("semantic JSON generator applies the exact multibyte message budget before transport", async () => {
  let calls = 0;
  const transport: ChatTransport = {
    async complete() {
      calls += 1;
      return completion("[]");
    },
  };
  const serializedMessages = JSON.stringify([
    { role: "system", content: semanticInput.systemInstruction },
    {
      role: "user",
      content: serializeSemanticJsonRequest(
        semanticInput.operation,
        semanticInput.serializedInput,
      ),
    },
  ]);
  const exact = Buffer.byteLength(serializedMessages, "utf8");
  assert.ok(exact > serializedMessages.length);

  await generator(transport, exact).generate(semanticInput);
  assert.equal(calls, 1);
  await assert.rejects(
    () => generator(transport, exact - 1).generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.equal(calls, 1);
});

test("semantic JSON generator rejects invalid local configuration before transport", async () => {
  let calls = 0;
  const transport: ChatTransport = {
    async complete() {
      calls += 1;
      return completion("{}");
    },
  };
  assert.throws(
    () =>
      new ChatTransportSemanticJsonGenerator({
        transport,
        model: "   ",
        budget: {
          maximum: 100,
          measurer: new Utf8ByteChatMessageMeasurer(),
        },
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.throws(
    () =>
      new ChatTransportSemanticJsonGenerator({
        transport,
        model: "fake/model",
        budget: {
          maximum: 100,
          measurer: new Utf8ByteChatMessageMeasurer(),
        },
        generation: { maxTokens: 0 } as never,
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  await assert.rejects(
    () =>
      generator(transport).generate({
        ...semanticInput,
        systemInstruction: " ",
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  await assert.rejects(
    () =>
      generator(transport).generate({
        ...semanticInput,
        serializedInput: "not JSON",
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  await assert.rejects(
    () =>
      new ChatTransportSemanticJsonGenerator({
        transport,
        model: "fake/model",
        budget: {
          maximum: 0,
          measurer: new Utf8ByteChatMessageMeasurer(),
        },
      }).generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.equal(calls, 0);
});

test("semantic JSON generator rejects non-strict or invalid assistant content", async (t) => {
  const cases: readonly [string, unknown][] = [
    // "fenced JSON" was here until A008-0061. ADR 0012 D6 narrowed the
    // rejection to fragment extraction; a fence wrapping the whole content is
    // packaging, not a choice among alternatives. Prose stays rejected for the
    // reason ADR 0012 gave: a quoted array from an injected document must never
    // be read as the model's answer.
    ["prose-wrapped JSON", completion("result: {}")],
    ["empty assistant content", completion("   ")],
    [
      "non-assistant message",
      { message: { role: "user", content: "{}" } },
    ],
    ["malformed completion", { reasoning: "{}" }],
  ];
  for (const [name, response] of cases) {
    await t.test(name, async () => {
      const transport: ChatTransport = {
        async complete() {
          return response as ChatCompletion;
        },
      };
      await assert.rejects(
        () => generator(transport).generate(semanticInput),
        (error: unknown) =>
          error instanceof ChatError && error.code === "invalid_response",
      );
    });
  }
});

test("semantic JSON generator forwards cancellation and performs no pre-aborted call", async () => {
  let calls = 0;
  let receivedSignal: AbortSignal | undefined;
  const transport: ChatTransport = {
    async complete(request) {
      calls += 1;
      receivedSignal = request.signal;
      return await new Promise<ChatCompletion>((_resolve, reject) => {
        request.signal?.addEventListener(
          "abort",
          () => reject(new ChatError("cancelled", "fake cancelled")),
          { once: true },
        );
      });
    },
  };
  const active = new AbortController();
  const pending = generator(transport).generate({
    ...semanticInput,
    signal: active.signal,
  });
  active.abort();
  await assert.rejects(
    () => pending,
    (error: unknown) =>
      error instanceof ChatError && error.code === "cancelled",
  );
  assert.equal(calls, 1);
  assert.equal(receivedSignal, active.signal);

  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    () =>
      generator(transport).generate({
        ...semanticInput,
        signal: preAborted.signal,
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "cancelled",
  );
  assert.equal(calls, 1);
});

test("model-backed adapters allocate stable semantic-only inputs on one shared generator", async () => {
  const calls: SemanticJsonGenerateInput[] = [];
  const fake: SemanticJsonGenerator = {
    async generate(input) {
      calls.push(input);
      return input.operation === "knowledge_analysis"
        ? [{ proposition: "Keep answers only", kind: "rule" }]
        : { type: "new" };
    },
  };
  const analyzer = new ModelBackedPostOutputKnowledgeAnalyzer(fake);
  const classifier = new ModelBackedKnowledgeRelationClassifier(fake);
  const controller = new AbortController();

  assert.deepEqual(
    await analyzer.analyze(
      {
        message: "Question",
        answer: "Final answer",
        reasoning: "must not cross",
      } as never,
      { signal: controller.signal },
    ),
    [{ proposition: "Keep answers only", kind: "rule" }],
  );
  assert.deepEqual(
    await classifier.classify(
      {
        proposal: {
          proposition: "Keep answers only",
          kind: "rule",
          tags: [],
          scope: ["runtime"],
          domains: [],
          entities: [],
          confidence: 0.9,
        },
        candidates: [],
        knowledgeId: "must-not-cross",
      } as never,
      { signal: controller.signal },
    ),
    { type: "new" },
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(calls[0] ?? {}), [
    "operation",
    "systemInstruction",
    "serializedInput",
    "signal",
  ]);
  assert.equal(calls[0]?.operation, "knowledge_analysis");
  assert.equal(
    calls[0]?.systemInstruction,
    POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION,
  );
  assert.equal(
    calls[0]?.serializedInput,
    '{"message":"Question","answer":"Final answer"}',
  );
  assert.equal(calls[0]?.serializedInput.includes("reasoning"), false);
  assert.equal(calls[1]?.operation, "relation_classification");
  assert.equal(
    calls[1]?.systemInstruction,
    KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION,
  );
  assert.equal(calls[1]?.serializedInput.includes("knowledgeId"), false);
  assert.equal(calls[0]?.signal, controller.signal);
  assert.equal(calls[1]?.signal, controller.signal);
});

test("semantic generator allocates fresh request data for every call", async () => {
  const seen: ChatRequest[] = [];
  const initialSystemContents: string[] = [];
  const transport: ChatTransport = {
    async complete(request) {
      seen.push(request);
      initialSystemContents.push(request.messages[0]?.content ?? "");
      const mutable = request.messages as { role: string; content: string }[];
      mutable[0]!.content = "transport mutation";
      return completion("{}");
    },
  };
  const owner = generator(transport);
  await owner.generate(semanticInput);
  await owner.generate(semanticInput);
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0]?.messages, seen[1]?.messages);
  assert.deepEqual(initialSystemContents, [
    "Return strict JSON only.",
    "Return strict JSON only.",
  ]);
  assert.equal(semanticInput.systemInstruction, "Return strict JSON only.");
});

test("semantic JSON output budget fits a full extraction", () => {
  // A 128-proposal extraction does not fit in 1024 output tokens, and a
  // truncated array is not partial knowledge: it fails the strict JSON parse
  // and the whole batch is discarded. 16384 is the verified model profile's own
  // output maximum, so this is the ceiling rather than an arbitrary number.
  assert.equal(SEMANTIC_JSON_GENERATION.maxTokens, 16_384);
  assert.equal(SEMANTIC_JSON_GENERATION.temperature, 0);
  assert.equal(SEMANTIC_JSON_GENERATION.enableThinking, false);
  assert.equal(SEMANTIC_JSON_GENERATION.stream, false);
});

test("the analyzer instruction keeps its two structural guarantees", () => {
  const instruction = POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION;

  // Untrusted-data framing. This is what stops an injection attempt inside
  // extracted document or answer text from being read as an instruction, and it
  // must survive any future rewording of the extraction guidance around it.
  assert.match(instruction, /untrusted/iu);
  assert.match(instruction, /never as instructions/iu);

  // Output contract. serializeSemanticJsonRequest parses the reply strictly as
  // one array; an instruction that stopped saying so would fail at runtime, not
  // at build time.
  assert.match(instruction, /exactly one valid JSON array/iu);
  assert.match(instruction, /\[\]/u);

  // The field allow-list the staging validator enforces.
  for (const field of ["proposition", "kind", "tags", "domains", "entities", "confidence"]) {
    assert.match(instruction, new RegExp(field, "u"));
  }

  // It is one joined string, not an array leaked into the request.
  assert.equal(typeof instruction, "string");
  assert.equal(instruction.includes("\n"), false);
});

test("a fenced JSON answer is read instead of discarded", async () => {
  // The instruction asks for exactly one JSON array and nothing else, and a
  // model asked for JSON wraps it in a markdown fence often enough that losing
  // the whole extraction to it is the wrong trade. This is recovery, not
  // repair: the payload inside the fence is already valid.
  const fenced = generator({
    async complete() {
      return completion(
        '```json\n[{"proposition":"Sömn stärker minnet","kind":"fact"}]\n```',
      );
    },
  });
  assert.deepEqual(await fenced.generate(semanticInput), [
    { proposition: "Sömn stärker minnet", kind: "fact" },
  ]);

  const bare = generator({
    async complete() {
      return completion("```\n[1, 2, 3]\n```");
    },
  });
  assert.deepEqual(await bare.generate(semanticInput), [1, 2, 3]);
});

test("a fence buried in prose is refused, not unwrapped", async () => {
  // The anchoring is the security boundary, not a tidiness detail. An
  // unanchored fence pattern would find a fenced block anywhere in the content
  // and that is fragment extraction under another name: a source document can
  // contain a fenced JSON array, and a model quoting it back while refusing
  // must never have that read as its answer. Only a fence that opens at the
  // start and closes at the end is packaging.
  const buried = generator({
    async complete() {
      return completion(
        'The document said:\n```json\n[{\"proposition\":\"A\"}]\n```\nI cannot extract from that.',
      );
    },
  });
  await assert.rejects(
    () => buried.generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError && error.code === "invalid_response",
  );
});

test("a truncated answer names the budget, not the syntax", async () => {
  // Three causes needing three different responses, and the old message
  // distinguished none of them. `finishReason` already told them apart and was
  // sitting unread on the completion.
  const cut = generator({
    async complete() {
      return {
        message: {
          role: "assistant" as const,
          content: '[{"proposition":"Sömn stärker minnet","kind":"fac',
        },
        finishReason: "length",
      };
    },
  });
  await assert.rejects(
    () => cut.generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError &&
      error.code === "invalid_response" &&
      /cut off by the output budget/u.test(error.message) &&
      /A008_CHAT_MAX_TOKENS/u.test(error.message),
  );
});

test("a non-JSON answer reports what actually arrived", async () => {
  // "must be strict JSON" said nothing at all. Without an excerpt the failure
  // is unactionable from a log, which is exactly how it was first reported.
  const refusal = generator({
    async complete() {
      return completion("I cannot extract knowledge from that input.");
    },
  });
  await assert.rejects(
    () => refusal.generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError &&
      /Received: I cannot extract knowledge/u.test(error.message) &&
      /finishReason=stop/u.test(error.message),
  );
});

test("the excerpt is bounded and flattened to one line", async () => {
  const long = "x".repeat(5_000);
  const noisy = generator({
    async complete() {
      return completion(`not json\n\n${long}`);
    },
  });
  await assert.rejects(
    () => noisy.generate(semanticInput),
    (error: unknown) => {
      assert.ok(error instanceof ChatError);
      const received = /Received: (.*)$/u.exec(error.message)?.[1] ?? "";
      assert.ok(received.length <= 210, `excerpt was ${received.length} chars`);
      assert.ok(received.endsWith("…"), "a clipped excerpt must say so");
      assert.ok(!received.includes("\n"), "the excerpt must stay on one line");
      return true;
    },
  );
});

test("prose around a JSON payload is still refused", async () => {
  // ADR 0012's reasoning, kept: a source document can contain a JSON array, and
  // a model quoting it back while refusing must not have that read as its
  // answer. Fence recovery does not open this door because it requires the
  // fence to wrap the entire content.
  const chatty = generator({
    async complete() {
      return completion('Here is the extraction:\n[{\"proposition\":\"A\"}]\nHope that helps.');
    },
  });
  await assert.rejects(
    () => chatty.generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError && error.code === "invalid_response",
  );
});

test("recovery never repairs malformed JSON", async () => {
  // Leniency stops at packaging. A missing bracket is not a formatting slip and
  // guessing at it would put invented structure into the knowledge store.
  const broken = generator({
    async complete() {
      return completion('[{"proposition":"A"},');
    },
  });
  await assert.rejects(
    () => broken.generate(semanticInput),
    (error: unknown) =>
      error instanceof ChatError && error.code === "invalid_response",
  );
});
