import assert from "node:assert/strict";
import test from "node:test";
import {
  composeChatInvocation,
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
    { role: "system", content: "persistent" },
    { role: "system", content: "ephemeral" },
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

test("chat invocation enforces an exact multibyte UTF-8 budget", () => {
  const measurer = new Utf8ByteChatMessageMeasurer();
  const baseline = composeChatInvocation([], "räv 🦊");
  const exact = measurer.measure(baseline.serialized);
  const accepted = composeChatInvocation([], "räv 🦊", {
    budget: { maximum: exact, measurer },
  });
  assert.equal(accepted.measuredUnits, exact);
  assert.equal(accepted.measurementUnit, "utf8-bytes");
  assert.throws(
    () =>
      composeChatInvocation([], "räv 🦊", {
        budget: { maximum: exact - 1, measurer },
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

function projection(items = 1): ProjectionResult {
  return {
    projection: {
      taskId: "a007_v1_task_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      items: Array.from({ length: items }, (_, index) => ({
        id: `knowledge-private-${index}`,
        proposition: index === 0 ? "Use SQLite locally." : "Keep context bounded.",
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

test("memory prompt exposes semantic data and strips all identity/control fields", () => {
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
      proposition: "Use SQLite locally.",
      kind: "architecture",
      tags: ["memory"],
      scope: ["core"],
      authority: 0.9,
    },
  ]);
  assert.equal(prompt.userEnvelope.includes("a007_v1_"), false);
  assert.equal(prompt.userEnvelope.includes("knowledge-private"), false);
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
    (JSON.parse(empty.userEnvelope) as { retrievedContext: { items: unknown[] } })
      .retrievedContext.items,
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
