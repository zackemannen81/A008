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
import type { ChatCompletion } from "../core/types.js";
import { isChatError } from "../core/errors.js";
import { IdentityError, isIdentityError } from "../identity/errors.js";
import { isMemoryError } from "../memory/errors.js";
import { isSourceIngestError } from "../ingest/index.js";
import {
  DEFAULT_MODEL_ID,
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import {
  parseRuntimeId,
  RuntimeIdentityFactory,
} from "../identity/runtime-id.js";
import { promptToText } from "./prompt-content.js";

export interface AcpTurnSession {
  send(
    content: string,
    options?: SendMessageOptions,
  ): Promise<ChatCompletion>;
  consumeMemoryDiagnostic?(): string | undefined;
}

interface AcpSessionState {
  model: string;
  chat?: AcpTurnSession;
  activeTurn?: AbortController;
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
}

export interface SourceIngestResult {
  readonly artifactId: string;
  readonly utteranceIds: readonly string[];
  readonly contentKind: string;
  readonly relation: string;
  readonly speaker: string;
}

export type IngestSource = (
  params: SourceIngestParams,
) => Promise<SourceIngestResult>;

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
  const { locator, mediaType, filename } = params as Record<string, unknown>;
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
  return {
    locator,
    ...(mediaType === undefined ? {} : { mediaType }),
    ...(filename === undefined ? {} : { filename }),
  };
}

export interface A008AcpAgentOptions {
  readonly createSession: (model: string) => AcpTurnSession;
  readonly registry?: ModelRegistry;
  readonly createSessionId?: () => string;
  readonly onMemoryDiagnostic?: (message: string) => void;
  /**
   * Backs `_a008/source/ingest`. Undefined when the host process has no
   * configured source store; the method then fails closed instead of the
   * client seeing an unrelated crash.
   */
  readonly ingestSource?: IngestSource;
}

type NotifySession = (notification: SessionNotification) => Promise<void>;

export class A008AcpAgent {
  readonly #createSession: (model: string) => AcpTurnSession;
  readonly #registry: ModelRegistry;
  readonly #createSessionId: () => string;
  readonly #onMemoryDiagnostic: ((message: string) => void) | undefined;
  readonly #ingestSource: IngestSource | undefined;
  readonly #sessions = new Map<string, AcpSessionState>();

  constructor(options: A008AcpAgentOptions) {
    this.#createSession = options.createSession;
    this.#registry = options.registry ?? defaultModelRegistry;
    this.#onMemoryDiagnostic = options.onMemoryDiagnostic;
    this.#ingestSource = options.ingestSource;
    const identityFactory = new RuntimeIdentityFactory();
    this.#createSessionId =
      options.createSessionId ??
      (() => identityFactory.create("acp_session"));
  }

  initialize(_params: InitializeRequest): InitializeResponse {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
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

  newSession(_params: NewSessionRequest): NewSessionResponse {
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
    this.#sessions.set(sessionId, { model: DEFAULT_MODEL_ID });
    return {
      sessionId,
      configOptions: this.#modelOptions(DEFAULT_MODEL_ID),
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

    const profile = this.#registry.get(params.value);
    if (profile === undefined) {
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
  ): Promise<PromptResponse> {
    const state = this.#requireSession(params.sessionId);
    if (state.activeTurn !== undefined) {
      throw new RequestError(
        -32000,
        `Session ${params.sessionId} already has an active turn.`,
      );
    }

    const content = promptToText(params.prompt);
    state.chat ??= this.#createSession(state.model);
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
      const completion = await state.chat.send(content, {
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
      const diagnostic = state.chat.consumeMemoryDiagnostic?.();
      if (diagnostic !== undefined && diagnostic.length > 0) {
        this.#onMemoryDiagnostic?.(diagnostic);
      }

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
        options: this.#registry.list().map((profile) => ({
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
