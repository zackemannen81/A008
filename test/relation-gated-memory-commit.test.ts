import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import type {
  CandidateSearchResult,
  RetrievalDocument,
  RetrievalPlan,
} from "../src/memory/retrieval-types.js";
import type {
  KnowledgeItem,
  ReconciliationDecision,
  ReconciliationGuard,
  ReconciliationResult,
} from "../src/memory/types.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type StagedKnowledgeBatch,
} from "../src/orchestration/post-output-knowledge-intake.js";
import type {
  RelationCandidate,
  RelationCandidateSource,
} from "../src/orchestration/relation-candidate-source.js";
import { IndexedRelationCandidateSource } from "../src/orchestration/relation-candidate-source.js";
import {
  RelationGatedMemoryCommit,
  serializeRelationClassifierInput,
  type KnowledgeRelationClassifier,
  type RelationClassifierInput,
  type RelationMemoryPort,
} from "../src/orchestration/relation-gated-memory-commit.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_50000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_50000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_50000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_50000000-0000-4000-8000-000000000004",
  "agent",
);

async function stagedBatch(
  proposition = "Reasoning förblir display-only.",
): Promise<StagedKnowledgeBatch> {
  return new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return [
          {
            proposition,
            kind: "architecture-decision",
            tags: ["memory", "reasoning"],
            domains: ["orchestration"],
            entities: ["ChatSession"],
            confidence: 0.9,
          },
        ];
      },
    },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 10_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  }).stage({
    taskId: TASK,
    message: "What should happen to reasoning?",
    answer: "Keep it display-only.",
    applicabilityScopes: ["runtime"],
  });
}

function item(id: string, proposition: string, revision = 1): KnowledgeItem {
  return {
    id,
    proposition,
    kind: "architecture-decision",
    tags: ["memory", "reasoning"],
    scope: ["runtime"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "dormant",
    relevanceScore: 0.1,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.8,
    confidence: 0.9,
    sourceBacked: false,
    provenance: [{ sourceId: "private-source", sourceType: "test" }],
    revision,
  };
}

function candidate(
  id: string,
  proposition: string,
  score: number,
): RelationCandidate {
  return {
    item: item(id, proposition),
    aggregateScore: score,
    channels: ["lexical", "tag"],
  };
}

class FakeMemory implements RelationMemoryPort {
  readonly projectId = PROJECT;
  readonly calls: Array<{
    decision: ReconciliationDecision;
    guard: ReconciliationGuard | undefined;
  }> = [];

  async reconcile(
    _proposal: Parameters<RelationMemoryPort["reconcile"]>[0],
    decision: ReconciliationDecision,
    guard?: ReconciliationGuard,
  ): Promise<ReconciliationResult> {
    this.calls.push({ decision, guard });
    if (decision.type === "conflict") {
      return {
        relation: "conflict",
        item: null,
        previousItem: null,
        conflictTargetIds: [...decision.targetIds],
      };
    }
    const id = decision.type === "new" ? "created-id" : decision.targetId;
    return {
      relation: decision.type,
      item: item(id, "Committed proposition", 2),
      previousItem: null,
      conflictTargetIds: [],
    };
  }
}

function staticSource(
  candidates: readonly RelationCandidate[],
  counter?: { calls: number },
): RelationCandidateSource {
  return {
    async find() {
      if (counter !== undefined) {
        counter.calls += 1;
      }
      return candidates;
    },
  };
}

test("indexed candidate source ranks deterministically and returns defensive dormant items", async () => {
  const batch = await stagedBatch();
  const original = new Map([
    ["knowledge-a", item("knowledge-a", "Alpha memory")],
    ["knowledge-b", item("knowledge-b", "Beta memory")],
    ["knowledge-c", item("knowledge-c", "Gamma memory")],
  ]);
  let retrievalCalls = 0;
  let receivedPlan: RetrievalPlan | undefined;
  const search: CandidateSearchResult = {
    persistentCurrentCount: 3,
    hits: [
      { knowledgeId: "knowledge-a", channel: "exact", score: 1, reason: "entity" },
      { knowledgeId: "knowledge-c", channel: "tag", score: 1, reason: "tag" },
      { knowledgeId: "knowledge-b", channel: "lexical", score: 0.7, reason: "term" },
      { knowledgeId: "knowledge-b", channel: "exact", score: 0.6, reason: "entity" },
      { knowledgeId: "knowledge-b", channel: "lexical", score: 0.5, reason: "lower duplicate" },
    ],
    channelCounts: { exact: 2, lexical: 3, tag: 1, domain: 0, semantic: 0 },
  };
  const source = new IndexedRelationCandidateSource({
    memory: {
      projectId: PROJECT,
      async getKnowledge(id) {
        return original.get(id);
      },
    },
    candidateStore: {
      projectId: PROJECT,
      async upsertRetrievalDocument() {},
      async retrieveCandidates(plan, vectors) {
        retrievalCalls += 1;
        receivedPlan = plan;
        assert.deepEqual(vectors, []);
        return search;
      },
    },
    maximumCandidates: 3,
  });

  const result = await source.find({
    projectId: PROJECT,
    conversationId: CONVERSATION,
    taskId: TASK,
    agentId: AGENT,
    staged: batch.proposals[0]!,
  });

  assert.equal(retrievalCalls, 1);
  assert.deepEqual(result.map((entry) => entry.item.id), [
    "knowledge-b",
    "knowledge-a",
    "knowledge-c",
  ]);
  assert.deepEqual(result[0]?.channels, ["exact", "lexical"]);
  assert.ok(Math.abs((result[0]?.aggregateScore ?? 0) - 1.3) < 1e-12);
  assert.ok(result.every((entry) => entry.item.activationStatus === "dormant"));
  assert.deepEqual(receivedPlan?.applicabilityScopes, ["runtime"]);
  assert.deepEqual(receivedPlan?.entities, ["ChatSession"]);
  assert.deepEqual(receivedPlan?.semanticQueries, []);
  (result[0]!.item.tags as string[]).push("caller-mutation");
  (result[0]!.item.provenance as Array<{ sourceId: string; sourceType: string }>)[0]!.sourceId = "changed";
  assert.equal(original.get("knowledge-b")?.tags.includes("caller-mutation"), false);
  assert.equal(original.get("knowledge-b")?.provenance[0]?.sourceId, "private-source");
});

test("classifier gets bounded semantic handles while runtime maps guarded IDs", async () => {
  const batch = await stagedBatch();
  const candidates = [
    candidate("private-knowledge-1", "Reasoning stays ephemeral.", 2),
    candidate("private-knowledge-2", "A different long candidate. ".repeat(8), 1),
  ];
  const proposal = {
    proposition: batch.proposals[0]!.proposal.proposition,
    kind: batch.proposals[0]!.proposal.kind,
    tags: [...(batch.proposals[0]!.proposal.tags ?? [])],
    scope: [...batch.proposals[0]!.proposal.scope],
    domains: [...batch.proposals[0]!.domains],
    entities: [...batch.proposals[0]!.entities],
    confidence: batch.proposals[0]!.proposal.confidence ?? 0.5,
  };
  const oneCandidateEnvelope: RelationClassifierInput = {
    proposal,
    candidates: [
      {
        handle: "candidate_1",
        proposition: candidates[0]!.item.proposition,
        kind: candidates[0]!.item.kind,
        tags: [...candidates[0]!.item.tags],
        scope: [...candidates[0]!.item.scope],
        authority: candidates[0]!.item.authority,
        confidence: candidates[0]!.item.confidence,
        activationStatus: candidates[0]!.item.activationStatus,
      },
    ],
  };
  const exactBudget = Buffer.byteLength(
    serializeRelationClassifierInput(oneCandidateEnvelope),
    "utf8",
  );
  let received: RelationClassifierInput | undefined;
  let classifierCalls = 0;
  const classifier: KnowledgeRelationClassifier = {
    async classify(input) {
      classifierCalls += 1;
      received = input;
      return {
        type: "restatement",
        targetHandle: "candidate_1",
        reasoning: "must be ignored",
        targetId: "invented-control-id",
      } as unknown as ReturnType<KnowledgeRelationClassifier["classify"]> extends Promise<infer T> ? T : never;
    },
  };
  const memory = new FakeMemory();
  const indexed: RetrievalDocument[] = [];
  const service = new RelationGatedMemoryCommit({
    memory,
    candidateSource: staticSource(candidates),
    classifier,
    classifierBudget: {
      maximum: exactBudget,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: {
      projectId: PROJECT,
      async upsertRetrievalDocument(document) {
        indexed.push(document);
      },
    },
  });

  const result = await service.commit({ batch, proposalIndex: 0 });
  assert.equal(classifierCalls, 1);
  assert.equal(received?.candidates.length, 1);
  assert.deepEqual(received?.candidates.map((entry) => entry.handle), [
    "candidate_1",
  ]);
  const classifierText = JSON.stringify(received);
  assert.equal(classifierText.includes("private-knowledge"), false);
  assert.equal(classifierText.includes("private-source"), false);
  assert.equal(classifierText.includes(PROJECT), false);
  assert.equal(classifierText.includes("revision"), false);
  assert.equal(classifierText.includes("aggregateScore"), false);
  assert.deepEqual(memory.calls, [
    {
      decision: { type: "restatement", targetId: "private-knowledge-1" },
      guard: {
        expectedRevisions: [
          { id: "private-knowledge-1", revision: 1 },
          { id: "private-knowledge-2", revision: 1 },
        ],
      },
    },
  ]);
  assert.deepEqual(result.evidence.materializedCandidateIds, [
    "private-knowledge-1",
    "private-knowledge-2",
  ]);
  assert.deepEqual(result.evidence.classifierCandidateIds, [
    "private-knowledge-1",
  ]);
  assert.equal(result.index.status, "updated");
  assert.deepEqual(indexed, [
    {
      knowledgeId: "private-knowledge-1",
      entities: ["ChatSession"],
      domains: ["orchestration"],
    },
  ]);
});

const liveRelationAlias = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../test/fixtures/nvidia-live-relation-alias.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  readonly characterization: string;
  readonly content: { readonly relation: string; readonly targetHandle: null };
};

function gatedCommit(options: {
  classifier: KnowledgeRelationClassifier;
  candidates?: readonly RelationCandidate[];
}): { service: RelationGatedMemoryCommit; memory: FakeMemory; indexCalls: { count: number } } {
  const memory = new FakeMemory();
  const indexCalls = { count: 0 };
  const service = new RelationGatedMemoryCommit({
    memory,
    candidateSource: staticSource(options.candidates ?? []),
    classifier: options.classifier,
    classifierBudget: {
      maximum: 10_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: {
      projectId: PROJECT,
      async upsertRetrievalDocument() {
        indexCalls.count += 1;
      },
    },
  });
  return { service, memory, indexCalls };
}

test("malformed classifier decisions fail before reconcile or index", async () => {
  const batch = await stagedBatch();
  const invalid = [
    { type: "extend", targetHandle: "candidate_999" },
    { type: "conflict", targetHandles: [] },
    { type: "conflict", targetHandles: ["candidate_1", "candidate_1"] },
    { type: "unknown" },
  ];

  for (const decision of invalid) {
    const { service, memory, indexCalls } = gatedCommit({
      classifier: {
        async classify() {
          return decision as never;
        },
      },
      candidates: [candidate("known-id", "Known candidate", 1)],
    });
    await assert.rejects(
      () => service.commit({ batch, proposalIndex: 0 }),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "policy",
    );
    assert.equal(memory.calls.length, 0);
    assert.equal(indexCalls.count, 0);
  }
});

test("live NVIDIA relation alias commits as canonical new", async () => {
  assert.match(
    liveRelationAlias.characterization,
    /named the canonical new relation under field relation/u,
  );
  assert.deepEqual(liveRelationAlias.content, {
    relation: "new",
    targetHandle: null,
  });
  const batch = await stagedBatch();
  const { service, memory, indexCalls } = gatedCommit({
    classifier: {
      async classify() {
        return liveRelationAlias.content as never;
      },
    },
  });
  const result = await service.commit({ batch, proposalIndex: 0 });
  assert.deepEqual(result.classifierDecision, { type: "new" });
  assert.deepEqual(memory.calls, [
    { decision: { type: "new" }, guard: { expectedRevisions: [] } },
  ]);
  assert.equal(result.index.status, "updated");
  assert.equal(indexCalls.count, 1);
});

test("classifier type aliases trim, case-fold, and map relation to type", async () => {
  const batch = await stagedBatch();
  const { service, memory } = gatedCommit({
    classifier: {
      async classify() {
        return { type: " New ", relation: "NEW" } as never;
      },
    },
  });
  const result = await service.commit({ batch, proposalIndex: 0 });
  assert.deepEqual(result.classifierDecision, { type: "new" });
  assert.equal(memory.calls[0]?.decision.type, "new");
});

test("relation field with a known handle maps to extend", async () => {
  const batch = await stagedBatch();
  const { service, memory } = gatedCommit({
    classifier: {
      async classify() {
        return { relation: "extend", targetHandle: "candidate_1" } as never;
      },
    },
    candidates: [candidate("known-id", "Known candidate", 1)],
  });
  const result = await service.commit({ batch, proposalIndex: 0 });
  assert.deepEqual(result.classifierDecision, {
    type: "extend",
    targetHandle: "candidate_1",
  });
  assert.deepEqual(memory.calls[0]?.decision, {
    type: "extend",
    targetId: "known-id",
  });
});

test("unknown, missing, and conflicting classifier types fail closed with the returned name", async () => {
  const batch = await stagedBatch();
  const cases: Array<{ decision: unknown; message: string }> = [
    {
      decision: { relation: "create" },
      message: 'relation classifier returned an unknown type: "create"',
    },
    {
      decision: { targetHandle: null },
      message: "relation classifier decision is missing type",
    },
    {
      decision: { type: "new", relation: "extend" },
      message:
        'relation classifier returned conflicting type fields: "new" vs "extend"',
    },
  ];
  for (const { decision, message } of cases) {
    const { service, memory, indexCalls } = gatedCommit({
      classifier: {
        async classify() {
          return decision as never;
        },
      },
    });
    await assert.rejects(
      () => service.commit({ batch, proposalIndex: 0 }),
      (error: unknown) =>
        error instanceof MemoryError &&
        error.code === "policy" &&
        error.message === message,
    );
    assert.equal(memory.calls.length, 0);
    assert.equal(indexCalls.count, 0);
  }
});

test("proposal-only budget failure calls neither classifier nor memory", async () => {
  const batch = await stagedBatch("Å".repeat(40));
  let classifierCalls = 0;
  const memory = new FakeMemory();
  const service = new RelationGatedMemoryCommit({
    memory,
    candidateSource: staticSource([]),
    classifier: {
      async classify() {
        classifierCalls += 1;
        return { type: "new" };
      },
    },
    classifierBudget: {
      maximum: 1,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: {
      projectId: PROJECT,
      async upsertRetrievalDocument() {
        throw new Error("must not be called");
      },
    },
  });

  await assert.rejects(
    () => service.commit({ batch, proposalIndex: 0 }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "budget_exceeded",
  );
  assert.equal(classifierCalls, 0);
  assert.equal(memory.calls.length, 0);
});

test("post-commit index failure is explicit and repair does not reconcile twice", async () => {
  const batch = await stagedBatch();
  const memory = new FakeMemory();
  let indexCalls = 0;
  const service = new RelationGatedMemoryCommit({
    memory,
    candidateSource: staticSource([]),
    classifier: { async classify() { return { type: "new" }; } },
    classifierBudget: {
      maximum: 10_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: {
      projectId: PROJECT,
      async upsertRetrievalDocument() {
        indexCalls += 1;
        if (indexCalls === 1) {
          throw new Error("index unavailable");
        }
      },
    },
  });

  const committed = await service.commit({ batch, proposalIndex: 0 });
  assert.equal(committed.index.status, "pending_repair");
  assert.equal(memory.calls.length, 1);
  if (committed.index.status !== "pending_repair") {
    throw new Error("expected pending repair");
  }
  const repaired = await service.repairIndex(committed.index);
  assert.equal(repaired.status, "updated");
  assert.equal(indexCalls, 2);
  assert.equal(memory.calls.length, 1);
});

test("overlapping relation operations reject deterministically", async () => {
  const batch = await stagedBatch();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sourceCalls = { calls: 0 };
  const source: RelationCandidateSource = {
    async find() {
      sourceCalls.calls += 1;
      await gate;
      return [];
    },
  };
  const service = new RelationGatedMemoryCommit({
    memory: new FakeMemory(),
    candidateSource: source,
    classifier: { async classify() { return { type: "new" }; } },
    classifierBudget: {
      maximum: 10_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: {
      projectId: PROJECT,
      async upsertRetrievalDocument() {},
    },
  });

  const first = service.commit({ batch, proposalIndex: 0 });
  await assert.rejects(
    () => service.commit({ batch, proposalIndex: 0 }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "illegal_state",
  );
  release();
  await first;
  assert.equal(sourceCalls.calls, 1);
});
