import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import { SEMANTIC_JSON_GENERATION } from "../src/orchestration/semantic-json-model.js";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import {
  byteStream,
  isolatedMemoryEnv,
  semanticOperation,
  uniqueTraceFile,
} from "./helpers.js";

const live = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../test/fixtures/nvidia-live-reasoning-leak.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  readonly reasoning: string;
  readonly leakedContent: string;
  readonly expectedAnswer: string;
};

const REASONING_MUST_HAVE_NO_PATH_TO_KNOWLEDGE =
  "REASONING MUST HAVE NO PATH TO KNOWLEDGE.";

function assertNoReasoningPath(reasoning: string, text: string, label: string): void {
  assert.equal(
    text.includes(reasoning),
    false,
    `${label} contains the reasoning prefix. ${REASONING_MUST_HAVE_NO_PATH_TO_KNOWLEDGE}`,
  );
  for (const chunk of reasoning.split(/\n+/u).map((part) => part.trim())) {
    if (chunk.length < 8) {
      continue;
    }
    assert.equal(
      text.includes(chunk),
      false,
      `${label} contains reasoning substring ${JSON.stringify(chunk)}. ${REASONING_MUST_HAVE_NO_PATH_TO_KNOWLEDGE}`,
    );
  }
}

test("holy invariant: no emitted reasoning substring reaches knowledge surfaces", async () => {
  const isolated = isolatedMemoryEnv();
  const traceFile = uniqueTraceFile(isolated.directory);
  const analyzerInputs: unknown[] = [];
  const transport = new NvidiaChatTransport({
    apiKey: "test-token",
    fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        readonly stream?: boolean;
        readonly messages?: Array<{ readonly content?: string }>;
        readonly chat_template_kwargs?: { readonly enable_thinking?: boolean };
        readonly reasoning_budget?: number;
      };
      if (body.stream === false) {
        analyzerInputs.push(JSON.parse(body.messages?.at(-1)?.content ?? "{}"));
        assert.equal(body.chat_template_kwargs?.enable_thinking, false);
        assert.equal(body.reasoning_budget, undefined);
        assert.equal(body.stream, SEMANTIC_JSON_GENERATION.stream);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { role: "assistant", content: "[]" },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const sse = [
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: live.reasoning } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: live.leakedContent }, finish_reason: "stop" }] })}\n\n`,
        "data: [DONE]\n\n",
      ].join("");
      return new Response(byteStream([sse]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  const runtime = createLocalMemoryRuntime({
    env: {
      ...isolated.env,
      A007_DEBUG_TRACE: "raw",
      A007_DEBUG_TRACE_FILE: traceFile,
    },
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const session = runtime.openSession();
    const result = await session.turn(
      "Tja läget? Funderar på en sak, hur fungerar sqllite, är det filer?",
    );
    assert.equal(result.completion.message.content, live.expectedAnswer);
    assert.equal(result.memoryDiagnostic, undefined);
    const committed = session.messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.content)
      .join("\n");
    const analyzer = analyzerInputs[0] as {
      readonly input?: { readonly answer?: string; readonly message?: string };
    };
    const answer = analyzer.input?.answer ?? "";
    assert.equal(answer, live.expectedAnswer);
    assertNoReasoningPath(live.reasoning, answer, "analyzer input");
    assertNoReasoningPath(live.reasoning, committed, "committed history");
    assertNoReasoningPath(
      live.reasoning,
      result.memory.plan.queryText,
      "retrieval dialogue",
    );
    assert.equal(result.postOutput.status, "completed");
    if (result.postOutput.status === "completed") {
      for (const proposal of result.postOutput.batch.proposals) {
        assertNoReasoningPath(
          live.reasoning,
          proposal.proposal.proposition,
          "canonical proposal source",
        );
      }
    }
    const trace = readFileSync(traceFile, "utf8");
    const phases = trace
      .trim()
      .split(/\n/u)
      .map((line) => JSON.parse(line) as { readonly phase: string; readonly seq?: number; readonly status?: string })
      .filter((event) => event.phase !== "turn_start" || event.seq !== undefined);
    const turnPhases = phases
      .filter((event) => event.phase !== "trace-warning")
      .map((event) => event.phase);
    const readAt = turnPhases.indexOf("memory_read");
    const chatAt = turnPhases.indexOf("chat_request");
    assert.ok(readAt >= 0 && chatAt > readAt);
    assert.equal(turnPhases.filter((phase) => phase === "memory_failure").length, 0);
    const complete = phases.find((event) => event.phase === "turn_complete");
    assert.equal(complete?.status, "ok");
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("memory timeout is a degraded outcome and is traced once after successful chat", async () => {
  const isolated = isolatedMemoryEnv();
  const traceFile = uniqueTraceFile(isolated.directory);
  let chatCalls = 0;
  const runtime = createLocalMemoryRuntime({
    env: {
      ...isolated.env,
      A007_DEBUG_TRACE: "safe",
      A007_DEBUG_TRACE_FILE: traceFile,
    },
    surface: "test",
    createTransport: () => ({
      async complete(request) {
        if (semanticOperation(request) !== undefined) {
          throw new ChatError("timeout", "NVIDIA request timed out.");
        }
        chatCalls += 1;
        return {
          message: { role: "assistant", content: "Hej! SQLite är en fil." },
        };
      },
    }),
  });
  try {
    const result = await runtime.openSession().turn("Hur fungerar sqlite?");
    assert.equal(chatCalls, 1);
    assert.equal(result.completion.message.content, "Hej! SQLite är en fil.");
    assert.match(result.memoryDiagnostic ?? "", /memory staging failed/u);
    const events = readFileSync(traceFile, "utf8")
      .trim()
      .split(/\n/u)
      .map((line) => JSON.parse(line) as { readonly phase: string; readonly status?: string });
    assert.equal(
      events.filter((event) => event.phase === "memory_failure").length,
      1,
    );
    const complete = events.find((event) => event.phase === "turn_complete") as
      | { readonly status?: string; readonly chatStatus?: string; readonly memoryStatus?: string }
      | undefined;
    assert.equal(complete?.status, "degraded");
    assert.equal(complete?.chatStatus, "ok");
    assert.equal(complete?.memoryStatus, "staging_failed");
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
