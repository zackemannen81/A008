import { randomUUID } from "node:crypto";
import { ChatError, isChatError } from "../../core/errors.js";
import { loadUserCatalog, type UserCatalog } from "../../core/user-catalog.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatTransport,
} from "../../core/types.js";
import {
  ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_MAX_STREAM_EVENT_BYTES,
  ACME_MODEL_RUNTIME_PROTOCOL,
  ACME_TASK_EXECUTE_PATH,
  AcmeChatError,
  acmeRuntimeUrl,
  buildAcmeExecuteBody,
  chatErrorFromAcmeFailure,
  chatErrorFromRefusal,
  completionFromAcmeResponse,
  parseAcmeDescriptor,
  parseRefusalEnvelope,
  type AcmeModelRuntimeDescriptor,
} from "./acme-model-runtime.js";
import { parseAcmeSseEvents } from "./acme-sse.js";

export type AcmeFetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface AcmeChatTransportOptions {
  readonly baseUrl: string;
  readonly token?: string;
  readonly engineBuild?: string;
  readonly fetch?: AcmeFetchLike;
  readonly timeoutMs?: number;
  readonly requestKey?: () => string;
  readonly correlationId?: () => string | undefined;
  readonly catalogPath?: string;
  readonly catalog?: UserCatalog;
}

function isAbortError(value: unknown): boolean {
  return (
    (value instanceof DOMException && value.name === "AbortError") ||
    (typeof value === "object" &&
      value !== null &&
      "name" in value &&
      value.name === "AbortError")
  );
}

function protocolHeaders(
  accept: string,
  token: string | undefined,
): Record<string, string> {
  return {
    accept,
    [ACME_MODEL_RUNTIME_HEADER]: ACME_MODEL_RUNTIME_PROTOCOL,
    ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class AcmeChatTransport implements ChatTransport {
  readonly #baseUrl: string;
  readonly #token: string | undefined;
  readonly #engineBuild: string | undefined;
  readonly #fetch: AcmeFetchLike;
  readonly #timeoutMs: number;
  readonly #requestKey: () => string;
  readonly #correlationId: (() => string | undefined) | undefined;
  readonly #catalog: UserCatalog | undefined;

  constructor(options: AcmeChatTransportOptions) {
    const baseUrl = options.baseUrl.trim();
    if (baseUrl.length === 0) {
      throw new ChatError(
        "configuration",
        "A008_ACME_MODEL_RUNTIME_URL is required for ACME chat.",
      );
    }
    this.#baseUrl = baseUrl.replace(/\/+$/u, "");
    const token = options.token?.trim();
    this.#token = token === undefined || token.length === 0 ? undefined : token;
    const engineBuild = options.engineBuild?.trim();
    this.#engineBuild =
      engineBuild === undefined || engineBuild.length === 0
        ? undefined
        : engineBuild;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 180_000;
    this.#requestKey = options.requestKey ?? randomUUID;
    this.#correlationId = options.correlationId;
    this.#catalog =
      options.catalog ??
      (options.catalogPath === undefined
        ? undefined
        : loadUserCatalog(options.catalogPath));
  }

  async complete(
    request: ChatRequest,
    callbacks: ChatCallbacks = {},
  ): Promise<ChatCompletion> {
    const controller = new AbortController();
    let timedOut = false;
    let dispatched = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const cancel = (): void => controller.abort();
    if (request.signal?.aborted) {
      controller.abort();
    } else {
      request.signal?.addEventListener("abort", cancel, { once: true });
    }

    try {
      await this.#requireCompatible(controller.signal);
      const correlationId = this.#correlationId?.();
      const body = buildAcmeExecuteBody(request, {
        requestKey: this.#requestKey(),
        timeoutMs: this.#timeoutMs,
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(this.#catalog === undefined ? {} : { catalog: this.#catalog }),
      });
      const encoded = JSON.stringify(body);
      dispatched = true;
      const response = await this.#fetch(
        acmeRuntimeUrl(this.#baseUrl, ACME_MODEL_RUNTIME_EXECUTE_PATH),
        {
          method: "POST",
          headers: {
            ...protocolHeaders("text/event-stream", this.#token),
            "content-type": "application/json",
          },
          body: encoded,
          signal: controller.signal,
        },
      );
      this.#assertNotTaskRuntime(
        response.url || ACME_MODEL_RUNTIME_EXECUTE_PATH,
      );
      if (!response.ok) {
        throw await this.#refusal(response);
      }
      const protocolHeader = response.headers.get(ACME_MODEL_RUNTIME_HEADER);
      if (protocolHeader !== ACME_MODEL_RUNTIME_PROTOCOL) {
        throw new AcmeChatError(
          "configuration",
          `ACME execute response protocol is ${protocolHeader ?? "missing"}.`,
          {
            evidence: {
              protocolCode: "MODEL_RUNTIME_PROTOCOL_MISMATCH",
              delivery: "unknown",
            },
          },
        );
      }
      const mediaType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim();
      if (mediaType !== "text/event-stream") {
        throw await this.#refusal(response);
      }
      return await this.#readStream(
        response,
        callbacks,
        request.options?.stream !== false,
      );
    } catch (cause) {
      if (isChatError(cause)) {
        throw cause;
      }
      if (timedOut) {
        throw new AcmeChatError("timeout", "ACME model execution timed out.", {
          retryable: !dispatched,
          cause,
          evidence: {
            diagnosticKind: dispatched ? "timeout" : "timeout",
            delivery: dispatched ? "unknown" : "not-sent",
          },
        });
      }
      if (request.signal?.aborted || isAbortError(cause)) {
        throw new AcmeChatError(
          "cancelled",
          "ACME model execution was cancelled.",
          {
            cause,
            evidence: {
              diagnosticKind: "cancelled",
              delivery: dispatched ? "unknown" : "not-sent",
            },
          },
        );
      }
      throw new AcmeChatError(
        "network",
        "ACME model runtime network request failed.",
        {
          retryable: !dispatched,
          cause,
          evidence: {
            diagnosticKind: dispatched ? "ambiguous-delivery" : "unavailable",
            delivery: dispatched ? "unknown" : "not-sent",
          },
        },
      );
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
    }
  }

  async #requireCompatible(
    signal: AbortSignal,
  ): Promise<AcmeModelRuntimeDescriptor> {
    const response = await this.#fetch(
      acmeRuntimeUrl(this.#baseUrl, ACME_MODEL_RUNTIME_COMPATIBILITY_PATH),
      {
        method: "GET",
        headers: protocolHeaders("application/json", this.#token),
        signal,
      },
    );
    this.#assertNotTaskRuntime(
      response.url || ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
    );
    if (!response.ok) {
      throw await this.#refusal(response);
    }
    const descriptor = parseAcmeDescriptor(await this.#json(response));
    if (
      this.#engineBuild !== undefined &&
      descriptor.engineBuild !== this.#engineBuild
    ) {
      throw new AcmeChatError(
        "configuration",
        `ACME engineBuild is ${descriptor.engineBuild}, pinned ${this.#engineBuild}.`,
        {
          evidence: {
            protocolCode: "MODEL_RUNTIME_PROTOCOL_MISMATCH",
            delivery: "not-sent",
          },
        },
      );
    }
    return descriptor;
  }

  async #readStream(
    response: Response,
    callbacks: ChatCallbacks,
    emitDeltas: boolean,
  ): Promise<ChatCompletion> {
    if (response.body === null) {
      throw new AcmeChatError(
        "invalid_response",
        "ACME streaming response had no body.",
        {
          evidence: { diagnosticKind: "truncated-stream", delivery: "unknown" },
        },
      );
    }
    let expectedSequence = 0;
    let sawTerminal = false;
    let completion: ChatCompletion | undefined;
    let sawToolDelta = false;
    let reasoning = "";
    for await (const event of parseAcmeSseEvents(response.body)) {
      if (event.data.length > ACME_MODEL_RUNTIME_MAX_STREAM_EVENT_BYTES) {
        throw new AcmeChatError(
          "invalid_response",
          "ACME stream event exceeded the 64 KiB bound.",
          {
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch (cause) {
        throw new AcmeChatError(
          "invalid_response",
          "ACME stream event is not JSON.",
          {
            cause,
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      if (!isRecord(parsed)) {
        throw new AcmeChatError(
          "invalid_response",
          "ACME stream event is not an object.",
          {
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      if (parsed.protocolVersion !== ACME_MODEL_RUNTIME_PROTOCOL) {
        throw new AcmeChatError(
          "configuration",
          `ACME stream protocol is ${String(parsed.protocolVersion)}.`,
          {
            evidence: {
              protocolCode: "MODEL_RUNTIME_PROTOCOL_MISMATCH",
              delivery: "unknown",
            },
          },
        );
      }
      const type = typeof parsed.type === "string" ? parsed.type : undefined;
      if (
        event.event !== undefined &&
        type !== undefined &&
        event.event !== type
      ) {
        throw new AcmeChatError(
          "invalid_response",
          "ACME stream event type does not match the SSE event name.",
          {
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      const eventType = event.event ?? type;
      if (
        typeof parsed.sequence !== "number" ||
        parsed.sequence !== expectedSequence
      ) {
        throw new AcmeChatError(
          "invalid_response",
          `ACME stream sequence was ${String(parsed.sequence)}, expected ${String(expectedSequence)}.`,
          {
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      expectedSequence += 1;
      if (sawTerminal) {
        throw new AcmeChatError(
          "invalid_response",
          "ACME stream continued after a terminal event.",
          {
            evidence: {
              diagnosticKind: "malformed-stream",
              delivery: "unknown",
            },
          },
        );
      }
      if (eventType === "reasoning-delta") {
        if (typeof parsed.text !== "string") {
          throw new AcmeChatError(
            "invalid_response",
            "ACME reasoning-delta is missing text.",
            {
              evidence: {
                diagnosticKind: "malformed-stream",
                delivery: "unknown",
              },
            },
          );
        }
        reasoning += parsed.text;
        if (emitDeltas && parsed.text.length > 0) {
          callbacks.onDelta?.({ type: "reasoning", text: parsed.text });
        }
        continue;
      }
      if (eventType === "content-delta") {
        if (typeof parsed.text !== "string") {
          throw new AcmeChatError(
            "invalid_response",
            "ACME content-delta is missing text.",
            {
              evidence: {
                diagnosticKind: "malformed-stream",
                delivery: "unknown",
              },
            },
          );
        }
        if (emitDeltas && parsed.text.length > 0) {
          callbacks.onDelta?.({ type: "content", text: parsed.text });
        }
        continue;
      }
      if (eventType === "tool-call-delta") {
        sawToolDelta = true;
        continue;
      }
      if (eventType === "completed") {
        sawTerminal = true;
        completion = completionFromAcmeResponse(parsed.response, parsed.result);
        continue;
      }
      if (eventType === "failed") {
        sawTerminal = true;
        throw chatErrorFromAcmeFailure(parsed.error, parsed.result, true);
      }
      throw new AcmeChatError(
        "invalid_response",
        `Unsupported ACME stream event (${String(eventType)}).`,
        {
          evidence: { diagnosticKind: "malformed-stream", delivery: "unknown" },
        },
      );
    }
    if (!sawTerminal || completion === undefined) {
      throw new AcmeChatError(
        "invalid_response",
        sawToolDelta
          ? "ACME stream ended before a structurally complete tool call."
          : "ACME stream ended without a terminal event.",
        {
          evidence: {
            diagnosticKind: "truncated-stream",
            delivery: "unknown",
          },
        },
      );
    }
    return reasoning.length === 0 ? completion : { ...completion, reasoning };
  }

  async #refusal(response: Response): Promise<AcmeChatError> {
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text.length === 0 ? undefined : (JSON.parse(text) as unknown);
    } catch {
      parsed = undefined;
    }
    return chatErrorFromRefusal(
      response.status,
      parseRefusalEnvelope(parsed),
      text,
    );
  }

  async #json(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw new AcmeChatError(
        "invalid_response",
        "ACME compatibility response is not JSON.",
        {
          cause,
          evidence: {
            diagnosticKind: "invalid-response",
            delivery: "not-sent",
          },
        },
      );
    }
  }

  #assertNotTaskRuntime(url: string): void {
    if (
      url.includes(ACME_TASK_EXECUTE_PATH) &&
      !url.includes(ACME_MODEL_RUNTIME_EXECUTE_PATH)
    ) {
      throw new AcmeChatError(
        "configuration",
        "A008 must not call ACME /v1/execute task runtime.",
        {
          evidence: {
            protocolCode: "FORBIDDEN_TASK_RUNTIME",
            delivery: "not-sent",
          },
        },
      );
    }
  }
}

export function createAcmeChatTransport(
  options: AcmeChatTransportOptions,
): ChatTransport {
  return new AcmeChatTransport(options);
}
