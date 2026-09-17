import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  v2AuthenticateSchema,
  v2SessionCommandSchema,
  type V2SessionCommand,
  type V2SessionServerFrame,
} from "../../packages/protocol/src/index.js";
import { acceptWebSocket, type GuiWebSocket } from "./websocket.js";
import { V2Auth, V2AuthError, V2_LIMITS, type V2Principal } from "./v2-auth.js";
import { V2SessionService } from "./v2-session.js";

interface AuthenticatedConnection {
  principal: V2Principal;
  readonly projectId: string;
  readonly ticketSessionId?: string;
  attachedSessionId?: string;
  creatingSession?: boolean;
}

export function openV2SessionSocket(options: {
  request: IncomingMessage;
  socket: Duplex;
  head: Buffer;
  auth: V2Auth;
  sessions: V2SessionService;
  authorizationCheckMs?: number;
  redact?: (text: string) => string;
}): GuiWebSocket | undefined {
  const connectionId = `connection_${randomUUID()}`;
  let authenticated: AuthenticatedConnection | undefined;
  let ws: GuiWebSocket | undefined;
  let authTimer: ReturnType<typeof setTimeout> | undefined;
  let authorityTimer: ReturnType<typeof setInterval> | undefined;

  const send = (frame: V2SessionServerFrame): void => {
    if (!ws) return;
    const encoded = JSON.stringify(frame);
    const text = options.redact ? options.redact(encoded) : encoded;
    if (Buffer.byteLength(text, "utf8") <= V2_LIMITS.outputFrameBytes) {
      ws.send(text);
      return;
    }
    const requestId = "requestId" in frame ? frame.requestId : undefined;
    ws.send(
      JSON.stringify(
        v2Failure(
          options.auth,
          "SNAPSHOT_TOO_LARGE",
          "V2 output exceeded the advertised frame limit.",
          requestId,
          authenticated?.projectId,
        ),
      ),
    );
  };

  const revoke = async (message: string): Promise<void> => {
    if (authorityTimer) clearInterval(authorityTimer);
    authorityTimer = undefined;
    await options.sessions.closeConnection(connectionId);
    ws?.close(4003, message);
  };
  const beginAuthorityChecks = (): void => {
    const interval = options.authorizationCheckMs ?? 1000;
    authorityTimer = setInterval(() => {
      if (!authenticated) return;
      try {
        const current = options.auth.authorize(
          authenticated.principal,
          authenticated.projectId,
          "session",
        );
        authenticated.principal = current;
      } catch {
        void revoke("credential revoked or expired");
      }
    }, interval);
    authorityTimer.unref?.();
  };

  const onMessage = (raw: string): void => {
    if (!authenticated) {
      const parsed = safeJson(raw);
      const frame = v2AuthenticateSchema.safeParse(parsed);
      if (!frame.success) {
        send(
          v2Failure(
            options.auth,
            "UNAUTHENTICATED",
            "The first V2 frame must authenticate with a valid ticket.",
          ),
        );
        ws?.close(4001, "authentication required");
        return;
      }
      try {
        const consumed = options.auth.consume(frame.data.ticket);
        authenticated = {
          principal: consumed.principal,
          projectId: consumed.scope.projectId,
          ...(consumed.scope.sessionId
            ? { ticketSessionId: consumed.scope.sessionId }
            : {}),
        };
        if (authTimer) clearTimeout(authTimer);
        authTimer = undefined;
        beginAuthorityChecks();
        send({
          type: "authenticated",
          serverInstanceId: options.auth.serverInstanceId,
          projectId: consumed.scope.projectId,
          ...(consumed.scope.sessionId
            ? { sessionId: consumed.scope.sessionId }
            : {}),
        });
      } catch (error) {
        send(toFailure(options.auth, error));
        ws?.close(4001, "authentication failed");
      }
      return;
    }
    void dispatch(
      raw,
      authenticated,
      connectionId,
      options.auth,
      options.sessions,
      send,
    );
  };

  ws = acceptWebSocket(
    options.request,
    options.socket,
    options.head,
    onMessage,
    {
      protocol: "a008.v2",
      maxMessageBytes: () =>
        authenticated ? V2_LIMITS.inputFrameBytes : V2_LIMITS.preauthFrameBytes,
    },
  );
  if (!ws) return undefined;
  authTimer = setTimeout(() => {
    send(
      v2Failure(
        options.auth,
        "UNAUTHENTICATED",
        "V2 authentication timed out.",
      ),
    );
    ws?.close(4001, "authentication timeout");
  }, V2_LIMITS.authenticationDeadlineMs);
  authTimer.unref?.();
  void ws.closed.then(async () => {
    if (authTimer) clearTimeout(authTimer);
    if (authorityTimer) clearInterval(authorityTimer);
    await options.sessions.closeConnection(connectionId);
  });
  return ws;
}

async function dispatch(
  raw: string,
  connection: AuthenticatedConnection,
  connectionId: string,
  auth: V2Auth,
  sessions: V2SessionService,
  send: (frame: V2SessionServerFrame) => void,
): Promise<void> {
  const parsed = v2SessionCommandSchema.safeParse(safeJson(raw));
  if (!parsed.success) {
    send(v2Failure(auth, "INVALID_REQUEST", "Invalid V2 session command."));
    return;
  }
  const command = parsed.data;
  try {
    connection.principal = auth.authorize(
      connection.principal,
      connection.projectId,
      "session",
    );
    if (command.projectId !== connection.projectId)
      throw new V2AuthError(
        "FORBIDDEN",
        403,
        "The socket is bound to another project.",
      );
    const state = await runCommand(
      command,
      connection,
      connectionId,
      sessions,
      send,
    );
    send({
      type: "result",
      serverInstanceId: auth.serverInstanceId,
      requestId: command.requestId,
      action: command.action,
      projectId: command.projectId,
      sessionId: state.sessionId,
      state,
    });
  } catch (error) {
    send(
      toFailure(
        auth,
        error,
        command.requestId,
        command.projectId,
        "sessionId" in command ? command.sessionId : undefined,
      ),
    );
  }
}
async function runCommand(
  command: V2SessionCommand,
  connection: AuthenticatedConnection,
  connectionId: string,
  sessions: V2SessionService,
  send: (frame: V2SessionServerFrame) => void,
) {
  if (command.action === "session/new") {
    if (
      connection.ticketSessionId ||
      connection.attachedSessionId ||
      connection.creatingSession
    ) {
      throw new V2AuthError(
        "SESSION_BUSY",
        409,
        "This connection is already scoped to a session.",
      );
    }
    connection.creatingSession = true;
    try {
      const state = await sessions.newSession({
        principal: connection.principal,
        projectId: command.projectId,
        connectionId,
        ...(command.payload?.model ? { model: command.payload.model } : {}),
        emit: send,
      });
      connection.attachedSessionId = state.sessionId;
      return state;
    } finally {
      delete connection.creatingSession;
    }
  }
  const sessionId = command.sessionId;
  const bound = connection.ticketSessionId ?? connection.attachedSessionId;
  if (bound !== undefined && bound !== sessionId)
    throw new V2AuthError(
      "FORBIDDEN",
      403,
      "The connection is bound to another session.",
    );
  switch (command.action) {
    case "session/inspect":
      return sessions.inspect(
        connection.principal,
        command.projectId,
        sessionId,
        connectionId,
      );
    case "session/prompt": {
      if (
        Buffer.byteLength(command.payload.text, "utf8") > V2_LIMITS.promptBytes
      )
        throw new V2AuthError(
          "INVALID_REQUEST",
          413,
          "Prompt exceeds the advertised byte limit.",
        );
      return sessions.prompt(
        connection.principal,
        command.projectId,
        sessionId,
        connectionId,
        command.payload.text,
      );
    }
    case "session/cancel":
      return sessions.cancel(
        connection.principal,
        command.projectId,
        sessionId,
        connectionId,
      );
    case "session/control": {
      const state = await sessions.control(
        connection.principal,
        command.projectId,
        sessionId,
        connectionId,
        command.payload.control,
      );
      if (command.payload.control.action === "close")
        delete connection.attachedSessionId;
      return state;
    }
    case "tool/permission":
      return sessions.resolvePermission(
        connection.principal,
        command.projectId,
        sessionId,
        connectionId,
        command.payload.permissionId,
        command.payload.allow,
      );
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
function toFailure(
  auth: V2Auth,
  error: unknown,
  requestId?: string,
  projectId?: string,
  sessionId?: string,
): V2SessionServerFrame {
  if (error instanceof V2AuthError)
    return v2Failure(
      auth,
      error.code,
      error.message,
      requestId,
      projectId,
      sessionId,
      error.status >= 500,
    );
  if (
    error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "PROJECT_BINDING_CONFLICT"
  ) {
    return v2Failure(
      auth,
      "PROJECT_BINDING_CONFLICT",
      error instanceof Error ? error.message : "Project binding conflict.",
      requestId,
      projectId,
      sessionId,
    );
  }
  return v2Failure(
    auth,
    "RUNTIME_FAILED",
    "The V2 session operation failed.",
    requestId,
    projectId,
    sessionId,
    false,
  );
}

function v2Failure(
  auth: V2Auth,
  code: import("../../packages/protocol/src/index.js").V2ErrorCode,
  message: string,
  requestId?: string,
  projectId?: string,
  sessionId?: string,
  retryable = false,
): V2SessionServerFrame {
  return {
    type: "error",
    serverInstanceId: auth.serverInstanceId,
    code,
    message,
    retryable,
    ...(requestId ? { requestId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
}
