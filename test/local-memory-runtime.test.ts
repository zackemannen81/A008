import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import type { KnowledgeItem } from "../src/memory/types.js";
import {
  createLocalMemoryRuntime,
  LIVE_RECONCILIATION_REINFORCEMENT,
} from "../src/runtime/local-memory-runtime.js";
import {
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  semanticInput,
  semanticOperation,
  TEST_PROJECT_ID,
  uniqueTraceFile,
} from "./helpers.js";

const ASSERTION =
  "Durable fact: the local memory project code is alpha-seven.";
const PROPOSITION = "the local memory project code is alpha-seven";
const QUESTION = "What is the local memory project code?";

function assertionTransport() {
  return memoryAwareFakeTransport({
    chat: (request, chatTurn) => {
      if (chatTurn === 2) {
        const envelope = request.messages.at(-1)?.content ?? "";
        assert.match(envelope, new RegExp(PROPOSITION, "u"));
        assert.equal(envelope.includes("A008_v1_"), false);
        assert.equal(envelope.includes("PRIVATE"), false);
      }
      return {
        content:
          chatTurn === 1
            ? "Noted."
            : "The local memory project code is alpha-seven.",
        reasoning: "PRIVATE_RUNTIME_REASONING",
      };
    },
    analyze: (input) => {
      const raw = input as { readonly message?: unknown; readonly answer?: unknown };
      if (raw.message === ASSERTION) {
        return [
          {
            proposition: PROPOSITION,
            kind: "fact",
            tags: ["memory"],
            domains: ["runtime"],
            entities: ["alpha-seven"],
            confidence: 0.99,
          },
        ];
      }
      return [];
    },
    classify: () => ({ type: "new" }),
  });
}

test("two-turn runtime commits an explicit user assertion and rereads it", async () => {
  const isolated = isolatedMemoryEnv();
  const transport = assertionTransport();
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const session = runtime.openSession();
    const first = await session.turn(ASSERTION);
    assert.equal(first.completion.message.content, "Noted.");
    assert.equal(first.memoryDiagnostic, undefined);
    assert.equal(first.postOutput.status, "completed");
    assert.equal(first.memory.evidence.selectedKnowledgeIds.length, 0);

    const second = await session.turn(QUESTION);
    assert.match(second.completion.message.content, /alpha-seven/u);
    assert.equal(second.memory.evidence.selectedKnowledgeIds.length, 1);
    assert.equal(
      second.memory.projection.projection.items[0]?.proposition,
      PROPOSITION,
    );
    const chatRequests = transport.requests.filter(
      (request) => semanticOperation(request) === undefined,
    );
    const analyzeRequests = transport.requests.filter(
      (request) => semanticOperation(request) === "knowledge_analysis",
    );
    assert.equal(chatRequests.length, 2);
    assert.equal(analyzeRequests.length, 2);
    assert.equal(
      JSON.stringify(chatRequests[0]?.messages).includes("PRIVATE_RUNTIME_REASONING"),
      false,
    );
    assert.equal(
      JSON.stringify(analyzeRequests[0]?.messages).includes("PRIVATE_RUNTIME_REASONING"),
      false,
    );
    const firstAnalyze = semanticInput(analyzeRequests[0]!) as {
      readonly message: string;
      readonly answer: string;
    };
    assert.deepEqual(firstAnalyze, { message: ASSERTION, answer: "Noted." });
    assert.equal(chatRequests[1]?.messages.filter((message) => message.role !== "system").length, 3);
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("restart with existing SQLite still projects the active assertion", async () => {
  const isolated = isolatedMemoryEnv();
  const firstRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => assertionTransport(),
  });
  try {
    await firstRuntime.openSession().turn(ASSERTION);
  } finally {
    firstRuntime.close();
  }

  const secondRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => assertionTransport(),
  });
  try {
    const reread = await secondRuntime.openSession().turn(QUESTION);
    assert.equal(reread.memory.evidence.selectedKnowledgeIds.length, 1);
    assert.equal(
      reread.memory.projection.projection.items[0]?.proposition,
      PROPOSITION,
    );
    const repository = new SqliteMemoryRepository({
      filename: isolated.sqlitePath,
      projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
    });
    try {
      const items = await repository.read((view) => view.listCurrent());
      assert.equal(items[0]?.activationStatus, "active");
      assert.equal(items[0]?.revision, 1);
      assert.equal(items[0]?.proposition, PROPOSITION);
    } finally {
      repository.close();
    }
  } finally {
    secondRuntime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("chat rollback, staging failure, stale commit, and read failure stay distinct", async () => {
  const isolated = isolatedMemoryEnv();
  const failingChat = memoryAwareFakeTransport({
    chat: () => {
      throw new ChatError("provider", "boom");
    },
  });
  const chatRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => failingChat,
  });
  try {
    const session = chatRuntime.openSession();
    await assert.rejects(() => session.turn("hello there"), /boom/u);
    assert.equal(
      session.messages.some((message) => message.role === "user"),
      false,
    );
  } finally {
    chatRuntime.close();
  }

  const staging = memoryAwareFakeTransport({
    chat: () => ({ content: "ok" }),
    analyze: () => "not-an-array",
  });
  const stagingRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => staging,
  });
  try {
    const result = await stagingRuntime.openSession().turn(ASSERTION);
    assert.equal(result.completion.message.content, "ok");
    assert.match(result.memoryDiagnostic ?? "", /memory staging failed/u);
  } finally {
    stagingRuntime.close();
  }

  const stale = memoryAwareFakeTransport({
    chat: () => ({ content: "ok" }),
    analyze: () => [
      {
        proposition: PROPOSITION,
        kind: "fact",
        tags: ["memory"],
        domains: ["runtime"],
        entities: ["alpha-seven"],
      },
    ],
    classify: () => ({ type: "new" }),
  });
  const staleRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => stale,
    memoryDecorator: (memory) => ({
      projectId: memory.projectId,
      async reconcile() {
        throw new MemoryError("stale_state", "revision changed");
      },
    }),
  });
  try {
    const result = await staleRuntime.openSession().turn(ASSERTION);
    assert.equal(result.completion.message.content, "ok");
    assert.match(result.memoryDiagnostic ?? "", /stale_state/u);
  } finally {
    staleRuntime.close();
  }

  const readRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({ chat: () => ({ content: "unused" }) }),
    readerDecorator: () => ({
      async read() {
        throw new MemoryError("policy", "sqlite read failed");
      },
    }),
  });
  try {
    await assert.rejects(
      () => readRuntime.openSession().turn("hello there"),
      /sqlite read failed/u,
    );
  } finally {
    readRuntime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("pending index repair is retried once and sink failure does not rewrite the answer", async () => {
  const isolated = isolatedMemoryEnv();
  let failures = 1;
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => assertionTransport(),
    indexWriterDecorator: (writer) => ({
      projectId: writer.projectId,
      async upsertRetrievalDocument(document) {
        if (failures > 0) {
          failures -= 1;
          throw new Error("index unavailable");
        }
        return writer.upsertRetrievalDocument(document);
      },
    }),
  });
  try {
    const result = await runtime.openSession().turn(ASSERTION);
    assert.equal(result.completion.message.content, "Noted.");
    assert.equal(result.memoryDiagnostic, undefined);
    assert.equal(result.postOutput.status, "completed");
  } finally {
    runtime.close();
  }

  writeFileSync(join(isolated.directory, "blocked"), "nope");
  const blocked = createLocalMemoryRuntime({
    env: {
      ...isolated.env,
      A008_DEBUG_TRACE: "safe",
      A008_DEBUG_TRACE_FILE: join(isolated.directory, "blocked", "trace.debug.jsonl"),
    },
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({
        chat: () => ({ content: "still answered" }),
        analyze: () => [],
      }),
  });
  try {
    const result = await blocked.openSession().turn("hello there");
    assert.equal(result.completion.message.content, "still answered");
    assert.match(result.memoryDiagnostic ?? "", /memory-trace sink failed/u);
  } finally {
    blocked.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("safe and raw traces correlate a turn without credentials or control IDs in the model request", async () => {
  const isolated = isolatedMemoryEnv();
  const safeFile = uniqueTraceFile(isolated.directory);
  const rawFile = uniqueTraceFile(isolated.directory);
  const transport = assertionTransport();
  const runtime = createLocalMemoryRuntime({
    env: {
      ...isolated.env,
      A008_DEBUG_TRACE: "raw",
      A008_DEBUG_TRACE_FILE: rawFile,
      NVIDIA_API_KEY: "super-secret-test-key",
    },
    surface: "test",
    createTransport: () => transport,
  });
  try {
    await runtime.openSession().turn(ASSERTION);
    await runtime.tracer.flush();
    const raw = readFileSync(rawFile, "utf8");
    assert.match(raw, /chat_request/u);
    assert.match(raw, /analyze_request/u);
    assert.match(raw, /classify_request/u);
    assert.match(raw, /commit/u);
    assert.equal(raw.includes("super-secret-test-key"), false);
    assert.equal(raw.includes("Authorization"), false);
    assert.match(raw, /Noted/u);
  } finally {
    runtime.close();
  }

  const safeRuntime = createLocalMemoryRuntime({
    env: {
      ...isolated.env,
      A008_DEBUG_TRACE: "safe",
      A008_DEBUG_TRACE_FILE: safeFile,
    },
    surface: "test",
    createTransport: () => assertionTransport(),
  });
  try {
    await safeRuntime.openSession().turn(ASSERTION);
    await safeRuntime.tracer.flush();
    const safe = readFileSync(safeFile, "utf8");
    assert.match(safe, /turn_start/u);
    assert.match(safe, /memory_read/u);
    assert.equal(safe.includes("Durable fact"), false);
  } finally {
    safeRuntime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("trace off creates no file and cancellation skips post-output", async () => {
  const isolated = isolatedMemoryEnv();
  const unusedFile = uniqueTraceFile(isolated.directory);
  let semanticCalls = 0;
  const runtime = createLocalMemoryRuntime({
    env: { ...isolated.env, A008_DEBUG_TRACE_FILE: unusedFile },
    surface: "test",
    createTransport: () => ({
      async complete(request, callbacks) {
        if (semanticOperation(request) !== undefined) {
          semanticCalls += 1;
          return { message: { role: "assistant", content: "[]" } };
        }
        callbacks?.onDelta?.({ type: "content", text: "partial" });
        if (request.signal?.aborted) {
          throw new ChatError("cancelled", "NVIDIA request was cancelled.");
        }
        throw new ChatError("cancelled", "NVIDIA request was cancelled.");
      },
    }),
  });
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => runtime.openSession().turn(ASSERTION, { signal: controller.signal }),
      (error: unknown) =>
        error instanceof ChatError && error.code === "cancelled",
    );
    assert.equal(runtime.tracer.mode, "off");
    assert.equal(semanticCalls, 0);
  } finally {
    runtime.close();
    assert.throws(() => readFileSync(unusedFile, "utf8"));
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

const SEEDED_ID = "seeded_alpha_seven";

function seededItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: SEEDED_ID,
    proposition: PROPOSITION,
    kind: "fact",
    tags: ["memory"],
    scope: ["local"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "dormant",
    relevanceScore: 0.35,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.4,
    confidence: 0.5,
    sourceBacked: false,
    provenance: [],
    revision: 1,
    ...overrides,
  };
}

async function seedCanonical(
  sqlitePath: string,
  item: KnowledgeItem,
): Promise<void> {
  const repository = new SqliteMemoryRepository({
    filename: sqlitePath,
    projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
  });
  try {
    await repository.transact((transaction) => transaction.insert(item));
    await repository.upsertRetrievalDocument({
      knowledgeId: item.id,
      entities: ["alpha-seven"],
      domains: ["runtime"],
    });
  } finally {
    repository.close();
  }
}

async function readCanonical(
  sqlitePath: string,
): Promise<KnowledgeItem | undefined> {
  const repository = new SqliteMemoryRepository({
    filename: sqlitePath,
    projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
  });
  try {
    return await repository.read((view) => view.get(SEEDED_ID));
  } finally {
    repository.close();
  }
}

function restatementTransport() {
  return memoryAwareFakeTransport({
    chat: () => ({ content: "Noted." }),
    analyze: (input) => {
      const message = (input as { readonly message?: unknown }).message;
      if (typeof message === "string" && message.trim().endsWith("?")) {
        return [];
      }
      return [
        {
          proposition: PROPOSITION,
          kind: "fact",
          tags: ["memory"],
          domains: ["runtime"],
          entities: ["alpha-seven"],
        },
      ];
    },
    classify: (input) => {
      const candidates = (
        input as {
          readonly candidates?: ReadonlyArray<{ readonly handle: string }>;
        }
      ).candidates;
      const handle = candidates?.[0]?.handle;
      if (handle === undefined) {
        return { type: "new" };
      }
      return { type: "restatement", targetHandle: handle };
    },
  });
}

test("live restatement boosts an active item without changing the read path", async () => {
  const isolated = isolatedMemoryEnv();
  await seedCanonical(
    isolated.sqlitePath,
    seededItem({
      activationStatus: "active",
      relevanceScore: 0.7,
    }),
  );
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => restatementTransport(),
  });
  try {
    const session = runtime.openSession();
    const read = await session.turn("What is the local memory project code?");
    assert.equal(read.postOutput.status, "completed");
    const afterRead = await readCanonical(isolated.sqlitePath);
    assert.equal(afterRead?.revision, 1);
    assert.equal(afterRead?.relevanceScore, 0.7);
    assert.equal(afterRead?.activationStatus, "active");

    const restated = await session.turn(
      "The local memory project code is alpha-seven.",
    );
    assert.equal(restated.postOutput.status, "completed");
    if (restated.postOutput.status === "completed") {
      assert.equal(
        restated.postOutput.records[0]?.result.reconciliation.relation,
        "restatement",
      );
    }
    const afterWrite = await readCanonical(isolated.sqlitePath);
    assert.equal(afterWrite?.activationStatus, "active");
    assert.ok(
      Math.abs(
        (afterWrite?.relevanceScore ?? 0) -
          (0.7 + LIVE_RECONCILIATION_REINFORCEMENT),
      ) < 1e-12,
    );
    assert.equal(afterWrite?.revision, 2);
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("live restatement reactivates dormant knowledge that crosses the threshold", async () => {
  const isolated = isolatedMemoryEnv();
  await seedCanonical(
    isolated.sqlitePath,
    seededItem({ relevanceScore: 0.35, activationStatus: "dormant" }),
  );
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => restatementTransport(),
  });
  try {
    const result = await runtime
      .openSession()
      .turn("The local memory project code is alpha-seven.");
    assert.equal(result.postOutput.status, "completed");
    const current = await readCanonical(isolated.sqlitePath);
    assert.equal(current?.activationStatus, "active");
    assert.ok(
      Math.abs(
        (current?.relevanceScore ?? 0) -
          (0.35 + LIVE_RECONCILIATION_REINFORCEMENT),
      ) < 1e-12,
    );
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("live restatement leaves dormant knowledge dormant when still below threshold", async () => {
  const isolated = isolatedMemoryEnv();
  await seedCanonical(
    isolated.sqlitePath,
    seededItem({ relevanceScore: 0.1, activationStatus: "dormant" }),
  );
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => restatementTransport(),
  });
  try {
    const result = await runtime
      .openSession()
      .turn("The local memory project code is alpha-seven.");
    assert.equal(result.postOutput.status, "completed");
    const current = await readCanonical(isolated.sqlitePath);
    assert.equal(current?.activationStatus, "dormant");
    assert.ok(
      Math.abs(
        (current?.relevanceScore ?? 0) -
          (0.1 + LIVE_RECONCILIATION_REINFORCEMENT),
      ) < 1e-12,
    );
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("overlapping turns are rejected and cannot rewrite sourceMessage", async () => {
  const isolated = isolatedMemoryEnv();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let analyzeStarted = 0;
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => ({
      async complete(request) {
        const operation = semanticOperation(request);
        if (operation === "knowledge_analysis") {
          analyzeStarted += 1;
          await held;
          return {
            message: {
              role: "assistant",
              content: JSON.stringify([
                {
                  proposition: PROPOSITION,
                  kind: "fact",
                  tags: ["memory"],
                  domains: ["runtime"],
                  entities: ["alpha-seven"],
                },
              ]),
            },
          };
        }
        if (operation === "relation_classification") {
          return {
            message: {
              role: "assistant",
              content: JSON.stringify({ type: "new" }),
            },
          };
        }
        return { message: { role: "assistant", content: "Noted." } };
      },
    }),
  });
  try {
    const session = runtime.openSession();
    const first = session.turn(ASSERTION);
    while (analyzeStarted === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    await assert.rejects(
      () =>
        session.turn(
          "Durable fact: something else entirely is the project code.",
        ),
      (error: unknown) =>
        error instanceof ChatError && error.code === "configuration",
    );
    release();
    const result = await first;
    assert.equal(result.postOutput.status, "completed");
    if (result.postOutput.status === "completed") {
      assert.equal(result.postOutput.batch.sourceMessage, ASSERTION);
      assert.equal(
        result.postOutput.records[0]?.result.reconciliation.item
          ?.activationStatus,
        "active",
      );
    }
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
