import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  v2AuthenticateSchema,
  v2SessionCommandSchema,
  type V2CommandReceipt,
  type V2SessionCommand,
  type V2SessionServerFrame,
  type V2SessionState,
} from "../../packages/protocol/src/index.js";
import { acceptWebSocket, type GuiWebSocket } from "./websocket.js";
import { V2Auth, V2AuthError, V2_LIMITS, type V2Principal } from "./v2-auth.js";
import {
  isV2MutationCommand,
  isV2ReceiptCommand,
  mutationCommandId,
} from "./v2-command-receipts.js";
import { V2SessionService } from "./v2-session.js";

interface AuthenticatedConnection {
  principal: V2Principal;
  readonly projectId: string;
  readonly ticketSessionId?: string;
  attachedSessionId?: string;
  creatingSession?: boolean;
}

interface CommandRunResult {
  readonly state: V2SessionState;
  readonly resumeCapability?: string;
  readonly snapshot: boolean;
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
    await options.sessions.terminateConnection(connectionId);
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
  let commandId: string | undefined;
  let receiptStarted = false;
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

    if (isV2MutationCommand(command)) commandId = mutationCommandId(command);

    if (isV2ReceiptCommand(command)) {
      const begun = sessions.beginCommand(connection.principal, command);
      if (begun.kind === "existing") {
        sendExistingReceipt(auth, command, begun.receipt, send);
        return;
      }
      receiptStarted = true;
    }

    const outcome = await runCommand(
      command,
      connection,
      connectionId,
      sessions,
      send,
    );
    const state = outcome.state;
    const receipt =
      commandId && receiptStarted
        ? sessions.settleCommandSuccess(connection.principal, commandId, {
            sessionId: state.sessionId,
          })
        : undefined;
    send({
      type: "result",
      serverInstanceId: auth.serverInstanceId,
      requestId: command.requestId,
      ...(commandId ? { commandId } : {}),
      action: command.action,
      projectId: command.projectId,
      sessionId: state.sessionId,
      state,
      ...(outcome.resumeCapability
        ? { resumeCapability: outcome.resumeCapability }
        : {}),
      ...(receipt ? { receipt } : {}),
    });
    if (outcome.snapshot)
      sessions.finishSnapshot(state.sessionId, connectionId);
  } catch (error) {
    if (
      (command.action === "session/inspect" ||
        command.action === "session/resume") &&
      "sessionId" in command
    )
      sessions.finishSnapshot(command.sessionId, connectionId);
    const details = failureDetails(error);
    const receipt =
      commandId && receiptStarted
        ? sessions.settleCommandFailure(connection.principal, commandId, {
            ...details,
            ...("sessionId" in command ? { sessionId: command.sessionId } : {}),
          })
        : undefined;
    send(
      v2Failure(
        auth,
        details.code,
        details.message,
        command.requestId,
        command.projectId,
        "sessionId" in command ? command.sessionId : undefined,
        details.retryable,
        commandId,
        receipt,
      ),
    );
  }
}

function sendExistingReceipt(
  auth: V2Auth,
  command: V2SessionCommand,
  receipt: V2CommandReceipt,
  send: (frame: V2SessionServerFrame) => void,
): void {
  if (receipt.status === "failed" && receipt.error) {
    send(
      v2Failure(
        auth,
        receipt.error.code,
        receipt.error.message,
        command.requestId,
        command.projectId,
        receipt.sessionId ??
          ("sessionId" in command ? command.sessionId : undefined),
        receipt.error.retryable,
        receipt.commandId,
        receipt,
      ),
    );
    return;
  }
  send({
    type: "result",
    serverInstanceId: auth.serverInstanceId,
    requestId: command.requestId,
    commandId: receipt.commandId,
    action: command.action,
    projectId: command.projectId,
    ...(receipt.sessionId ? { sessionId: receipt.sessionId } : {}),
    receipt,
  });
}
async function runCommand(
  command: V2SessionCommand,
  connection: AuthenticatedConnection,
  connectionId: string,
  sessions: V2SessionService,
  send: (frame: V2SessionServerFrame) => void,
): Promise<CommandRunResult> {
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
      return {
        state,
        resumeCapability: sessions.resumeCapability(
          connection.principal,
          command.projectId,
          state.sessionId,
          connectionId,
        ),
        snapshot: false,
      };
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
    case "session/resume": {
      if (
        connection.attachedSessionId !== undefined &&
        connection.attachedSessionId !== sessionId
      )
        throw new V2AuthError(
          "SESSION_BUSY",
          409,
          "This connection is already scoped to another session.",
        );
      const state = await sessions.resumeSession({
        principal: connection.principal,
        projectId: command.projectId,
        sessionId,
        connectionId,
        resumeCapability: command.payload.resumeCapability,
        emit: send,
      });
      connection.attachedSessionId = sessionId;
      return {
        state,
        resumeCapability: sessions.resumeCapability(
          connection.principal,
          command.projectId,
          sessionId,
          connectionId,
        ),
        snapshot: true,
      };
    }
    case "session/inspect":
      return {
        state: sessions.inspect(
          connection.principal,
          command.projectId,
          sessionId,
          connectionId,
        ),
        snapshot: true,
      };
    case "session/prompt": {
      if (
        Buffer.byteLength(command.payload.text, "utf8") > V2_LIMITS.promptBytes
      )
        throw new V2AuthError(
          "INVALID_REQUEST",
          413,
          "Prompt exceeds the advertised byte limit.",
        );
      return {
        state: await sessions.prompt(
          connection.principal,
          command.projectId,
          sessionId,
          connectionId,
          command.payload.text,
          (turnId) =>
            sessions.noteCommandTurn(
              connection.principal,
              command.commandId,
              turnId,
            ),
        ),
        snapshot: false,
      };
    }
    case "session/cancel":
      return {
        state: sessions.cancel(
          connection.principal,
          command.projectId,
          sessionId,
          connectionId,
        ),
        snapshot: false,
      };
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
      return { state, snapshot: false };
    }
    case "tool/permission":
      return {
        state: sessions.resolvePermission(
          connection.principal,
          command.projectId,
          sessionId,
          connectionId,
          command.payload.permissionId,
          command.payload.allow,
        ),
        snapshot: false,
      };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
function failureDetails(error: unknown): {
  code: import("../../packages/protocol/src/index.js").V2ErrorCode;
  message: string;
  retryable: boolean;
} {
  if (error instanceof V2AuthError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.status >= 500,
    };
  if (
    error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "PROJECT_BINDING_CONFLICT"
  )
    return {
      code: "PROJECT_BINDING_CONFLICT",
      message: "Project binding conflict.",
      retryable: false,
    };
  return {
    code: "RUNTIME_FAILED",
    message: "The V2 session operation failed.",
    retryable: false,
  };
}

function toFailure(
  auth: V2Auth,
  error: unknown,
  requestId?: string,
  projectId?: string,
  sessionId?: string,
): V2SessionServerFrame {
  const details = failureDetails(error);
  return v2Failure(
    auth,
    details.code,
    details.message,
    requestId,
    projectId,
    sessionId,
    details.retryable,
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
  commandId?: string,
  receipt?: V2CommandReceipt,
): V2SessionServerFrame {
  return {
    type: "error",
    serverInstanceId: auth.serverInstanceId,
    code,
    message,
    retryable,
    ...(requestId ? { requestId } : {}),
    ...(commandId ? { commandId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(receipt ? { receipt } : {}),
  };
}
