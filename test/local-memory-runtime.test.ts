import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import {
  ProjectConversationStateStore,
  readProjectConversations,
} from "../src/runtime/conversation-state-store.js";
import type { ChatRequest } from "../src/core/types.js";
import { DEFAULT_PROVIDER_TIMEOUT_MS } from "../src/runtime/local-runtime-config.js";
import { ChatError } from "../src/core/errors.js";
import { generatedImagePart } from "../src/core/chat-content.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import { SqliteKnowledgeStore } from "../src/memory/knowledge/index.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import type { KnowledgeItem } from "../src/memory/types.js";
import {
  createLocalMemoryRuntime,
  describeMemoryOutcome,
} from "../src/runtime/local-memory-runtime.js";
import {
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  semanticInput,
  semanticOperation,
  TEST_PROJECT_ID,
  uniqueTraceFile,
} from "./helpers.js";

const ASSERTION = "Durable fact: the local memory project code is alpha-seven.";
const PROPOSITION = "the local memory project code is alpha-seven";
const QUESTION = "What is the local memory project code?";

test("sidebar conversation migration preserves legacy chat, selection, content and project isolation", () => {
  const fixture = isolatedMemoryEnv();
  const filename = join(fixture.directory, "chat-migration.sqlite");
  const first = parseRuntimeId(
    "A008_v1_conversation_00000000-0000-4000-8000-000000000001",
    "conversation",
  );
  const second = parseRuntimeId(
    "A008_v1_conversation_00000000-0000-4000-8000-000000000002",
    "conversation",
  );
  const other = parseRuntimeId(
    "A008_v1_project_00000000-0000-4000-8000-000000000002",
    "project",
  );
  const legacy = new Database(filename);
  legacy.exec(
    "CREATE TABLE A008_project_conversation (namespace TEXT PRIMARY KEY, conversation_id TEXT, model TEXT, messages_json TEXT, updated_at TEXT)",
  );
  legacy
    .prepare("INSERT INTO A008_project_conversation VALUES (?, ?, ?, ?, ?)")
    .run(
      TEST_PROJECT_ID,
      first,
      "fixture",
      JSON.stringify([
        { role: "user", content: "Legacy chat title" },
        { role: "assistant", content: "Retained answer" },
      ]),
      "2026-09-22T00:00:00Z",
    );
  legacy
    .prepare("INSERT INTO A008_project_conversation VALUES (?, ?, ?, ?, ?)")
    .run(
      "unopened-legacy-project",
      second,
      "fixture",
      JSON.stringify([{ role: "user", content: "Unopened legacy title" }]),
      "2026-09-22T00:00:00Z",
    );
  legacy.close();
  assert.equal(
    readProjectConversations(filename, TEST_PROJECT_ID)[0]?.title,
    "Legacy chat title",
  );
  const store = new ProjectConversationStateStore(
    filename,
    parseRuntimeId(TEST_PROJECT_ID, "project"),
  );
  try {
    assert.equal(
      readProjectConversations(filename, "unopened-legacy-project")[0]?.title,
      "Unopened legacy title",
    );
    assert.equal(store.load()?.messages.length, 2);
    store.save({
      conversationId: second,
      model: "fixture",
      messages: [{ role: "user", content: "Second\nchat" }],
    });
    assert.equal(store.list().length, 2);
    assert.equal(
      store.list().find((chat) => chat.current)?.title,
      "Second chat",
    );
    store.select(first);
    assert.equal(store.load()?.messages[1]?.content, "Retained answer");
    const foreign = new ProjectConversationStateStore(filename, other);
    try {
      assert.deepEqual(foreign.list(), []);
      assert.throws(
        () => foreign.select(first),
        /Unknown project conversation/u,
      );
    } finally {
      foreign.close();
    }
  } finally {
    store.close();
  }
  const reopened = new ProjectConversationStateStore(
    filename,
    parseRuntimeId(TEST_PROJECT_ID, "project"),
  );
  try {
    assert.equal(reopened.load()?.conversationId, first);
    assert.equal(reopened.list().length, 2);
    reopened.save({ conversationId: first, model: "fixture", messages: [] });
    assert.equal(reopened.list().length, 2);
    reopened.select(second);
    assert.equal(reopened.load()?.messages[0]?.content, "Second\nchat");
  } finally {
    reopened.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("workspace new/select preserves chats while reset affects only the selected chat", async () => {
  const fixture = isolatedMemoryEnv();
  const runtime = createLocalMemoryRuntime({
    env: fixture.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({
        chat: () => ({ content: "Answer" }),
        analyze: () => [],
        classify: () => ({ type: "new" }),
      }),
  });
  try {
    const first = runtime.openSession({ workspaceConversation: "restore" });
    await first.turn("First chat");
    runtime.createWorkspaceConversation();
    const second = runtime.openSession({ workspaceConversation: "restore" });
    await second.turn("Second chat");
    assert.equal(runtime.listWorkspaceConversations().length, 2);
    runtime.selectWorkspaceConversation(first.conversationId);
    const restored = runtime.openSession({ workspaceConversation: "restore" });
    assert.equal(restored.messages[0]?.content, "First chat");
    restored.reset();
    assert.equal(runtime.listWorkspaceConversations().length, 2);
    runtime.selectWorkspaceConversation(second.conversationId);
    assert.equal(
      runtime.openSession({ workspaceConversation: "restore" }).messages[0]
        ?.content,
      "Second chat",
    );
  } finally {
    runtime.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("trusted conversation seed reaches the next turn without workspace persistence or semantic replay", async () => {
  const fixture = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: (request) => {
      assert.deepEqual(
        request.messages
          .filter((message) => message.role !== "system")
          .slice(0, 2)
          .map((message) => message.content),
        ["Seeded question.", "Seeded answer."],
      );
      assert.match(request.messages.at(-1)?.content ?? "", /New question\./u);
      return { content: "New answer." };
    },
    analyze: () => [],
    classify: () => ({ type: "new" }),
  });
  const runtime = createLocalMemoryRuntime({
    env: fixture.env,
    surface: "test",
    createTransport: () => transport,
  });
  const seed = {
    conversationId: "A008_v1_conversation_00000000-0000-4000-8000-000000000163",
    messages: [
      { role: "user" as const, content: "Seeded question." },
      { role: "assistant" as const, content: "Seeded answer." },
    ],
  };
  try {
    const session = runtime.openSession({ conversationSeed: seed });
    seed.messages[0]!.content = "Caller mutation.";
    assert.equal(session.conversationId, seed.conversationId);
    assert.deepEqual(session.messages, [
      { role: "user", content: "Seeded question." },
      { role: "assistant", content: "Seeded answer." },
    ]);
    assert.equal(transport.requests.length, 0);
    assert.deepEqual(runtime.listWorkspaceConversations(), []);

    await session.turn("New question.");
    assert.equal(
      transport.requests.filter(
        (request) => semanticOperation(request) === undefined,
      ).length,
      1,
    );
    const analysis = transport.requests.find(
      (request) => semanticOperation(request) === "knowledge_analysis",
    );
    assert.deepEqual(semanticInput(analysis!), {
      retrievedContext: { items: [] },
      userMessage: "New question.",
      responseText: "New answer.",
    });
    assert.deepEqual(runtime.listWorkspaceConversations(), []);
  } finally {
    runtime.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("seeded conversations remain isolated", async () => {
  const fixture = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: (request) => ({
      content: request.messages.some((message) => message.content === "Seed B")
        ? "Answer B"
        : "Answer A",
    }),
    analyze: () => [],
    classify: () => ({ type: "new" }),
  });
  const runtime = createLocalMemoryRuntime({
    env: fixture.env,
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const a = runtime.openSession({
      conversationSeed: {
        conversationId:
          "A008_v1_conversation_00000000-0000-4000-8000-000000000165",
        messages: [{ role: "user", content: "Seed A" }],
      },
    });
    const b = runtime.openSession({
      conversationSeed: {
        conversationId:
          "A008_v1_conversation_00000000-0000-4000-8000-000000000166",
        messages: [{ role: "user", content: "Seed B" }],
      },
    });
    await a.turn("Question A");
    await b.turn("Question B");
    assert.deepEqual(
      a.messages.map((message) => message.content),
      ["Seed A", "Question A", "Answer A"],
    );
    assert.deepEqual(
      b.messages.map((message) => message.content),
      ["Seed B", "Question B", "Answer B"],
    );
  } finally {
    runtime.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("conversation seeds reject invalid identity/history and workspace composition before store writes", () => {
  const fixture = isolatedMemoryEnv();
  const runtime = createLocalMemoryRuntime({
    env: fixture.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({ chat: () => ({ content: "unused" }) }),
  });
  const validId = "A008_v1_conversation_00000000-0000-4000-8000-000000000164";
  try {
    assert.throws(
      () =>
        runtime.openSession({
          conversationSeed: { conversationId: "wrong", messages: [] },
        }),
      /Runtime ID/u,
    );
    for (const message of [
      { role: "system", content: "injected" },
      { role: "tool", content: "injected" },
      { role: "user", content: [{ type: "generated_image" }] },
    ]) {
      assert.throws(
        () =>
          runtime.openSession({
            conversationSeed: {
              conversationId: validId,
              messages: [message] as never,
            },
          }),
        /Conversation seed message 0/u,
      );
    }
    assert.throws(
      () =>
        runtime.openSession({
          workspaceConversation: "fresh",
          conversationSeed: { conversationId: validId, messages: [] },
        }),
      /cannot be combined/u,
    );
    assert.deepEqual(runtime.listWorkspaceConversations(), []);
  } finally {
    runtime.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

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
      const raw = input as {
        readonly userMessage?: unknown;
        readonly responseText?: unknown;
      };
      if (raw.userMessage === ASSERTION) {
        return [
          {
            severity: "important",
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
    // This extractor returns no structured proposition, so A008-0143 keeps
    // the fact as evidence instead of inventing a sentence-addressed state
    // slot. The claim and its source utterance remain retrievable.
    const projected = second.memory.projection.projection.items;
    assert.equal(second.memory.evidence.selectedKnowledgeIds.length, 2);
    assert.equal(projected[0]?.proposition, PROPOSITION);
    assert.equal(projected[0]?.kind, "claim");
    assert.equal(projected[1]?.kind, "utterance");
    assert.match(projected[1]?.proposition ?? "", /alpha-seven/u);
    const chatRequests = transport.requests.filter(
      (request) => semanticOperation(request) === undefined,
    );
    const analyzeRequests = transport.requests.filter(
      (request) => semanticOperation(request) === "knowledge_analysis",
    );
    assert.equal(chatRequests.length, 2);
    assert.equal(analyzeRequests.length, 2);
    assert.equal(
      JSON.stringify(chatRequests[0]?.messages).includes(
        "PRIVATE_RUNTIME_REASONING",
      ),
      false,
    );
    assert.equal(
      JSON.stringify(analyzeRequests[0]?.messages).includes(
        "PRIVATE_RUNTIME_REASONING",
      ),
      false,
    );
    const firstAnalyze = semanticInput(analyzeRequests[0]!) as {
      readonly retrievedContext: { readonly items: readonly unknown[] };
      readonly userMessage: string;
      readonly responseText: string;
    };
    assert.deepEqual(firstAnalyze, {
      retrievedContext: { items: [] },
      userMessage: ASSERTION,
      responseText: "Noted.",
    });
    assert.equal(
      chatRequests[1]?.messages.filter((message) => message.role !== "system")
        .length,
      3,
    );
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
    // Two surfaces survive a restart, same as they do in one process. See the
    // note in the two-turn test above.
    assert.equal(reread.memory.evidence.selectedKnowledgeIds.length, 2);
    assert.equal(
      reread.memory.projection.projection.items[0]?.proposition,
      PROPOSITION,
    );
    assert.deepEqual(
      reread.memory.projection.projection.items.map((item) => item.kind),
      ["claim", "utterance"],
    );
    const store = new SqliteKnowledgeStore({
      filename: isolated.sqlitePath,
      projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
    });
    try {
      const snapshot = store.load();
      assert.equal(
        snapshot.state.bindings.some(
          (binding) => binding.label === PROPOSITION,
        ),
        false,
        "unstructured evidence must not invent current state after restart",
      );
      assert.equal(
        snapshot.claims.some((claim) => claim.label === PROPOSITION),
        true,
      );
      assert.equal(
        snapshot.state.bindings.some(
          (binding) =>
            "activationStatus" in binding || "canonicalStatus" in binding,
        ),
        false,
      );
    } finally {
      store.close();
    }
  } finally {
    secondRuntime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("workspace conversation survives runtime restart while generic sessions stay fresh", async () => {
  const isolated = isolatedMemoryEnv();
  const transport = () =>
    memoryAwareFakeTransport({
      chat: () => ({ content: "Workspace fixture answer." }),
      analyze: () => [],
      classify: () => ({ type: "new" }),
    });
  const firstRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: transport,
  });
  let conversationId = "";
  try {
    const session = firstRuntime.openSession({
      workspaceConversation: "fresh",
    });
    conversationId = session.conversationId;
    await session.turn("Persist this workspace turn.");
    assert.deepEqual(
      session.messages.map((message) => message.role),
      ["user", "assistant"],
    );
  } finally {
    firstRuntime.close();
  }

  const secondRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: transport,
  });
  try {
    const restored = secondRuntime.openSession({
      workspaceConversation: "restore",
    });
    assert.equal(restored.conversationId, conversationId);
    assert.deepEqual(
      restored.messages.map((message) => message.role),
      ["user", "assistant"],
    );
    assert.equal(restored.messages[0]?.content, "Persist this workspace turn.");
    assert.equal(restored.messages[1]?.content, "Workspace fixture answer.");

    const generic = secondRuntime.openSession();
    assert.notEqual(generic.conversationId, conversationId);
    assert.equal(generic.messages.length, 0);
  } finally {
    secondRuntime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("workspace reset and undo persist the resulting canonical conversation", async () => {
  const isolated = isolatedMemoryEnv();
  const transport = () =>
    memoryAwareFakeTransport({
      chat: (_request, chatTurn) => ({ content: `Answer ${chatTurn}.` }),
      analyze: () => [],
      classify: () => ({ type: "new" }),
    });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: transport,
  });
  try {
    const session = runtime.openSession({ workspaceConversation: "fresh" });
    await session.turn("First turn.");
    await session.turn("Second turn.");
    assert.equal(session.messages.length, 4);
    assert.equal(session.undoLastTurn(), true);
    assert.equal(session.messages.length, 2);
  } finally {
    runtime.close();
  }

  const afterUndo = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: transport,
  });
  try {
    const restored = afterUndo.openSession({
      workspaceConversation: "restore",
    });
    assert.deepEqual(
      restored.messages.map((message) => message.content),
      ["First turn.", "Answer 1."],
    );
    restored.reset();
    assert.equal(restored.messages.length, 0);
  } finally {
    afterUndo.close();
  }

  const afterReset = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: transport,
  });
  try {
    assert.equal(
      afterReset.openSession({ workspaceConversation: "restore" }).messages
        .length,
      0,
    );
  } finally {
    afterReset.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("workspace restore terminalizes a stale pending generated image without replay", () => {
  const isolated = isolatedMemoryEnv();
  const create = () =>
    createLocalMemoryRuntime({
      env: isolated.env,
      surface: "test",
      createTransport: () =>
        memoryAwareFakeTransport({
          chat: () => {
            throw new Error("restore must not call the provider");
          },
        }),
    });
  const first = create();
  let generationId = "";
  try {
    const session = first.openSession({ workspaceConversation: "fresh" });
    generationId = "image_pending_restore";
    session.reserveGeneratedImage(generationId, "unfinished image fixture");
    session.reserveGeneratedImage(
      "image_completed_restore",
      "completed image fixture",
    );
    session.resolveGeneratedImage("image_completed_restore", {
      status: "completed",
      locator:
        "source:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/completed.png",
      mediaType: "image/png",
      filename: "completed.png",
    });
    assert.equal(
      generatedImagePart(session.messages[0]?.content)?.status,
      "pending",
    );
    assert.equal(
      generatedImagePart(session.messages[1]?.content)?.status,
      "completed",
    );
  } finally {
    first.close();
  }

  const second = create();
  try {
    const restored = second.openSession({ workspaceConversation: "restore" });
    const part = generatedImagePart(restored.messages[0]?.content);
    assert.equal(part?.generationId, generationId);
    assert.equal(part?.status, "cancelled");
    assert.match(part?.error ?? "", /did not complete/u);
    const completed = generatedImagePart(restored.messages[1]?.content);
    assert.equal(completed?.status, "completed");
    assert.equal(
      completed?.locator,
      "source:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/completed.png",
    );
  } finally {
    second.close();
  }

  const third = create();
  try {
    const restoredAgain = third.openSession({
      workspaceConversation: "restore",
    });
    assert.equal(
      generatedImagePart(restoredAgain.messages[0]?.content)?.status,
      "cancelled",
    );
  } finally {
    third.close();
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
        severity: "important",
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
    committerDecorator: (committer) => ({
      async commit() {
        throw new MemoryError("stale_state", "revision changed");
      },
      repairIndex: (pending) => committer.repairIndex(pending),
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
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => assertionTransport(),
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
      A008_DEBUG_TRACE_FILE: join(
        isolated.directory,
        "blocked",
        "trace.debug.jsonl",
      ),
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
      () =>
        runtime.openSession().turn(ASSERTION, { signal: controller.signal }),
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
      const message = (input as { readonly userMessage?: unknown }).userMessage;
      if (typeof message === "string" && message.trim().endsWith("?")) {
        return [];
      }
      return [
        {
          severity: "important",
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

test("live restatement boosts evidence without changing the read path or state lifecycle", async () => {
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
    assert.equal(
      read.memory.projection.projection.items[0]?.proposition,
      PROPOSITION,
    );
    const afterRead = await readCanonical(isolated.sqlitePath);
    assert.equal(afterRead?.revision, 1);
    assert.equal(afterRead?.relevanceScore, 0.7);

    const restated = await session.turn(
      "The local memory project code is alpha-seven.",
    );
    assert.equal(restated.postOutput.status, "completed");
    if (restated.postOutput.status === "completed") {
      assert.equal(
        restated.postOutput.records[0]?.result.reconciliation.relation,
        "restatement",
      );
      assert.equal(
        restated.postOutput.records[0]?.result.reconciliation.item,
        null,
      );
    }
    const afterWrite = await readCanonical(isolated.sqlitePath);
    assert.equal(afterWrite?.revision, 1);
    assert.equal(afterWrite?.relevanceScore, 0.7);
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("migrated dormant v0 exact hits remain answerable on the live read path", async () => {
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
      .turn("What is the local memory project code?");
    assert.equal(result.postOutput.status, "completed");
    assert.equal(
      result.memory.projection.projection.items[0]?.proposition,
      PROPOSITION,
    );
    const current = await readCanonical(isolated.sqlitePath);
    assert.equal(current?.activationStatus, "dormant");
    assert.equal(current?.relevanceScore, 0.35);
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("live restatement does not write lifecycle onto state bindings", async () => {
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
    const store = new SqliteKnowledgeStore({
      filename: isolated.sqlitePath,
      projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
    });
    try {
      const snapshot = store.load();
      assert.equal(
        snapshot.state.bindings.some(
          (binding) =>
            "activationStatus" in binding ||
            "relevanceScore" in binding ||
            "keepAlive" in binding,
        ),
        false,
      );
    } finally {
      store.close();
    }
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
                  severity: "important",
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
        result.postOutput.records[0]?.result.reconciliation.item,
        null,
      );
    }
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("chat generation overrides reach the provider request", async () => {
  // The verified profile ships reasoningBudget 16384 against maxTokens 16384,
  // so reasoning can consume the whole output budget and truncate the answer.
  // An operator must be able to cap it without editing a profile that means
  // "checked against the model card".
  const seen: (ChatRequest["options"] | undefined)[] = [];
  let transportTimeoutMs: number | undefined;
  const isolated = isolatedMemoryEnv({
    A008_CHAT_REASONING_BUDGET: "2048",
    A008_CHAT_MAX_TOKENS: "32768",
    A008_CHAT_TEMPERATURE: "0.5",
  });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: (transportOptions) => ({
      async complete(request) {
        transportTimeoutMs = transportOptions.timeoutMs;
        if (semanticOperation(request) === undefined)
          seen.push(request.options);
        return {
          message: { role: "assistant", content: "Noted." },
          model: request.model,
          finishReason: "stop",
        } as never;
      },
    }),
  });
  try {
    await runtime.openSession().turn("Remember that the sky is blue.");
  } catch {
    // The post-output path may fail against this minimal fake; the chat request
    // has already been observed, which is what this test is about.
  } finally {
    runtime.close();
  }

  const chat = seen[0];
  assert.ok(chat, "a chat request was made");
  assert.equal(chat.reasoningBudget, 2_048, "the cap is applied");
  assert.equal(chat.maxTokens, 32_768);
  assert.equal(chat.temperature, 0.5);
  // Untouched profile defaults survive.
  assert.equal(chat.topP, 0.95);
  assert.equal(chat.enableThinking, true);

  // The adapter's own fallback is 60s, which a completeness extraction exceeds.
  // The runtime must hand it the configured ceiling rather than leave it unset.
  assert.equal(transportTimeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS);
});

test("a commit refusal is named in the diagnostic, apart from a staging skip", () => {
  // Two places drop a proposal and they point at different things to go and
  // look at: staging refuses a malformed analyzer item, the commit loop refuses
  // one the store will not accept. Reporting them under one word would send a
  // reader to the wrong half.
  const batch = {
    skippedProposals: ["proposal 3 proposition must be a non-empty string"],
  } as never;

  assert.equal(
    describeMemoryOutcome({
      status: "completed",
      batch,
      records: [],
      skippedProposals: [],
    } as never),
    "memory skipped 1 malformed proposal: proposal 3 proposition must be a non-empty string",
  );

  assert.equal(
    describeMemoryOutcome({
      status: "completed",
      batch: { skippedProposals: [] } as never,
      records: [],
      skippedProposals: [
        { proposalIndex: 2, reason: "UPDATE fails when the slot is contested" },
      ],
    } as never),
    "memory refused 1 proposal at commit: proposal 2: UPDATE fails when the slot is contested",
  );

  // Both at once, and a clean batch stays silent.
  assert.match(
    describeMemoryOutcome({
      status: "completed",
      batch,
      records: [],
      skippedProposals: [{ proposalIndex: 2, reason: "contested" }],
    } as never) ?? "",
    /skipped 1 malformed proposal.*refused 1 proposal at commit/u,
  );
  assert.equal(
    describeMemoryOutcome({
      status: "completed",
      batch: { skippedProposals: [] } as never,
      records: [],
      skippedProposals: [],
    } as never),
    undefined,
  );
});

test("A007 shared-memory protocol writes, recalls and survives SQLite restart without a provider call", async () => {
  const isolated = isolatedMemoryEnv();
  const marker = "A007 shared memory marker cobalt-pineapple-007";
  const transport = assertionTransport();
  const firstRuntime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const capabilities = firstRuntime.sharedMemoryCapabilities();
    assert.equal(capabilities.protocol, "A007_MEMORY_V1");
    assert.equal(capabilities.version, 1);
    assert.ok(capabilities.capabilities.includes("recall"));
    assert.ok(capabilities.capabilities.includes("write"));
    assert.equal(capabilities.writeSemantics, "evidence");

    const before = transport.requests.length;
    const stored = firstRuntime.writeSharedMemory({ content: marker });
    assert.equal(stored.status, "STORED");
    assert.equal(stored.semantics, "evidence");
    const recalled = await firstRuntime.recallSharedMemory({
      query: "cobalt-pineapple-007",
    });
    assert.ok(recalled.items.some((item) => item.content.includes(marker)));
    assert.equal(
      transport.requests.length,
      before,
      "external recall/write must not hide a model/provider call",
    );
  } finally {
    firstRuntime.close();
  }

  const restartTransport = assertionTransport();
  const restarted = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => restartTransport,
  });
  try {
    const recalledAfterRestart = await restarted.recallSharedMemory({
      query: "cobalt-pineapple-007",
    });
    assert.ok(
      recalledAfterRestart.items.some((item) => item.content.includes(marker)),
    );
    assert.equal(
      restartTransport.requests.length,
      0,
      "restart recall must remain provider-free",
    );
  } finally {
    restarted.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
