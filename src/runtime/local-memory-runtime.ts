import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ChatSession, type SendMessageOptions } from "../core/chat-session.js";
import {
  Utf8ByteChatMessageMeasurer,
  type ChatInvocationBudget,
} from "../core/chat-invocation.js";
import { ChatError, isChatError } from "../core/errors.js";
import {
  DEFAULT_MODEL_ID,
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import type { ChatCompletion, ChatTransport } from "../core/types.js";
import { IdentityError } from "../identity/errors.js";
import {
  parseRuntimeId,
  RuntimeIdentityFactory,
} from "../identity/runtime-id.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../identity/types.js";
import { CodingAgentMemoryPolicy } from "../memory/coding-agent-policy.js";
import { DeterministicRetrievalPlanner } from "../memory/deterministic-retrieval-planner.js";
import { MemoryError, isMemoryError } from "../memory/errors.js";
import { HybridMemoryReader } from "../memory/hybrid-memory-reader.js";
import { NeutralHybridMemoryReadPolicy } from "../memory/hybrid-retrieval-policy.js";
import { SemanticMemory } from "../memory/memory-engine.js";
import type { HybridMemoryReadResult } from "../memory/retrieval-types.js";
import { Utf8ByteContextMeasurer } from "../memory/serialization.js";
import { SqliteMemoryRepository } from "../memory/sqlite-memory-repository.js";
import { MemoryAwareChatSession } from "../orchestration/memory-aware-chat-session.js";
import type { MemoryReadPort } from "../orchestration/memory-aware-chat-session.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../orchestration/post-output-knowledge-intake.js";
import {
  PostOutputMemoryCoordinator,
  type PostOutputMemoryResult,
} from "../orchestration/post-output-memory-coordinator.js";
import { IndexedRelationCandidateSource } from "../orchestration/relation-candidate-source.js";
import {
  RelationGatedMemoryCommit,
  type RelationIndexWriter,
  type RelationMemoryPort,
} from "../orchestration/relation-gated-memory-commit.js";
import {
  ChatTransportSemanticJsonGenerator,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
  SEMANTIC_JSON_GENERATION,
} from "../orchestration/semantic-json-model.js";
import { verifiedFinalAnswer } from "../providers/nvidia/reasoning-normalizer.js";
import type { NvidiaChatTransportOptions } from "../providers/nvidia/nvidia-chat-transport.js";
import {
  createDebugTracer,
  currentTraceId,
  tracedChatTransport,
  tracedFetch,
  withTraceId,
  type DebugTraceObserver,
  type DebugTraceSurface,
} from "./debug-trace.js";
import {
  parseLocalRuntimeConfig,
  projectIdSidecarPath,
  type LocalRuntimeCliTraceOptions,
  type LocalRuntimeConfig,
} from "./local-runtime-config.js";
import {
  createNvidiaChatTransport,
  createNvidiaTransportOptions,
  DEFAULT_SYSTEM_MESSAGE,
} from "./nvidia-session.js";
import { applyUserAssertionActivation } from "./user-assertion-gate.js";

export const LOCAL_MEMORY_SCOPES = ["local"] as const;
export const LIVE_PROJECTION_REINFORCEMENT = 0;
export const LIVE_RECONCILIATION_REINFORCEMENT = 0.2;
const INVOCATION_BUDGET_MAXIMUM = 16_384;
const SEMANTIC_BUDGET_MAXIMUM = 16_384;

export interface LocalMemoryRuntimeOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly surface: DebugTraceSurface;
  readonly registry?: ModelRegistry;
  readonly stderr?: NodeJS.WritableStream;
  readonly cli?: LocalRuntimeCliTraceOptions;
  readonly identityFactory?: RuntimeIdentityFactory;
  readonly createTransport?: (
    options: NvidiaChatTransportOptions,
  ) => ChatTransport;
  readonly readerDecorator?: (reader: MemoryReadPort) => MemoryReadPort;
  readonly indexWriterDecorator?: (
    writer: RelationIndexWriter,
  ) => RelationIndexWriter;
  readonly memoryDecorator?: (memory: RelationMemoryPort) => RelationMemoryPort;
}

export interface LocalMemorySessionOptions {
  readonly model?: string;
  readonly systemMessage?: string;
}

export interface LocalMemoryTurnResult {
  readonly completion: ChatCompletion;
  readonly memory: HybridMemoryReadResult;
  readonly taskId: RuntimeTaskId;
  readonly postOutput: PostOutputMemoryResult;
  readonly memoryDiagnostic: string | undefined;
}

function budget(): ChatInvocationBudget {
  return {
    maximum: INVOCATION_BUDGET_MAXIMUM,
    measurer: new Utf8ByteChatMessageMeasurer(),
  };
}

function semanticBudget(): {
  readonly maximum: number;
  readonly measurer: Utf8ByteKnowledgeIntakeMeasurer;
} {
  return {
    maximum: SEMANTIC_BUDGET_MAXIMUM,
    measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
  };
}

export function formatRuntimeError(error: unknown): string {
  if (isChatError(error) || isMemoryError(error) || error instanceof IdentityError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

export function describeMemoryOutcome(
  result: PostOutputMemoryResult,
): string | undefined {
  if (result.status === "completed") {
    return undefined;
  }
  if (result.status === "staging_failed") {
    return `memory staging failed: ${formatRuntimeError(result.error)}`;
  }
  if (result.status === "commit_failed") {
    return `memory commit failed at proposal ${result.failedProposalIndex}: ${formatRuntimeError(result.error)}`;
  }
  return `memory index repair required: ${formatRuntimeError(result.error)}`;
}

function resolveProjectId(
  config: LocalRuntimeConfig,
  factory: RuntimeIdentityFactory,
): ProjectId {
  const sidecar = config.sqliteIsMemory
    ? undefined
    : projectIdSidecarPath(config.sqlitePath);
  const persisted =
    sidecar !== undefined && existsSync(sidecar)
      ? parseRuntimeId(readFileSync(sidecar, "utf8").trim(), "project")
      : undefined;
  if (config.projectId !== undefined) {
    const configured = parseRuntimeId(config.projectId, "project");
    if (persisted !== undefined && persisted !== configured) {
      throw new ChatError(
        "configuration",
        "A007_PROJECT_ID does not match the SQLite project-id sidecar.",
      );
    }
    if (sidecar !== undefined && persisted === undefined) {
      writeFileSync(sidecar, `${configured}\n`, "utf8");
    }
    return configured;
  }
  if (persisted !== undefined) {
    return persisted;
  }
  const created = factory.create("project");
  if (sidecar !== undefined) {
    writeFileSync(sidecar, `${created}\n`, "utf8");
  }
  return created;
}

function resolveAgentId(
  config: LocalRuntimeConfig,
  factory: RuntimeIdentityFactory,
): AgentId {
  return config.agentId === undefined
    ? factory.create("agent")
    : parseRuntimeId(config.agentId, "agent");
}

function emitCommitTrace(
  tracer: DebugTraceObserver,
  surface: DebugTraceSurface,
  traceId: string,
  result: PostOutputMemoryResult,
): void {
  if (result.status !== "completed" && result.status !== "commit_failed") {
    if (result.status === "index_repair_required") {
      const summary = describeMemoryOutcome(result);
      tracer.emit({
        traceId,
        surface,
        phase: "index",
        status: "error",
        index: { status: "pending_repair" },
        ...(summary === undefined ? {} : { summary }),
      });
    }
    return;
  }
  const records =
    result.status === "completed" ? result.records : result.checkpoint.records;
  for (const record of records) {
    const item = record.result.reconciliation.item;
    tracer.emit({
      traceId,
      surface,
      phase: "commit",
      status: "ok",
      commit: {
        proposalIndex: record.proposalIndex,
        relation: record.result.reconciliation.relation,
        ...(item === null
          ? {}
          : {
              knowledgeId: item.id,
              revision: item.revision,
              activation: item.activationStatus,
            }),
      },
    });
    tracer.emit({
      traceId,
      surface,
      phase: "index",
      status: record.result.index.status === "pending_repair" ? "error" : "ok",
      index: { status: record.result.index.status },
    });
  }
}

export class LocalMemorySession {
  readonly conversationId: ConversationId;
  readonly #runtime: LocalMemoryRuntime;
  readonly #chat: MemoryAwareChatSession;
  readonly #coordinator: PostOutputMemoryCoordinator;
  readonly #identityFactory: RuntimeIdentityFactory;
  #turnActive = false;
  #lastDiagnostic: string | undefined;

  constructor(options: {
    readonly runtime: LocalMemoryRuntime;
    readonly conversationId: ConversationId;
    readonly chat: MemoryAwareChatSession;
    readonly coordinator: PostOutputMemoryCoordinator;
    readonly identityFactory: RuntimeIdentityFactory;
  }) {
    this.#runtime = options.runtime;
    this.conversationId = options.conversationId;
    this.#chat = options.chat;
    this.#coordinator = options.coordinator;
    this.#identityFactory = options.identityFactory;
  }

  get model(): string {
    return this.#chat.model;
  }

  get messages() {
    return this.#chat.messages;
  }

  reset(): void {
    this.#chat.reset();
  }

  consumeMemoryDiagnostic(): string | undefined {
    const diagnostic = this.#lastDiagnostic;
    this.#lastDiagnostic = undefined;
    return diagnostic;
  }

  async send(
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatCompletion> {
    const result = await this.turn(content, options);
    this.#lastDiagnostic = result.memoryDiagnostic;
    return result.completion;
  }

  async turn(
    message: string,
    options: SendMessageOptions = {},
  ): Promise<LocalMemoryTurnResult> {
    if (this.#turnActive) {
      throw new ChatError(
        "configuration",
        "Memory session already has an active turn.",
      );
    }
    this.#turnActive = true;
    const traceId = randomUUID();
    const taskId = this.#identityFactory.create("task");
    try {
    return await withTraceId(traceId, async () => {
      this.#runtime.tracer.emit({
        traceId,
        surface: this.#runtime.surface,
        phase: "turn_start",
        summary: "memory-aware turn",
      });
      try {
        const memoryResult = await this.#chat.send(
          {
            taskId,
            message,
            applicabilityScopes: [...LOCAL_MEMORY_SCOPES],
          },
          {
            ...(options.generation === undefined
              ? {}
              : { generation: options.generation }),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            ...(options.onDelta === undefined ? {} : { onDelta: options.onDelta }),
          },
        );
        await this.#runtime.tracer.flush();
        const answer = verifiedFinalAnswer(memoryResult.completion);
        let postOutput = await this.#coordinator.process(
          {
            taskId,
            message,
            answer,
            applicabilityScopes: [...LOCAL_MEMORY_SCOPES],
          },
          options.signal === undefined ? {} : { signal: options.signal },
        );
        if (postOutput.status === "index_repair_required") {
          postOutput = await this.#coordinator.repairAndResume(
            postOutput.checkpoint,
            options.signal === undefined ? {} : { signal: options.signal },
          );
        }
        emitCommitTrace(
          this.#runtime.tracer,
          this.#runtime.surface,
          traceId,
          postOutput,
        );
        const memoryDiagnostic = describeMemoryOutcome(postOutput);
        if (memoryDiagnostic !== undefined) {
          this.#runtime.tracer.emit({
            traceId,
            surface: this.#runtime.surface,
            phase: "memory_failure",
            status: "error",
            summary: memoryDiagnostic,
          });
        }
        this.#runtime.tracer.emit({
          traceId,
          surface: this.#runtime.surface,
          phase: "turn_complete",
          status: memoryDiagnostic === undefined ? "ok" : "degraded",
          chatStatus: "ok",
          memoryStatus: postOutput.status,
        });
        await this.#runtime.tracer.flush();
        const sinkFailure = this.#runtime.tracer.consumeSinkFailure();
        const diagnostic =
          memoryDiagnostic ??
          (sinkFailure === undefined
            ? undefined
            : `memory-trace sink failed: ${sinkFailure}`);
        return {
          completion: memoryResult.completion,
          memory: memoryResult.memory,
          taskId,
          postOutput,
          memoryDiagnostic: diagnostic,
        };
      } catch (error) {
        this.#runtime.tracer.emit({
          traceId,
          surface: this.#runtime.surface,
          phase: "memory_failure",
          status: "error",
          summary: formatRuntimeError(error),
        });
        await this.#runtime.tracer.flush();
        throw error;
      }
    });
    } finally {
      this.#turnActive = false;
    }
  }
}

export class LocalMemoryRuntime {
  readonly surface: DebugTraceSurface;
  readonly projectId: ProjectId;
  readonly agentId: AgentId;
  readonly sqlitePath: string;
  readonly tracer: DebugTraceObserver;
  readonly #repository: SqliteMemoryRepository;
  readonly #memory: SemanticMemory;
  readonly #reader: MemoryReadPort;
  readonly #indexWriter: RelationIndexWriter;
  readonly #commitMemory: RelationMemoryPort;
  readonly #transport: ChatTransport;
  readonly #registry: ModelRegistry;
  readonly #identityFactory: RuntimeIdentityFactory;
  #closed = false;

  constructor(options: {
    readonly surface: DebugTraceSurface;
    readonly projectId: ProjectId;
    readonly agentId: AgentId;
    readonly sqlitePath: string;
    readonly tracer: DebugTraceObserver;
    readonly repository: SqliteMemoryRepository;
    readonly memory: SemanticMemory;
    readonly reader: MemoryReadPort;
    readonly indexWriter: RelationIndexWriter;
    readonly commitMemory: RelationMemoryPort;
    readonly transport: ChatTransport;
    readonly registry: ModelRegistry;
    readonly identityFactory: RuntimeIdentityFactory;
  }) {
    this.surface = options.surface;
    this.projectId = options.projectId;
    this.agentId = options.agentId;
    this.sqlitePath = options.sqlitePath;
    this.tracer = options.tracer;
    this.#repository = options.repository;
    this.#memory = options.memory;
    this.#reader = options.reader;
    this.#indexWriter = options.indexWriter;
    this.#commitMemory = options.commitMemory;
    this.#transport = options.transport;
    this.#registry = options.registry;
    this.#identityFactory = options.identityFactory;
  }

  openSession(options: LocalMemorySessionOptions = {}): LocalMemorySession {
    if (this.#closed) {
      throw new ChatError(
        "configuration",
        "Local memory runtime is closed.",
      );
    }
    const profile = this.#registry.require(options.model ?? DEFAULT_MODEL_ID);
    const conversationId = this.#identityFactory.create("conversation");
    const chatSession = new ChatSession({
      model: profile.id,
      transport: this.#transport,
      systemMessage: options.systemMessage ?? DEFAULT_SYSTEM_MESSAGE,
      generation: profile.defaults,
    });
    const memoryAware = new MemoryAwareChatSession({
      chat: chatSession,
      memoryReader: this.#reader,
      context: {
        projectId: this.projectId,
        conversationId,
        agentId: this.agentId,
      },
      invocationBudget: budget(),
    });
    const generator = new ChatTransportSemanticJsonGenerator({
      transport: this.#transport,
      model: profile.id,
      budget: budget(),
      generation: SEMANTIC_JSON_GENERATION,
    });
    const intakeBudget = semanticBudget();
    const intake = new PostOutputKnowledgeIntake({
      analyzer: new ModelBackedPostOutputKnowledgeAnalyzer(generator),
      context: {
        projectId: this.projectId,
        conversationId,
        agentId: this.agentId,
      },
      budget: intakeBudget,
    });
    const committer = new RelationGatedMemoryCommit({
      memory: this.#commitMemory,
      candidateSource: new IndexedRelationCandidateSource({
        memory: this.#memory,
        candidateStore: this.#repository,
      }),
      classifier: new ModelBackedKnowledgeRelationClassifier(generator),
      classifierBudget: intakeBudget,
      indexWriter: this.#indexWriter,
      activateNewProposal: applyUserAssertionActivation,
    });
    const coordinator = new PostOutputMemoryCoordinator({
      stager: intake,
      committer,
    });
    return new LocalMemorySession({
      runtime: this,
      conversationId,
      chat: memoryAware,
      coordinator,
      identityFactory: this.#identityFactory,
    });
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#repository.close();
    void this.tracer.close();
  }
}

export function createLocalMemoryRuntime(
  options: LocalMemoryRuntimeOptions,
): LocalMemoryRuntime {
  const surface = options.surface;
  const nvidiaOptions = createNvidiaTransportOptions({ env: options.env });
  const config = parseLocalRuntimeConfig(options.env, {
    surface: surface === "acp" ? "acp" : "cli",
    ...(options.cli === undefined ? {} : { cli: options.cli }),
  });
  const identityFactory =
    options.identityFactory ?? new RuntimeIdentityFactory();
  if (!config.sqliteIsMemory) {
    mkdirSync(dirname(config.sqlitePath), { recursive: true });
  }
  const projectId = resolveProjectId(config, identityFactory);
  const agentId = resolveAgentId(config, identityFactory);
  const secrets = [nvidiaOptions.apiKey].filter((value) => value.length >= 8);
  const tracer = createDebugTracer({
    mode: config.debugTrace,
    surface,
    ...(config.debugTraceFile === undefined
      ? {}
      : { filePath: config.debugTraceFile }),
    ...(options.stderr === undefined || surface === "acp"
      ? {}
      : { stderr: options.stderr }),
    secrets,
  });
  const innerTransport = createNvidiaChatTransport({
    env: options.env,
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    ...(options.createTransport === undefined
      ? {
          fetch: tracedFetch(
            globalThis.fetch.bind(globalThis),
            tracer,
            surface,
          ),
        }
      : { createTransport: options.createTransport }),
  });
  const transport = tracedChatTransport(innerTransport, tracer, surface);
  const repository = new SqliteMemoryRepository({
    filename: config.sqlitePath,
    projectId,
  });
  const memory = new SemanticMemory({
    repository,
    policy: new CodingAgentMemoryPolicy({
      projectionReinforcement: LIVE_PROJECTION_REINFORCEMENT,
      reconciliationReinforcement: LIVE_RECONCILIATION_REINFORCEMENT,
    }),
    measurer: new Utf8ByteContextMeasurer(),
  });
  const reader = new HybridMemoryReader({
    memory,
    candidateStore: repository,
    planner: new DeterministicRetrievalPlanner(),
    policy: new NeutralHybridMemoryReadPolicy(),
  });
  const baseReader = options.readerDecorator?.(reader) ?? reader;
  const tracedReader: MemoryReadPort = {
    async read(request) {
      const result = await baseReader.read(request);
      tracer.emit({
        traceId: currentTraceId(),
        surface,
        phase: "memory_read",
        status: "ok",
        selectedMemoryIds: [...result.evidence.selectedKnowledgeIds],
        sizes: {
          selected: result.evidence.selectedKnowledgeIds.length,
          projectionBytes: result.evidence.projectionMeasuredUnits,
        },
      });
      return result;
    },
  };
  return new LocalMemoryRuntime({
    surface,
    projectId,
    agentId,
    sqlitePath: config.sqlitePath,
    tracer,
    repository,
    memory,
    reader: tracedReader,
    indexWriter: options.indexWriterDecorator?.(repository) ?? repository,
    commitMemory: options.memoryDecorator?.(memory) ?? memory,
    transport,
    registry: options.registry ?? defaultModelRegistry,
    identityFactory,
  });
}
