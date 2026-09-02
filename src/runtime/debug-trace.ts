import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { serializeChatMessages } from "../core/chat-invocation.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatTransport,
} from "../core/types.js";
import type { FetchLike } from "../providers/nvidia/nvidia-chat-transport.js";

export type DebugTraceMode = "off" | "safe" | "raw";
export type DebugTraceSurface = "cli" | "acp" | "test";

export type DebugTracePhase =
  | "turn_start"
  | "memory_read"
  | "chat_request"
  | "chat_response"
  | "analyze_request"
  | "analyze_response"
  | "classify_request"
  | "classify_response"
  | "provider_http_request"
  | "provider_http_response"
  | "commit"
  | "index"
  | "turn_complete"
  | "memory_failure"
  | "trace_sink_failure"
  | "trace_truncated";

export interface DebugTraceEvent {
  readonly ts: string;
  readonly seq?: number;
  readonly traceId: string;
  readonly httpCallId?: string;
  readonly surface: DebugTraceSurface;
  readonly phase: DebugTracePhase;
  readonly operation?: string;
  readonly status?: "ok" | "error" | "cancelled" | "degraded";
  readonly chatStatus?: string;
  readonly memoryStatus?: string;
  readonly sizes?: Readonly<Record<string, number>>;
  readonly selectedMemoryIds?: readonly string[];
  readonly commit?: Readonly<Record<string, string | number | boolean>>;
  readonly index?: Readonly<Record<string, string>>;
  readonly summary?: string;
  readonly payload?: unknown;
  readonly truncated?: boolean;
  readonly errorCode?: string;
}

export interface DebugTraceObserver {
  readonly mode: DebugTraceMode;
  emit(event: Omit<DebugTraceEvent, "ts"> & { readonly ts?: string }): void;
  track(pending: Promise<void>): void;
  flush(): Promise<void>;
  close(): Promise<void>;
  consumeSinkFailure(): string | undefined;
}

export interface DebugTraceObserverOptions {
  readonly mode: DebugTraceMode;
  readonly surface: DebugTraceSurface;
  readonly filePath?: string;
  readonly stderr?: NodeJS.WritableStream;
  readonly secrets?: readonly string[];
  readonly maxEventChars?: number;
  readonly maxFileBytes?: number;
  readonly now?: () => Date;
}

const SECRET_HEADER =
  /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie)$/iu;
const SECRET_HEADER_PART = /(api-?key|token|secret|password|authorization)/iu;
export const DEFAULT_TRACE_EVENT_CHARS = 65_536;
export const DEFAULT_TRACE_FILE_BYTES = 8 * 1024 * 1024;
const RAW_WARNING =
  "raw debug trace writes local prompts, projected memory, reasoning, answers, and semantic JSON";

export function redactHeaders(
  headers: HeadersInit | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (headers === undefined) {
    return result;
  }
  new Headers(headers).forEach((value, key) => {
    result[key] = SECRET_HEADER.test(key) || SECRET_HEADER_PART.test(key)
      ? "[redacted]"
      : value;
  });
  return result;
}

export function redactSecrets(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const secret of secrets) {
    if (secret.length >= 8) {
      result = result.split(secret).join("[redacted]");
    }
  }
  return result;
}

function boundText(
  value: string,
  maximum: number,
): { readonly value: string; readonly truncated: boolean } {
  if (value.length <= maximum) {
    return { value, truncated: false };
  }
  return { value: value.slice(0, maximum), truncated: true };
}

function semanticOperation(
  request: ChatRequest,
): "knowledge_analysis" | "relation_classification" | undefined {
  const content = request.messages.at(-1)?.content;
  if (content === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    const operation = (parsed as { readonly operation?: unknown }).operation;
    if (
      operation === "knowledge_analysis" ||
      operation === "relation_classification"
    ) {
      return operation;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function createDebugTracer(
  options: DebugTraceObserverOptions,
): DebugTraceObserver {
  if (options.mode === "off") {
    return new OffDebugTracer();
  }
  return new WritingDebugTracer(options);
}

class OffDebugTracer implements DebugTraceObserver {
  readonly mode = "off" as const;

  emit(): void {}

  track(): void {}

  async flush(): Promise<void> {}

  async close(): Promise<void> {}

  consumeSinkFailure(): undefined {
    return undefined;
  }
}

class WritingDebugTracer implements DebugTraceObserver {
  readonly mode: Exclude<DebugTraceMode, "off">;
  readonly #surface: DebugTraceSurface;
  readonly #filePath: string | undefined;
  readonly #stderr: NodeJS.WritableStream | undefined;
  readonly #secrets: readonly string[];
  readonly #maxEventChars: number;
  readonly #maxFileBytes: number;
  readonly #now: () => Date;
  #writes: Promise<void> = Promise.resolve();
  #fileBytes = 0;
  #fileStopped = false;
  #prepared = false;
  #sinkFailure: string | undefined;
  #warnedRaw = false;
  #seq = 0;

  constructor(options: DebugTraceObserverOptions) {
    this.mode = options.mode === "raw" ? "raw" : "safe";
    this.#surface = options.surface;
    this.#filePath = options.filePath;
    this.#stderr = options.stderr;
    this.#secrets = options.secrets ?? [];
    this.#maxEventChars = options.maxEventChars ?? DEFAULT_TRACE_EVENT_CHARS;
    this.#maxFileBytes = options.maxFileBytes ?? DEFAULT_TRACE_FILE_BYTES;
    this.#now = options.now ?? (() => new Date());
  }

  emit(event: Omit<DebugTraceEvent, "ts"> & { readonly ts?: string }): void {
    const record = this.#prepare(event);
    if (this.mode === "safe" && this.#stderr !== undefined) {
      this.#writeStderr(record);
    }
    if (this.#filePath !== undefined) {
      this.#writes = this.#writes
        .then(() => this.#append(record))
        .catch((error: unknown) => {
          this.#sinkFailure =
            error instanceof Error ? error.message : "trace sink failed";
        });
    }
  }

  track(pending: Promise<void>): void {
    this.#writes = this.#writes.then(() => pending).catch((error: unknown) => {
      this.#sinkFailure =
        error instanceof Error ? error.message : "trace sink failed";
    });
  }

  async flush(): Promise<void> {
    let current = this.#writes;
    while (true) {
      await current;
      if (current === this.#writes) {
        return;
      }
      current = this.#writes;
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }

  consumeSinkFailure(): string | undefined {
    const failure = this.#sinkFailure;
    this.#sinkFailure = undefined;
    return failure;
  }

  #prepare(
    event: Omit<DebugTraceEvent, "ts"> & { readonly ts?: string },
  ): DebugTraceEvent {
    const raw: DebugTraceEvent = {
      ts: event.ts ?? this.#now().toISOString(),
      seq: event.seq ?? (this.#seq += 1),
      traceId: event.traceId,
      ...(event.httpCallId === undefined ? {} : { httpCallId: event.httpCallId }),
      surface: event.surface ?? this.#surface,
      phase: event.phase,
      ...(event.operation === undefined ? {} : { operation: event.operation }),
      ...(event.status === undefined ? {} : { status: event.status }),
      ...(event.chatStatus === undefined ? {} : { chatStatus: event.chatStatus }),
      ...(event.memoryStatus === undefined
        ? {}
        : { memoryStatus: event.memoryStatus }),
      ...(event.sizes === undefined ? {} : { sizes: { ...event.sizes } }),
      ...(event.selectedMemoryIds === undefined
        ? {}
        : { selectedMemoryIds: [...event.selectedMemoryIds] }),
      ...(event.commit === undefined ? {} : { commit: { ...event.commit } }),
      ...(event.index === undefined ? {} : { index: { ...event.index } }),
      ...(event.summary === undefined ? {} : { summary: event.summary }),
      ...(this.mode === "raw" && event.payload !== undefined
        ? { payload: event.payload }
        : {}),
      ...(event.truncated === true ? { truncated: true } : {}),
      ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
    };
    return this.#bound(this.#redact(raw));
  }

  #redact(event: DebugTraceEvent): DebugTraceEvent {
    const serialized = redactSecrets(JSON.stringify(event), this.#secrets);
    return JSON.parse(serialized) as DebugTraceEvent;
  }

  #bound(event: DebugTraceEvent): DebugTraceEvent {
    const serialized = JSON.stringify(event);
    if (serialized.length <= this.#maxEventChars) {
      return event;
    }
    if (event.payload !== undefined) {
      const payloadText =
        typeof event.payload === "string"
          ? event.payload
          : JSON.stringify(event.payload);
      const bounded = boundText(payloadText, Math.max(256, this.#maxEventChars - 512));
      const reduced: DebugTraceEvent = {
        ...event,
        payload: bounded.value,
        truncated: true,
      };
      if (JSON.stringify(reduced).length <= this.#maxEventChars) {
        return reduced;
      }
    }
    const { payload: _payload, ...rest } = event;
    return { ...rest, truncated: true };
  }

  #writeStderr(event: DebugTraceEvent): void {
    if (this.#stderr === undefined) {
      return;
    }
    const parts = [
      "trace>",
      event.phase,
      event.operation === undefined ? undefined : event.operation,
      event.status === undefined ? undefined : event.status,
      event.summary,
    ].filter((part): part is string => part !== undefined && part.length > 0);
    this.#stderr.write(`${parts.join(" ")}\n`);
  }

  async #append(event: DebugTraceEvent): Promise<void> {
    if (this.#filePath === undefined || this.#fileStopped) {
      return;
    }
    if (!this.#prepared) {
      await mkdir(dirname(this.#filePath), { recursive: true });
      if (this.mode === "raw" && !this.#warnedRaw) {
        this.#warnedRaw = true;
        await appendFile(
          this.#filePath,
          `${JSON.stringify({
            ts: this.#now().toISOString(),
            traceId: "trace-warning",
            surface: this.#surface,
            phase: "turn_start",
            summary: RAW_WARNING,
          })}\n`,
          "utf8",
        );
      }
      try {
        this.#fileBytes = (await stat(this.#filePath)).size;
      } catch {
        this.#fileBytes = 0;
      }
      this.#prepared = true;
    }
    const line = `${JSON.stringify(event)}\n`;
    const nextBytes = this.#fileBytes + Buffer.byteLength(line, "utf8");
    if (nextBytes > this.#maxFileBytes) {
      this.#fileStopped = true;
      const truncated = `${JSON.stringify({
        ts: this.#now().toISOString(),
        traceId: event.traceId,
        surface: this.#surface,
        phase: "trace_truncated",
        truncated: true,
        sizes: { fileBytes: this.#fileBytes, maxFileBytes: this.#maxFileBytes },
      })}\n`;
      if (
        this.#fileBytes + Buffer.byteLength(truncated, "utf8") <=
        this.#maxFileBytes
      ) {
        await appendFile(this.#filePath, truncated, "utf8");
      }
      return;
    }
    await appendFile(this.#filePath, line, "utf8");
    this.#fileBytes = nextBytes;
  }
}

export class TraceIdHolder {
  current = "unassigned";
}

export const debugTraceIdStorage = new AsyncLocalStorage<string>();

export function currentTraceId(fallback = "unassigned"): string {
  return debugTraceIdStorage.getStore() ?? fallback;
}

export async function withTraceId<T>(
  traceId: string,
  work: () => Promise<T>,
): Promise<T> {
  return debugTraceIdStorage.run(traceId, work);
}

export function tracedChatTransport(
  inner: ChatTransport,
  tracer: DebugTraceObserver,
  surface: DebugTraceSurface,
  correlation: TraceIdHolder = new TraceIdHolder(),
): ChatTransport {
  if (tracer.mode === "off") {
    return inner;
  }
  return {
    async complete(request: ChatRequest, callbacks: ChatCallbacks = {}) {
      const operation = semanticOperation(request) ?? "chat";
      const serialized = serializeChatMessages(request.messages);
      const requestPhase =
        operation === "knowledge_analysis"
          ? "analyze_request"
          : operation === "relation_classification"
            ? "classify_request"
            : "chat_request";
      const responsePhase =
        operation === "knowledge_analysis"
          ? "analyze_response"
          : operation === "relation_classification"
            ? "classify_response"
            : "chat_response";
      tracer.emit({
        traceId: currentTraceId(correlation.current),
        surface,
        phase: requestPhase,
        operation,
        sizes: {
          messageCount: request.messages.length,
          requestBytes: Buffer.byteLength(serialized, "utf8"),
        },
        summary: `messages=${request.messages.length}`,
        payload: tracer.mode === "raw" ? serialized : undefined,
      });
      try {
        const completion = await inner.complete(request, {
          onDelta: (delta) => callbacks.onDelta?.(delta),
        });
        tracer.emit({
          traceId: currentTraceId(correlation.current),
          surface,
          phase: responsePhase,
          operation,
          status: "ok",
          sizes: {
            contentChars: completion.message.content.length,
            reasoningChars: completion.reasoning?.length ?? 0,
          },
          payload:
            tracer.mode === "raw"
              ? {
                  content: completion.message.content,
                  reasoning: completion.reasoning ?? "",
                }
              : undefined,
        });
        return completion;
      } catch (error) {
        tracer.emit({
          traceId: currentTraceId(correlation.current),
          surface,
          phase: responsePhase,
          operation,
          status:
            error instanceof Error && /cancel/iu.test(error.message)
              ? "cancelled"
              : "error",
          errorCode: error instanceof Error ? error.name : "error",
          summary: error instanceof Error ? error.message : "transport failed",
        });
        throw error;
      }
    },
  };
}

export function tracedFetch(
  inner: FetchLike,
  tracer: DebugTraceObserver,
  surface: DebugTraceSurface,
  correlation: TraceIdHolder = new TraceIdHolder(),
): FetchLike {
  if (tracer.mode === "off") {
    return inner;
  }
  return async (input, init) => {
    const traceId = currentTraceId(correlation.current);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method =
      init?.method ?? (input instanceof Request ? input.method : "POST");
    const headers = redactHeaders(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const rawBody = typeof init?.body === "string" ? init.body : "";
    const httpCallId = randomUUID();
    const operation = providerOperationFromBody(rawBody);
    tracer.emit({
      traceId,
      httpCallId,
      surface,
      phase: "provider_http_request",
      operation,
      sizes: { requestBytes: Buffer.byteLength(rawBody, "utf8") },
      summary: `${method} ${url}`,
      payload:
        tracer.mode === "raw"
          ? { url, method, headers, body: rawBody }
          : { url, method, headers },
    });
    try {
      const response = await inner(input, init);
      const clone = response.clone();
      tracer.track(
        clone.text().then((text) => {
          tracer.emit({
            traceId,
            httpCallId,
            surface,
            phase: "provider_http_response",
            operation,
            status: response.ok ? "ok" : "error",
            sizes: {
              responseBytes: Buffer.byteLength(text, "utf8"),
              httpStatus: response.status,
            },
            summary: `HTTP ${response.status}`,
            payload:
              tracer.mode === "raw"
                ? { httpStatus: response.status, body: text }
                : undefined,
          });
        }),
      );
      return response;
    } catch (error) {
      tracer.emit({
        traceId,
        httpCallId,
        surface,
        phase: "provider_http_response",
        operation,
        status: "error",
        summary: error instanceof Error ? error.message : "fetch failed",
      });
      throw error;
    }
  };
}

function providerOperationFromBody(rawBody: string): string {
  try {
    const payload = JSON.parse(rawBody) as {
      readonly messages?: Array<{ readonly content?: unknown }>;
    };
    const content = payload.messages?.at(-1)?.content;
    if (typeof content !== "string") {
      return "chat";
    }
    const envelope = JSON.parse(content) as { readonly operation?: unknown };
    if (
      envelope.operation === "knowledge_analysis" ||
      envelope.operation === "relation_classification"
    ) {
      return envelope.operation;
    }
  } catch {
    return "chat";
  }
  return "chat";
}

export function completionPayload(completion: ChatCompletion): {
  readonly content: string;
  readonly reasoning: string;
} {
  return {
    content: completion.message.content,
    reasoning: completion.reasoning ?? "",
  };
}
