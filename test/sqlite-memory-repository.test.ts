import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { CodingAgentMemoryPolicy } from "../src/memory/coding-agent-policy.js";
import { MemoryError } from "../src/memory/errors.js";
import { SemanticMemory } from "../src/memory/memory-engine.js";
import { Utf8ByteContextMeasurer } from "../src/memory/serialization.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import type { RetrievalPlan } from "../src/memory/retrieval-types.js";
import type { KnowledgeItem } from "../src/memory/types.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";

const PROJECT_A = parseRuntimeId(
  "A008_v1_project_00000000-0000-4000-8000-000000000001",
  "project",
);
const PROJECT_B = parseRuntimeId(
  "A008_v1_project_00000000-0000-4000-8000-000000000002",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_00000000-0000-4000-8000-000000000003",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_00000000-0000-4000-8000-000000000004",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_00000000-0000-4000-8000-000000000005",
  "agent",
);

function item(
  id: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    proposition: `proposition ${id}`,
    kind: "decision",
    tags: ["memory"],
    scope: ["core"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "active",
    relevanceScore: 0.8,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.8,
    confidence: 0.9,
    sourceBacked: true,
    provenance: [{ sourceId: `source-${id}`, sourceType: "test" }],
    revision: 1,
    ...overrides,
  };
}

function plan(projectId = PROJECT_A): RetrievalPlan {
  return {
    projectId,
    conversationId: CONVERSATION,
    taskId: TASK,
    agentId: AGENT,
    queryText: "How does SQLite memory work?",
    intents: ["question"],
    domains: [{ value: "architecture", weight: 1 }],
    tags: [{ value: "memory", weight: 1 }],
    entities: ["sqlite"],
    terms: ["sqlite", "memory"],
    semanticQueries: ["SQLite memory"],
    temporalHints: {
      currentOnly: true,
      mentionsPast: false,
      mentionsFuture: false,
    },
    applicabilityScopes: ["core"],
    confidence: 0.9,
  };
}

const limits = {
  exact: 10,
  lexical: 10,
  tag: 10,
  domain: 10,
  semantic: 10,
} as const;

test("SQLite repository persists canon, audit, and retrieval index across reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "A008-sqlite-memory-"));
  const filename = join(directory, "memory.sqlite");
  try {
    const repository = new SqliteMemoryRepository({
      filename,
      projectId: PROJECT_A,
    });
    const memory = new SemanticMemory({
      repository,
      policy: new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
      measurer: new Utf8ByteContextMeasurer(),
      idFactory: () => "knowledge-sqlite",
    });
    await memory.reconcile(
      {
        proposition: "SQLite provides durable local memory.",
        kind: "architecture",
        tags: ["memory", "sqlite"],
        scope: ["core"],
        relevanceScore: 0.8,
        activationThreshold: 0.5,
        authority: 0.9,
      },
      { type: "new" },
    );
    await repository.upsertRetrievalDocument({
      knowledgeId: "knowledge-sqlite",
      entities: ["SQLite"],
      domains: ["architecture"],
      embeddingModel: "test-embedding-v1",
      embedding: [1, 0],
    });
    repository.close();

    const reopened = new SqliteMemoryRepository({
      filename,
      projectId: PROJECT_A,
    });
    assert.equal(reopened.schemaVersion, 1);
    assert.equal(
      (await reopened.read((view) => view.get("knowledge-sqlite")))
        ?.proposition,
      "SQLite provides durable local memory.",
    );
    assert.equal((await reopened.readAudit()).length, 1);
    const defensiveItem = await reopened.read((view) =>
      view.get("knowledge-sqlite"),
    );
    (defensiveItem!.tags as string[]).push("caller-mutation");
    assert.equal(
      (
        await reopened.read((view) => view.get("knowledge-sqlite"))
      )?.tags.includes("caller-mutation"),
      false,
    );
    const defensiveAudit = await reopened.readAudit();
    (defensiveAudit[0]!.knowledgeIds as string[]).push("caller-mutation");
    assert.equal((await reopened.readAudit())[0]!.knowledgeIds.length, 1);
    const candidates = await reopened.retrieveCandidates(
      plan(),
      [{ model: "test-embedding-v1", vector: [1, 0] }],
      limits,
    );
    assert.equal(candidates.persistentCurrentCount, 1);
    assert.deepEqual(
      new Set(candidates.hits.map((hit) => hit.channel)),
      new Set(["exact", "lexical", "tag", "domain", "semantic"]),
    );
    assert.ok(
      candidates.hits.every((hit) => hit.knowledgeId === "knowledge-sqlite"),
    );
    const weightedPlan: RetrievalPlan = {
      ...plan(),
      entities: [],
      terms: [],
      semanticQueries: [],
      tags: [{ value: "memory", weight: 0.3 }],
      domains: [{ value: "architecture", weight: 0.4 }],
    };
    const weighted = await reopened.retrieveCandidates(
      weightedPlan,
      [],
      limits,
    );
    assert.equal(
      weighted.hits.find((hit) => hit.channel === "tag")?.score,
      0.3,
    );
    assert.equal(
      weighted.hits.find((hit) => hit.channel === "domain")?.score,
      0.4,
    );
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite repository rolls back invalid state and serializes concurrent transactions", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT_A,
  });
  await repository.transact((transaction) => transaction.insert(item("k1")));
  const before = await repository.read((view) => view.get("k1"));
  await assert.rejects(
    () =>
      repository.transact((transaction) => {
        transaction.replace({
          ...transaction.get("k1")!,
          canonicalStatus: "superseded",
          activationStatus: "dormant",
          supersededBy: "missing",
          revision: 2,
        });
      }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "illegal_state",
  );
  assert.deepEqual(await repository.read((view) => view.get("k1")), before);

  await Promise.all([
    repository.transact(async (transaction) => {
      const current = transaction.get("k1")!;
      await Promise.resolve();
      transaction.replace({
        ...current,
        relevanceScore: current.relevanceScore + 0.05,
        revision: current.revision + 1,
      });
    }),
    repository.transact((transaction) => {
      const current = transaction.get("k1")!;
      transaction.replace({
        ...current,
        relevanceScore: current.relevanceScore + 0.05,
        revision: current.revision + 1,
      });
    }),
  ]);
  const after = await repository.read((view) => view.get("k1"));
  assert.ok(Math.abs((after?.relevanceScore ?? 0) - 0.9) < 1e-12);
  assert.equal(after?.revision, 3);
  repository.close();
});

test("one SQLite file isolates identical knowledge IDs by validated project namespace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "A008-sqlite-namespace-"));
  const filename = join(directory, "memory.sqlite");
  try {
    const first = new SqliteMemoryRepository({
      filename,
      projectId: PROJECT_A,
    });
    const second = new SqliteMemoryRepository({
      filename,
      projectId: PROJECT_B,
    });
    await first.transact((transaction) =>
      transaction.insert(item("same", { proposition: "Project A memory" })),
    );
    await second.transact((transaction) =>
      transaction.insert(item("same", { proposition: "Project B memory" })),
    );
    await first.upsertRetrievalDocument({
      knowledgeId: "same",
      entities: ["sqlite"],
    });
    await second.upsertRetrievalDocument({
      knowledgeId: "same",
      entities: ["postgres"],
    });

    assert.equal(
      (await first.read((view) => view.get("same")))?.proposition,
      "Project A memory",
    );
    assert.equal(
      (await second.read((view) => view.get("same")))?.proposition,
      "Project B memory",
    );
    const firstHits = await first.retrieveCandidates(
      plan(PROJECT_A),
      [],
      limits,
    );
    assert.equal(
      firstHits.hits.some((hit) => hit.channel === "exact"),
      true,
    );
    await assert.rejects(
      () => first.retrieveCandidates(plan(PROJECT_B), [], limits),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "invalid_input",
    );
    await assert.rejects(
      () =>
        first.retrieveCandidates(plan(PROJECT_A), [], {
          ...limits,
          lexical: 0,
        }),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "invalid_input",
    );
    first.close();
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retrieval metadata is invalidated when canonical proposition changes", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT_A,
  });
  const memory = new SemanticMemory({
    repository,
    policy: new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
    measurer: new Utf8ByteContextMeasurer(),
    idFactory: () => "mutable",
  });
  await memory.reconcile(
    {
      proposition: "Old SQLite proposition",
      kind: "decision",
      tags: ["memory"],
      scope: ["core"],
    },
    { type: "new" },
  );
  await repository.upsertRetrievalDocument({
    knowledgeId: "mutable",
    entities: ["sqlite"],
    embeddingModel: "test-embedding-v1",
    embedding: [1, 0],
  });
  await memory.reconcile(
    {
      proposition: "Old SQLite proposition",
      kind: "decision",
      tags: ["memory"],
      scope: ["core"],
    },
    { type: "restatement", targetId: "mutable" },
  );
  const afterRestatement = await repository.retrieveCandidates(
    plan(),
    [{ model: "test-embedding-v1", vector: [1, 0] }],
    limits,
  );
  assert.equal(afterRestatement.channelCounts.exact, 1);
  assert.equal(afterRestatement.channelCounts.semantic, 1);
  await memory.reconcile(
    {
      proposition: "Replacement local persistence proposition",
      kind: "decision",
      tags: ["memory"],
      scope: ["core"],
    },
    { type: "extend", targetId: "mutable" },
  );
  const result = await repository.retrieveCandidates(
    plan(),
    [{ model: "test-embedding-v1", vector: [1, 0] }],
    limits,
  );
  assert.equal(result.channelCounts.exact, 0);
  assert.equal(result.channelCounts.semantic, 0);
  assert.equal(result.channelCounts.lexical > 0, true);
  repository.close();
});

test("unsupported SQLite schema version fails closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "A008-sqlite-schema-"));
  const filename = join(directory, "memory.sqlite");
  try {
    const repository = new SqliteMemoryRepository({
      filename,
      projectId: PROJECT_A,
    });
    repository.close();
    const raw = new Database(filename);
    raw
      .prepare("UPDATE A008_memory_schema SET version = 2 WHERE singleton = 1")
      .run();
    raw.close();
    assert.throws(
      () => new SqliteMemoryRepository({ filename, projectId: PROJECT_A }),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "illegal_state",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
