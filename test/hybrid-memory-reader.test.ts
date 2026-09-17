import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { DeterministicRetrievalPlanner } from "../src/memory/deterministic-retrieval-planner.js";
import { CodingAgentMemoryPolicy } from "../src/memory/coding-agent-policy.js";
import { MemoryError } from "../src/memory/errors.js";
import { HybridMemoryReader } from "../src/memory/hybrid-memory-reader.js";
import {
  NeutralHybridMemoryReadPolicy,
  strengthWeightForChannels,
} from "../src/memory/hybrid-retrieval-policy.js";
import { SemanticMemory } from "../src/memory/memory-engine.js";
import { Utf8ByteContextMeasurer } from "../src/memory/serialization.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import type {
  EmbeddingProvider,
  MemoryReadRequest,
  RetrievalPlan,
  RetrievalPlanner,
} from "../src/memory/retrieval-types.js";
import type { KnowledgeItem } from "../src/memory/types.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_10000000-0000-4000-8000-000000000001",
  "project",
);
const OTHER_PROJECT = parseRuntimeId(
  "A008_v1_project_10000000-0000-4000-8000-000000000002",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_10000000-0000-4000-8000-000000000003",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_10000000-0000-4000-8000-000000000004",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_10000000-0000-4000-8000-000000000005",
  "agent",
);
const OTHER_CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_10000000-0000-4000-8000-000000000006",
  "conversation",
);
const OTHER_TASK = parseRuntimeId(
  "A008_v1_task_10000000-0000-4000-8000-000000000007",
  "task",
);
const OTHER_AGENT = parseRuntimeId(
  "A008_v1_agent_10000000-0000-4000-8000-000000000008",
  "agent",
);

const request: MemoryReadRequest = {
  projectId: PROJECT,
  conversationId: CONVERSATION,
  taskId: TASK,
  agentId: AGENT,
  message: 'How should "SQLite" memory architecture work now?',
  recentTurns: [
    { role: "user", content: "We need durable memory." },
    { role: "assistant", content: "SQLite is a local option." },
  ],
  applicabilityScopes: ["core"],
};

function storedItem(
  id: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    proposition: `proposition ${id}`,
    kind: "architecture",
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

const embeddingProvider: EmbeddingProvider = {
  model: "test-embedding-v1",
  embed: async (queries) => queries.map(() => [1, 0]),
};

async function seed(
  repository: SqliteMemoryRepository,
  items: readonly KnowledgeItem[],
): Promise<void> {
  await repository.transact((transaction) => {
    for (const item of items) {
      transaction.insert(item);
    }
  });
}

function reader(
  repository: SqliteMemoryRepository,
  options: {
    readonly policy?: NeutralHybridMemoryReadPolicy;
    readonly embeddings?: EmbeddingProvider;
    readonly planner?: RetrievalPlanner;
  } = {},
): HybridMemoryReader {
  return new HybridMemoryReader({
    memory: new SemanticMemory({
      repository,
      policy: new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
      measurer: new Utf8ByteContextMeasurer(),
    }),
    candidateStore: repository,
    planner:
      options.planner ??
      new DeterministicRetrievalPlanner({
        knownTags: ["memory"],
        knownDomains: ["architecture"],
      }),
    policy: options.policy ?? new NeutralHybridMemoryReadPolicy(),
    ...(options.embeddings === undefined
      ? {}
      : { embeddingProvider: options.embeddings }),
  });
}

test("deterministic planner is bounded and does not select knowledge IDs", () => {
  const planner = new DeterministicRetrievalPlanner({
    knownTags: ["memory"],
    knownDomains: ["architecture"],
  });
  const withExtraHistory: MemoryReadRequest = {
    ...request,
    recentTurns: [
      { role: "user", content: "discarded old turn" },
      ...request.recentTurns!,
    ],
  };
  const first = planner.plan(withExtraHistory);
  const second = planner.plan(withExtraHistory);
  assert.deepEqual(first, second);
  assert.equal(first.semanticQueries.length <= 3, true);
  assert.equal(first.terms.length <= 16, true);
  assert.deepEqual(first.tags, [{ value: "memory", weight: 1 }]);
  assert.deepEqual(first.domains, [{ value: "architecture", weight: 1 }]);
  assert.deepEqual(first.entities, ["sqlite"]);
  assert.equal("knowledgeIds" in first, false);
  assert.equal("selectedKnowledgeIds" in first, false);
});

test("five retrieval channels merge into one scored candidate and one projection item", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [
    storedItem("sqlite-memory", {
      proposition: "SQLite memory keeps provider architecture local.",
    }),
  ]);
  await repository.upsertRetrievalDocument({
    knowledgeId: "sqlite-memory",
    entities: ["sqlite"],
    domains: ["architecture"],
    embeddingModel: embeddingProvider.model,
    embedding: [1, 0],
  });
  const result = await reader(repository, {
    embeddings: embeddingProvider,
  }).read(request);
  assert.equal(result.evidence.uniqueCandidateCount, 1);
  assert.deepEqual(result.evidence.rankedCandidates[0]?.channels, [
    "domain",
    "exact",
    "lexical",
    "semantic",
    "tag",
  ]);
  assert.deepEqual(result.evidence.selectedKnowledgeIds, ["sqlite-memory"]);
  assert.equal(result.projection.projection.items.length, 1);
  assert.equal(
    result.projection.serialized.match(
      /SQLite memory keeps provider architecture local\./gu,
    )?.length,
    1,
  );
  assert.equal(result.evidence.semanticRetrieval, "used");
  repository.close();
});

test("S6 reduced: dormant exact/direct hit is projected without mutation", async () => {
  const dormant = storedItem("dormant", {
    proposition: "Dormant SQLite memory remains searchable.",
    activationStatus: "dormant",
    relevanceScore: 0.1,
    activationThreshold: 0.9,
  });
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [dormant]);
  await repository.upsertRetrievalDocument({
    knowledgeId: "dormant",
    entities: ["sqlite"],
    domains: ["architecture"],
    embeddingModel: embeddingProvider.model,
    embedding: [1, 0],
  });
  const before = await repository.read((view) => view.get("dormant"));
  const auditBefore = await repository.readAudit();
  const result = await reader(repository, {
    embeddings: embeddingProvider,
  }).read(request);
  assert.deepEqual(result.evidence.dormantCandidateIds, ["dormant"]);
  assert.deepEqual(result.evidence.selectedKnowledgeIds, ["dormant"]);
  assert.equal(result.evidence.rankedCandidates[0]?.exclusionReason, null);
  assert.equal(result.evidence.rankedCandidates[0]?.included, true);
  assert.ok(result.evidence.rankedCandidates[0]?.channels.includes("exact"));
  assert.ok(
    result.evidence.rankedCandidates[0]?.reasons.includes(
      "direct_match_ignores_activation",
    ),
  );
  assert.equal(result.evidence.rankedCandidates[0]?.components.strength, 0);
  assert.deepEqual(
    await repository.read((view) => view.get("dormant")),
    before,
  );
  assert.deepEqual(await repository.readAudit(), auditBefore);
  repository.close();
});

test("S7 reduced: dormant associative hit is omitted with an explicit reason", async () => {
  const paint = storedItem("paint-shop", {
    proposition: "Brittan bought paint at Bauhaus.",
    tags: ["house"],
    kind: "event",
    activationStatus: "dormant",
    relevanceScore: 0.1,
    activationThreshold: 0.9,
  });
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [paint]);
  await repository.upsertRetrievalDocument({
    knowledgeId: "paint-shop",
    domains: ["color"],
  });
  const associativePlan: RetrievalPlanner = {
    plan: () => ({
      projectId: PROJECT,
      conversationId: CONVERSATION,
      taskId: TASK,
      agentId: AGENT,
      queryText: "Beratta nagot om Brittan",
      intents: ["question"],
      domains: [{ value: "color", weight: 1 }],
      tags: [{ value: "house", weight: 1 }],
      entities: [],
      terms: ["brittan", "paint"],
      semanticQueries: [],
      temporalHints: {
        currentOnly: true,
        mentionsPast: false,
        mentionsFuture: false,
      },
      applicabilityScopes: ["core"],
      confidence: 0.5,
    }),
  };
  const before = await repository.read((view) => view.get("paint-shop"));
  const auditBefore = await repository.readAudit();
  const result = await reader(repository, { planner: associativePlan }).read(
    request,
  );
  assert.ok(!result.evidence.rankedCandidates[0]?.channels.includes("exact"));
  assert.deepEqual(result.evidence.dormantCandidateIds, ["paint-shop"]);
  assert.deepEqual(result.evidence.selectedKnowledgeIds, []);
  assert.equal(result.evidence.rankedCandidates[0]?.included, false);
  assert.equal(
    result.evidence.rankedCandidates[0]?.exclusionReason,
    "associative_activation_dormant",
  );
  assert.ok(
    (result.evidence.rankedCandidates[0]?.score ?? 0) >=
      new NeutralHybridMemoryReadPolicy().projectionThreshold,
  );
  assert.deepEqual(
    await repository.read((view) => view.get("paint-shop")),
    before,
  );
  assert.deepEqual(await repository.readAudit(), auditBefore);
  repository.close();
});

test("exact-channel scoring zeros memory strength; associative scoring keeps it", async () => {
  assert.equal(
    strengthWeightForChannels(new NeutralHybridMemoryReadPolicy().weights, [
      "exact",
      "lexical",
    ]),
    0,
  );
  assert.equal(
    strengthWeightForChannels(new NeutralHybridMemoryReadPolicy().weights, [
      "lexical",
      "tag",
    ]),
    0.05,
  );

  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [
    storedItem("exact-hit", {
      proposition: "SQLite entity remains the durable store.",
      relevanceScore: 1,
    }),
    storedItem("associative-hit", {
      proposition: "Tag-only associative neighbor.",
      tags: ["memory"],
      relevanceScore: 1,
      activationStatus: "active",
    }),
  ]);
  await repository.upsertRetrievalDocument({
    knowledgeId: "exact-hit",
    entities: ["sqlite"],
  });
  const mixedPlan: RetrievalPlanner = {
    plan: () => ({
      projectId: PROJECT,
      conversationId: CONVERSATION,
      taskId: TASK,
      agentId: AGENT,
      queryText: "sqlite memory",
      intents: ["question"],
      domains: [],
      tags: [{ value: "memory", weight: 1 }],
      entities: ["sqlite"],
      terms: [],
      semanticQueries: [],
      temporalHints: {
        currentOnly: true,
        mentionsPast: false,
        mentionsFuture: false,
      },
      applicabilityScopes: ["core"],
      confidence: 0.5,
    }),
  };
  const result = await reader(repository, { planner: mixedPlan }).read(request);
  const exact = result.evidence.rankedCandidates.find(
    (candidate) => candidate.knowledgeId === "exact-hit",
  );
  const associative = result.evidence.rankedCandidates.find(
    (candidate) => candidate.knowledgeId === "associative-hit",
  );
  assert.ok(exact);
  assert.ok(associative);
  assert.ok(exact.channels.includes("exact"));
  assert.ok(!associative.channels.includes("exact"));
  assert.equal(exact.components.strength, 0);
  assert.equal(associative.components.strength, 0.05);
  repository.close();
});

test("candidate and projection thresholds are independent from item activation threshold", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [
    storedItem("thresholds", {
      proposition: "Memory threshold separation.",
      activationStatus: "active",
      relevanceScore: 0.3,
      activationThreshold: 0.95,
      authority: 0.2,
    }),
  ]);
  const customPlan: RetrievalPlanner = {
    plan: () => ({
      projectId: PROJECT,
      conversationId: CONVERSATION,
      taskId: TASK,
      agentId: AGENT,
      queryText: "memory",
      intents: ["statement"],
      domains: [],
      tags: [{ value: "memory", weight: 1 }],
      entities: [],
      terms: [],
      semanticQueries: ["memory"],
      temporalHints: {
        currentOnly: false,
        mentionsPast: false,
        mentionsFuture: false,
      },
      applicabilityScopes: ["core"],
      confidence: 0.5,
    }),
  };
  const policy = new NeutralHybridMemoryReadPolicy({
    candidateThreshold: 0.1,
    projectionThreshold: 0.2,
  });
  const result = await reader(repository, { policy, planner: customPlan }).read(
    request,
  );
  const candidate = result.evidence.rankedCandidates[0];
  assert.ok(candidate);
  assert.equal(candidate.score >= policy.candidateThreshold, true);
  assert.equal(candidate.score < policy.projectionThreshold, true);
  assert.equal(candidate.activationStatus, "active");
  assert.equal(candidate.activationThreshold, 0.95);
  assert.equal(candidate.exclusionReason, "below_projection_threshold");
  assert.deepEqual(result.evidence.selectedKnowledgeIds, []);
  repository.close();
});

test("missing embedding configuration degrades to non-vector channels", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  await seed(repository, [
    storedItem("lexical", {
      proposition: "SQLite memory is available without embeddings.",
    }),
  ]);
  const result = await reader(repository).read(request);
  assert.equal(result.evidence.semanticRetrieval, "not_configured");
  assert.equal(result.evidence.channelCounts.semantic, 0);
  assert.deepEqual(result.evidence.selectedKnowledgeIds, ["lexical"]);
  repository.close();
});

test("planner and memory repository cannot change verified runtime identity", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  const honest = new DeterministicRetrievalPlanner();
  for (const changed of [
    { projectId: OTHER_PROJECT },
    { conversationId: OTHER_CONVERSATION },
    { taskId: OTHER_TASK },
    { agentId: OTHER_AGENT },
  ]) {
    const malicious: RetrievalPlanner = {
      plan: (input): RetrievalPlan => ({
        ...honest.plan(input),
        ...changed,
      }),
    };
    await assert.rejects(
      () => reader(repository, { planner: malicious }).read(request),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "policy",
    );
  }
  const wrongMemoryRepository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: OTHER_PROJECT,
  });
  const mismatchedReader = new HybridMemoryReader({
    memory: new SemanticMemory({
      repository: wrongMemoryRepository,
      policy: new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
      measurer: new Utf8ByteContextMeasurer(),
    }),
    candidateStore: repository,
    planner: honest,
    policy: new NeutralHybridMemoryReadPolicy(),
  });
  await assert.rejects(
    () => mismatchedReader.read(request),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "invalid_input",
  );
  wrongMemoryRepository.close();
  repository.close();
});

test("100 and 100,000 records produce byte-identical bounded projection", async () => {
  async function run(size: number) {
    const repository = new SqliteMemoryRepository({
      filename: ":memory:",
      projectId: PROJECT,
    });
    const corpus: KnowledgeItem[] = [
      storedItem("needle", {
        proposition: "Needle memory architecture remains bounded.",
        tags: ["needle"],
      }),
      ...Array.from({ length: size - 1 }, (_, index) =>
        storedItem(`noise-${index.toString().padStart(6, "0")}`, {
          proposition: `Unrelated canvas record ${index}`,
          tags: ["canvas"],
          scope: ["gui"],
        }),
      ),
    ];
    const started = performance.now();
    await seed(repository, corpus);
    const planner = new DeterministicRetrievalPlanner({
      knownTags: ["needle"],
    });
    const result = await reader(repository, { planner }).read({
      ...request,
      message: "needle memory architecture",
    });
    const elapsedMs = performance.now() - started;
    repository.close();
    return { result, elapsedMs };
  }

  const small = await run(100);
  const large = await run(100_000);
  assert.equal(
    large.result.projection.serialized,
    small.result.projection.serialized,
  );
  assert.deepEqual(large.result.evidence.selectedKnowledgeIds, ["needle"]);
  assert.equal(large.result.evidence.uniqueCandidateCount <= 32, true);
  console.log(
    JSON.stringify({
      test: "sqlite-corpus-invariance",
      smallRecords: 100,
      smallElapsedMs: Math.round(small.elapsedMs),
      largeRecords: 100_000,
      largeElapsedMs: Math.round(large.elapsedMs),
      candidateCount: large.result.evidence.uniqueCandidateCount,
      projectionBytes: large.result.projection.measuredUnits,
    }),
  );
});
