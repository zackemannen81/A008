import {
  promptImageAttachmentSchema,
  type ClientMessage,
  type HostServerMessage,
  type SessionControlInput,
} from "./schemas.js";
export function parseSessionControlInput(
  value: unknown,
  invalid: () => Error = () =>
    new Error("Invalid session control action or parameters."),
): SessionControlInput {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid session control.");
  const input = value as Record<string, unknown>;
  switch (input.action) {
    case "inspect":
    case "reset":
    case "undo":
    case "close":
      return { action: input.action };
    case "model":
      if (typeof input.model === "string" && input.model.trim().length > 0)
        return { action: "model", model: input.model };
      break;
    case "configure":
      if ("parameters" in input)
        return { action: "configure", parameters: input.parameters };
      break;
    case "configureRuntime":
      if ("settings" in input && typeof input.revision === "string")
        return {
          action: "configureRuntime",
          settings: input.settings,
          revision: input.revision,
        };
      break;
  }
  throw invalid();
}

export interface ParseFailure {
  readonly error: string;
  readonly requestId?: string;
  readonly sessionId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseClientMessage(
  raw: string,
  parseControl: (
    value: unknown,
  ) => SessionControlInput = parseSessionControlInput,
): ClientMessage<SessionControlInput> | ParseFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { error: "WebSocket frame is not valid JSON." };
  }
  if (!isRecord(parsed)) {
    return { error: "WebSocket frame must be a JSON object." };
  }
  const requestId =
    typeof parsed.requestId === "string" && parsed.requestId.trim().length > 0
      ? parsed.requestId
      : undefined;
  const sessionId =
    typeof parsed.sessionId === "string" && parsed.sessionId.trim().length > 0
      ? parsed.sessionId
      : undefined;
  const type = parsed.type;
  if (type === "tool/permission") {
    if (
      !requestId ||
      !sessionId ||
      typeof parsed.permissionId !== "string" ||
      typeof parsed.allow !== "boolean"
    )
      return { error: "Invalid tool permission response." };
    return {
      type,
      requestId,
      sessionId,
      permissionId: parsed.permissionId,
      allow: parsed.allow,
    };
  }
  if (type === "session/control") {
    if (requestId === undefined || sessionId === undefined)
      return { error: "session/control requires requestId and sessionId." };
    try {
      return {
        type,
        requestId,
        sessionId,
        control: parseControl(parsed.control),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Invalid session control.",
        requestId,
        sessionId,
      };
    }
  }
  if (type === "session/new") {
    if (requestId === undefined) {
      return { error: "session/new requires requestId." };
    }
    if (!("model" in parsed) || parsed.model === undefined) {
      return { type: "session/new", requestId };
    }
    if (typeof parsed.model !== "string" || parsed.model.trim().length === 0) {
      return {
        error: "session/new model must be a non-empty string.",
        requestId,
      };
    }
    return { type: "session/new", requestId, model: parsed.model };
  }
  if (type === "session/resume") {
    if (requestId === undefined || sessionId === undefined) {
      return {
        error: "session/resume requires requestId and sessionId.",
        ...(requestId === undefined ? {} : { requestId }),
        ...(sessionId === undefined ? {} : { sessionId }),
      };
    }
    if (
      typeof parsed.resumeToken !== "string" ||
      !/^[a-f0-9]{64}$/u.test(parsed.resumeToken)
    ) {
      return {
        error: "session/resume requires a valid resume capability.",
        requestId,
        sessionId,
      };
    }
    return { type, requestId, sessionId, resumeToken: parsed.resumeToken };
  }
  if (type === "prompt") {
    if (requestId === undefined || sessionId === undefined) {
      return {
        error: "prompt requires requestId and sessionId.",
        ...(requestId === undefined ? {} : { requestId }),
        ...(sessionId === undefined ? {} : { sessionId }),
      };
    }
    if (typeof parsed.text !== "string") {
      return { error: "prompt text must be a string.", requestId, sessionId };
    }
    if (parsed.attachment === undefined) {
      return { type: "prompt", requestId, sessionId, text: parsed.text };
    }
    const attachment = promptImageAttachmentSchema.safeParse(parsed.attachment);
    if (!attachment.success) {
      return {
        error: "prompt attachment must be a valid image attachment.",
        requestId,
        sessionId,
      };
    }
    return {
      type: "prompt",
      requestId,
      sessionId,
      text: parsed.text,
      attachment: attachment.data,
    };
  }
  if (type === "cancel") {
    if (requestId === undefined || sessionId === undefined) {
      return {
        error: "cancel requires requestId and sessionId.",
        ...(requestId === undefined ? {} : { requestId }),
        ...(sessionId === undefined ? {} : { sessionId }),
      };
    }
    return { type: "cancel", requestId, sessionId };
  }
  return {
    error: "Unknown WebSocket message type.",
    ...(requestId === undefined ? {} : { requestId }),
    ...(sessionId === undefined ? {} : { sessionId }),
  };
}

export function errorMessage(
  failure: ParseFailure | { readonly message: string },
  extras: {
    readonly requestId?: string;
    readonly sessionId?: string;
  } = {},
): Extract<HostServerMessage, { type: "error" }> {
  const requestId =
    "requestId" in failure ? failure.requestId : extras.requestId;
  const sessionId =
    "sessionId" in failure ? failure.sessionId : extras.sessionId;
  return {
    type: "error",
    message: "error" in failure ? failure.error : failure.message,
    ...(requestId === undefined ? {} : { requestId }),
    ...(sessionId === undefined ? {} : { sessionId }),
  };
}
