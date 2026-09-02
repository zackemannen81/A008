export const GUI_HOST_NAME = "A008-gui-host";
export const DEFAULT_GUI_HOST_PORT = 8787;
export const DEFAULT_GUI_HOST_BIND = "127.0.0.1";

export type GuiHostClientMessage =
  | {
      readonly type: "session/new";
      readonly requestId: string;
      readonly model?: string;
    }
  | {
      readonly type: "prompt";
      readonly requestId: string;
      readonly sessionId: string;
      readonly text: string;
    }
  | {
      readonly type: "cancel";
      readonly requestId: string;
      readonly sessionId: string;
    };

export type GuiHostServerMessage =
  | {
      readonly type: "session/new/ok";
      readonly requestId: string;
      readonly sessionId: string;
    }
  | {
      readonly type: "thought";
      readonly sessionId: string;
      readonly text: string;
    }
  | {
      readonly type: "answer";
      readonly sessionId: string;
      readonly text: string;
    }
  | {
      readonly type: "prompt/ok";
      readonly requestId: string;
      readonly sessionId: string;
    }
  | {
      readonly type: "error";
      readonly requestId?: string;
      readonly sessionId?: string;
      readonly message: string;
    };

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
): GuiHostClientMessage | ParseFailure {
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
  if (type === "session/new") {
    if (requestId === undefined) {
      return { error: "session/new requires requestId." };
    }
    if (!("model" in parsed) || parsed.model === undefined) {
      return { type: "session/new", requestId };
    }
    if (typeof parsed.model !== "string" || parsed.model.trim().length === 0) {
      return { error: "session/new model must be a non-empty string.", requestId };
    }
    return { type: "session/new", requestId, model: parsed.model };
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
    return { type: "prompt", requestId, sessionId, text: parsed.text };
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
): GuiHostServerMessage {
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
