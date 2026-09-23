import { performance } from "node:perf_hooks";
import { ChatSession } from "../core/chat-session.js";
import { Utf8ByteChatMessageMeasurer } from "../core/chat-invocation.js";
import type { ChatDelta, ChatRequest, ChatTransport } from "../core/types.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import { CodingAgentMemoryPolicy } from "../memory/coding-agent-policy.js";
import { DeterministicRetrievalPlanner } from "../memory/deterministic-retrieval-planner.js";
import { HybridMemoryReader } from "../memory/hybrid-memory-reader.js";
import { NeutralHybridMemoryReadPolicy } from "../memory/hybrid-retrieval-policy.js";
import { SemanticMemory } from "../memory/memory-engine.js";
import { Utf8ByteContextMeasurer } from "../memory/serialization.js";
import { SqliteMemoryRepository } from "../memory/sqlite-memory-repository.js";
import type { KnowledgeItem } from "../memory/types.js";
import { MemoryAwareChatSession } from "../orchestration/memory-aware-chat-session.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../orchestration/post-output-knowledge-intake.js";
import { PostOutputMemoryCoordinator } from "../orchestration/post-output-memory-coordinator.js";
import { IndexedRelationCandidateSource } from "../orchestration/relation-candidate-source.js";
import { RelationGatedMemoryCommit } from "../orchestration/relation-gated-memory-commit.js";
import {
  ChatTransportSemanticJsonGenerator,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
} from "../orchestration/semantic-json-model.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_40000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_40000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_40000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_40000000-0000-4000-8000-000000000004",
  "agent",
);
const KNOWLEDGE_ID = "benchmark_reasoning_boundary";
const BASELINE_PROPOSITION =
  "Provider reasoning is display-only and excluded from conversation history.";
const EXTENDED_PROPOSITION =
  "Provider reasoning is display-only and excluded from conversation history, semantic knowledge, and future prompts.";
const FIRST_MESSAGE = "Where may provider reasoning be retained?";
const FIRST_ANSWER =
  "Provider reasoning is display-only and must stay outside history, semantic knowledge, and future prompts.";
const SECOND_MESSAGE =
  "What is the full retention boundary for provider reasoning?";
const SECOND_ANSWER =
  "It stays outside conversation history, semantic knowledge, and future prompts.";

type ProviderCallKind =
  "chat" | "knowledge_analysis" | "relation_classification";

function assertProof(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Memory-loop benchmark assertion failed: ${message}`);
  }
}

function benchmarkKnowledge(): KnowledgeItem {
  return {
    id: KNOWLEDGE_ID,
    proposition: BASELINE_PROPOSITION,
    kind: "architecture-decision",
    tags: ["memory", "reasoning"],
    scope: ["runtime"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "active",
    relevanceScore: 0.9,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.9,
    confidence: 1,
    sourceBacked: true,
    provenance: [],
    revision: 1,
  };
}

function operationEnvelope(request: ChatRequest):
  | {
      readonly operation: "knowledge_analysis" | "relation_classification";
      readonly input: Record<string, unknown>;
    }
  | undefined {
  const content = request.messages.at(-1)?.content;
  if (content === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }
    const raw = parsed as Record<string, unknown>;
    if (
      (raw.operation === "knowledge_analysis" ||
        raw.operation === "relation_classification") &&
      typeof raw.input === "object" &&
      raw.input !== null &&
      !Array.isArray(raw.input)
    ) {
      return {
        operation: raw.operation,
        input: raw.input as Record<string, unknown>,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const repository = new SqliteMemoryRepository({
  filename: ":memory:",
  projectId: PROJECT,
});

try {
  await repository.transact((transaction) =>
    transaction.insert(benchmarkKnowledge()),
  );
  await repository.upsertRetrievalDocument({
    knowledgeId: KNOWLEDGE_ID,
    entities: ["ChatSession"],
    domains: ["runtime"],
  });

  const memory = new SemanticMemory({
    repository,
    policy: new CodingAgentMemoryPolicy({
      projectionReinforcement: 0,
      reconciliationReinforcement: 0,
    }),
    measurer: new Utf8ByteContextMeasurer(),
  });
  const reader = new HybridMemoryReader({
    memory,
    candidateStore: repository,
    planner: new DeterministicRetrievalPlanner({
      knownTags: ["memory", "reasoning"],
      knownDomains: ["runtime"],
    }),
    policy: new NeutralHybridMemoryReadPolicy(),
  });
  let memoryReads = 0;
  const countedReader = {
    async read(request: Parameters<typeof reader.read>[0]) {
      memoryReads += 1;
      return reader.read(request);
    },
  };

  const providerCallOrder: ProviderCallKind[] = [];
  const chatRequests: ChatRequest[] = [];
  const semanticRequests: ChatRequest[] = [];
  const chatReasoning: string[] = [];
  const semanticReasoning: string[] = [];
  const chatAnswers = [FIRST_ANSWER, SECOND_ANSWER] as const;
  const sharedTransport: ChatTransport = {
    async complete(request, callbacks) {
      const envelope = operationEnvelope(request);
      if (envelope !== undefined) {
        providerCallOrder.push(envelope.operation);
        semanticRequests.push(request);
        assertProof(
          callbacks === undefined,
          "semantic calls must not provide stream callbacks",
        );
        assertProof(
          request.options?.stream === false,
          "semantic calls must force non-streaming mode",
        );
        if (envelope.operation === "knowledge_analysis") {
          assertProof(
            providerCallOrder.length === 2 && providerCallOrder[0] === "chat",
            "analysis must follow the first chat answer",
          );
          assertProof(
            JSON.stringify(Object.keys(envelope.input).sort()) ===
              JSON.stringify([
                "responseText",
                "retrievedContext",
                "userMessage",
              ]),
            "analyzer input must contain retrieved context, user message and response",
          );
          assertProof(
            envelope.input.userMessage === FIRST_MESSAGE &&
              envelope.input.responseText === FIRST_ANSWER,
            "analyzer must receive the original first message and final answer",
          );
          const baseline = envelope.input.retrievedContext as
            | { readonly items?: readonly { readonly id?: unknown }[] }
            | undefined;
          assertProof(
            baseline?.items?.[0]?.id === KNOWLEDGE_ID,
            "analyzer must receive the exact retrieved knowledge identity",
          );
          const reasoning = "BENCH_PRIVATE_ANALYZER_REASONING";
          semanticReasoning.push(reasoning);
          return {
            message: {
              role: "assistant",
              content: JSON.stringify([
                {
                  severity: "important",
                  proposition: EXTENDED_PROPOSITION,
                  kind: "architecture-decision",
                  tags: ["memory", "reasoning"],
                  domains: ["runtime"],
                  entities: ["ChatSession"],
                  confidence: 1,
                },
              ]),
            },
            reasoning,
            finishReason: "stop",
          };
        }

        assertProof(
          providerCallOrder.length === 3 &&
            providerCallOrder[1] === "knowledge_analysis",
          "classification must follow analysis",
        );
        const proposal = envelope.input.proposal as
          { readonly proposition?: unknown } | undefined;
        const candidates = envelope.input.candidates as
          | readonly {
              readonly handle?: unknown;
              readonly proposition?: unknown;
              readonly activationStatus?: unknown;
            }[]
          | undefined;
        assertProof(
          proposal?.proposition === EXTENDED_PROPOSITION,
          "classifier must receive the extended proposal",
        );
        assertProof(
          candidates?.length === 1 &&
            candidates[0]?.handle === "candidate_1" &&
            candidates[0]?.proposition === BASELINE_PROPOSITION &&
            candidates[0]?.activationStatus === "active",
          "classifier must receive one active baseline candidate by local handle",
        );
        const reasoning = "BENCH_PRIVATE_CLASSIFIER_REASONING";
        semanticReasoning.push(reasoning);
        return {
          message: {
            role: "assistant",
            content: '{"type":"extend","targetHandle":"candidate_1"}',
          },
          reasoning,
          finishReason: "stop",
        };
      }

      providerCallOrder.push("chat");
      const turn = chatRequests.length;
      chatRequests.push(request);
      assertProof(turn < chatAnswers.length, "unexpected extra chat call");
      const reasoning = `BENCH_PRIVATE_CHAT_REASONING_${turn + 1}: ${"noise ".repeat(64)}`;
      chatReasoning.push(reasoning);
      callbacks?.onDelta?.({ type: "reasoning", text: reasoning });
      callbacks?.onDelta?.({ type: "content", text: chatAnswers[turn]! });
      return {
        message: { role: "assistant", content: chatAnswers[turn]! },
        reasoning,
        finishReason: "stop",
      };
    },
  };

  const chat = new MemoryAwareChatSession({
    chat: new ChatSession({
      model: "benchmark/shared-fake-provider",
      transport: sharedTransport,
      systemMessage: "Answer using bounded reference context.",
    }),
    memoryReader: countedReader,
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    invocationBudget: {
      maximum: 16_384,
      measurer: new Utf8ByteChatMessageMeasurer(),
    },
  });

  const semanticGenerator = new ChatTransportSemanticJsonGenerator({
    transport: sharedTransport,
    model: "benchmark/shared-fake-provider",
    budget: {
      maximum: 16_384,
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
      maximum: 16_384,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  });
  const relationCommit = new RelationGatedMemoryCommit({
    memory,
    candidateSource: new IndexedRelationCandidateSource({
      memory,
      candidateStore: repository,
    }),
    classifier: new ModelBackedKnowledgeRelationClassifier(semanticGenerator),
    classifierBudget: {
      maximum: 16_384,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    indexWriter: repository,
  });
  const postOutput = new PostOutputMemoryCoordinator({
    stager: intake,
    committer: relationCommit,
  });

  const deltaCounts = { reasoning: 0, content: 0 };
  const onDelta = (delta: ChatDelta): void => {
    deltaCounts[delta.type] += 1;
  };
  const elapsedMs: number[] = [];

  const startedFirst = performance.now();
  const first = await chat.send(
    {
      taskId: TASK,
      message: FIRST_MESSAGE,
      applicabilityScopes: ["runtime"],
    },
    { onDelta },
  );
  elapsedMs.push(Number((performance.now() - startedFirst).toFixed(3)));

  const beforeCommit = await memory.getKnowledge(KNOWLEDGE_ID);
  assertProof(beforeCommit !== undefined, "baseline knowledge must exist");
  const commit = await postOutput.process({
    taskId: TASK,
    message: FIRST_MESSAGE,
    answer: first.completion.message.content,
    retrievedContext: first.memory.projection.projection.items,
    applicabilityScopes: ["runtime"],
  });
  assertProof(
    commit.status === "completed",
    "post-output commit must complete",
  );
  const afterCommit = await memory.getKnowledge(KNOWLEDGE_ID);
  assertProof(afterCommit !== undefined, "extended knowledge must exist");

  const startedSecond = performance.now();
  const second = await chat.send(
    {
      taskId: TASK,
      message: SECOND_MESSAGE,
      applicabilityScopes: ["runtime"],
    },
    { onDelta },
  );
  elapsedMs.push(Number((performance.now() - startedSecond).toFixed(3)));

  const firstProjection = first.memory.projection.projection.items;
  const secondProjection = second.memory.projection.projection.items;
  const selectedKnowledgeIds = [
    [...first.memory.evidence.selectedKnowledgeIds],
    [...second.memory.evidence.selectedKnowledgeIds],
  ];
  const projectedPropositions = [
    firstProjection.map((item) => item.proposition),
    secondProjection.map((item) => item.proposition),
  ];
  const priorDialogueCounts = chatRequests.map((request) =>
    Math.max(
      0,
      request.messages.filter(
        (message) => message.role === "user" || message.role === "assistant",
      ).length - 1,
    ),
  );
  const committedDialogue = chat.messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const secondChatSerialized = JSON.stringify(chatRequests[1]!.messages);
  const chatHistorySerialized = JSON.stringify(chat.messages);
  const semanticResultSerialized = JSON.stringify(commit);
  const canonicalSerialized = JSON.stringify(afterCommit);
  const userChatSerialized = JSON.stringify(
    chatRequests.map((request) => request.messages),
  );
  const semanticRequestSerialized = JSON.stringify(
    semanticRequests.map((request) => request.messages),
  );
  const runtimeControlValues = [PROJECT, CONVERSATION, TASK, AGENT];
  const auditTypes = (await memory.getAudit()).map((event) => event.type);

  assertProof(
    JSON.stringify(providerCallOrder) ===
      JSON.stringify([
        "chat",
        "knowledge_analysis",
        "relation_classification",
        "chat",
      ]),
    "provider calls must follow the exact closed-loop order",
  );
  assertProof(memoryReads === 2, "expected exactly two memory reads");
  assertProof(chatRequests.length === 2, "expected exactly two chat calls");
  assertProof(
    semanticRequests.length === 2,
    "expected exactly two stateless semantic calls",
  );
  assertProof(
    selectedKnowledgeIds.every(
      (ids) => ids.length === 1 && ids[0] === KNOWLEDGE_ID,
    ),
    "the same canonical knowledge ID must be selected on both turns",
  );
  assertProof(
    firstProjection[0]?.proposition === BASELINE_PROPOSITION,
    "question one must project revision-one meaning",
  );
  assertProof(
    secondProjection[0]?.proposition === EXTENDED_PROPOSITION,
    "question two must project the committed revision-two meaning",
  );
  assertProof(
    beforeCommit.revision === 1 &&
      afterCommit.revision === 2 &&
      afterCommit.proposition === EXTENDED_PROPOSITION &&
      afterCommit.activationStatus === "active",
    "canonical active knowledge must extend from revision one to two",
  );
  assertProof(
    commit.records.length === 1 &&
      commit.records[0]?.result.reconciliation.relation === "extend" &&
      commit.records[0]?.result.index.status === "updated",
    "post-output processing must perform one indexed extend",
  );
  assertProof(
    auditTypes.includes("knowledge_extended"),
    "canonical audit must record the extension",
  );
  assertProof(
    priorDialogueCounts[0] === 0 && priorDialogueCounts[1] === 2,
    "provider-visible prior dialogue must remain bounded at two messages",
  );
  assertProof(
    chatReasoning.every(
      (reasoning) =>
        !secondChatSerialized.includes(reasoning) &&
        !chatHistorySerialized.includes(reasoning) &&
        !canonicalSerialized.includes(reasoning),
    ),
    "chat reasoning must not enter next context, history, or canon",
  );
  assertProof(
    semanticReasoning.every(
      (reasoning) =>
        !semanticResultSerialized.includes(reasoning) &&
        !canonicalSerialized.includes(reasoning),
    ),
    "semantic reasoning must not enter results or canon",
  );
  assertProof(
    !semanticRequestSerialized.includes("BENCH_PRIVATE_CHAT_REASONING") &&
      !semanticRequestSerialized.includes("A008_v1_") &&
      semanticRequestSerialized.includes(KNOWLEDGE_ID),
    "semantic requests must exclude reasoning/runtime IDs while preserving retrieved knowledge identity",
  );
  assertProof(
    runtimeControlValues.every(
      (value) => !userChatSerialized.includes(value),
    ) &&
      userChatSerialized.includes(KNOWLEDGE_ID) &&
      !userChatSerialized.includes("candidate_1") &&
      !userChatSerialized.includes("knowledge_analysis") &&
      !userChatSerialized.includes("relation_classification"),
    "user chat requests must exclude control IDs and semantic-call details",
  );
  assertProof(
    deltaCounts.reasoning === 2 && deltaCounts.content === 2,
    "chat reasoning and answer must stream as separate channels",
  );
  assertProof(
    committedDialogue.length === 4,
    "only two user and two assistant messages should commit",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        benchmark: "A008_committed_memory_loop_v2",
        mode: "fake_shared_transport_actual_sqlite",
        turns: 2,
        memoryReads,
        providerCalls: providerCallOrder.length,
        chatProviderCalls: chatRequests.length,
        semanticProviderCalls: semanticRequests.length,
        providerCallOrder,
        selectedKnowledgeIds,
        projectedPropositions,
        priorDialogueCounts,
        commitStatus: commit.status,
        commitRelations: commit.records.map(
          (record) => record.result.reconciliation.relation,
        ),
        indexStates: commit.records.map((record) => record.result.index.status),
        canonicalRevisionBefore: beforeCommit.revision,
        canonicalRevisionAfter: afterCommit.revision,
        canonicalActivationAfter: afterCommit.activationStatus,
        auditTypes,
        chatRequestBytes: chatRequests.map((request) =>
          Buffer.byteLength(JSON.stringify(request.messages), "utf8"),
        ),
        semanticRequestBytes: semanticRequests.map((request) =>
          Buffer.byteLength(JSON.stringify(request.messages), "utf8"),
        ),
        semanticRequestMessageCounts: semanticRequests.map(
          (request) => request.messages.length,
        ),
        streamedDeltas: deltaCounts,
        committedDialogueMessages: committedDialogue.length,
        secondRequestContainsPriorReasoning: chatReasoning.some((reasoning) =>
          secondChatSerialized.includes(reasoning),
        ),
        semanticResultsContainProviderReasoning: semanticReasoning.some(
          (reasoning) => semanticResultSerialized.includes(reasoning),
        ),
        providerMessagesContainControlIds: runtimeControlValues.some(
          (value: string) => userChatSerialized.includes(value),
        ),
        newDraftAutoActivationProven: false,
        observedChatTurnElapsedMs: elapsedMs,
        timingIsGuarantee: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  repository.close();
}
