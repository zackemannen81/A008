import { randomUUID } from "node:crypto";
import {
  acquireRuntimeLease,
  canonicalStoragePath,
} from "./runtime-ownership.js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { ChatSession, type SendMessageOptions } from "../core/chat-session.js";
import {
  cloneChatMessage,
  type GeneratedImageTerminalUpdate,
} from "../core/chat-content.js";
import {
  Utf8ByteChatMessageMeasurer,
  type ChatInvocationBudget,
} from "../core/chat-invocation.js";
import { ChatError, isChatError } from "../core/errors.js";
import { RuntimePreferencesStore } from "./runtime-preferences-store.js";
import {
  ProjectConversationStateStore,
  type ProjectConversationState,
} from "./conversation-state-store.js";
import type { RuntimeBudgets } from "../core/runtime-preferences.js";
import { ConversationScopes } from "../memory/knowledge/current-scope.js";
import { DeterministicRetrievalPlanner } from "../memory/deterministic-retrieval-planner.js";
import {
  chatGeneration,
  defaultSessionParameters,
  generationCapabilities,
  parseSessionParameters,
} from "../core/generation-controls.js";
import {
  DEFAULT_MODEL_ID,
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import type {
  ChatCompletion,
  ChatImageAttachment,
  ChatMessage,
  ChatTransport,
} from "../core/types.js";
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
import { MemoryError, isMemoryError } from "../memory/errors.js";
import type { ProvenanceRelation } from "../memory/knowledge/evidence-types.js";
import { ingest } from "../memory/knowledge/ingest.js";
import {
  inspectKnowledge,
  type MemoryInspection,
  type MemoryInspectionQuery,
} from "../memory/knowledge/inspection.js";
import {
  createSqliteKnowledgeContext,
  KnowledgeEngineCommit,
  KnowledgeMemoryReader,
  type ContentKind,
  type SqliteKnowledgeContextHandle,
} from "../memory/knowledge/index.js";
import type { HybridMemoryReadResult } from "../memory/retrieval-types.js";
import {
  sniffSourceMediaType,
  DocxExtractor,
  PdfExtractor,
  SourceExtractorRegistry,
  Utf8TextExtractor,
} from "../ingest/index.js";
import {
  IMAGE_GIF,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
} from "../ingest/types.js";
import { MemoryAwareChatSession } from "../orchestration/memory-aware-chat-session.js";
import type { MemoryReadPort } from "../orchestration/memory-aware-chat-session.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../orchestration/post-output-knowledge-intake.js";
import {
  PostOutputMemoryCoordinator,
  type PostOutputMemoryResult,
  type StagedProposalCommitter,
} from "../orchestration/post-output-memory-coordinator.js";
import type {
  RelationIndexWriter,
  RelationMemoryPort,
} from "../orchestration/relation-gated-memory-commit.js";
import {
  ChatTransportSemanticJsonGenerator,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
  ModelBackedRetrievalScopeClassifier,
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
  type ChatGenerationOverrides,
  type LocalRuntimeConfig,
} from "./local-runtime-config.js";
import {
  createNvidiaChatTransport,
  createNvidiaTransportOptions,
} from "./nvidia-session.js";
import { createConfiguredChatTransport } from "./chat-dispatch.js";
import { defaultCatalogPath } from "../core/user-catalog.js";
import { chatContentSchema } from "../../packages/protocol/src/index.js";

export const LOCAL_MEMORY_SCOPES = ["local"] as const;
export const LIVE_PROJECTION_REINFORCEMENT = 0;
export const LIVE_RECONCILIATION_REINFORCEMENT = 0.2;

/**
 * Speaker recorded when text is taken verbatim from an uploaded source. This
 * process serves one local user, exactly as `KnowledgeEngineCommit` hardcodes
 * `speaker: "user"` for the dialogue ingest path.
 */
const SOURCE_UPLOADER_SPEAKER = "user";

/**
 * Optional scheme prefix on a source locator, per ADR 0020 D2
 * (`source:<sha256>/<sanitised-name>`). Stripped before filesystem
 * resolution — `:` is not a legal path character on Windows — but the
 * caller's original locator string, prefix included, is what is preserved on
 * the stored artifact.
 */
const SOURCE_LOCATOR_SCHEME = "source:";

export interface SourceIngestInput {
  readonly locator: string;
  /**
   * Run the analyze/classify/commit coordinator over the extracted text.
   *
   * Off by default, deliberately. The coordinator commits proposals strictly
   * sequentially with one classifier call each and the ceiling is 128, so
   * turning this on can mean well over a hundred provider calls for one
   * source. Evidence is stored either way; this only decides whether knowledge
   * is extracted from it now.
   */
  readonly extractKnowledge?: boolean;
  /** Advisory only; the actual media type is always sniffed from the bytes. */
  readonly mediaType?: string;
  /** Advisory only; never decides extraction. */
  readonly filename?: string;
  readonly signal?: AbortSignal;
}

export interface SourceKnowledgeOutcome {
  readonly status: PostOutputMemoryResult["status"];
  /** Proposals the coordinator committed before finishing or stopping. */
  readonly proposalsCommitted: number;
  /** Present when extraction failed; the stored evidence is unaffected. */
  readonly error?: string;
}

export interface SourceIngestOutcome {
  readonly artifactId: string;
  readonly utteranceIds: readonly string[];
  readonly contentKind: ContentKind;
  readonly relation: ProvenanceRelation;
  readonly speaker: string;
  /** Absent unless `extractKnowledge` was requested. */
  readonly knowledge?: SourceKnowledgeOutcome;
}

export interface LocalMemoryRuntimeOptions {
  /** Internal composition only: the project registry already holds both leases. */
  readonly ownershipAlreadyHeld?: boolean;
  readonly env: NodeJS.ProcessEnv;
  readonly surface: DebugTraceSurface;
  readonly registry?: ModelRegistry;
  readonly stderr?: NodeJS.WritableStream;
  readonly cli?: LocalRuntimeCliTraceOptions;
  readonly identityFactory?: RuntimeIdentityFactory;
  readonly createTransport?: (
    options: NvidiaChatTransportOptions,
  ) => ChatTransport;
  readonly fetch?: NvidiaChatTransportOptions["fetch"];
  readonly readerDecorator?: (reader: MemoryReadPort) => MemoryReadPort;
  readonly committerDecorator?: (
    committer: StagedProposalCommitter,
  ) => StagedProposalCommitter;
  readonly indexWriterDecorator?: (
    writer: RelationIndexWriter,
  ) => RelationIndexWriter;
  readonly memoryDecorator?: (memory: RelationMemoryPort) => RelationMemoryPort;
  /**
   * Composed registry of `SourceExtractor`s for `ingestSource`. Defaults to the
   * three that need no provider call — text, PDF and Word — because those read
   * the file and nothing else. Image description is not in the default set: it
   * is a paid vision call, so a caller that wants it composes it in explicitly.
   * Tests inject a fake extractor here to drive the `derived_from`
   * provenance-passthrough gate without a live vision call.
   */
  readonly sourceExtractorRegistry?: SourceExtractorRegistry;
  /**
   * Reads the stored bytes for `ingestSource`, after locator containment has
   * already been proven safe. Overridable so a test can prove a rejected
   * locator's file was never opened.
   */
  readonly readSourceBytes?: (path: string) => Uint8Array;
}

export interface ConversationSeed {
  readonly conversationId: string;
  readonly messages: readonly ChatMessage[];
}

export interface LocalMemorySessionOptions {
  readonly model?: string;
  readonly systemMessage?: string;
  /** Internal standalone-workspace policy; generic sessions omit this. */
  readonly workspaceConversation?: "restore" | "fresh";
  /**
   * Trusted backend composition only. This is deliberately absent from ACP
   * request payloads: platform-owned committed history enters through the
   * existing runtime, never through an untrusted client request.
   */
  readonly conversationSeed?: ConversationSeed;
}

export function validateConversationSeed(
  seed: ConversationSeed,
): {
  readonly conversationId: ConversationId;
  readonly messages: ChatMessage[];
} {
  const conversationId = parseRuntimeId(seed.conversationId, "conversation");
  if (!Array.isArray(seed.messages)) {
    throw new ChatError(
      "configuration",
      "Conversation seed messages must be an array.",
    );
  }
  const messages = seed.messages.map((candidate, index): ChatMessage => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      (candidate.role !== "user" && candidate.role !== "assistant")
    ) {
      throw new ChatError(
        "configuration",
        `Conversation seed message ${index} must be a committed user or assistant message.`,
      );
    }
    const parsed = chatContentSchema.safeParse(candidate.content);
    if (!parsed.success) {
      throw new ChatError(
        "configuration",
        `Conversation seed message ${index} has invalid content.`,
        { cause: parsed.error },
      );
    }
    return cloneChatMessage({ role: candidate.role, content: parsed.data });
  });
  return { conversationId, messages };
}

export interface LocalMemoryTurnResult {
  readonly completion: ChatCompletion;
  readonly memory: HybridMemoryReadResult;
  readonly taskId: RuntimeTaskId;
  readonly postOutput: PostOutputMemoryResult;
  readonly memoryDiagnostic: string | undefined;
}

export interface SharedMemoryCapabilities {
  readonly protocol: "A007_MEMORY_V1";
  readonly version: 1;
  readonly capabilities: readonly string[];
  readonly projectId: ProjectId;
  readonly durable: boolean;
  readonly writeSemantics: "evidence";
}

export interface SharedMemoryRecallInput {
  readonly query: string;
  readonly limit?: number;
  readonly scopes?: readonly string[];
}

export interface SharedMemoryRecallItem {
  readonly id: string;
  readonly content: string;
  readonly kind: string;
  readonly score: number;
  readonly tags: readonly string[];
  readonly scope: readonly string[];
  readonly provenance: readonly string[];
  readonly metadata: {
    readonly authority: number;
    readonly identityKind: "projection";
    readonly projectId: ProjectId;
  };
}

export interface SharedMemoryRecallResult {
  readonly items: readonly SharedMemoryRecallItem[];
  readonly omitted: number;
  readonly measuredUnits: number;
  readonly measurementUnit: string;
}

export interface SharedMemoryWriteInput {
  readonly content: string;
  readonly scopes?: readonly string[];
}

export interface SharedMemoryWriteResult {
  readonly id: string;
  readonly artifactId: string;
  readonly status: "STORED";
  readonly durable: boolean;
  readonly semantics: "evidence";
}

function budget(
  maximum: number,
  label = "Semantic input (Parameters → Budgets)",
): ChatInvocationBudget {
  return {
    maximum,
    label,
    measurer: new Utf8ByteChatMessageMeasurer(),
  };
}

function semanticBudget(maximum: number): {
  readonly maximum: number;
  readonly measurer: Utf8ByteKnowledgeIntakeMeasurer;
} {
  return {
    maximum,
    measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
  };
}

function semanticGeneration(
  model: string,
  limits: RuntimeBudgets,
  selectedReasoningEffort: string | null = null,
) {
  const capabilities = generationCapabilities(model);
  if (
    selectedReasoningEffort !== null &&
    !capabilities.reasoningEfforts.includes(selectedReasoningEffort)
  ) {
    throw new ChatError(
      "configuration",
      `Semantic reasoning effort ${selectedReasoningEffort} is not supported for ${model}.`,
    );
  }
  const semanticReasoningEffort =
    capabilities.reasoningEfforts.length === 0
      ? undefined
      : (selectedReasoningEffort ?? "none");
  return {
    ...SEMANTIC_JSON_GENERATION,
    ...(capabilities.topP ? {} : { topP: null }),
    ...(capabilities.thinking ? {} : { enableThinking: null }),
    ...(model === "gpt-5.6-luna" || model === "gpt-5.6-terra"
      ? { temperature: null }
      : {}),
    ...(semanticReasoningEffort === undefined
      ? {}
      : { reasoningEffort: semanticReasoningEffort }),
    maxTokens: Math.min(limits.semanticOutputTokens, capabilities.maxTokens),
  };
}

function containedRelative(
  root: string,
  candidate: string,
): string | undefined {
  const relativePath = relative(root, candidate);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return undefined;
  }
  return relativePath;
}

/**
 * Resolves a source locator against the configured store root and returns
 * the real filesystem path of the stored bytes.
 *
 * The host names the path and this process reads it, so containment is a
 * security boundary (ADR 0020 D2), not a convenience check: a `startsWith`
 * comparison on the root is not sufficient, because it does not catch a
 * symlink whose target escapes the root after the syntactic path already
 * looks contained. Every rejection here happens before any byte of the
 * target file is read.
 *
 * Two passes, both required:
 *  1. Syntactic — reject `..` traversal and an absolute locator using
 *     `path.relative`, exactly as `resolvedSqlitePath` validates
 *     `A008_MEMORY_SQLITE_PATH`. This alone stops every attack that never
 *     touches the filesystem.
 *  2. Real — resolve both the candidate and the root with `realpathSync` and
 *     re-check containment. This is what catches a symlink (or, on Windows
 *     without the symlink privilege, a directory junction) planted inside the
 *     store that resolves outside it.
 */
function resolveSourceLocatorPath(storeRoot: string, locator: string): string {
  const trimmed = locator.trim();
  if (trimmed.length === 0) {
    throw new ChatError("configuration", "Source locator must not be empty.");
  }
  const relativePart = trimmed.startsWith(SOURCE_LOCATOR_SCHEME)
    ? trimmed.slice(SOURCE_LOCATOR_SCHEME.length)
    : trimmed;
  if (relativePart.length === 0 || isAbsolute(relativePart)) {
    throw new ChatError(
      "configuration",
      `Source locator must name a relative path under the store root: ${locator}`,
    );
  }
  const candidate = resolve(storeRoot, relativePart);
  if (containedRelative(storeRoot, candidate) === undefined) {
    throw new ChatError(
      "configuration",
      `Source locator escapes the configured store root: ${locator}`,
    );
  }
  let realCandidate: string;
  let realRoot: string;
  try {
    realCandidate = realpathSync(candidate);
    realRoot = realpathSync(storeRoot);
  } catch (error) {
    throw new ChatError(
      "configuration",
      `Source locator does not resolve to a stored file: ${locator}`,
      { cause: error },
    );
  }
  if (containedRelative(realRoot, realCandidate) === undefined) {
    throw new ChatError(
      "configuration",
      `Source locator escapes the configured store root: ${locator}`,
    );
  }
  return realCandidate;
}

export function formatRuntimeError(error: unknown): string {
  if (
    isChatError(error) ||
    isMemoryError(error) ||
    error instanceof IdentityError
  ) {
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
    // A completed batch is silent unless items were dropped. Skipping is not a
    // failure, but it is a loss, and a silent loss is the thing to avoid.
    //
    // Two places can drop one. Staging refuses a malformed analyzer item before
    // it is ever a proposal; the commit loop refuses one the store will not
    // accept, such as a write to a contested slot. Both are reported, and named
    // apart, because they point at different things to go and look at.
    const staged = "batch" in result ? result.batch.skippedProposals : [];
    const committed = result.skippedProposals;
    const parts: string[] = [];
    if (staged.length > 0) {
      parts.push(
        `skipped ${staged.length} malformed proposal${plural(staged.length)}: ${staged.join("; ")}`,
      );
    }
    if (committed.length > 0) {
      parts.push(
        `refused ${committed.length} proposal${plural(committed.length)} at commit: ` +
          committed
            .map((entry) => `proposal ${entry.proposalIndex}: ${entry.reason}`)
            .join("; "),
      );
    }
    return parts.length === 0 ? undefined : `memory ${parts.join(", ")}`;
  }
  if (result.status === "staging_failed") {
    return `memory staging failed: ${formatRuntimeError(result.error)}`;
  }
  if (result.status === "commit_failed") {
    return `memory commit failed at proposal ${result.failedProposalIndex}: ${formatRuntimeError(result.error)}`;
  }
  return `memory index repair required: ${formatRuntimeError(result.error)}`;
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
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
  #parameters:
    import("../core/generation-controls.js").SessionParameters | undefined;
  readonly conversationId: ConversationId;
  readonly #runtime: LocalMemoryRuntime;
  readonly #chat: ChatSession;
  readonly #identityFactory: RuntimeIdentityFactory;
  readonly #persistConversation:
    | ((state: ProjectConversationState) => void)
    | undefined;
  #turnActive = false;
  #lastDiagnostic: string | undefined;
  #lastMemoryStatus: PostOutputMemoryResult["status"] | undefined;

  constructor(options: {
    readonly runtime: LocalMemoryRuntime;
    readonly conversationId: ConversationId;
    readonly chat: ChatSession;
    readonly identityFactory: RuntimeIdentityFactory;
    readonly persistConversation?: (state: ProjectConversationState) => void;
  }) {
    this.#runtime = options.runtime;
    this.conversationId = options.conversationId;
    this.#chat = options.chat;
    this.#identityFactory = options.identityFactory;
    this.#persistConversation = options.persistConversation;
  }

  get model(): string {
    return this.#chat.model;
  }

  get messages() {
    return this.#chat.messages;
  }

  get parameters() {
    const parameters =
      this.#parameters ?? this.#runtime.sessionParameters(this.model);
    return {
      ...parameters,
      stop: parameters.stop === null ? null : [...parameters.stop],
    };
  }

  enableSessionControls(): void {
    this.#parameters ??= this.#runtime.sessionParameters(this.model);
  }

  configureParameters(value: unknown): void {
    if (this.#turnActive)
      throw new ChatError(
        "configuration",
        "Cannot configure during an active turn.",
      );
    this.#parameters = parseSessionParameters(value, this.model);
  }

  get runtimePreferences() {
    const snapshot = this.#runtime.preferences.snapshot();
    return {
      ...snapshot,
      fields: snapshot.fields.map((field) =>
        field.key === "semanticOutputTokens"
          ? {
              ...field,
              description: `${field.description} Saved effective semantic limit: ${snapshot.settings.semantic.model} ${semanticGeneration(snapshot.settings.semantic.model, snapshot.settings.budgets, snapshot.settings.semantic.reasoningEffort).maxTokens}.`,
            }
          : field,
      ),
    };
  }

  configureRuntimePreferences(value: unknown, revision: string): void {
    if (this.#turnActive)
      throw new ChatError(
        "configuration",
        "Cannot configure during an active turn.",
      );
    this.#runtime.preferences.save(value, revision);
  }

  reset(): void {
    if (this.#turnActive)
      throw new ChatError(
        "configuration",
        "Cannot reset during an active turn.",
      );
    this.#chat.reset();
    this.#persist();
  }

  undoLastTurn(): boolean {
    if (this.#turnActive)
      throw new ChatError(
        "configuration",
        "Cannot undo during an active turn.",
      );
    const undone = this.#chat.undoLastTurn();
    if (undone) this.#persist();
    return undone;
  }

  reserveGeneratedImage(generationId: string, prompt: string): void {
    this.#chat.reserveGeneratedImage(generationId, prompt);
    this.#persist();
  }

  resolveGeneratedImage(
    generationId: string,
    update: GeneratedImageTerminalUpdate,
  ): boolean {
    const resolved = this.#chat.resolveGeneratedImage(generationId, update);
    if (resolved) this.#persist();
    return resolved;
  }

  #persist(): void {
    this.#persistConversation?.({
      conversationId: this.conversationId,
      model: this.model,
      messages: this.#chat.messages.filter((message) => message.role !== "system"),
    });
  }

  consumeMemoryDiagnostic(): string | undefined {
    const diagnostic = this.#lastDiagnostic;
    this.#lastDiagnostic = undefined;
    return diagnostic;
  }

  consumeMemoryStatus(): PostOutputMemoryResult["status"] | undefined {
    const status = this.#lastMemoryStatus;
    this.#lastMemoryStatus = undefined;
    return status;
  }

  async send(
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatCompletion> {
    const result = await this.turn(content, {
      ...options,
      ...(this.#parameters === undefined
        ? {}
        : {
            generation: chatGeneration(
              parseSessionParameters(this.#parameters, this.model),
            ),
          }),
    });
    this.#lastDiagnostic = result.memoryDiagnostic;
    this.#lastMemoryStatus = result.postOutput.status;
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
      return await this.#runtime.preferences.run(() =>
        withTraceId(traceId, async () => {
          const tools = options.prepareTools
            ? await options.prepareTools(
                options.signal ?? new AbortController().signal,
                this.#runtime.preferences.current.budgets,
              )
            : options.tools;
          const turn = this.#runtime.createTurn(
            this.#chat,
            this.conversationId,
          );
          this.#runtime.tracer.emit({
            traceId,
            surface: this.#runtime.surface,
            phase: "turn_start",
            summary: "memory-aware turn",
          });
          try {
            const memoryResult = await turn.chat.send(
              {
                taskId,
                message,
                applicabilityScopes: [...LOCAL_MEMORY_SCOPES],
              },
              {
                ...(options.generation === undefined
                  ? {}
                  : { generation: options.generation }),
                ...(options.imageAttachments?.length
                  ? { imageAttachments: options.imageAttachments }
                  : {}),
                ...(options.signal === undefined
                  ? {}
                  : { signal: options.signal }),
                ...(options.onDelta === undefined
                  ? {}
                  : { onDelta: options.onDelta }),
                ...(tools === undefined ? {} : { tools }),
              },
            ).finally(() => this.#persist());
            await this.#runtime.tracer.flush();
            const answer = verifiedFinalAnswer(memoryResult.completion);
            let postOutput = await turn.coordinator.process(
              {
                taskId,
                message,
                answer,
                retrievedContext:
                  memoryResult.memory.projection.projection.items,
                applicabilityScopes: [...LOCAL_MEMORY_SCOPES],
              },
              options.signal === undefined ? {} : { signal: options.signal },
            );
            if (postOutput.status === "index_repair_required") {
              postOutput = await turn.coordinator.repairAndResume(
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
        }),
      );
    } finally {
      this.#turnActive = false;
    }
  }
}

export class LocalMemoryRuntime {
  readonly preferences: RuntimePreferencesStore;
  readonly surface: DebugTraceSurface;
  readonly projectId: ProjectId;
  readonly agentId: AgentId;
  readonly sqlitePath: string;
  readonly tracer: DebugTraceObserver;
  readonly #knowledge: SqliteKnowledgeContextHandle;
  readonly #conversationStore: ProjectConversationStateStore;
  readonly #createReader: (budgets: RuntimeBudgets) => MemoryReadPort;
  readonly #committerDecorator:
    | ((committer: StagedProposalCommitter) => StagedProposalCommitter)
    | undefined;
  readonly #transport: ChatTransport;
  readonly #registry: ModelRegistry;
  readonly #identityFactory: RuntimeIdentityFactory;
  readonly sourceStoreRoot: string | undefined;
  readonly #chatGeneration: ChatGenerationOverrides;
  readonly #sourceExtractorRegistry: SourceExtractorRegistry;
  readonly #readSourceBytes: (path: string) => Uint8Array;
  #closed = false;

  constructor(options: {
    readonly surface: DebugTraceSurface;
    readonly projectId: ProjectId;
    readonly agentId: AgentId;
    readonly sqlitePath: string;
    readonly tracer: DebugTraceObserver;
    readonly knowledge: SqliteKnowledgeContextHandle;
    readonly conversationStore: ProjectConversationStateStore;
    readonly preferences: RuntimePreferencesStore;
    readonly createReader: (budgets: RuntimeBudgets) => MemoryReadPort;
    readonly committerDecorator?: (
      committer: StagedProposalCommitter,
    ) => StagedProposalCommitter;
    readonly transport: ChatTransport;
    readonly registry: ModelRegistry;
    readonly identityFactory: RuntimeIdentityFactory;
    readonly sourceStoreRoot?: string;
    readonly chatGeneration: ChatGenerationOverrides;
    readonly sourceExtractorRegistry: SourceExtractorRegistry;
    readonly readSourceBytes: (path: string) => Uint8Array;
  }) {
    this.surface = options.surface;
    this.projectId = options.projectId;
    this.agentId = options.agentId;
    this.sqlitePath = options.sqlitePath;
    this.tracer = options.tracer;
    this.#knowledge = options.knowledge;
    this.#conversationStore = options.conversationStore;
    this.preferences = options.preferences;
    this.#createReader = options.createReader;
    this.#committerDecorator = options.committerDecorator;
    this.#transport = options.transport;
    this.#registry = options.registry;
    this.#identityFactory = options.identityFactory;
    this.sourceStoreRoot = options.sourceStoreRoot;
    this.#sourceExtractorRegistry = options.sourceExtractorRegistry;
    this.#chatGeneration = options.chatGeneration;
    this.#readSourceBytes = options.readSourceBytes;
  }

  sharedMemoryCapabilities(): SharedMemoryCapabilities {
    if (this.#closed) {
      throw new ChatError("configuration", "Local memory runtime is closed.");
    }
    const durable = this.sqlitePath !== ":memory:";
    return {
      protocol: "A007_MEMORY_V1",
      version: 1,
      capabilities: [
        "recall",
        "write",
        "provenance",
        "lexical",
        "deterministic",
        "project-scoped",
        ...(durable ? ["durable"] : []),
      ],
      projectId: this.projectId,
      durable,
      // External writes are persisted as attributed evidence. They deliberately
      // do not run A008's model-backed analyzer/classifier or promote themselves
      // into accepted semantic state behind the caller's back.
      writeSemantics: "evidence",
    };
  }

  inspectMemory(query: MemoryInspectionQuery = {}): MemoryInspection {
    if (this.#closed)
      throw new ChatError("configuration", "Local memory runtime is closed.");
    return inspectKnowledge(
      this.#knowledge.context,
      { projectId: this.projectId, durable: this.sqlitePath !== ":memory:" },
      query,
    );
  }

  async recallSharedMemory(
    input: SharedMemoryRecallInput,
  ): Promise<SharedMemoryRecallResult> {
    if (this.#closed) {
      throw new ChatError("configuration", "Local memory runtime is closed.");
    }
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (query.length === 0) {
      throw new MemoryError(
        "invalid_input",
        "shared memory recall requires a non-empty query",
      );
    }
    const limit = Math.max(1, Math.min(20, Number(input.limit) || 6));
    const scopes = Array.isArray(input.scopes)
      ? input.scopes
          .filter(
            (scope): scope is string =>
              typeof scope === "string" && scope.trim().length > 0,
          )
          .map((scope) => scope.trim())
      : [...LOCAL_MEMORY_SCOPES];
    // No scope classifier is composed here. This is intentionally the free,
    // deterministic retrieval path documented by KnowledgeMemoryReader: an
    // external memory lookup must never hide a provider call or funding event.
    const reader = new KnowledgeMemoryReader({
      context: this.#knowledge.context,
      maximumProjectionBytes:
        this.preferences.current.budgets.memoryProjectionBytes,
    });
    const result = await reader.read({
      projectId: this.projectId,
      conversationId: this.#identityFactory.create("conversation"),
      taskId: this.#identityFactory.create("task"),
      agentId: this.agentId,
      message: query,
      applicabilityScopes: scopes,
    });
    const projected = result.projection.projection.items;
    return {
      items: projected.slice(0, limit).map((item) => ({
        id: item.id,
        content: item.proposition,
        kind: item.kind,
        score: item.authority,
        tags: [...item.tags],
        scope: [...item.scope],
        provenance: ["a008:memory", `a008:project:${this.projectId}`],
        metadata: {
          authority: item.authority,
          identityKind: "projection",
          projectId: this.projectId,
        },
      })),
      omitted: Math.max(0, projected.length - limit),
      measuredUnits: result.projection.measuredUnits,
      measurementUnit: result.projection.measurementUnit,
    };
  }

  writeSharedMemory(input: SharedMemoryWriteInput): SharedMemoryWriteResult {
    if (this.#closed) {
      throw new ChatError("configuration", "Local memory runtime is closed.");
    }
    const content =
      typeof input.content === "string" ? input.content.trim() : "";
    if (content.length === 0) {
      throw new MemoryError(
        "invalid_input",
        "shared memory write requires non-empty content",
      );
    }
    const scopes = Array.isArray(input.scopes)
      ? input.scopes
          .filter(
            (scope): scope is string =>
              typeof scope === "string" && scope.trim().length > 0,
          )
          .map((scope) => scope.trim())
      : [...LOCAL_MEMORY_SCOPES];
    const stored = ingest(
      {
        content,
        speaker: "agent007",
        locator: `agent007:memory:${randomUUID()}`,
        scope: { verified: true, tags: scopes },
      },
      { store: this.#knowledge.context.evidence },
    );
    const utterance = stored.utterances[0];
    if (utterance === undefined) {
      throw new MemoryError(
        "illegal_state",
        "shared memory write produced no utterance",
      );
    }
    return {
      id: utterance.id,
      artifactId: stored.artifact.id,
      status: "STORED",
      durable: this.sqlitePath !== ":memory:",
      semantics: "evidence",
    };
  }

  sessionParameters(model: string) {
    return defaultSessionParameters(
      this.#registry.require(model),
      this.#chatGeneration,
    );
  }

  listWorkspaceConversations() {
    return this.#conversationStore.list();
  }

  selectWorkspaceConversation(conversationId: string): void {
    this.#conversationStore.select(conversationId);
  }

  createWorkspaceConversation(): void {
    const model = this.#conversationStore.load()?.model ?? DEFAULT_MODEL_ID;
    this.#conversationStore.save({
      conversationId: this.#identityFactory.create("conversation"),
      model,
      messages: [],
    });
  }

  openSession(options: LocalMemorySessionOptions = {}): LocalMemorySession {
    if (this.#closed) {
      throw new ChatError("configuration", "Local memory runtime is closed.");
    }
    if (
      options.conversationSeed !== undefined &&
      options.workspaceConversation !== undefined
    ) {
      throw new ChatError(
        "configuration",
        "Conversation seeds cannot be combined with workspace conversations.",
      );
    }
    const seed =
      options.conversationSeed === undefined
        ? undefined
        : validateConversationSeed(options.conversationSeed);
    const restored =
      options.workspaceConversation === "restore"
        ? this.#conversationStore.load()
        : undefined;
    const profile = this.#registry.require(
      restored?.model ?? options.model ?? DEFAULT_MODEL_ID,
    );
    const conversationId =
      restored?.conversationId ??
      seed?.conversationId ??
      this.#identityFactory.create("conversation");
    const chatSession = new ChatSession({
      model: profile.id,
      transport: this.#transport,
      ...(options.systemMessage === undefined
        ? {}
        : { systemMessage: options.systemMessage }),
      ...(restored !== undefined
        ? { initialMessages: restored.messages }
        : seed === undefined
          ? {}
          : { initialMessages: seed.messages }),
      // Profile defaults first, operator overrides on top. The profile means
      // "checked against the model card" and is not edited to tune a run.
      generation: { ...profile.defaults, ...this.#chatGeneration },
    });
    let persistedConversationId = conversationId;
    const persistConversation =
      options.workspaceConversation === undefined
        ? undefined
        : (state: ProjectConversationState) => {
            this.#conversationStore.save(state, persistedConversationId);
            persistedConversationId = state.conversationId;
          };
    const session = new LocalMemorySession({
      runtime: this,
      conversationId,
      chat: chatSession,
      identityFactory: this.#identityFactory,
      ...(persistConversation === undefined ? {} : { persistConversation }),
    });
    if (options.workspaceConversation !== undefined && restored === undefined) {
      const previous =
        options.workspaceConversation === "fresh"
          ? this.#conversationStore.list().find((chat) => chat.current)
              ?.conversationId
          : undefined;
      this.#conversationStore.save(
        {
          conversationId,
          model: session.model,
          messages: session.messages.filter(
            (message) => message.role !== "system",
          ),
        },
        previous,
      );
    }
    return session;
  }

  /** Recompose each turn from one settings snapshot while retaining raw history. */
  createTurn(chatSession: ChatSession, conversationId: ConversationId) {
    const settings = this.preferences.current;
    const limits = settings.budgets;
    const memoryAware = new MemoryAwareChatSession({
      chat: chatSession,
      memoryReader: this.#createReader(limits),
      context: {
        projectId: this.projectId,
        conversationId,
        agentId: this.agentId,
      },
      invocationBudget: budget(
        limits.chatInputBytes,
        "Chat input (Parameters → Budgets)",
      ),
      recentMessageLimit: limits.recentMessages,
      systemInstructions: settings.instructions,
    });
    const semanticProfile = this.#registry.require(settings.semantic.model);
    const generator = new ChatTransportSemanticJsonGenerator({
      transport: this.#transport,
      model: semanticProfile.id,
      budget: budget(limits.semanticInputBytes),
      generation: semanticGeneration(
        semanticProfile.id,
        limits,
        settings.semantic.reasoningEffort,
      ),
    });
    const intakeBudget = semanticBudget(limits.stagingBytes);
    const intake = new PostOutputKnowledgeIntake({
      analyzer: new ModelBackedPostOutputKnowledgeAnalyzer(generator),
      context: {
        projectId: this.projectId,
        conversationId,
        agentId: this.agentId,
      },
      budget: intakeBudget,
      limits,
    });
    const committer = new KnowledgeEngineCommit({
      ...(this.preferences.current.memoryLifecycle === undefined
        ? {}
        : { policy: this.preferences.current.memoryLifecycle }),
      context: this.#knowledge.context,
      classifier: new ModelBackedKnowledgeRelationClassifier(generator),
    });
    const coordinator = new PostOutputMemoryCoordinator({
      stager: intake,
      committer: this.#committerDecorator?.(committer) ?? committer,
    });
    return { chat: memoryAware, coordinator };
  }

  resolveImageAttachment(locator: string): ChatImageAttachment {
    if (this.#closed)
      throw new ChatError("configuration", "Local memory runtime is closed.");
    if (this.sourceStoreRoot === undefined) {
      throw new ChatError(
        "configuration",
        "A008_SOURCE_STORE_PATH is not configured.",
      );
    }
    const resolvedPath = resolveSourceLocatorPath(
      this.sourceStoreRoot,
      locator,
    );
    const bytes = this.#readSourceBytes(resolvedPath);
    const mediaType = sniffSourceMediaType(bytes);
    const supported = new Set([IMAGE_PNG, IMAGE_JPEG, IMAGE_WEBP, IMAGE_GIF]);
    if (!supported.has(mediaType)) {
      throw new ChatError(
        "configuration",
        `Native vision attachment must be PNG, JPEG, WebP or GIF; stored source is ${mediaType}.`,
      );
    }
    return {
      mediaType,
      dataRef: `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
    };
  }

  /**
   * Ingests a source already stored under the configured store root, by
   * locator, per ADR 0020 D1/D4.
   *
   * The locator is resolved and proven to stay inside the store root before
   * a single byte is read (see {@link resolveSourceLocatorPath}). The bytes
   * are then sniffed for their real media type — the caller's `mediaType` is
   * advisory only, exactly as a declared filename is — and handed to the
   * extractor registry. Whatever `content`, `speaker`, `relation` and
   * `contentKind` the chosen extractor returns pass straight through to
   * `ingest()`; this runtime does not reinterpret them (ADR 0020 D5). The
   * original locator string, not the resolved filesystem path, is what is
   * preserved on the stored artifact, so it stays stable and re-readable
   * without leaking a machine-local path into the evidence graph.
   *
   * Wave 1 stores evidence only (ADR 0020 D7): this never calls
   * `PostOutputMemoryCoordinator`.
   */
  async ingestSource(input: SourceIngestInput): Promise<SourceIngestOutcome> {
    return this.preferences.run(() => this.#ingestSource(input));
  }

  async #ingestSource(input: SourceIngestInput): Promise<SourceIngestOutcome> {
    if (this.#closed) {
      throw new ChatError("configuration", "Local memory runtime is closed.");
    }
    if (this.sourceStoreRoot === undefined) {
      throw new ChatError(
        "configuration",
        "A008_SOURCE_STORE_PATH is not configured.",
      );
    }
    const resolvedPath = resolveSourceLocatorPath(
      this.sourceStoreRoot,
      input.locator,
    );
    const bytes = this.#readSourceBytes(resolvedPath);
    const mediaType = sniffSourceMediaType(bytes);
    const extracted = await this.#sourceExtractorRegistry.extract({
      bytes,
      mediaType,
      locator: input.locator,
      uploadedBy: SOURCE_UPLOADER_SPEAKER,
      ...(input.filename === undefined ? {} : { filename: input.filename }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const result = ingest(
      {
        content: extracted.content,
        speaker: extracted.speaker,
        relation: extracted.relation,
        ...(extracted.contentKind === undefined
          ? {}
          : { contentKind: extracted.contentKind }),
        locator: input.locator,
        scope: { verified: true },
      },
      { store: this.#knowledge.context.evidence },
    );
    const lifecycleAt = this.#knowledge.context.lifecycle.now();
    for (const utterance of result.utterances)
      this.#knowledge.context.lifecycle.attach({
        evidenceId: utterance.id,
        evidenceKind: "utterance",
        at: lifecycleAt,
        caller: "source-ingest",
      });
    const outcome: SourceIngestOutcome = {
      artifactId: result.artifact.id,
      utteranceIds: result.utterances.map((utterance) => utterance.id),
      contentKind: result.artifact.contentKind,
      relation: extracted.relation,
      speaker: extracted.speaker,
    };
    if (input.extractKnowledge !== true) {
      return outcome;
    }
    const utteranceId = result.utterances[0]?.id;
    if (utteranceId === undefined) {
      return outcome;
    }
    return {
      ...outcome,
      knowledge: await this.#extractSourceKnowledge(
        input.locator,
        extracted.content,
        utteranceId,
        input.signal,
      ),
    };
  }

  /**
   * Runs the post-output coordinator over an already-ingested source.
   *
   * A failure here degrades the ingest rather than losing it: the artifact,
   * utterance and provenance are already durably stored, and the source can be
   * re-extracted later from the same locator. That mirrors how a chat turn
   * treats a failed post-output as a degraded memory outcome and not a failed
   * turn.
   */
  async #extractSourceKnowledge(
    locator: string,
    content: string,
    utteranceId: string,
    signal: AbortSignal | undefined,
  ): Promise<SourceKnowledgeOutcome> {
    const settings = this.preferences.current;
    const limits = settings.budgets;
    const profile = this.#registry.require(settings.semantic.model);
    const generator = new ChatTransportSemanticJsonGenerator({
      transport: this.#transport,
      model: profile.id,
      budget: budget(limits.semanticInputBytes),
      generation: semanticGeneration(
        profile.id,
        limits,
        settings.semantic.reasoningEffort,
      ),
    });
    // A source is not a conversation. It gets its own conversation and task
    // identity so nothing ties an uploaded file to whichever chat was open.
    const conversationId = this.#identityFactory.create("conversation");
    const taskId = this.#identityFactory.create("task");
    const committer = new KnowledgeEngineCommit({
      ...(this.preferences.current.memoryLifecycle === undefined
        ? {}
        : { policy: this.preferences.current.memoryLifecycle }),
      context: this.#knowledge.context,
      classifier: new ModelBackedKnowledgeRelationClassifier(generator),
    });
    const coordinator = new PostOutputMemoryCoordinator({
      stager: new PostOutputKnowledgeIntake({
        analyzer: new ModelBackedPostOutputKnowledgeAnalyzer(generator),
        context: {
          projectId: this.projectId,
          conversationId,
          agentId: this.agentId,
        },
        budget: semanticBudget(limits.stagingBytes),
        limits,
      }),
      committer: this.#committerDecorator?.(committer) ?? committer,
    });

    try {
      const result = await coordinator.process(
        {
          kind: "source",
          taskId,
          locator,
          content,
          utteranceId,
          applicabilityScopes: [...LOCAL_MEMORY_SCOPES],
        },
        signal === undefined ? {} : { signal },
      );
      // The coordinator records a proposal only once it has committed, and
      // stops at the first failure, so the record count is the committed count.
      const records = "records" in result ? result.records : [];
      return { status: result.status, proposalsCommitted: records.length };
    } catch (error) {
      return {
        status: "commit_failed",
        proposalsCommitted: 0,
        error: formatRuntimeError(error),
      };
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#conversationStore.close();
    this.#knowledge.close();
    void this.tracer.close();
  }
}

export function createLocalMemoryRuntime(
  options: LocalMemoryRuntimeOptions,
): LocalMemoryRuntime {
  if (options.ownershipAlreadyHeld) return createRuntime(options);
  const config = parseLocalRuntimeConfig(options.env, {
    surface: options.surface === "acp" ? "acp" : "cli",
    ...(options.cli ? { cli: options.cli } : {}),
  });
  if (config.sqliteIsMemory) return createRuntime(options);
  const sqlitePath = canonicalStoragePath(config.sqlitePath);
  const sidecar = projectIdSidecarPath(sqlitePath);
  const releaseInitialization = acquireRuntimeLease(
    sidecar,
    "identity-initialization",
    5000,
  );
  let releaseOwnership = () => {};
  let runtime: LocalMemoryRuntime | undefined;
  try {
    const namespace =
      config.projectId ??
      (existsSync(sidecar) ? readFileSync(sidecar, "utf8").trim() : undefined);
    if (namespace)
      releaseOwnership = acquireRuntimeLease(sqlitePath, namespace);
    runtime = createRuntime({
      ...options,
      env: { ...options.env, A008_MEMORY_SQLITE_PATH: sqlitePath },
    });
    if (!namespace)
      releaseOwnership = acquireRuntimeLease(sqlitePath, runtime.projectId);
    const dispose = runtime.close.bind(runtime);
    runtime.close = () => {
      dispose();
      releaseOwnership();
    };
    return runtime;
  } catch (error) {
    try {
      runtime?.close();
    } finally {
      releaseOwnership();
    }
    throw error;
  } finally {
    releaseInitialization();
  }
}

function createRuntime(options: LocalMemoryRuntimeOptions): LocalMemoryRuntime {
  const surface = options.surface;
  const nvidiaOptions = options.env.NVIDIA_API_KEY?.trim()
    ? createNvidiaTransportOptions({ env: options.env })
    : undefined;
  const config = parseLocalRuntimeConfig(options.env, {
    surface: surface === "acp" ? "acp" : "cli",
    ...(options.cli === undefined ? {} : { cli: options.cli }),
  });
  const identityFactory =
    options.identityFactory ?? new RuntimeIdentityFactory();
  const preferences = new RuntimePreferencesStore(
    options.env,
    config.providerTimeoutMs,
  );
  if (!config.sqliteIsMemory) {
    mkdirSync(dirname(config.sqlitePath), { recursive: true });
  }
  if (config.sourceStorePath !== undefined) {
    mkdirSync(config.sourceStorePath, { recursive: true });
  }
  const projectId = resolveProjectId(config, identityFactory);
  const agentId = resolveAgentId(config, identityFactory);
  const kieKey = options.env.KIE_API_KEY?.trim() ?? "";
  const openAiKey = options.env.OPENAI_API_KEY?.trim() ?? "";
  const openRouterKey = options.env.OPENROUTER_API_KEY?.trim() ?? "";
  const groqKey = options.env.GROQ_API_KEY?.trim() ?? "";
  const geminiKey = options.env.GEMINI_API_KEY?.trim() ?? "";
  const openCodeKey = options.env.OPENCODE_API_KEY?.trim() ?? "";
  if (
    !nvidiaOptions &&
    !kieKey &&
    !openAiKey &&
    !openRouterKey &&
    !groqKey &&
    !geminiKey &&
    !openCodeKey &&
    options.createTransport === undefined &&
    config.chatTransport.mode !== "acme"
  ) {
    throw new ChatError(
      "configuration",
      "A configured API key for at least one execution provider is required for chat.",
    );
  }
  const secrets = [
    nvidiaOptions?.apiKey,
    kieKey,
    openAiKey,
    openRouterKey,
    groqKey,
    geminiKey,
    openCodeKey,
    config.chatTransport.token,
  ].filter(
    (value): value is string => typeof value === "string" && value.length >= 8,
  );
  const registry = options.registry ?? defaultModelRegistry;
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
  const makeTransport = (timeoutMs: number) => {
    if (options.createTransport !== undefined) {
      return createNvidiaChatTransport({
        env: options.env,
        timeoutMs,
        createTransport: options.createTransport,
      });
    }
    return createConfiguredChatTransport({
      env: options.env,
      catalogPath: defaultCatalogPath(options.env),
      timeoutMs,
      registry,
      acme: config.chatTransport,
      fetch: tracedFetch(
        options.fetch ?? globalThis.fetch.bind(globalThis),
        tracer,
        surface,
      ),
    });
  };
  let transportTimeout = preferences.current.budgets.providerTimeoutMs;
  let innerTransport = makeTransport(transportTimeout);
  const transport = tracedChatTransport(
    {
      complete(request, callbacks) {
        const timeout = preferences.current.budgets.providerTimeoutMs;
        if (timeout !== transportTimeout) {
          innerTransport = makeTransport(timeout);
          transportTimeout = timeout;
        }
        return innerTransport.complete(request, callbacks);
      },
    },
    tracer,
    surface,
  );
  const conversationStore = new ProjectConversationStateStore(
    config.sqlitePath,
    projectId,
  );
  const knowledge = createSqliteKnowledgeContext({
    filename: config.sqlitePath,
    projectId,
    migrateV0: true,
  });
  const scopes = new ConversationScopes();
  const createReader = (limits: RuntimeBudgets): MemoryReadPort => {
    const semanticSettings = preferences.current.semantic;
    const semanticProfile = registry.require(semanticSettings.model);
    const reader = new KnowledgeMemoryReader({
      context: knowledge.context,
      scopes,
      maximumScopeDomains: limits.maximumScopeDomains,
      maximumProjectionBytes: limits.memoryProjectionBytes,
      planner: new DeterministicRetrievalPlanner({
        maxTerms: limits.retrievalTerms,
        maxEntities: limits.retrievalEntities,
        maxRecentTurns: limits.retrievalHistoryMessages,
        maxTurnCharacters: limits.retrievalHistoryCharacters,
        maxSemanticQueries: limits.retrievalSemanticQueries,
      }),
      // Retrieval is a semantic-runtime operation. Its model is explicit in
      // Runtime Preferences and never inferred from whichever provider key
      // happens to be configured on this machine.
      scopeClassifier: new ModelBackedRetrievalScopeClassifier(
        new ChatTransportSemanticJsonGenerator({
          transport,
          model: semanticProfile.id,
          budget: budget(limits.semanticInputBytes),
          generation: semanticGeneration(
            semanticProfile.id,
            limits,
            semanticSettings.reasoningEffort,
          ),
        }),
        { maximumVocabulary: limits.retrievalVocabulary },
      ),
    });
    const baseReader = options.readerDecorator?.(reader) ?? reader;
    const tracedReader: MemoryReadPort = {
      async read(request, options) {
        const result = await baseReader.read(request, options);
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
    return tracedReader;
  };
  return new LocalMemoryRuntime({
    surface,
    projectId,
    agentId,
    sqlitePath: config.sqlitePath,
    tracer,
    knowledge,
    conversationStore,
    preferences,
    createReader,
    ...(options.committerDecorator === undefined
      ? {}
      : { committerDecorator: options.committerDecorator }),
    transport,
    registry: options.registry ?? defaultModelRegistry,
    identityFactory,
    ...(config.sourceStorePath === undefined
      ? {}
      : { sourceStoreRoot: config.sourceStorePath }),
    chatGeneration: config.chatGeneration,
    sourceExtractorRegistry:
      options.sourceExtractorRegistry ??
      new SourceExtractorRegistry([
        new Utf8TextExtractor(),
        new PdfExtractor(),
        new DocxExtractor(),
      ]),
    readSourceBytes: options.readSourceBytes ?? ((path) => readFileSync(path)),
  });
}
