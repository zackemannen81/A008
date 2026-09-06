import { parseSessionSnapshot, type SessionControl, type SessionSnapshot } from "./session-controls.js";
export const GUI_SESSION_PATH = "/v1/session";
export const DEFAULT_GUI_HOST = "127.0.0.1:8787";

export const CLIENT_MESSAGE_KEYS = [
  "type",
  "requestId",
  "sessionId",
  "text",
  "model",
  "control",
] as const;

export type ClientMessage =
  | { type: "session/control"; requestId: string; sessionId: string; control: SessionControl }
  | { type: "session/new"; requestId: string; model?: string }
  | { type: "prompt"; requestId: string; sessionId: string; text: string }
  | { type: "cancel"; requestId: string; sessionId: string };

export type ServerMessage =
  | { type: "session/control/ok"; requestId: string; sessionId: string; state: SessionSnapshot }
  | { type: "session/new/ok"; requestId: string; sessionId: string; state?: SessionSnapshot }
  | { type: "thought"; sessionId: string; text: string }
  | { type: "answer"; sessionId: string; text: string }
  | { type: "prompt/ok"; requestId: string; sessionId: string; state?: SessionSnapshot }
  | { type: "error"; requestId?: string; sessionId?: string; message: string };

export class GuiHostProtocolError extends Error {
  override readonly name = "GuiHostProtocolError";
}

export function resolveGuiSessionUrl(
  location: { readonly protocol: string; readonly host: string } | undefined =
    typeof globalThis.location === "object" ? globalThis.location : undefined,
): string {
  if (location === undefined || location.host === "") {
    return `ws://${DEFAULT_GUI_HOST}${GUI_SESSION_PATH}`;
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${GUI_SESSION_PATH}`;
}

export function encodeClientMessage(message: ClientMessage): string {
  switch (message.type) {
    case "session/control":
      return JSON.stringify({ type: message.type, requestId: message.requestId, sessionId: message.sessionId, control: message.control });
    case "session/new": {
      const body: Record<string, string> = {
        type: "session/new",
        requestId: message.requestId,
      };
      if (message.model !== undefined) {
        body.model = message.model;
      }
      return JSON.stringify(body);
    }
    case "prompt":
      return JSON.stringify({
        type: "prompt",
        requestId: message.requestId,
        sessionId: message.sessionId,
        text: message.text,
      });
    case "cancel":
      return JSON.stringify({
        type: "cancel",
        requestId: message.requestId,
        sessionId: message.sessionId,
      });
  }
}

export function parseServerMessage(value: unknown): ServerMessage | undefined {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new GuiHostProtocolError("Host message is malformed.");
  }

  switch (value.type) {
    case "session/control/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      if (requestId === undefined || sessionId === undefined) throw new GuiHostProtocolError("session/control/ok is missing identifiers.");
      return { type: value.type, requestId, sessionId, state: parseSessionSnapshot(value.state) };
    }
    case "session/new/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      if (requestId === undefined || sessionId === undefined) {
        throw new GuiHostProtocolError(
          "session/new/ok is missing requestId or sessionId.",
        );
      }
      return { type: "session/new/ok", requestId, sessionId, ...(value.state === undefined ? {} : { state: parseSessionSnapshot(value.state) }) };
    }
    case "thought":
    case "answer": {
      const sessionId = requiredString(value, "sessionId");
      if (sessionId === undefined || typeof value.text !== "string") {
        throw new GuiHostProtocolError(
          `${value.type} is missing sessionId or text.`,
        );
      }
      return { type: value.type, sessionId, text: value.text };
    }
    case "prompt/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      if (requestId === undefined || sessionId === undefined) {
        throw new GuiHostProtocolError(
          "prompt/ok is missing requestId or sessionId.",
        );
      }
      return { type: "prompt/ok", requestId, sessionId, ...(value.state === undefined ? {} : { state: parseSessionSnapshot(value.state) }) };
    }
    case "error": {
      if (typeof value.message !== "string") {
        throw new GuiHostProtocolError("error is missing message.");
      }
      const requestId = optionalString(value, "requestId");
      const sessionId = optionalString(value, "sessionId");
      const message: Extract<ServerMessage, { type: "error" }> = {
        type: "error",
        message: value.message,
        ...(requestId === undefined ? {} : { requestId }),
        ...(sessionId === undefined ? {} : { sessionId }),
      };
      return message;
    }
    default:
      return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  if (!(key in record)) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
