import assert from "node:assert/strict";
import test from "node:test";
import { Utf8ByteChatMessageMeasurer } from "../src/core/chat-invocation.js";
import type { ChatRequest, ChatTransport } from "../src/core/types.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { CodingAgentMemoryPolicy } from "../src/memory/coding-agent-policy.js";
import { SemanticMemory } from "../src/memory/memory-engine.js";
import type { RetrievalPlan } from "../src/memory/retrieval-types.js";
import { Utf8ByteContextMeasurer } from "../src/memory/serialization.js";
import { SqliteMemoryRepository } from "../src/memory/sqlite-memory-repository.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../src/orchestration/post-output-knowledge-intake.js";
import { PostOutputMemoryCoordinator } from "../src/orchestration/post-output-memory-coordinator.js";
import { IndexedRelationCandidateSource } from "../src/orchestration/relation-candidate-source.js";
import {
  RelationGatedMemoryCommit,
} from "../src/orchestration/relation-gated-memory-commit.js";
import {
  ChatTransportSemanticJsonGenerator,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
} from "../src/orchestration/semantic-json-model.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_80000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_80000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_80000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_80000000-0000-4000-8000-000000000004",
  "agent",
);

test("actual SQLite multi-proposal flow observes earlier indexed canon", async () => {
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
      idFactory: () => "coordinator-current",
    });
    const semanticRequests: ChatRequest[] = [];
    const semanticAbort = new AbortController();
    let classifierCalls = 0;
    const semanticTransport: ChatTransport = {
      async complete(request) {
        semanticRequests.push(request);
        assert.equal(request.signal, semanticAbort.signal);
        const user = request.messages[1];
        assert.equal(request.messages.length, 2);
        assert.equal(request.messages[0]?.role, "system");
        assert.equal(user?.role, "user");
        const envelope = JSON.parse(user?.content ?? "") as {
          operation: string;
          input: Record<string, unknown>;
        };
        if (envelope.operation === "knowledge_analysis") {
          assert.deepEqual(Object.keys(envelope.input).sort(), ["answer", "message"]);
          return {
            message: {
              role: "assistant",
              content: JSON.stringify([
                { severity: "important",
                  proposition: "SQLite stores canonical memory.",
                  kind: "architecture-decision",
                  tags: ["memory", "sqlite"],
                  domains: ["architecture"],
                  entities: ["sqlite"],
                  confidence: 0.9,
                },
                { severity: "important",
                  proposition:
                    "SQLite stores canonical memory and relation decisions.",
                  kind: "architecture-decision",
                  tags: ["memory", "relations", "sqlite"],
                  domains: ["architecture"],
                  entities: ["relation-gate", "sqlite"],
                  confidence: 0.92,
                },
              ]),
            },
            reasoning: "private analyzer reasoning must remain display-only",
          };
        }
        assert.equal(envelope.operation, "relation_classification");
        classifierCalls += 1;
        const candidates = envelope.input.candidates as readonly {
          handle: string;
          proposition: string;
          activationStatus: string;
        }[];
        if (classifierCalls === 1) {
          assert.deepEqual(candidates, []);
          return {
            message: { role: "assistant", content: '{"type":"new"}' },
            reasoning: "private relation reasoning",
          };
        }
        assert.equal(candidates[0]?.handle, "candidate_1");
        assert.equal(
          candidates[0]?.proposition,
          "SQLite stores canonical memory.",
        );
        assert.equal(candidates[0]?.activationStatus, "dormant");
        return {
          message: {
            role: "assistant",
            content: '{"type":"extend","targetHandle":"candidate_1"}',
          },
          reasoning: "private relation reasoning",
        };
      },
    };
    const semanticGenerator = new ChatTransportSemanticJsonGenerator({
      transport: semanticTransport,
      model: "fake/shared-semantic-model",
      budget: {
        maximum: 20_000,
        measurer: new Utf8ByteChatMessageMeasurer(),
      },
      generation: {
        maxTokens: 1_024,
        enableThinking: false,
      },
    });
    const intake = new PostOutputKnowledgeIntake({
      analyzer: new ModelBackedPostOutputKnowledgeAnalyzer(semanticGenerator),
      context: {
        projectId: PROJECT,
        conversationId: CONVERSATION,
        agentId: AGENT,
      },
      budget: {
        maximum: 20_000,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
    });
    let stagingCalls = 0;
    const relationCommit = new RelationGatedMemoryCommit({
      memory,
      candidateSource: new IndexedRelationCandidateSource({
        memory,
        candidateStore: repository,
      }),
      classifier: new ModelBackedKnowledgeRelationClassifier(semanticGenerator),
      classifierBudget: {
        maximum: 20_000,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
      indexWriter: repository,
    });
    const coordinator = new PostOutputMemoryCoordinator({
      stager: {
        async stage(input, context) {
          stagingCalls += 1;
          return intake.stage(input, context);
        },
      },
      committer: relationCommit,
    });

    const result = await coordinator.process(
      {
        taskId: TASK,
        message: "How should memory be persisted?",
        answer: "Use SQLite and retain explicit relation decisions.",
        applicabilityScopes: ["runtime"],
        reasoning: "This private chain must remain display-only.",
      } as never,
      { signal: semanticAbort.signal },
    );

    assert.equal(
      result.status,
      "completed",
      result.status === "staging_failed" || result.status === "commit_failed"
        ? String(result.error)
        : undefined,
    );
    assert.equal(stagingCalls, 1);
    assert.equal(semanticRequests.length, 3);
    assert.equal(classifierCalls, 2);
    assert.deepEqual(
      semanticRequests.map((request) => request.model),
      [
        "fake/shared-semantic-model",
        "fake/shared-semantic-model",
        "fake/shared-semantic-model",
      ],
    );
    assert.equal(
      JSON.stringify(semanticRequests).includes("private chain"),
      false,
    );
    assert.equal(
      JSON.stringify(semanticRequests).includes("coordinator-current"),
      false,
    );
    assert.equal(JSON.stringify(result).includes("private analyzer reasoning"), false);
    assert.equal(JSON.stringify(result).includes("private relation reasoning"), false);
    if (result.status !== "completed") {
      throw new Error("expected completed coordinator result");
    }
    assert.deepEqual(
      result.records.map((record) => record.result.reconciliation.relation),
      ["new", "extend"],
    );
    assert.ok(result.records.every((record) => record.result.index.status === "updated"));

    const current = await memory.getKnowledge("coordinator-current");
    assert.equal(
      current?.proposition,
      "SQLite stores canonical memory and relation decisions.",
    );
    assert.equal(current?.revision, 2);
    assert.equal(current?.activationStatus, "dormant");
    assert.deepEqual(
      (await memory.getAudit()).map((event) => event.type),
      ["knowledge_created", "knowledge_extended"],
    );

    const retrievalPlan: RetrievalPlan = {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      taskId: TASK,
      agentId: AGENT,
      queryText: "SQLite relation decisions",
      intents: ["question"],
      domains: [{ value: "architecture", weight: 1 }],
      tags: [{ value: "relations", weight: 1 }],
      entities: ["relation-gate"],
      terms: ["sqlite", "relation", "decisions"],
      semanticQueries: [],
      temporalHints: {
        currentOnly: true,
        mentionsPast: false,
        mentionsFuture: false,
      },
      applicabilityScopes: ["runtime"],
      confidence: 1,
    };
    const retrieval = await repository.retrieveCandidates(
      retrievalPlan,
      [],
      { exact: 8, lexical: 8, tag: 8, domain: 8, semantic: 1 },
    );
    assert.ok(retrieval.hits.length > 0);
    assert.ok(
      retrieval.hits.every(
        (hit) => hit.knowledgeId === "coordinator-current",
      ),
    );
    assert.deepEqual(
      new Set(retrieval.hits.map((hit) => hit.channel)),
      new Set(["exact", "lexical", "tag", "domain"]),
    );
  } finally {
    repository.close();
  }
});
