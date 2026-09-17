import assert from "node:assert/strict";
import test from "node:test";
import { CodingAgentMemoryPolicy } from "../src/memory/coding-agent-policy.js";
import { MemoryError } from "../src/memory/errors.js";
import { InMemoryMemoryRepository } from "../src/memory/in-memory-repository.js";
import { SemanticMemory } from "../src/memory/memory-engine.js";
import {
  serializeContextProjection,
  Utf8ByteContextMeasurer,
} from "../src/memory/serialization.js";
import type {
  KnowledgeItem,
  KnowledgeProposal,
  MemoryPolicy,
  MemoryTask,
} from "../src/memory/types.js";

function proposal(
  proposition: string,
  overrides: Partial<KnowledgeProposal> = {},
): KnowledgeProposal {
  return {
    proposition,
    kind: "decision",
    tags: ["memory"],
    scope: ["core"],
    relevanceScore: 0.1,
    activationThreshold: 0.5,
    authority: 0.8,
    confidence: 0.9,
    provenance: [{ sourceId: "owner-input", sourceType: "document" }],
    ...overrides,
  };
}

function task(overrides: Partial<MemoryTask> = {}): MemoryTask {
  return {
    id: "task-memory",
    query: "Work on the memory core",
    scopes: ["core"],
    terms: ["memory"],
    requiredKnowledgeIds: [],
    ...overrides,
  };
}

function storedItem(
  id: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    proposition: `knowledge ${id}`,
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
    sourceBacked: false,
    provenance: [],
    revision: 1,
    ...overrides,
  };
}

function engine(
  repository = new InMemoryMemoryRepository(),
  policy: MemoryPolicy = new CodingAgentMemoryPolicy(),
): SemanticMemory {
  let sequence = 0;
  return new SemanticMemory({
    repository,
    policy,
    measurer: new Utf8ByteContextMeasurer(),
    idFactory: () => `knowledge_${++sequence}`,
  });
}

test("dormant restatement reinforces on write; project includes it without mutation", async () => {
  const memory = engine();
  const created = await memory.reconcile(
    proposal("The memory core is provider neutral."),
    { type: "new" },
  );
  assert.equal(created.item?.id, "knowledge_1");
  assert.equal(created.item?.activationStatus, "dormant");

  const discovered = await memory.discover(task());
  assert.deepEqual(
    discovered.map((item) => item.id),
    ["knowledge_1"],
  );
  assert.equal(discovered[0]?.activationStatus, "dormant");

  const restated = await memory.reconcile(
    proposal("Equivalent restatement", {
      tags: ["continuity"],
      provenance: [{ sourceId: "restatement", sourceType: "test" }],
    }),
    { type: "restatement", targetId: "knowledge_1" },
  );
  assert.equal(restated.item?.id, "knowledge_1");
  assert.equal(
    restated.item?.proposition,
    "The memory core is provider neutral.",
  );
  assert.ok(Math.abs((restated.item?.relevanceScore ?? 0) - 0.3) < 1e-12);
  assert.equal(restated.item?.activationStatus, "dormant");
  const afterWrite = await memory.getKnowledge("knowledge_1");
  const auditAfterWrite = await memory.getAudit();

  const projected = await memory.project(task({ terms: ["continuity"] }), {
    maximum: 2_000,
  });
  assert.deepEqual(
    projected.projection.items.map((item) => item.id),
    ["knowledge_1"],
  );
  assert.deepEqual(await memory.getKnowledge("knowledge_1"), afterWrite);
  assert.deepEqual(await memory.getAudit(), auditAfterWrite);
  assert.equal(
    (await memory.getKnowledge("knowledge_1"))?.activationStatus,
    "dormant",
  );
});

test("guarded reconciliation rejects stale revisions inside the transaction", async () => {
  const memory = engine();
  await memory.reconcile(proposal("Guarded canonical fact."), { type: "new" });
  const before = await memory.getKnowledge("knowledge_1");
  const beforeAudit = await memory.getAudit();

  await assert.rejects(
    () =>
      memory.reconcile(
        proposal("Stale restatement."),
        { type: "restatement", targetId: "knowledge_1" },
        { expectedRevisions: [{ id: "knowledge_1", revision: 2 }] },
      ),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "stale_state",
  );
  assert.deepEqual(await memory.getKnowledge("knowledge_1"), before);
  assert.deepEqual(await memory.getAudit(), beforeAudit);

  const committed = await memory.reconcile(
    proposal("Fresh restatement."),
    { type: "restatement", targetId: "knowledge_1" },
    { expectedRevisions: [{ id: "knowledge_1", revision: 1 }] },
  );
  assert.equal(committed.item?.revision, 2);
});

test("extend enriches one canonical item and conflict records audit without canon mutation", async () => {
  const memory = engine();
  await memory.reconcile(proposal("Memory is optional."), { type: "new" });

  const extended = await memory.reconcile(
    proposal("Memory is an optional backend capability.", {
      tags: ["backend"],
      scope: ["core", "runtime"],
    }),
    { type: "extend", targetId: "knowledge_1" },
  );
  assert.equal(extended.item?.id, "knowledge_1");
  assert.equal(
    extended.item?.proposition,
    "Memory is an optional backend capability.",
  );
  assert.deepEqual(extended.item?.scope, ["core", "runtime"]);

  const beforeConflict = await memory.getKnowledge("knowledge_1");
  const conflict = await memory.reconcile(
    proposal("Memory must always be enabled."),
    { type: "conflict", targetIds: ["knowledge_1"] },
  );
  assert.equal(conflict.item, null);
  assert.deepEqual(conflict.conflictTargetIds, ["knowledge_1"]);
  assert.deepEqual(await memory.getKnowledge("knowledge_1"), beforeConflict);
  assert.equal((await memory.getAudit()).at(-1)?.type, "knowledge_conflict");
});

test("supersede separates current truth from historical state", async () => {
  const memory = engine();
  await memory.reconcile(
    proposal("The first persistence adapter is SQLite.", {
      relevanceScore: 0.8,
    }),
    { type: "new" },
  );
  const replacement = await memory.reconcile(
    proposal("The first persistence adapter is not selected.", {
      relevanceScore: 0.8,
    }),
    { type: "supersede", targetId: "knowledge_1" },
  );

  assert.equal(replacement.item?.id, "knowledge_2");
  const history = await memory.getHistory("knowledge_1");
  assert.deepEqual(
    history.map((item) => item.id),
    ["knowledge_1", "knowledge_2"],
  );
  assert.equal(history[0]?.canonicalStatus, "superseded");
  assert.equal(history[0]?.activationStatus, "dormant");
  assert.equal(history[1]?.canonicalStatus, "current");

  const current = await memory.discover(task());
  assert.deepEqual(
    current.map((item) => item.id),
    ["knowledge_2"],
  );
});

test("scope isolation excludes active knowledge without decaying it", async () => {
  const repository = new InMemoryMemoryRepository([
    storedItem("in-scope", { relevanceScore: 0.6 }),
    storedItem("out-of-scope", {
      scope: ["gui"],
      tags: ["canvas"],
      relevanceScore: 0.6,
    }),
  ]);
  const memory = engine(
    repository,
    new CodingAgentMemoryPolicy({ projectionReinforcement: 0.1 }),
  );

  const before = await memory.getKnowledge("in-scope");
  const projection = await memory.project(task(), { maximum: 2_000 });
  assert.deepEqual(
    projection.projection.items.map((item) => item.id),
    ["in-scope"],
  );
  assert.deepEqual(await memory.getKnowledge("in-scope"), before);
  assert.equal((await memory.getKnowledge("in-scope"))?.relevanceScore, 0.6);
  assert.equal(
    (await memory.getKnowledge("out-of-scope"))?.relevanceScore,
    0.6,
  );
  assert.equal(
    (await memory.getKnowledge("out-of-scope"))?.activationStatus,
    "active",
  );
  assert.equal((await memory.getKnowledge("out-of-scope"))?.revision, 1);
});

test("keep-alive and dormant required items project without activation or mutation", async () => {
  const repository = new InMemoryMemoryRepository([
    storedItem("pinned", {
      scope: ["unrelated"],
      tags: ["safety"],
      relevanceScore: 0,
      activationThreshold: 1,
      keepAlive: true,
    }),
    storedItem("required-dormant", {
      activationStatus: "dormant",
      relevanceScore: 0,
      activationThreshold: 1,
    }),
  ]);
  const excludingPolicy: MemoryPolicy = {
    isRelevant: () => false,
    projectionReinforcement: () => 0.1,
    reconciliationReinforcement: () => 0.1,
    rankForContext: (items) => items,
  };
  const memory = engine(repository, excludingPolicy);

  const pinned = await memory.project(task(), { maximum: 2_000 });
  assert.ok(pinned.projection.items.some((item) => item.id === "pinned"));
  const before = await memory.getKnowledge("required-dormant");
  const auditBefore = await memory.getAudit();

  const required = await memory.project(
    task({ requiredKnowledgeIds: ["required-dormant"] }),
    { maximum: 2_000 },
  );
  assert.deepEqual(required.projection.items.map((item) => item.id).sort(), [
    "pinned",
    "required-dormant",
  ]);
  assert.deepEqual(await memory.getKnowledge("required-dormant"), before);
  assert.deepEqual(await memory.getAudit(), auditBefore);
});

test("projection enforces exact serialized budget and excludes audit and provenance", async () => {
  const repository = new InMemoryMemoryRepository(
    [
      storedItem("required", {
        proposition: "Materialized semantic rule.",
        keepAlive: true,
        provenance: [
          { sourceId: "secret-audit-source", sourceType: "private-trace" },
        ],
      }),
      storedItem("optional", {
        proposition: "Optional semantic detail.",
        relevanceScore: 0.7,
      }),
    ],
    [
      {
        sequence: 1,
        type: "knowledge_created",
        knowledgeIds: ["secret-audit-id"],
        taskId: null,
        selectedKnowledgeIds: [],
        excludedCount: 0,
      },
    ],
  );
  const memory = engine(
    repository,
    new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
  );
  const onlyRequired = serializeContextProjection({
    taskId: "task-memory",
    items: [
      {
        id: "required",
        proposition: "Materialized semantic rule.",
        kind: "decision",
        tags: ["memory"],
        scope: ["core"],
        authority: 0.8,
      },
    ],
  });
  const exactBudget = Buffer.byteLength(onlyRequired, "utf8");
  const result = await memory.project(task(), { maximum: exactBudget });

  assert.equal(result.serialized, onlyRequired);
  assert.equal(result.measuredUnits, exactBudget);
  assert.equal(result.measurementUnit, "utf8-bytes");
  assert.deepEqual(
    result.projection.items.map((item) => item.id),
    ["required"],
  );
  assert.ok(result.serialized.includes("Materialized semantic rule."));
  assert.ok(!result.serialized.includes("secret-audit-source"));
  assert.ok(!result.serialized.includes("secret-audit-id"));
  assert.ok(!result.serialized.includes("provenance"));

  const canonicalBeforeFailure = await memory.getKnowledge("required");
  const auditBeforeFailure = await memory.getAudit();
  await assert.rejects(
    () => memory.project(task(), { maximum: exactBudget - 1 }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "budget_exceeded",
  );
  assert.deepEqual(
    await memory.getKnowledge("required"),
    canonicalBeforeFailure,
  );
  assert.deepEqual(await memory.getAudit(), auditBeforeFailure);
});

test("missing required knowledge fails explicitly", async () => {
  const memory = engine();
  await assert.rejects(
    () =>
      memory.project(task({ requiredKnowledgeIds: ["missing"] }), {
        maximum: 1_000,
      }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "required_not_found",
  );
});

test("invalid duplicate generated ID and policy failure roll back state", async () => {
  const duplicateRepository = new InMemoryMemoryRepository([
    storedItem("same"),
  ]);
  const duplicateMemory = new SemanticMemory({
    repository: duplicateRepository,
    policy: new CodingAgentMemoryPolicy(),
    measurer: new Utf8ByteContextMeasurer(),
    idFactory: () => "same",
  });
  await assert.rejects(
    () => duplicateMemory.reconcile(proposal("Duplicate"), { type: "new" }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "duplicate_id",
  );
  assert.deepEqual(await duplicateMemory.getAudit(), []);

  const boostingPolicy: MemoryPolicy = {
    isRelevant: () => true,
    projectionReinforcement: () => 0.25,
    reconciliationReinforcement: () => 0.1,
    rankForContext: (items) => items,
  };
  const repository = new InMemoryMemoryRepository([
    storedItem("first", { relevanceScore: 0.6 }),
    storedItem("second", { relevanceScore: 0.6 }),
  ]);
  const memory = engine(repository, boostingPolicy);
  const before = await memory.getKnowledge("first");
  const projected = await memory.project(task(), { maximum: 2_000 });
  assert.deepEqual(projected.projection.items.map((item) => item.id).sort(), [
    "first",
    "second",
  ]);
  assert.deepEqual(await memory.getKnowledge("first"), before);
  assert.equal((await memory.getKnowledge("first"))?.relevanceScore, 0.6);
  assert.equal((await memory.getKnowledge("first"))?.revision, 1);
  assert.deepEqual(await memory.getAudit(), []);
});

test("ranking is deterministic and malformed policy output is rejected", async () => {
  const repository = new InMemoryMemoryRepository([
    storedItem("b", { relevanceScore: 0.5, authority: 0.5 }),
    storedItem("a", { relevanceScore: 0.5, authority: 0.5 }),
    storedItem("high", { relevanceScore: 0.5, authority: 0.9 }),
  ]);
  const memory = engine(
    repository,
    new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
  );
  const result = await memory.project(task(), { maximum: 4_000 });
  assert.deepEqual(
    result.projection.items.map((item) => item.id),
    ["high", "a", "b"],
  );

  const rewritingPolicy: MemoryPolicy = {
    isRelevant: () => true,
    projectionReinforcement: () => 0,
    reconciliationReinforcement: () => 0,
    rankForContext: (items) =>
      items.map((item) => ({ ...item, proposition: "policy rewrite" })),
  };
  const rewriting = engine(
    new InMemoryMemoryRepository([
      storedItem("canonical", { proposition: "Canonical meaning" }),
    ]),
    rewritingPolicy,
  );
  const rewrittenResult = await rewriting.project(task(), { maximum: 2_000 });
  assert.equal(
    rewrittenResult.projection.items[0]?.proposition,
    "Canonical meaning",
  );

  const malformedPolicy: MemoryPolicy = {
    isRelevant: () => true,
    projectionReinforcement: () => 0,
    reconciliationReinforcement: () => 0,
    rankForContext: (items) => items.slice(1),
  };
  const malformed = engine(
    new InMemoryMemoryRepository([storedItem("one"), storedItem("two")]),
    malformedPolicy,
  );
  await assert.rejects(
    () => malformed.project(task(), { maximum: 2_000 }),
    (error: unknown) => error instanceof MemoryError && error.code === "policy",
  );
});

test("100,000 unrelated items do not enlarge the same task projection", async () => {
  const relevant = storedItem("relevant", {
    proposition: "Context grows with the task, not accumulated history.",
    relevanceScore: 0.9,
  });
  const createCorpus = (size: number): KnowledgeItem[] => [
    relevant,
    ...Array.from({ length: size - 1 }, (_, index) =>
      storedItem(`noise-${index.toString().padStart(6, "0")}`, {
        proposition: `Unrelated GUI record ${index}`,
        tags: ["canvas"],
        scope: ["gui"],
      }),
    ),
  ];
  const policy = new CodingAgentMemoryPolicy({ projectionReinforcement: 0 });
  const small = engine(new InMemoryMemoryRepository(createCorpus(100)), policy);
  const large = engine(
    new InMemoryMemoryRepository(createCorpus(100_000)),
    policy,
  );

  const smallProjection = await small.project(task(), { maximum: 2_000 });
  const largeProjection = await large.project(task(), { maximum: 2_000 });
  assert.equal(largeProjection.serialized, smallProjection.serialized);
  assert.equal(largeProjection.measuredUnits, smallProjection.measuredUnits);
  assert.deepEqual(
    largeProjection.projection.items.map((item) => item.id),
    ["relevant"],
  );
});

test("selected projection preserves explicit rank without lifecycle mutation", async () => {
  const repository = new InMemoryMemoryRepository([
    storedItem("first", { relevanceScore: 0.6 }),
    storedItem("second", { relevanceScore: 0.7 }),
    storedItem("dormant", {
      activationStatus: "dormant",
      relevanceScore: 0.1,
      activationThreshold: 0.9,
    }),
  ]);
  const memory = engine(
    repository,
    new CodingAgentMemoryPolicy({ projectionReinforcement: 0.25 }),
  );
  const before = await repository.read((view) => view.listAll());
  const auditBefore = await repository.readAudit();

  const result = await memory.projectSelected(task(), { maximum: 4_000 }, [
    "second",
    "dormant",
    "first",
  ]);

  assert.deepEqual(
    result.projection.items.map((item) => item.id),
    ["second", "dormant", "first"],
  );
  assert.deepEqual(await repository.read((view) => view.listAll()), before);
  assert.deepEqual(await repository.readAudit(), auditBefore);
});

test("S6 reduced: a dormant current record is returned for a direct question", async () => {
  const repository = new InMemoryMemoryRepository([
    storedItem("house-color", {
      proposition: "Brittans house is green.",
      activationStatus: "dormant",
      relevanceScore: 0.1,
      activationThreshold: 0.9,
    }),
  ]);
  const memory = engine(
    repository,
    new CodingAgentMemoryPolicy({ projectionReinforcement: 0.25 }),
  );
  const before = await memory.getKnowledge("house-color");
  const auditBefore = await memory.getAudit();
  const result = await memory.project(task(), { maximum: 2_000 });
  assert.deepEqual(
    result.projection.items.map((item) => item.id),
    ["house-color"],
  );
  assert.deepEqual(await memory.getKnowledge("house-color"), before);
  assert.deepEqual(await memory.getAudit(), auditBefore);
});
