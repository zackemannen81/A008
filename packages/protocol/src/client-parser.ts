import { parseSessionSnapshot, type ClientMessage, type ServerMessage } from "./schemas.js";
export class GuiHostProtocolError extends Error {
  override readonly name = "GuiHostProtocolError";
}

export function encodeClientMessage(message: ClientMessage): string {
  switch (message.type) {
    case "tool/permission": return JSON.stringify(message);
    case "session/control":
      return JSON.stringify({ type: message.type, requestId: message.requestId, sessionId: message.sessionId, control: message.control });
    case "session/resume":
      return JSON.stringify({ type: message.type, requestId: message.requestId, sessionId: message.sessionId, resumeToken: message.resumeToken });
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
        ...(message.attachment === undefined ? {} : { attachment: message.attachment }),
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
    case "tool/permission": {
      for (const key of ["sessionId", "id", "title", "text"]) if (typeof value[key] !== "string") throw new GuiHostProtocolError("Invalid tool permission.");
      return { type: "tool/permission", sessionId: value.sessionId as string, id: value.id as string, title: value.title as string, text: value.text as string };
    }
    case "tool": {
      for (const key of ["sessionId", "id", "title", "status", "text"]) if (typeof value[key] !== "string") throw new GuiHostProtocolError("Invalid tool activity.");
      return { type: "tool", sessionId: value.sessionId as string, id: value.id as string, title: value.title as string, status: value.status as string, text: value.text as string };
    }
    case "session/activity": {
      const sessionId = requiredString(value, "sessionId");
      if (!sessionId || typeof value.active !== "boolean" || value.text !== undefined && typeof value.text !== "string") throw new GuiHostProtocolError("Invalid session activity.");
      return { type: value.type, sessionId, active: value.active, ...(value.text === undefined ? {} : { text: value.text }), ...(value.state === undefined ? {} : { state: parseSessionSnapshot(value.state) }) };
    }
    case "session/control/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      if (requestId === undefined || sessionId === undefined) throw new GuiHostProtocolError("session/control/ok is missing identifiers.");
      return { type: value.type, requestId, sessionId, state: parseSessionSnapshot(value.state) };
    }
    case "session/new/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      const resumeToken = optionalResumeToken(value);
      if (requestId === undefined || sessionId === undefined) throw new GuiHostProtocolError("session/new/ok is missing identifiers.");
      return { type: value.type, requestId, sessionId, ...(resumeToken === undefined ? {} : { resumeToken }), ...(value.state === undefined ? {} : { state: parseSessionSnapshot(value.state) }) };
    }
    case "session/resume/ok": {
      const requestId = requiredString(value, "requestId");
      const sessionId = requiredString(value, "sessionId");
      const resumeToken = optionalResumeToken(value);
      if (requestId === undefined || sessionId === undefined || resumeToken === undefined) throw new GuiHostProtocolError("session/resume/ok is missing valid identifiers or resume capability.");
      return { type: value.type, requestId, sessionId, resumeToken, ...(value.state === undefined ? {} : { state: parseSessionSnapshot(value.state) }) };
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

function optionalResumeToken(record: Record<string, unknown>): string | undefined {
  if (!("resumeToken" in record)) return undefined;
  const value = record.resumeToken;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new GuiHostProtocolError("Invalid resume capability.");
  return value;
}
