import { ChatError } from "../../core/errors.js";
import {
  acmeProviderHint,
  resolveExecutionProvider,
} from "../../core/execution-provider.js";
import {
  effectiveReasoningEffort,
  generationCapabilities,
} from "../../core/generation-controls.js";
import type {
  ChatCompletion,
  ChatGenerationOptions,
  ChatRequest,
  ChatToolCall,
  ChatUsage,
  ChatWireMessage,
} from "../../core/types.js";

export const ACME_MODEL_RUNTIME_PROTOCOL = "acme-model-runtime/2" as const;
export const ACME_MODEL_RUNTIME_ERROR_PROTOCOL =
  "acme-model-runtime-error/1" as const;
export const ACME_MODEL_RUNTIME_HEADER = "x-acme-model-runtime-protocol";
export const ACME_MODEL_RUNTIME_COMPATIBILITY_PATH =
  "/v1/model/compatibility" as const;
export const ACME_MODEL_RUNTIME_EXECUTE_PATH = "/v1/model/execute" as const;
export const ACME_TASK_EXECUTE_PATH = "/v1/execute" as const;
export const ACME_MODEL_RUNTIME_MAX_STREAM_EVENT_BYTES = 65_536;
export const ACME_MODEL_RUNTIME_MAX_REQUEST_BYTES = 1_048_576;

export type AcmeDelivery = "not-sent" | "sent" | "unknown";

export type AcmeDiagnosticKind =
  | "completed"
  | "timeout"
  | "cancel"
  | "provider-http"
  | "malformed-stream"
  | "truncated-stream"
  | "ambiguous-delivery"
  | "invalid-response"
  | "unavailable"
  | "auth"
  | "rate-limit"
  | "content-filter"
  | "conflict"
  | "unsupported-capability"
  | "invalid-request"
  | "resume-evidence-unavailable"
  | "cancelled"
  | "internal";

export interface AcmeExecutionEvidence {
  readonly modelExecutionId?: string;
  readonly diagnosticKind?: AcmeDiagnosticKind | string;
  readonly delivery?: AcmeDelivery;
  readonly httpStatus?: number;
  readonly protocolCode?: string;
  readonly replayed?: boolean;
}

export class AcmeChatError extends ChatError {
  readonly modelExecutionId: string | undefined;
  readonly diagnosticKind: string | undefined;
  readonly delivery: AcmeDelivery | undefined;
  readonly protocolCode: string | undefined;

  constructor(
    code: ChatError["code"],
    message: string,
    options: {
      readonly status?: number;
      readonly retryable?: boolean;
      readonly cause?: unknown;
      readonly evidence?: AcmeExecutionEvidence;
    } = {},
  ) {
    super(code, message, {
      ...(options.status === undefined ? {} : { status: options.status }),
      ...(options.retryable === undefined
        ? {}
        : { retryable: options.retryable }),
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "AcmeChatError";
    this.modelExecutionId = options.evidence?.modelExecutionId;
    this.diagnosticKind = options.evidence?.diagnosticKind;
    this.delivery = options.evidence?.delivery;
    this.protocolCode = options.evidence?.protocolCode;
  }
}

export function isAcmeChatError(value: unknown): value is AcmeChatError {
  return value instanceof AcmeChatError;
}

export interface AcmeModelRuntimeDescriptor {
  readonly protocolVersion: string;
  readonly engineBuild: string;
  readonly executePath: string;
}

export function acmeRuntimeUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/+$/u, "")}/`).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonValue(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ChatError("invalid_response", `${label} is not JSON.`, { cause });
  }
}

function toolResultValue(content: string): unknown {
  if (content.length === 0) {
    return "";
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

function messageContent(message: ChatWireMessage): unknown[] {
  if (message.role === "tool") {
    return [
      {
        type: "tool-result",
        toolCallId: message.toolCallId,
        value: toolResultValue(message.content),
      },
    ];
  }
  if ("toolCalls" in message) {
    const parts: unknown[] = [];

    if (message.content?.trim()) {
      parts.push({ type: "text", text: message.content });
    }
    for (const call of message.toolCalls) {
      parts.push({
        type: "tool-call",
        toolCallId: call.id,
        name: call.name,
        arguments: parseJsonValue(
          call.arguments,
          `Tool call ${call.id} arguments`,
        ),
      });
    }
    if (parts.length === 0) {
      throw new ChatError(
        "invalid_response",
        "Assistant tool-call continuation has no content parts.",
      );
    }
    return parts;
  }
  return [{ type: "text", text: message.content }];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function assignSupportedControl(
  target: Record<string, unknown>,
  field: string,
  value: unknown,
  supported: boolean,
  model: string,
): void {
  if (!isPresent(value)) {
    return;
  }
  if (!supported) {
    throw new ChatError(
      "configuration",
      `${field} is not supported for ${model} on the ACME runtime.`,
    );
  }
  target[field] = value;
}

function assignAcmeGeneration(
  target: Record<string, unknown>,
  generation: ChatGenerationOptions,
  model: string,
  toolCount: number,
): void {
  const caps = generationCapabilities(model);
  if (
    isPresent(generation.temperature) &&
    Number.isFinite(generation.temperature) &&
    generation.temperature >= 0
  ) {
    target.temperature = generation.temperature;
  }
  if (
    isPresent(generation.maxTokens) &&
    Number.isSafeInteger(generation.maxTokens) &&
    generation.maxTokens > 0
  ) {
    target.maxOutputTokens = generation.maxTokens;
  }
  assignSupportedControl(target, "topP", generation.topP, caps.topP, model);
  assignSupportedControl(
    target,
    "reasoningBudget",
    generation.reasoningBudget,
    caps.reasoningBudget !== null,
    model,
  );
  assignSupportedControl(
    target,
    "enableThinking",
    generation.enableThinking,
    caps.thinking,
    model,
  );
  assignSupportedControl(
    target,
    "reasoningEffort",
    effectiveReasoningEffort(model, toolCount, generation.reasoningEffort),
    caps.reasoningEfforts.length > 0,
    model,
  );
  assignSupportedControl(target, "seed", generation.seed, caps.seed, model);
  if (isPresent(generation.stop)) {
    if (!caps.stop) {
      throw new ChatError(
        "configuration",
        `stop is not supported for ${model} on the ACME runtime.`,
      );
    }
    if (generation.stop.length > 0) {
      target.stop = [...generation.stop];
    }
  }
}

export function buildAcmeExecuteBody(
  request: ChatRequest,
  options: {
    readonly requestKey: string;
    readonly timeoutMs: number;
    readonly correlationId?: string;
    readonly catalog?: {
      readonly chatModels: readonly {
        readonly id: string;
        readonly provider: string;
      }[];
    };
  },
): Record<string, unknown> {
  let attachmentUserIndex = -1;
  if (request.imageAttachments?.length) {
    request.messages.forEach((message, index) => {
      if (message.role === "user") attachmentUserIndex = index;
    });
    if (attachmentUserIndex < 0)
      throw new ChatError(
        "configuration",
        "Native vision requires a user message.",
      );
  }
  const messages = request.messages.map((message, index) => ({
    role: message.role,
    content: [
      ...messageContent(message),
      ...(index === attachmentUserIndex
        ? request.imageAttachments!.map((image) => ({
            type: "image",
            mediaType: image.mediaType,
            dataRef: image.dataRef,
          }))
        : []),
    ],
  }));
  if (messages.length === 0) {
    throw new ChatError(
      "configuration",
      "ACME model request requires messages.",
    );
  }
  const generation = request.options ?? {};
  const acmeRequest: Record<string, unknown> = {
    messages,
    output: { mode: "text" },
    ...(typeof generation.stream === "boolean"
      ? { stream: generation.stream }
      : {}),
  };
  if (request.tools !== undefined && request.tools.length > 0) {
    acmeRequest.tools = request.tools.map((tool) => ({
      type: "function",
      name: tool.name,
      ...(tool.description.length > 0 ? { description: tool.description } : {}),
      parameters: tool.parameters,
    }));
  }
  assignAcmeGeneration(
    acmeRequest,
    generation,
    request.model,
    request.tools?.length ?? 0,
  );
  const executionProvider = resolveExecutionProvider(
    request.model,
    options.catalog,
  );
  const model: Record<string, unknown> = {
    profile: request.model,
    modelHint: request.model,
    providerHint: acmeProviderHint(executionProvider, request.model),
  };
  const body: Record<string, unknown> = {
    protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL,
    requestKey: options.requestKey,
    model,
    request: acmeRequest,
    policy: { timeoutMs: options.timeoutMs },
  };
  if (options.correlationId !== undefined && options.correlationId.length > 0) {
    body.correlationId = options.correlationId;
  }
  const requiredCapabilities: Record<string, boolean> = {};
  if (request.tools !== undefined && request.tools.length > 0)
    requiredCapabilities.tools = true;
  if (request.imageAttachments?.length) requiredCapabilities.vision = true;
  if (Object.keys(requiredCapabilities).length > 0)
    body.requiredCapabilities = requiredCapabilities;
  return body;
}

export function parseAcmeDescriptor(
  value: unknown,
): AcmeModelRuntimeDescriptor {
  if (!isRecord(value)) {
    throw new AcmeChatError(
      "configuration",
      "ACME model-runtime compatibility descriptor is not an object.",
    );
  }
  if (value.protocolVersion !== ACME_MODEL_RUNTIME_PROTOCOL) {
    throw new AcmeChatError(
      "configuration",
      `Unsupported ACME model-runtime protocol (${String(value.protocolVersion)}).`,
      { evidence: { protocolCode: "MODEL_RUNTIME_PROTOCOL_MISMATCH" } },
    );
  }
  if (value.executePath !== ACME_MODEL_RUNTIME_EXECUTE_PATH) {
    throw new AcmeChatError(
      "configuration",
      `ACME model-runtime execute path is ${String(value.executePath)}, not ${ACME_MODEL_RUNTIME_EXECUTE_PATH}.`,
      { evidence: { protocolCode: "MODEL_RUNTIME_PROTOCOL_MISMATCH" } },
    );
  }
  if (
    typeof value.engineBuild !== "string" ||
    value.engineBuild.trim().length === 0
  ) {
    throw new AcmeChatError(
      "configuration",
      "ACME model-runtime compatibility descriptor is missing engineBuild.",
    );
  }
  return {
    protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL,
    engineBuild: value.engineBuild,
    executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
  };
}

export function parseRefusalEnvelope(value: unknown):
  | {
      readonly code: string;
      readonly message: string;
    }
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (value.protocolVersion !== ACME_MODEL_RUNTIME_ERROR_PROTOCOL) {
    return undefined;
  }
  if (typeof value.code !== "string" || typeof value.message !== "string") {
    return undefined;
  }
  return { code: value.code, message: value.message };
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function usageFrom(value: unknown): ChatUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const promptTokens = optionalFiniteNumber(value.inputTokens);
  const completionTokens = optionalFiniteNumber(value.outputTokens);
  const totalTokens = optionalFiniteNumber(value.totalTokens);
  const usage: ChatUsage = {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
  return Object.keys(usage).length === 0 ? undefined : usage;
}

function finishReasonFrom(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === "tool") {
    return "tool_calls";
  }
  if (value === "content-filter") {
    return "content_filter";
  }
  return typeof value === "string" ? value : undefined;
}

function toolCallsFrom(value: unknown): ChatToolCall[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AcmeChatError(
      "invalid_response",
      "ACME toolCalls must be an array.",
      { evidence: { diagnosticKind: "invalid-response" } },
    );
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AcmeChatError(
        "invalid_response",
        `ACME tool call ${String(index)} is not an object.`,
        { evidence: { diagnosticKind: "invalid-response" } },
      );
    }
    if (typeof item.toolCallId !== "string" || item.toolCallId.length === 0) {
      throw new AcmeChatError(
        "invalid_response",
        `ACME tool call ${String(index)} is missing toolCallId.`,
        { evidence: { diagnosticKind: "invalid-response" } },
      );
    }
    if (ids.has(item.toolCallId)) {
      throw new AcmeChatError(
        "invalid_response",
        `ACME returned a duplicate tool call id (${item.toolCallId}).`,
        { evidence: { diagnosticKind: "invalid-response" } },
      );
    }
    if (typeof item.name !== "string" || item.name.length === 0) {
      throw new AcmeChatError(
        "invalid_response",
        `ACME tool call ${item.toolCallId} is missing a name.`,
        { evidence: { diagnosticKind: "invalid-response" } },
      );
    }
    if (item.arguments === undefined) {
      throw new AcmeChatError(
        "invalid_response",
        `ACME tool call ${item.toolCallId} is missing arguments.`,
        { evidence: { diagnosticKind: "invalid-response" } },
      );
    }
    ids.add(item.toolCallId);
    return {
      id: item.toolCallId,
      name: item.name,
      arguments: JSON.stringify(item.arguments),
    };
  });
}

export function completionFromAcmeResponse(
  response: unknown,
  result: unknown,
): ChatCompletion {
  if (!isRecord(response)) {
    throw new AcmeChatError(
      "invalid_response",
      "ACME completed event is missing a response object.",
      { evidence: { diagnosticKind: "invalid-response" } },
    );
  }
  const text = typeof response.text === "string" ? response.text : undefined;
  const calls = toolCallsFrom(response.toolCalls);
  if (text === undefined && calls.length === 0) {
    throw new AcmeChatError(
      "invalid_response",
      "ACME response did not contain assistant text or a tool call.",
      {
        evidence: evidenceFromResult(result, {
          diagnosticKind: "invalid-response",
        }),
      },
    );
  }
  const content = text ?? "";
  if (content.length === 0 && calls.length === 0) {
    throw new AcmeChatError(
      "invalid_response",
      "ACME completed with no usable answer.",
      {
        evidence: evidenceFromResult(result, {
          diagnosticKind: "invalid-response",
        }),
      },
    );
  }
  const usage =
    usageFrom(response.usage) ??
    usageFrom(isRecord(result) ? result.usage : undefined);
  const finishReason = finishReasonFrom(response.finishReason);
  const evidence = evidenceFromResult(result, { diagnosticKind: "completed" });
  return {
    message: { role: "assistant", content },
    ...(calls.length > 0 ? { toolCalls: calls } : {}),
    ...(finishReason === undefined ? {} : { finishReason }),
    ...(usage === undefined ? {} : { usage }),
    ...(evidence.modelExecutionId === undefined &&
    evidence.replayed === undefined
      ? {}
      : {
          execution: {
            ...(evidence.modelExecutionId === undefined
              ? {}
              : { id: evidence.modelExecutionId }),
            ...(evidence.replayed === undefined
              ? {}
              : { replayed: evidence.replayed }),
            diagnosticKind: "completed",
          },
        }),
  };
}

export function evidenceFromResult(
  result: unknown,
  fallback: AcmeExecutionEvidence = {},
): AcmeExecutionEvidence {
  if (!isRecord(result)) {
    return fallback;
  }
  const diagnostic = isRecord(result.diagnostic)
    ? result.diagnostic
    : undefined;
  const delivery =
    diagnostic?.delivery === "not-sent" ||
    diagnostic?.delivery === "sent" ||
    diagnostic?.delivery === "unknown"
      ? diagnostic.delivery
      : fallback.delivery;
  const httpStatus =
    typeof diagnostic?.httpStatus === "number" &&
    Number.isSafeInteger(diagnostic.httpStatus)
      ? diagnostic.httpStatus
      : fallback.httpStatus;
  return {
    ...(typeof result.modelExecutionId === "string"
      ? { modelExecutionId: result.modelExecutionId }
      : fallback.modelExecutionId === undefined
        ? {}
        : { modelExecutionId: fallback.modelExecutionId }),
    ...(typeof diagnostic?.kind === "string"
      ? { diagnosticKind: diagnostic.kind }
      : fallback.diagnosticKind === undefined
        ? {}
        : { diagnosticKind: fallback.diagnosticKind }),
    ...(delivery === undefined ? {} : { delivery }),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(typeof result.replayed === "boolean"
      ? { replayed: result.replayed }
      : {}),
    ...(fallback.protocolCode === undefined
      ? {}
      : { protocolCode: fallback.protocolCode }),
  };
}

export function chatErrorFromAcmeFailure(
  error: unknown,
  result: unknown,
  dispatched: boolean,
): AcmeChatError {
  const evidence = evidenceFromResult(result);
  const body = isRecord(error) ? error : {};
  const protocolCode = typeof body.code === "string" ? body.code : undefined;
  const kind = evidence.diagnosticKind;
  const message =
    typeof body.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : "ACME model execution failed.";
  const annotated = evidenceMessage(message, {
    ...evidence,
    ...(protocolCode === undefined ? {} : { protocolCode }),
  });
  const delivery = evidence.delivery ?? (dispatched ? "unknown" : "not-sent");
  const retryable = delivery === "not-sent";
  const status = evidence.httpStatus;
  const mapped = mapDiagnosticKind(kind, protocolCode, status);
  return new AcmeChatError(mapped.code, annotated, {
    ...(status === undefined ? {} : { status }),
    retryable: mapped.retryable ?? retryable,
    evidence: {
      ...evidence,
      delivery,
      ...(protocolCode === undefined ? {} : { protocolCode }),
    },
  });
}

export function chatErrorFromRefusal(
  status: number,
  envelope: { readonly code: string; readonly message: string } | undefined,
  rawText: string,
): AcmeChatError {
  const code = envelope?.code;
  const evidence: AcmeExecutionEvidence = {
    delivery: "not-sent",
    httpStatus: status,
    ...(code === undefined ? {} : { protocolCode: code }),
  };
  const message = evidenceMessage(
    envelope?.message ??
      `ACME model runtime refused the request with HTTP ${String(status)}.`,
    evidence,
  );
  if (status === 401 || code === "UNAUTHORIZED") {
    return new AcmeChatError("authentication", message, {
      status,
      evidence: { ...evidence, protocolCode: code ?? "UNAUTHORIZED" },
    });
  }
  if (status === 409 || code === "MODEL_RUNTIME_PROTOCOL_MISMATCH") {
    return new AcmeChatError("configuration", message, {
      status,
      evidence: {
        ...evidence,
        protocolCode: code ?? "MODEL_RUNTIME_PROTOCOL_MISMATCH",
      },
    });
  }
  if (status === 429) {
    return new AcmeChatError("rate_limit", message, {
      status,
      retryable: true,
      evidence,
    });
  }
  if (status >= 500) {
    return new AcmeChatError("server", message, {
      status,
      retryable: true,
      evidence,
    });
  }
  return new AcmeChatError("configuration", message, {
    status,
    evidence,
  });
}

function mapDiagnosticKind(
  kind: string | undefined,
  protocolCode: string | undefined,
  httpStatus: number | undefined,
): { readonly code: ChatError["code"]; readonly retryable?: boolean } {
  if (kind === "timeout") {
    return { code: "timeout", retryable: false };
  }
  if (
    kind === "cancel" ||
    kind === "cancelled" ||
    protocolCode === "CANCELLED"
  ) {
    return { code: "cancelled", retryable: false };
  }
  if (kind === "auth" || protocolCode === "UNAUTHORIZED") {
    return { code: "authentication" };
  }
  if (kind === "rate-limit" || httpStatus === 429) {
    return { code: "rate_limit" };
  }
  if (
    kind === "malformed-stream" ||
    kind === "truncated-stream" ||
    kind === "invalid-response"
  ) {
    return { code: "invalid_response", retryable: false };
  }
  if (kind === "unsupported-capability" || kind === "invalid-request") {
    return { code: "configuration", retryable: false };
  }
  if (kind === "ambiguous-delivery" || kind === "resume-evidence-unavailable") {
    return { code: "provider", retryable: false };
  }
  if (
    kind === "unavailable" ||
    kind === "internal" ||
    (httpStatus !== undefined && httpStatus >= 500)
  ) {
    return { code: "server" };
  }
  return { code: "provider", retryable: false };
}

export function evidenceMessage(
  message: string,
  evidence: AcmeExecutionEvidence,
): string {
  const parts = [message.replace(/\s+/gu, " ").trim()];
  if (evidence.modelExecutionId) {
    parts.push(`modelExecutionId=${evidence.modelExecutionId}`);
  }
  if (evidence.diagnosticKind) {
    parts.push(`diagnostic=${evidence.diagnosticKind}`);
  }
  if (evidence.delivery) {
    parts.push(`delivery=${evidence.delivery}`);
  }
  if (evidence.protocolCode) {
    parts.push(`code=${evidence.protocolCode}`);
  }
  return parts.join(" ");
}
