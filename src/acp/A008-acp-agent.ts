import {
  PROTOCOL_VERSION,
  RequestError,
  type AgentContext,
  type CancelNotification,
  type CloseSessionRequest,
  type CloseSessionResponse,
  type InitializeRequest,
  type InitializeResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type SessionConfigOption,
  type SessionNotification,
  type SetSessionConfigOptionRequest,
  type SetSessionConfigOptionResponse,
} from "@agentclientprotocol/sdk";
import type { SendMessageOptions } from "../core/chat-session.js";
import type { GeneratedImageTerminalUpdate } from "../core/chat-content.js";
import type { ChatCompletion, ChatImageAttachment } from "../core/types.js";
import type { ChatMessage } from "../core/types.js";
import {
  defaultSessionParameters,
  parseSessionParameters,
  type SessionParameters,
} from "../core/generation-controls.js";
import {
  parseSessionControl,
  type SessionSnapshot,
} from "../core/session-control.js";
import { isChatError } from "../core/errors.js";
import { IdentityError, isIdentityError } from "../identity/errors.js";
import { isMemoryError } from "../memory/errors.js";
import {
  parseMemoryInspectionQuery,
  type MemoryInspection,
  type MemoryInspectionQuery,
} from "../memory/knowledge/inspection.js";
import { isSourceIngestError } from "../ingest/index.js";
import {
  DEFAULT_MODEL_ID,
  acceptsModality,
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import type { ModelProfile } from "../core/types.js";
import {
  defaultCatalogPath,
  loadUserCatalog,
  userModelProfile,
} from "../core/user-catalog.js";
import {
  parseRuntimeId,
  RuntimeIdentityFactory,
} from "../identity/runtime-id.js";
import {
  validateConversationSeed,
  type ConversationSeed,
} from "../runtime/local-memory-runtime.js";
import { promptToTurnInput } from "./prompt-content.js";

export interface AcpTurnSession {
  readonly model?: string;
  readonly runtimePreferences?: import("../core/runtime-preferences.js").RuntimePreferencesSnapshot;
  configureRuntimePreferences?(value: unknown, revision: string): void;
  readonly messages?: readonly ChatMessage[];
  readonly parameters?: SessionParameters;
  reset?(): void;
  undoLastTurn?(): boolean;
  configureParameters?(value: unknown): void;
  enableSessionControls?(): void;
  reserveGeneratedImage?(generationId: string, prompt: string): void;
  resolveGeneratedImage?(
    generationId: string,
    update: GeneratedImageTerminalUpdate,
  ): boolean;
  send(content: string, options?: SendMessageOptions): Promise<ChatCompletion>;
  consumeMemoryDiagnostic?(): string | undefined;
  consumeMemoryStatus?(): string | undefined;
}

interface AcpSessionState {
  model: string;
  workspaceConversation: boolean;
  conversationSeed?: ConversationSeed;
  chat?: AcpTurnSession;
  activeTurn?: AbortController;
}

export interface AcpNewSessionOptions {
  readonly initialModel?: string;
  readonly workspaceConversation?: boolean;
  /** Trusted EngineHost composition only; ACP request payloads cannot set this. */
  readonly conversationSeed?: ConversationSeed;
}

export interface AcpCreateSessionOptions {
  readonly workspaceConversation?: "restore" | "fresh";
  readonly conversationSeed?: ConversationSeed;
}

/**
 * Params for the `_a008/source/ingest` custom method (ADR 0020 D4).
 *
 * `mediaType` and `filename` are advisory only, exactly as they are on
 * `LocalMemoryRuntime.ingestSource`: the runtime always sniffs the real media
 * type from the stored bytes rather than trusting a caller-declared value.
 */
export interface SourceIngestParams {
  readonly locator: string;
  readonly mediaType?: string;
  readonly filename?: string;
  /** Opt in to running the knowledge coordinator; off by default. */
  readonly extractKnowledge?: boolean;
}

export interface SourceIngestResult {
  readonly artifactId: string;
  readonly utteranceIds: readonly string[];
  readonly contentKind: string;
  readonly relation: string;
  readonly speaker: string;
  /** Absent unless `extractKnowledge` was requested. */
  readonly knowledge?: {
    readonly status: string;
    readonly proposalsCommitted: number;
    readonly error?: string;
  };
}

export type IngestSource = (
  params: SourceIngestParams,
) => Promise<SourceIngestResult>;

export interface SharedMemoryCapabilitiesParams {
  readonly protocol: "A007_MEMORY_V1";
  readonly version: 1;
}

export interface SharedMemoryCapabilitiesResult {
  readonly protocol: "A007_MEMORY_V1";
  readonly version: 1;
  readonly capabilities: readonly string[];
  readonly projectId: string;
  readonly durable: boolean;
  readonly writeSemantics: "evidence";
}

export interface SharedMemoryRecallParams {
  readonly query: string;
  readonly limit?: number;
  readonly scopes?: readonly string[];
}

export interface SharedMemoryRecallResult {
  readonly items: readonly {
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
      readonly projectId: string;
    };
  }[];
  readonly omitted: number;
  readonly measuredUnits: number;
  readonly measurementUnit: string;
}

export interface SharedMemoryWriteParams {
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

export type GetSharedMemoryCapabilities = () =>
  SharedMemoryCapabilitiesResult | Promise<SharedMemoryCapabilitiesResult>;
export type RecallSharedMemory = (
  params: SharedMemoryRecallParams,
) => Promise<SharedMemoryRecallResult>;
export type WriteSharedMemory = (
  params: SharedMemoryWriteParams,
) => SharedMemoryWriteResult | Promise<SharedMemoryWriteResult>;

/**
 * Validates raw JSON-RPC params for `_a008/source/ingest`.
 *
 * Used both as this agent's own defensive check and as the SDK's
 * `ParamsParser` when the method is registered in `server.ts` — the same
 * `onRequest(method, params, handler)` overload `session/close` would use if
 * it were a custom method instead of a standard one.
 */
export function parseSourceIngestParams(params: unknown): SourceIngestParams {
  if (typeof params !== "object" || params === null) {
    throw RequestError.invalidParams(
      params,
      "_a008/source/ingest requires an object with a locator.",
    );
  }
  const { locator, mediaType, filename, extractKnowledge } = params as Record<
    string,
    unknown
  >;
  if (typeof locator !== "string" || locator.trim().length === 0) {
    throw RequestError.invalidParams(
      params,
      "_a008/source/ingest requires a non-empty string locator.",
    );
  }
  if (mediaType !== undefined && typeof mediaType !== "string") {
    throw RequestError.invalidParams(
      params,
      "_a008/source/ingest mediaType must be a string when present.",
    );
  }
  if (filename !== undefined && typeof filename !== "string") {
    throw RequestError.invalidParams(
      params,
      "_a008/source/ingest filename must be a string when present.",
    );
  }
  if (extractKnowledge !== undefined && typeof extractKnowledge !== "boolean") {
    throw RequestError.invalidParams(
      params,
      "_a008/source/ingest extractKnowledge must be a boolean when present.",
    );
  }
  return {
    locator,
    ...(mediaType === undefined ? {} : { mediaType }),
    ...(filename === undefined ? {} : { filename }),
    ...(extractKnowledge === undefined ? {} : { extractKnowledge }),
  };
}

function parseScopes(
  value: unknown,
  params: unknown,
  method: string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    )
  ) {
    throw RequestError.invalidParams(
      params,
      `${method} scopes must be an array of non-empty strings when present.`,
    );
  }
  return value.map((entry) => entry.trim());
}

export function parseSharedMemoryCapabilitiesParams(
  params: unknown,
): SharedMemoryCapabilitiesParams {
  if (typeof params !== "object" || params === null) {
    throw RequestError.invalidParams(
      params,
      "memory/capabilities requires an A007_MEMORY_V1 handshake object.",
    );
  }
  const { protocol, version } = params as Record<string, unknown>;
  if (protocol !== "A007_MEMORY_V1" || version !== 1) {
    throw RequestError.invalidParams(
      params,
      "memory/capabilities supports only A007_MEMORY_V1 version 1.",
    );
  }
  return { protocol, version };
}

export function parseSharedMemoryRecallParams(
  params: unknown,
): SharedMemoryRecallParams {
  if (typeof params !== "object" || params === null) {
    throw RequestError.invalidParams(
      params,
      "memory/recall requires an object with a query.",
    );
  }
  const { query, limit, scopes } = params as Record<string, unknown>;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw RequestError.invalidParams(
      params,
      "memory/recall requires a non-empty query string.",
    );
  }
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 20)
  ) {
    throw RequestError.invalidParams(
      params,
      "memory/recall limit must be an integer from 1 to 20.",
    );
  }
  const parsedScopes = parseScopes(scopes, params, "memory/recall");
  return {
    query: query.trim(),
    ...(limit === undefined ? {} : { limit: Number(limit) }),
    ...(parsedScopes === undefined ? {} : { scopes: parsedScopes }),
  };
}

export function parseSharedMemoryWriteParams(
  params: unknown,
): SharedMemoryWriteParams {
  if (typeof params !== "object" || params === null) {
    throw RequestError.invalidParams(
      params,
      "memory/write requires an object with content.",
    );
  }
  const { content, scopes } = params as Record<string, unknown>;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw RequestError.invalidParams(
      params,
      "memory/write requires non-empty content.",
    );
  }
  const parsedScopes = parseScopes(scopes, params, "memory/write");
  return {
    content: content.trim(),
    ...(parsedScopes === undefined ? {} : { scopes: parsedScopes }),
  };
}

export interface A008AcpAgentOptions {
  /** Set only when the composition registers _a008/session/control. */
  readonly sessionControls?: boolean;
  readonly runtimeInfo?: () => SessionSnapshot["runtime"];
  readonly createSession: (
    model: string,
    options?: AcpCreateSessionOptions,
  ) => AcpTurnSession;
  /** Resolve a validated source locator into transient provider-ready image input. */
  readonly resolveImageAttachment?: (locator: string) => ChatImageAttachment;
  readonly registry?: ModelRegistry;
  /** Extra chat models from the user catalog. Reloaded on each resolve. */
  readonly extraProfiles?: () => readonly ModelProfile[];
  readonly createSessionId?: () => string;
  readonly onMemoryDiagnostic?: (message: string) => void;
  /**
   * Backs `_a008/source/ingest`. Undefined when the host process has no
   * configured source store; the method then fails closed instead of the
   * client seeing an unrelated crash.
   */
  readonly ingestSource?: IngestSource;
  readonly sharedMemoryCapabilities?: GetSharedMemoryCapabilities;
  readonly inspectMemory?: (
    query: MemoryInspectionQuery,
  ) => MemoryInspection | Promise<MemoryInspection>;
  readonly recallSharedMemory?: RecallSharedMemory;
  readonly writeSharedMemory?: WriteSharedMemory;
}

type NotifySession = (notification: SessionNotification) => Promise<void>;

export class A008AcpAgent {
  readonly #sessionControls: boolean;
  readonly #runtimeInfo: () => SessionSnapshot["runtime"];
  readonly #createSession: (
    model: string,
    options?: AcpCreateSessionOptions,
  ) => AcpTurnSession;
  readonly #resolveImageAttachment: A008AcpAgentOptions["resolveImageAttachment"];
  readonly #registry: ModelRegistry;
  readonly #extraProfiles: () => readonly ModelProfile[];
  readonly #createSessionId: () => string;
  readonly #onMemoryDiagnostic: ((message: string) => void) | undefined;
  readonly #ingestSource: IngestSource | undefined;
  readonly #sharedMemoryCapabilities: GetSharedMemoryCapabilities | undefined;
  readonly #inspectMemory: A008AcpAgentOptions["inspectMemory"];
  readonly #recallSharedMemory: RecallSharedMemory | undefined;
  readonly #writeSharedMemory: WriteSharedMemory | undefined;
  readonly #sessions = new Map<string, AcpSessionState>();

  constructor(options: A008AcpAgentOptions) {
    this.#sessionControls = options.sessionControls === true;
    this.#runtimeInfo =
      options.runtimeInfo ??
      (() => ({ cwd: process.cwd(), projectId: null, memoryPath: null }));
    this.#createSession = options.createSession;
    this.#resolveImageAttachment = options.resolveImageAttachment;
    this.#registry = options.registry ?? defaultModelRegistry;
    this.#extraProfiles =
      options.extraProfiles ??
      (() => {
        try {
          return loadUserCatalog(defaultCatalogPath()).chatModels.map(
            userModelProfile,
          );
        } catch {
          return [];
        }
      });
    this.#onMemoryDiagnostic = options.onMemoryDiagnostic;
    this.#ingestSource = options.ingestSource;
    this.#sharedMemoryCapabilities = options.sharedMemoryCapabilities;
    this.#inspectMemory = options.inspectMemory;
    this.#recallSharedMemory = options.recallSharedMemory;
    this.#writeSharedMemory = options.writeSharedMemory;
    const identityFactory = new RuntimeIdentityFactory();
    this.#createSessionId =
      options.createSessionId ?? (() => identityFactory.create("acp_session"));
  }

  initialize(_params: InitializeRequest): InitializeResponse {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        ...(this.#sessionControls
          ? { _meta: { "a008.sessionControl": 1 } }
          : {}),
        loadSession: false,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        },
        // `session/close` is the only session-lifecycle method A008 implements.
        // An empty object is how ACP v1 advertises support; a client that never
        // calls the method sees no other change to this response.
        sessionCapabilities: {
          close: {},
        },
      },
      agentInfo: {
        name: "A008",
        title: "A008 shared chat",
        version: "0.0.0",
      },
    };
  }

  newSession(
    _params: NewSessionRequest,
    options: AcpNewSessionOptions = {},
  ): NewSessionResponse {
    if (
      options.workspaceConversation === true &&
      options.conversationSeed !== undefined
    ) {
      throw RequestError.invalidParams(
        {},
        "Conversation seeds cannot be combined with workspace conversations.",
      );
    }
    let sessionId: string;
    try {
      sessionId = parseRuntimeId(this.#createSessionId(), "acp_session");
    } catch (error) {
      if (error instanceof IdentityError) {
        throw RequestError.invalidParams(
          {},
          `A008 generated an invalid ACP session identity: ${error.message}`,
        );
      }
      throw error;
    }
    if (this.#sessions.has(sessionId)) {
      throw RequestError.invalidParams(
        { sessionId },
        "A008 generated a duplicate ACP session identity.",
      );
    }
    const model =
      options.initialModel === undefined
        ? DEFAULT_MODEL_ID
        : this.#resolveProfile(options.initialModel).id;
    const conversationSeed =
      options.conversationSeed === undefined
        ? undefined
        : validateConversationSeed(options.conversationSeed);
    this.#sessions.set(sessionId, {
      model,
      workspaceConversation: options.workspaceConversation === true,
      ...(conversationSeed === undefined
        ? {}
        : { conversationSeed }),
    });
    return {
      sessionId,
      configOptions: this.#modelOptions(model),
    };
  }

  setSessionConfigOption(
    params: SetSessionConfigOptionRequest,
  ): SetSessionConfigOptionResponse {
    const state = this.#requireSession(params.sessionId);
    if (params.configId !== "model" || "type" in params) {
      throw RequestError.invalidParams(
        { configId: params.configId },
        "A008 supports only the model select option.",
      );
    }

    let profile;
    try {
      profile = this.#resolveProfile(params.value);
    } catch {
      throw RequestError.invalidParams(
        { model: params.value },
        `Unknown A008 model: ${params.value}`,
      );
    }
    if (state.chat !== undefined && state.model !== profile.id) {
      throw RequestError.invalidParams(
        { model: params.value },
        "Runtime model switching is not supported by this A008 slice.",
      );
    }

    state.model = profile.id;
    return { configOptions: this.#modelOptions(state.model) };
  }

  async prompt(
    params: PromptRequest,
    notify: NotifySession,
    prepareTools?: (
      signal: AbortSignal,
      budgets: import("../core/runtime-preferences.js").RuntimeBudgets,
    ) => Promise<import("../core/types.js").ChatTools>,
  ): Promise<PromptResponse> {
    const state = this.#requireSession(params.sessionId);
    if (state.activeTurn !== undefined) {
      throw new RequestError(
        -32000,
        `Session ${params.sessionId} already has an active turn.`,
      );
    }

    const input = promptToTurnInput(params.prompt);
    const restoredWorkspaceChat = state.workspaceConversation
      ? this.#ensureChat(state)
      : undefined;
    let imageAttachment: ChatImageAttachment | undefined;
    if (input.image !== undefined) {
      const profile = this.#resolveProfile(state.model);
      if (!acceptsModality(profile, "image")) {
        throw RequestError.invalidParams(
          { model: state.model, modality: "image" },
          `Model ${state.model} does not declare image input support.`,
        );
      }
      if (this.#resolveImageAttachment === undefined) {
        throw RequestError.invalidParams(
          undefined,
          "Native vision requires the configured A008 source store.",
        );
      }
      imageAttachment = this.#resolveImageAttachment(input.image.locator);
    }
    const chat = restoredWorkspaceChat ?? this.#ensureChat(state);
    const content = input.text;
    const controller = new AbortController();
    state.activeTurn = controller;
    let pendingNotifications = Promise.resolve();
    let streamedContent = "";
    let streamedReasoning = "";

    const queueDelta = (type: "content" | "reasoning", text: string): void => {
      if (type === "content") {
        streamedContent += text;
      } else {
        streamedReasoning += text;
      }
      const sessionUpdate =
        type === "content" ? "agent_message_chunk" : "agent_thought_chunk";
      pendingNotifications = pendingNotifications.then(() =>
        notify({
          sessionId: params.sessionId,
          update: {
            sessionUpdate,
            content: { type: "text", text },
          },
        }),
      );
    };

    try {
      const completion = await chat.send(content, {
        ...(imageAttachment === undefined
          ? {}
          : { imageAttachments: [imageAttachment] }),
        ...(prepareTools ? { prepareTools } : {}),
        signal: controller.signal,
        onDelta: (delta) => queueDelta(delta.type, delta.text),
      });

      const remainingReasoning = remainingText(
        streamedReasoning,
        completion.reasoning ?? "",
      );
      if (remainingReasoning.length > 0) {
        queueDelta("reasoning", remainingReasoning);
      }
      const remainingContent = remainingText(
        streamedContent,
        completion.message.content,
      );
      if (remainingContent.length > 0) {
        queueDelta("content", remainingContent);
      }
      await pendingNotifications;
      const diagnostic = chat.consumeMemoryDiagnostic?.();
      if (diagnostic !== undefined && diagnostic.length > 0) {
        this.#onMemoryDiagnostic?.(diagnostic);
      }
      const memoryStatus = chat.consumeMemoryStatus?.() ?? "unreported";

      return {
        stopReason:
          completion.finishReason === "length" ? "max_tokens" : "end_turn",
        ...(completion.usage === undefined
          ? {}
          : {
              usage: {
                inputTokens: completion.usage.promptTokens ?? 0,
                outputTokens: completion.usage.completionTokens ?? 0,
                totalTokens:
                  completion.usage.totalTokens ??
                  (completion.usage.promptTokens ?? 0) +
                    (completion.usage.completionTokens ?? 0),
              },
            }),
        _meta: { "a008.memoryStatus": memoryStatus },
      };
    } catch (error) {
      await pendingNotifications;
      if (
        controller.signal.aborted ||
        (isChatError(error) && error.code === "cancelled")
      ) {
        return { stopReason: "cancelled" };
      }
      if (isMemoryError(error) || isIdentityError(error)) {
        throw new RequestError(-32000, `${error.code}: ${error.message}`);
      }
      throw error;
    } finally {
      if (state.activeTurn === controller) {
        delete state.activeTurn;
      }
    }
  }

  reserveGeneratedImage(
    sessionId: string,
    generationId: string,
    prompt: string,
  ): SessionSnapshot {
    const state = this.#requireSession(sessionId);
    const chat = this.#ensureChat(state);
    if (chat.reserveGeneratedImage === undefined) {
      throw RequestError.methodNotFound("generated image transcript");
    }
    chat.reserveGeneratedImage(generationId, prompt);
    return this.#sessionSnapshot(state);
  }

  resolveGeneratedImage(
    sessionId: string,
    generationId: string,
    update: GeneratedImageTerminalUpdate,
  ): SessionSnapshot {
    const state = this.#requireSession(sessionId);
    if (state.chat?.resolveGeneratedImage === undefined) {
      throw RequestError.methodNotFound("generated image transcript");
    }
    state.chat.resolveGeneratedImage(generationId, update);
    return this.#sessionSnapshot(state);
  }

  controlSession(params: unknown): SessionSnapshot {
    if (
      typeof params !== "object" ||
      params === null ||
      !("sessionId" in params) ||
      typeof params.sessionId !== "string"
    ) {
      throw RequestError.invalidParams(
        params,
        "Session control requires sessionId.",
      );
    }
    const control = parseSessionControl(params);
    const state = this.#requireSession(params.sessionId);
    if (control.action === "close") {
      const snapshot = this.#sessionSnapshot(state);
      this.closeSession({ sessionId: params.sessionId });
      return { ...snapshot, closed: true };
    }
    if (state.activeTurn !== undefined && control.action !== "inspect")
      throw new RequestError(-32000, "Session already has an active turn.");
    if (control.action === "model") {
      const profile = this.#resolveProfile(control.model);
      // Construct first: configuration failure must preserve the old conversation.
      const chat = this.#createSession(
        profile.id,
        state.workspaceConversation
          ? { workspaceConversation: "fresh" }
          : undefined,
      );
      chat.enableSessionControls?.();
      state.model = chat.model ?? profile.id;
      state.chat = chat;
    }
    const chat = this.#ensureChat(state);
    if (control.action === "configure") {
      const parsed = parseSessionParameters(control.parameters, state.model);
      if (chat.configureParameters === undefined)
        throw RequestError.methodNotFound("session parameters");
      chat.configureParameters(parsed);
    }
    if (control.action === "configureRuntime") {
      if (chat.configureRuntimePreferences === undefined)
        throw RequestError.methodNotFound("runtime settings");
      chat.configureRuntimePreferences(
        control.settings,
        control.revision,
      );
    }
    if (control.action === "reset") {
      if (chat.reset === undefined)
        throw RequestError.methodNotFound("session reset");
      chat.reset();
    }
    let undone: boolean | undefined;
    if (control.action === "undo") {
      if (chat.undoLastTurn === undefined)
        throw RequestError.methodNotFound("session undo");
      undone = chat.undoLastTurn();
    }
    return {
      ...this.#sessionSnapshot(state),
      ...(undone === undefined ? {} : { undone }),
    };
  }

  #ensureChat(state: AcpSessionState): AcpTurnSession {
    if (state.chat === undefined) {
      state.chat = this.#createSession(
        state.model,
        state.workspaceConversation
          ? { workspaceConversation: "restore" }
          : state.conversationSeed === undefined
            ? undefined
            : { conversationSeed: state.conversationSeed },
      );
      state.chat.enableSessionControls?.();
      state.model = state.chat.model ?? state.model;
    }
    return state.chat;
  }

  #sessionSnapshot(state: AcpSessionState): SessionSnapshot {
    const runtimePreferences = state.chat?.runtimePreferences;
    return {
      ...(runtimePreferences === undefined ? {} : { runtimePreferences }),
      model: state.model,
      parameters:
        state.chat?.parameters ??
        defaultSessionParameters(this.#resolveProfile(state.model)),
      messages: (state.chat?.messages ?? []).flatMap((message) =>
        message.role === "system"
          ? []
          : [{ role: message.role, content: message.content }],
      ),
      runtime: this.#runtimeInfo(),
    };
  }

  #listedProfiles(): ModelProfile[] {
    const extras = this.#extraProfiles();
    const seen = new Set(this.#registry.list().map((profile) => profile.id));
    return [
      ...this.#registry.list(),
      ...extras.filter((profile) => !seen.has(profile.id)),
    ];
  }

  #resolveProfile(id: string): ModelProfile {
    return (
      this.#registry.get(id) ??
      this.#extraProfiles().find((profile) => profile.id === id) ??
      this.#registry.require(id)
    );
  }

  cancel(params: CancelNotification): void {
    this.#sessions.get(params.sessionId)?.activeTurn?.abort();
  }

  /**
   * ACP `session/close`. The client is done with a session it created, so any
   * active turn is aborted exactly as `session/cancel` would and every
   * process-local trace of the session is dropped.
   *
   * Closing a session A008 does not hold fails closed with the same typed
   * `invalid params` error every other session-scoped method here uses, so a
   * double close or a stale identity is observable instead of silently
   * succeeding.
   */
  closeSession(params: CloseSessionRequest): CloseSessionResponse {
    const state = this.#requireSession(params.sessionId);
    state.activeTurn?.abort();
    this.#sessions.delete(params.sessionId);
    return {};
  }

  /**
   * Session identities this agent still holds. Released sessions disappear
   * from it, which makes leaked session state directly observable instead of
   * something a test has to infer from a later failure.
   */
  openSessionIds(): readonly string[] {
    return [...this.#sessions.keys()];
  }

  sessionConfigOptions(sessionId: string) {
    return this.#modelOptions(this.#requireSession(sessionId).model);
  }

  /**
   * ACP `_a008/source/ingest` (ADR 0020 D4).
   *
   * Deliberately session-free: an upload is not part of a conversation, and
   * requiring a session would tie a stored source to whichever chat happened
   * to be open. The params are re-validated here rather than trusted from the
   * transport parser, so a caller reaching this agent through any path gets
   * the same check.
   *
   * A host that composed no runtime — every ACP client except the GUI host —
   * gets a method-not-found style refusal rather than a silent success.
   */
  async ingestSource(params: unknown): Promise<SourceIngestResult> {
    const ingest = this.#ingestSource;
    if (ingest === undefined) {
      throw RequestError.methodNotFound("_a008/source/ingest");
    }
    return await ingest(parseSourceIngestParams(params));
  }

  async sharedMemoryCapabilities(
    params: unknown,
  ): Promise<SharedMemoryCapabilitiesResult> {
    parseSharedMemoryCapabilitiesParams(params);
    if (this.#sharedMemoryCapabilities === undefined) {
      throw RequestError.methodNotFound("memory/capabilities");
    }
    return await this.#sharedMemoryCapabilities();
  }

  async inspectMemory(params: unknown): Promise<MemoryInspection> {
    let query: MemoryInspectionQuery;
    try {
      query = parseMemoryInspectionQuery(params);
    } catch (error) {
      throw RequestError.invalidParams(
        params,
        error instanceof Error ? error.message : "Invalid memory query.",
      );
    }
    if (this.#inspectMemory === undefined)
      throw RequestError.methodNotFound("memory/inspect");
    return await this.#inspectMemory(query);
  }

  async recallMemory(params: unknown): Promise<SharedMemoryRecallResult> {
    const recall = this.#recallSharedMemory;
    if (recall === undefined)
      throw RequestError.methodNotFound("memory/recall");
    return await recall(parseSharedMemoryRecallParams(params));
  }

  async writeMemory(params: unknown): Promise<SharedMemoryWriteResult> {
    const write = this.#writeSharedMemory;
    if (write === undefined) throw RequestError.methodNotFound("memory/write");
    return await write(parseSharedMemoryWriteParams(params));
  }

  #requireSession(sessionId: string): AcpSessionState {
    const state = this.#sessions.get(sessionId);
    if (state === undefined) {
      throw RequestError.invalidParams(
        { sessionId },
        `Unknown A008 ACP session: ${sessionId}`,
      );
    }
    return state;
  }

  #modelOptions(currentValue: string): SessionConfigOption[] {
    return [
      {
        type: "select",
        id: "model",
        name: "Model",
        description: "Provider model used by the shared A008 chat core.",
        category: "model",
        currentValue,
        options: this.#listedProfiles().map((profile) => ({
          value: profile.id,
          name: profile.name,
        })),
      },
    ];
  }
}

function remainingText(streamed: string, completed: string): string {
  if (streamed.length === 0) {
    return completed;
  }
  return completed.startsWith(streamed) ? completed.slice(streamed.length) : "";
}

export function sessionNotifier(context: AgentContext): NotifySession {
  return (notification) => context.notify("session/update", notification);
}
