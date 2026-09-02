import assert from "node:assert/strict";
import test from "node:test";
import {
  CodingAgentMemoryPolicy,
  ChatTransportSemanticJsonGenerator,
  createLocalMemoryRuntime,
  createNvidiaChatTransport,
  SEMANTIC_JSON_GENERATION,
  LIVE_PROJECTION_REINFORCEMENT,
  LIVE_RECONCILIATION_REINFORCEMENT,
  DeterministicRetrievalPlanner,
  HybridMemoryReader,
  InMemoryAcpIdentityBindingRepository,
  InMemoryMemoryRepository,
  MemoryAwareChatSession,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
  NeutralHybridMemoryReadPolicy,
  PostOutputKnowledgeIntake,
  PostOutputMemoryCoordinator,
  IndexedRelationCandidateSource,
  RelationGatedMemoryCommit,
  RuntimeIdentityFactory,
  SemanticMemory,
  SqliteMemoryRepository,
  DeterministicMemoryPromptComposer,
  Utf8ByteChatMessageMeasurer,
  Utf8ByteContextMeasurer,
  Utf8ByteKnowledgeIntakeMeasurer,
  serializeContextProjection,
  serializeStagedKnowledgeProposals,
  serializeRelationClassifierInput,
  serializeSemanticJsonRequest,
} from "../src/index.js";

test("memory and orchestration surfaces are exported from the package root", () => {
  const repository = new InMemoryMemoryRepository();
  const memory = new SemanticMemory({
    repository,
    policy: new CodingAgentMemoryPolicy(),
    measurer: new Utf8ByteContextMeasurer(),
    idFactory: () => "knowledge_export",
  });

  assert.ok(memory instanceof SemanticMemory);
  assert.equal(
    serializeContextProjection({ taskId: "task", items: [] }),
    '{"taskId":"task","items":[]}',
  );

  const identities = new RuntimeIdentityFactory(
    () => "00000000-0000-4000-8000-000000000001",
  );
  assert.match(identities.create("project"), /^a007_v1_project_/);
  assert.ok(
    new InMemoryAcpIdentityBindingRepository() instanceof
      InMemoryAcpIdentityBindingRepository,
  );

  const projectId = identities.create("project");
  const sqlite = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId,
  });
  const durableMemory = new SemanticMemory({
    repository: sqlite,
    policy: new CodingAgentMemoryPolicy({ projectionReinforcement: 0 }),
    measurer: new Utf8ByteContextMeasurer(),
  });
  const reader = new HybridMemoryReader({
    memory: durableMemory,
    planner: new DeterministicRetrievalPlanner(),
    candidateStore: sqlite,
    policy: new NeutralHybridMemoryReadPolicy(),
  });
  assert.ok(reader instanceof HybridMemoryReader);
  assert.equal(typeof MemoryAwareChatSession, "function");
  assert.ok(
    new DeterministicMemoryPromptComposer() instanceof
      DeterministicMemoryPromptComposer,
  );
  assert.equal(new Utf8ByteChatMessageMeasurer().unit, "utf8-bytes");
  assert.equal(new Utf8ByteKnowledgeIntakeMeasurer().unit, "utf8_bytes");
  assert.equal(serializeStagedKnowledgeProposals([]), '{"proposals":[]}');
  assert.ok(
    new PostOutputKnowledgeIntake({
      analyzer: { async analyze() { return []; } },
      context: {
        projectId,
        conversationId: identities.create("conversation"),
        agentId: identities.create("agent"),
      },
      budget: {
        maximum: 1_024,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
    }) instanceof PostOutputKnowledgeIntake,
  );
  assert.equal(typeof PostOutputMemoryCoordinator, "function");
  assert.equal(typeof ChatTransportSemanticJsonGenerator, "function");
  assert.equal(typeof ModelBackedPostOutputKnowledgeAnalyzer, "function");
  assert.equal(typeof ModelBackedKnowledgeRelationClassifier, "function");
  assert.equal(
    serializeSemanticJsonRequest("knowledge_analysis", '{"message":"m"}'),
    '{"operation":"knowledge_analysis","input":{"message":"m"}}',
  );
  const candidateSource = new IndexedRelationCandidateSource({
    memory: durableMemory,
    candidateStore: sqlite,
  });
  assert.ok(candidateSource instanceof IndexedRelationCandidateSource);
  assert.ok(
    new RelationGatedMemoryCommit({
      memory: durableMemory,
      candidateSource,
      classifier: { async classify() { return { type: "new" }; } },
      classifierBudget: {
        maximum: 1_024,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
      indexWriter: sqlite,
    }) instanceof RelationGatedMemoryCommit,
  );
  assert.equal(
    serializeRelationClassifierInput({
      proposal: {
        proposition: "Public contract",
        kind: "test",
        tags: [],
        scope: [],
        domains: [],
        entities: [],
        confidence: 1,
      },
      candidates: [],
    }),
    '{"proposal":{"proposition":"Public contract","kind":"test","tags":[],"scope":[],"domains":[],"entities":[],"confidence":1},"candidates":[]}',
  );
  sqlite.close();
  assert.equal(typeof createLocalMemoryRuntime, "function");
  assert.equal(typeof createNvidiaChatTransport, "function");
  assert.equal(LIVE_PROJECTION_REINFORCEMENT, 0);
  assert.equal(LIVE_RECONCILIATION_REINFORCEMENT, 0.2);
  assert.equal(SEMANTIC_JSON_GENERATION.enableThinking, false);
  assert.equal(SEMANTIC_JSON_GENERATION.stream, false);
});
