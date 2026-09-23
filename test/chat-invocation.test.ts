import assert from "node:assert/strict";
import test from "node:test";
import {
  composeChatInvocation,
  DEFAULT_SYSTEM_MESSAGE,
  serializeChatMessages,
  Utf8ByteChatMessageMeasurer,
} from "../src/core/chat-invocation.js";
import { ChatError } from "../src/core/errors.js";
import type { ChatMessage } from "../src/core/types.js";
import {
  DeterministicMemoryPromptComposer,
  MEMORY_CONTEXT_ENVELOPE_VERSION,
  MEMORY_CONTEXT_SYSTEM_INSTRUCTION,
} from "../src/orchestration/memory-prompt-composer.js";
import type { ProjectionResult } from "../src/memory/types.js";

test("chat invocation composition is stable, ordered, bounded, and defensive", () => {
  const committed: ChatMessage[] = [
    { role: "system", content: "persistent" },
    { role: "user", content: "old user" },
    { role: "assistant", content: "old answer" },
    { role: "user", content: "recent user" },
    { role: "assistant", content: "recent answer" },
  ];
  const composition = composeChatInvocation(committed, "original", {
    systemMessages: ["ephemeral"],
    providerUserContent: '{"message":"original"}',
    historyMessageLimit: 2,
  });

  assert.deepEqual(composition.messages, [
    { role: "system", content: "persistent\n\nephemeral" },
    { role: "user", content: "recent user" },
    { role: "assistant", content: "recent answer" },
    { role: "user", content: '{"message":"original"}' },
  ]);
  assert.equal(
    composition.serialized,
    serializeChatMessages(composition.messages),
  );
  (composition.messages[0] as { content: string }).content = "caller mutation";
  assert.equal(committed[0]?.content, "persistent");
});

test("chat invocation projects generated images as labels without locators", () => {
  const committed: ChatMessage[] = [
    {
      role: "assistant",
      content: [
        {
          type: "generated_image",
          generationId: "image_1",
          prompt: "a red robot",
          status: "completed",
          locator: "source://secret/robot.png",
          mediaType: "image/png",
          filename: "robot.png",
        },
      ],
    },
  ];
  const composition = composeChatInvocation(committed, "make another at night");
  assert.deepEqual(composition.messages.at(-2), {
    role: "assistant",
    content: "[IMAGE] a red robot",
  });
  assert.equal(composition.serialized.includes("source://"), false);
});

test("chat invocation enforces an exact multibyte UTF-8 budget", () => {
  const measurer = new Utf8ByteChatMessageMeasurer();
  const instruction = {
    systemMessages: ["Svara på svenska 🦊"],
    contextSystemMessages: [MEMORY_CONTEXT_SYSTEM_INSTRUCTION],
  };
  const baseline = composeChatInvocation([], "räv 🦊", instruction);
  const exact = measurer.measure(baseline.serialized);
  const accepted = composeChatInvocation([], "räv 🦊", {
    ...instruction,
    budget: { maximum: exact, measurer },
  });
  assert.equal(accepted.measuredUnits, exact);
  assert.equal(accepted.measurementUnit, "utf8-bytes");
  assert.throws(
    () =>
      composeChatInvocation([], "räv 🦊", {
        ...instruction,
        budget: { maximum: exact - 1, measurer },
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

function projection(items = 1): ProjectionResult {
  return {
    projection: {
      taskId: "A008_v1_task_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      items: Array.from({ length: items }, (_, index) => ({
        id: `knowledge-private-${index}`,
        proposition:
          index === 0 ? "Use SQLite locally." : "Keep context bounded.",
        kind: "architecture",
        tags: ["memory"],
        scope: ["core"],
        authority: 0.9,
      })),
    },
    serialized: "CONTROL_PLANE_SERIALIZATION_MUST_NOT_LEAK",
    measuredUnits: 999,
    measurementUnit: "utf8-bytes",
  };
}

test("memory prompt exposes bounded semantic identity while stripping runtime control fields", () => {
  const prompt = new DeterministicMemoryPromptComposer().compose(
    projection(),
    "Hur fungerar minnet?",
  );
  assert.equal(prompt.systemInstruction, MEMORY_CONTEXT_SYSTEM_INSTRUCTION);
  const envelope = JSON.parse(prompt.userEnvelope) as {
    version: string;
    retrievedContext: { items: Array<Record<string, unknown>> };
    message: string;
  };
  assert.equal(envelope.version, MEMORY_CONTEXT_ENVELOPE_VERSION);
  assert.equal(envelope.message, "Hur fungerar minnet?");
  assert.deepEqual(envelope.retrievedContext.items, [
    {
      id: "knowledge-private-0",
      proposition: "Use SQLite locally.",
      kind: "architecture",
      tags: ["memory"],
      scope: ["core"],
      authority: 0.9,
    },
  ]);
  assert.equal(prompt.userEnvelope.includes("A008_v1_"), false);
  assert.equal(prompt.userEnvelope.includes("knowledge-private-0"), true);
  assert.equal(
    prompt.userEnvelope.includes("CONTROL_PLANE_SERIALIZATION_MUST_NOT_LEAK"),
    false,
  );
  assert.equal(prompt.userEnvelope.includes("measuredUnits"), false);
});

test("empty memory uses the same envelope and malformed projections fail closed", () => {
  const composer = new DeterministicMemoryPromptComposer();
  const empty = composer.compose(projection(0), "continue");
  assert.deepEqual(
    (
      JSON.parse(empty.userEnvelope) as {
        retrievedContext: { items: unknown[] };
      }
    ).retrievedContext.items,
    [],
  );
  const malformed = projection();
  const item = malformed.projection.items[0]!;
  assert.throws(
    () =>
      composer.compose(
        {
          ...malformed,
          projection: {
            ...malformed.projection,
            items: [{ ...item, authority: Number.NaN }],
          },
        },
        "continue",
      ),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

test("one instruction selects fallback only when explicit configuration is absent", () => {
  const rule = MEMORY_CONTEXT_SYSTEM_INSTRUCTION;
  const cases = [
    { base: undefined, global: [], rule: [], expected: DEFAULT_SYSTEM_MESSAGE },
    {
      base: undefined,
      global: [],
      rule: [rule],
      expected: `${DEFAULT_SYSTEM_MESSAGE}\n\n${rule}`,
    },
    {
      base: undefined,
      global: ["Global"],
      rule: [rule],
      expected: `Global\n\n${rule}`,
    },
    { base: "Explicit", global: [], rule: [], expected: "Explicit" },
    {
      base: "Explicit",
      global: ["Global"],
      rule: [rule],
      expected: `Explicit\n\nGlobal\n\n${rule}`,
    },
    {
      base: DEFAULT_SYSTEM_MESSAGE,
      global: ["Global"],
      rule: [rule],
      expected: `${DEFAULT_SYSTEM_MESSAGE}\n\nGlobal\n\n${rule}`,
    },
  ];
  for (const fixture of cases) {
    const history: ChatMessage[] =
      fixture.base === undefined
        ? []
        : [{ role: "system", content: fixture.base }];
    const result = composeChatInvocation(history, "Actual question", {
      systemMessages: fixture.global,
      contextSystemMessages: fixture.rule,
    });
    assert.deepEqual(result.messages, [
      { role: "system", content: fixture.expected },
      { role: "user", content: "Actual question" },
    ]);
  }
  const history: ChatMessage[] = [{ role: "system", content: "Explicit" }];
  const first = composeChatInvocation(history, "one", {
    systemMessages: ["First snapshot"],
  });
  const second = composeChatInvocation(history, "two", {
    systemMessages: ["Second snapshot"],
  });
  assert.equal(first.messages[0]!.content, "Explicit\n\nFirst snapshot");
  assert.equal(second.messages[0]!.content, "Explicit\n\nSecond snapshot");
  assert.deepEqual(history, [{ role: "system", content: "Explicit" }]);
});
