import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { CodingAgentMemoryPolicy } from "../src/memory/coding-agent-policy.js";
import { MemoryError } from "../src/memory/errors.js";
import { SemanticMemory } from "../src/memory/memory-engine.js";
import type { RetrievalPlan } from "../src/memory/retrieval-types.js";
import { Utf8ByteContextMeasurer } from "../src/memory/serialization.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import type { KnowledgeProposal } from "../src/memory/types.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type AnalyzedKnowledgeDraft,
  type StagedKnowledgeBatch,
} from "../src/orchestration/post-output-knowledge-intake.js";
import { parseProposalConfidence } from "../src/orchestration/post-output-knowledge-intake.js";
import { IndexedRelationCandidateSource } from "../src/orchestration/relation-candidate-source.js";
import {
  RelationGatedMemoryCommit,
  type KnowledgeRelationClassifier,
  type RelationClassifierDecision,
} from "../src/orchestration/relation-gated-memory-commit.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_60000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_60000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_60000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_60000000-0000-4000-8000-000000000004",
  "agent",
);

const LIMITS = {
  exact: 16,
  lexical: 16,
  tag: 16,
  domain: 16,
  semantic: 1,
} as const;

async function stage(
  draft: AnalyzedKnowledgeDraft,
): Promise<StagedKnowledgeBatch> {
  return new PostOutputKnowledgeIntake({
    analyzer: { async analyze() { return [draft]; } },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 20_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  }).stage({
    taskId: TASK,
    message: "Persist only durable semantic knowledge.",
    answer: "The answer may contain visible reasoning that is never staged.",
    applicabilityScopes: ["runtime"],
  });
}

function retrievalPlan(draft: AnalyzedKnowledgeDraft): RetrievalPlan {
  return {
    projectId: PROJECT,
    conversationId: CONVERSATION,
    taskId: TASK,
    agentId: AGENT,
    queryText: draft.proposition,
    intents: ["statement"],
    domains: (draft.domains ?? []).map((value) => ({ value, weight: 1 })),
    tags: (draft.tags ?? []).map((value) => ({ value, weight: 1 })),
    entities: [...(draft.entities ?? [])],
    terms: [
      ...new Set(
        [draft.proposition, ...(draft.tags ?? [])]
          .join(" ")
          .toLocaleLowerCase("en-US")
          .split(/[^\p{L}\p{N}_-]+/u)
          .filter((value) => value.length >= 2),
      ),
    ],
    semanticQueries: [],
    temporalHints: {
      currentOnly: true,
      mentionsPast: false,
      mentionsFuture: false,
    },
    applicabilityScopes: ["runtime"],
    confidence: parseProposalConfidence(draft.confidence ?? 0.5, "confidence"),
  };
}

function seedProposal(): KnowledgeProposal {
  return {
    proposition: "SQLite is the local memory baseline.",
    kind: "architecture-decision",
    tags: ["memory", "sqlite"],
    scope: ["runtime"],
    relevanceScore: 0,
    activationThreshold: 0.5,
    authority: 0.8,
    confidence: 0.9,
  };
}

const relationDrafts: Readonly<Record<string, AnalyzedKnowledgeDraft>> = {
  new: { severity: "important",
    proposition: "SQLite is the local memory baseline.",
    kind: "architecture-decision",
    tags: ["memory", "sqlite"],
    domains: ["architecture"],
    entities: ["sqlite"],
    confidence: 0.9,
  },
  restatement: { severity: "important",
    proposition: "SQLite is the local memory baseline.",
    kind: "architecture-decision",
    tags: ["memory", "sqlite"],
    domains: ["architecture"],
    entities: ["sqlite"],
    confidence: 0.95,
  },
  extend: { severity: "important",
    proposition: "SQLite memory also stores relation decisions.",
    kind: "architecture-decision",
    tags: ["memory", "relations", "sqlite"],
    domains: ["architecture"],
    entities: ["relation-gate", "sqlite"],
    confidence: 0.92,
  },
  supersede: { severity: "important",
    proposition: "PostgreSQL becomes the memory baseline.",
    kind: "architecture-decision",
    tags: ["memory", "postgresql"],
    domains: ["architecture"],
    entities: ["postgresql"],
    confidence: 0.91,
  },
  conflict: { severity: "important",
    proposition: "SQLite must not be used for local memory.",
    kind: "architecture-decision",
    tags: ["memory", "sqlite"],
    domains: ["architecture"],
    entities: ["sqlite"],
    confidence: 0.88,
  },
};

const expectedAudit = {
  new: "knowledge_created",
  restatement: "knowledge_restated",
  extend: "knowledge_extended",
  supersede: "knowledge_superseded",
  conflict: "knowledge_conflict",
} as const;

test("relation-gated commit proves all five relations against actual SQLite", async (t) => {
  for (const relation of [
    "new",
    "restatement",
    "extend",
    "supersede",
    "conflict",
  ] as const) {
    await t.test(relation, async () => {
      const repository = new SqliteMemoryRepository({
        filename: ":memory:",
        projectId: PROJECT,
      });
      try {
        const generatedIds = relation === "new"
          ? ["created-current"]
          : ["seed-current", "replacement-current"];
        const memory = new SemanticMemory({
          repository,
          policy: new CodingAgentMemoryPolicy({
            projectionReinforcement: 0,
            reconciliationReinforcement: 0,
          }),
          measurer: new Utf8ByteContextMeasurer(),
          idFactory: () => {
            const id = generatedIds.shift();
            if (id === undefined) {
              throw new Error("unexpected knowledge id request");
            }
            return id;
          },
        });
        if (relation !== "new") {
          const seeded = await memory.reconcile(seedProposal(), { type: "new" });
          assert.equal(seeded.item?.activationStatus, "dormant");
          await repository.upsertRetrievalDocument({
            knowledgeId: "seed-current",
            entities: ["sqlite"],
            domains: ["architecture"],
          });
        }

        const draft = relationDrafts[relation]!;
        const batch = await stage(draft);
        let classifierInput: Parameters<KnowledgeRelationClassifier["classify"]>[0] | undefined;
        const classifier: KnowledgeRelationClassifier = {
          async classify(input) {
            classifierInput = input;
            if (relation === "new") {
              assert.equal(input.candidates.length, 0);
              return { type: "new" };
            }
            assert.ok(input.candidates.length >= 1);
            assert.equal(input.candidates[0]?.handle, "candidate_1");
            assert.equal(input.candidates[0]?.activationStatus, "dormant");
            return relation === "conflict"
              ? { type: "conflict", targetHandles: ["candidate_1"] }
              : { type: relation, targetHandle: "candidate_1" };
          },
        };
        const service = new RelationGatedMemoryCommit({
          memory,
          candidateSource: new IndexedRelationCandidateSource({
            memory,
            candidateStore: repository,
          }),
          classifier,
          classifierBudget: {
            maximum: 20_000,
            measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
          },
          indexWriter: repository,
        });

        const result = await service.commit({ batch, proposalIndex: 0 });
        assert.equal(result.reconciliation.relation, relation);
        assert.equal(
          JSON.stringify(classifierInput).includes("seed-current"),
          false,
        );
        assert.equal(
          JSON.stringify(classifierInput).includes("visible reasoning"),
          false,
        );
        assert.equal(
          result.index.status,
          relation === "conflict" ? "not_required" : "updated",
        );

        const audit = await memory.getAudit();
        assert.equal(audit.at(-1)?.type, expectedAudit[relation]);
        const all = await repository.read((view) => view.listAll());
        const current = all.filter((item) => item.canonicalStatus === "current");
        assert.equal(current.length, 1);
        assert.equal(current[0]?.activationStatus, "dormant");

        if (relation === "restatement") {
          assert.equal(current[0]?.id, "seed-current");
          assert.equal(current[0]?.revision, 2);
          assert.equal(current[0]?.proposition, seedProposal().proposition);
        } else if (relation === "extend") {
          assert.equal(current[0]?.id, "seed-current");
          assert.equal(current[0]?.revision, 2);
          assert.equal(current[0]?.proposition, draft.proposition);
        } else if (relation === "supersede") {
          assert.equal(current[0]?.id, "replacement-current");
          const historical = all.find((item) => item.id === "seed-current");
          assert.equal(historical?.canonicalStatus, "superseded");
          assert.equal(historical?.activationStatus, "dormant");
          assert.equal(historical?.supersededBy, "replacement-current");
        } else if (relation === "conflict") {
          assert.equal(current[0]?.id, "seed-current");
          assert.equal(current[0]?.revision, 1);
          assert.equal(current[0]?.proposition, seedProposal().proposition);
        } else {
          assert.equal(current[0]?.id, "created-current");
        }

        const retrieval = await repository.retrieveCandidates(
          retrievalPlan(draft),
          [],
          LIMITS,
        );
        assert.equal(retrieval.persistentCurrentCount, 1);
        const expectedCurrentId = relation === "supersede"
          ? "replacement-current"
          : relation === "new"
            ? "created-current"
            : "seed-current";
        assert.ok(retrieval.hits.length > 0);
        assert.ok(
          retrieval.hits.every((hit) => hit.knowledgeId === expectedCurrentId),
        );
        const channels = new Set(retrieval.hits.map((hit) => hit.channel));
        assert.equal(channels.has("exact"), true);
        assert.equal(channels.has("lexical"), true);
        assert.equal(channels.has("tag"), true);
        assert.equal(channels.has("domain"), true);
      } finally {
        repository.close();
      }
    });
  }
});

test("SQLite guarded commit rejects a candidate revision changed during classification", async () => {
  const repository = new SqliteMemoryRepository({
    filename: ":memory:",
    projectId: PROJECT,
  });
  try {
    const memory = new SemanticMemory({
      repository,
      policy: new CodingAgentMemoryPolicy({
        projectionReinforcement: 0,
        reconciliationReinforcement: 0,
      }),
      measurer: new Utf8ByteContextMeasurer(),
      idFactory: () => "seed-current",
    });
    await memory.reconcile(seedProposal(), { type: "new" });
    await repository.upsertRetrievalDocument({
      knowledgeId: "seed-current",
      entities: ["sqlite"],
      domains: ["architecture"],
    });
    const batch = await stage(relationDrafts.restatement!);
    let indexCalls = 0;
    const service = new RelationGatedMemoryCommit({
      memory,
      candidateSource: new IndexedRelationCandidateSource({
        memory,
        candidateStore: repository,
      }),
      classifier: {
        async classify() {
          await memory.reconcile(seedProposal(), {
            type: "restatement",
            targetId: "seed-current",
          });
          return {
            type: "restatement",
            targetHandle: "candidate_1",
          } satisfies RelationClassifierDecision;
        },
      },
      classifierBudget: {
        maximum: 20_000,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
      indexWriter: {
        projectId: PROJECT,
        async upsertRetrievalDocument(document) {
          indexCalls += 1;
          await repository.upsertRetrievalDocument(document);
        },
      },
    });

    await assert.rejects(
      () => service.commit({ batch, proposalIndex: 0 }),
      (error: unknown) =>
        error instanceof MemoryError && error.code === "stale_state",
    );
    assert.equal(indexCalls, 0);
    assert.equal((await memory.getKnowledge("seed-current"))?.revision, 2);
    assert.equal((await memory.getAudit()).length, 2);
  } finally {
    repository.close();
  }
});
