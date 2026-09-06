#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ChatError, isChatError } from "../core/errors.js";
import { parseMemoryInspectionQuery } from "../memory/knowledge/inspection.js";
import { sniffSourceMediaType } from "../ingest/media-type.js";
import {
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import {
  runTerminalCommand,
  type TerminalRunner,
} from "../tools/terminal.js";
import {
  createSpawnedAcpBridge,
  type AcpBridge,
} from "./acp-bridge.js";
import {
  ALLOWED_ORIGINS_ENV,
  firstHeaderValue,
  isAllowedOrigin,
  parseAllowedOrigins,
} from "./origin.js";
import {
  DEFAULT_GUI_HOST_BIND,
  DEFAULT_GUI_HOST_PORT,
  GUI_HOST_NAME,
  errorMessage,
  parseClientMessage,
  type GuiHostServerMessage,
} from "./protocol.js";
import { redactWireText, wireSecrets } from "./redact.js";
import {
  resolveSourceStorePath,
  sanitiseUploadFilename,
  writeBlob,
} from "./source-store.js";
import { acceptWebSocket, isWebSocketUpgrade, type GuiWebSocket } from "./websocket.js";

const MAX_JSON_BODY_BYTES = 64 * 1024;
/** Default cap for `POST /v1/upload`; overridable via `GuiHostOptions.maxUploadBytes`. */
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MIME_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface GuiHostOptions {
  readonly host?: string;
  readonly port?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  readonly staticDir?: string;
  readonly runTerminal?: TerminalRunner;
  readonly createAcpBridge?: () => AcpBridge | Promise<AcpBridge>;
  readonly registry?: ModelRegistry;
  readonly stderr?: NodeJS.WritableStream;
  /**
   * Root of the content-addressed source store for `POST /v1/upload`
   * (ADR 0020 D2). Overrides `A008_SOURCE_STORE_PATH`; mainly for tests. When
   * neither is set, `POST /v1/upload` is refused with a configuration error
   * rather than the host failing to start — most hosts never see an upload.
   */
  readonly sourceStorePath?: string;
  /** Byte cap for `POST /v1/upload`, enforced while reading the body. */
  readonly maxUploadBytes?: number;
  /**
   * Origins admitted in addition to same-host and loopback (ADR 0022 D4).
   * Defaults to `A008_GUI_HOST_ALLOWED_ORIGINS`, and to none when unset.
   */
  readonly allowedOrigins?: readonly string[];
}

export interface GuiHost {
  readonly host: string;
  readonly port: number;
  close(): Promise<void>;
}

export async function startGuiHost(
  options: GuiHostOptions = {},
): Promise<GuiHost> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const host = options.host ?? DEFAULT_GUI_HOST_BIND;
  const port = options.port ?? DEFAULT_GUI_HOST_PORT;
  const secrets = wireSecrets(env);
  const registry = options.registry ?? defaultModelRegistry;
  const runTerminal = options.runTerminal ?? runTerminalCommand;
  const staticDir = resolveStaticDir(options.staticDir, cwd, env);
  const storeRoot = resolveSourceStorePath(options.sourceStorePath, cwd, env);
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const allowedOrigins =
    options.allowedOrigins ?? parseAllowedOrigins(env[ALLOWED_ORIGINS_ENV]);
  const requestOriginAllowed = (request: IncomingMessage): boolean =>
    originAllowedBy(request, allowedOrigins);
  const sockets = new Set<GuiWebSocket>();
  let bridge: AcpBridge | undefined;
  let bridgePending: Promise<AcpBridge> | undefined;

  const getBridge = async (): Promise<AcpBridge> => {
    if (bridge !== undefined) {
      return bridge;
    }
    if (bridgePending === undefined) {
      bridgePending = Promise.resolve(
        options.createAcpBridge?.() ??
          createSpawnedAcpBridge({
            env,
            cwd,
            ...(options.stderr === undefined ? {} : { stderr: options.stderr }),
          }),
      ).then((created) => {
        bridge = created;
        return created;
      });
    }
    try {
      return await bridgePending;
    } catch (error) {
      bridgePending = undefined;
      throw error;
    }
  };

  /**
   * Give back every ACP session a closing socket owned.
   *
   * This deliberately reads `bridge` instead of calling `getBridge()`: a socket
   * that never opened a session must not spawn an ACP subprocess on its way
   * out. Failures are swallowed because this runs on a close path with no one
   * left to tell — the socket is already gone, and a rejection here would
   * surface as an unhandled rejection and could take the host down. The set is
   * cleared either way, so a failed release is never retried against an agent
   * that has likely already dropped the session itself.
   */
  const releaseSessions = async (sessionIds: Set<string>): Promise<void> => {
    const started = bridge;
    if (started === undefined || sessionIds.size === 0) {
      sessionIds.clear();
      return;
    }
    const releases = [...sessionIds].map(async (sessionId) => {
      try {
        await started.closeSession(sessionId);
      } catch {
        // Intentionally ignored; see the note above.
      }
    });
    sessionIds.clear();
    await Promise.all(releases);
  };

  const sendJson = (
    response: ServerResponse,
    status: number,
    body: unknown,
  ): void => {
    const text = redactWireText(JSON.stringify(body), secrets);
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(text),
    });
    response.end(text);
  };

  const server = createServer((request, response) => {
    void handleHttp({
      request,
      response,
      cwd,
      env,
      registry,
      runTerminal,
      secrets,
      sendJson,
      staticDir,
      storeRoot,
      maxUploadBytes,
      allowedOrigins,
      getBridge,
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = requestPath(request);
    if (pathname !== "/v1/session" || !isWebSocketUpgrade(request)) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    if (!requestOriginAllowed(request)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const ownedSessions = new Set<string>();
    const activePrompts = new Map<string, AbortController>();
    const session: { ws: GuiWebSocket | undefined } = { ws: undefined };
    const ws = acceptWebSocket(request, socket, head, (raw) => {
      const current = session.ws;
      if (current === undefined) {
        return;
      }
      void handleSocketMessage({
        raw,
        ws: current,
        getBridge,
        ownedSessions,
        activePrompts,
        secrets,
      });
    });
    if (ws === undefined) {
      return;
    }
    session.ws = ws;
    sockets.add(ws);
    void ws.closed.then(async () => {
      sockets.delete(ws);
      for (const controller of activePrompts.values()) {
        controller.abort();
      }
      activePrompts.clear();
      await releaseSessions(ownedSessions);
    });
  });

  await listen(server, host, port);
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("GUI host failed to bind a TCP port.");
  }

  return {
    host: address.address,
    port: address.port,
    async close() {
      for (const socket of sockets) {
        socket.close();
      }
      sockets.clear();
      const pending = bridgePending;
      bridgePending = undefined;
      if (pending !== undefined) {
        const started = await pending.catch(() => undefined);
        await started?.close();
      }
      bridge = undefined;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== null && error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
        // Keep-alive sockets from `fetch` would otherwise hold the listener
        // open until their idle timeout expires.
        server.closeAllConnections();
      });
    },
  };
}

async function handleHttp(input: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly registry: ModelRegistry;
  readonly runTerminal: TerminalRunner;
  readonly secrets: readonly string[];
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly staticDir: string | undefined;
  readonly storeRoot: string | undefined;
  readonly maxUploadBytes: number;
  readonly allowedOrigins: readonly string[];
  readonly getBridge: () => Promise<AcpBridge>;
}): Promise<void> {
  const { request, response, sendJson } = input;
  const method = request.method ?? "GET";
  const pathname = requestPath(request);

  if (!originAllowedBy(request, input.allowedOrigins)) {
    sendJson(response, 403, errorBody("Cross-origin requests are refused."));
    return;
  }

  if (pathname === "/v1/memory" && method !== "GET") {
    sendJson(response, 405, errorBody("Memory inspection supports GET only."));
    return;
  }

  try {
    if (method === "GET" && pathname === "/v1/memory") {
      const params = new URL(request.url ?? "/v1/memory", "http://localhost").searchParams;
      const raw: Record<string, unknown> = {};
      for (const [name, value] of params) {
        if (name in raw) { sendJson(response, 400, errorBody("Duplicate memory query parameter.")); return; }
        raw[name] = name === "limit" || name === "offset" ? (/^\d+$/u.test(value) ? Number(value) : NaN) : value;
      }
      let query;
      try { query = parseMemoryInspectionQuery(raw); }
      catch (error) { sendJson(response, 400, errorBody(publicErrorMessage(error))); return; }
      const bridge = await input.getBridge();
      if (bridge.inspectMemory === undefined) {
        sendJson(response, 503, errorBody("This runtime does not support memory inspection. Restart with the current A008 build."));
        return;
      }
      sendJson(response, 200, await bridge.inspectMemory(query));
      return;
    }
    if (method === "GET" && pathname === "/health") {
      sendJson(response, 200, { ok: true, name: GUI_HOST_NAME });
      return;
    }
    if (method === "GET" && pathname === "/v1/models") {
      sendJson(response, 200, {
        models: input.registry.list().map((profile) => ({
          id: profile.id,
          name: profile.name,
        })),
      });
      return;
    }
    if (method === "POST" && pathname === "/v1/shell") {
      if (!isJsonContentType(request)) {
        sendJson(
          response,
          415,
          errorBody("Content-Type must be application/json."),
        );
        return;
      }
      const body = await readJsonBody(request);
      if (!isRecord(body) || typeof body.command !== "string") {
        sendJson(response, 400, errorBody("command must be a string."));
        return;
      }
      const result = await input.runTerminal({
        command: body.command,
        cwd: input.cwd,
        env: input.env,
      });
      sendJson(response, 200, {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        truncated: result.truncated,
      });
      return;
    }
    if (method === "POST" && pathname === "/v1/upload") {
      await handleUpload(input);
      return;
    }
    if ((method === "GET" || method === "HEAD") && input.staticDir !== undefined) {
      const served = tryServeStatic(
        input.staticDir,
        pathname,
        method === "HEAD",
        response,
      );
      if (served) {
        return;
      }
    }
    sendJson(response, 404, errorBody("Not found."));
  } catch (error) {
    if (isChatError(error) && error.code === "configuration") {
      sendJson(response, error.status ?? 400, errorBody(publicErrorMessage(error)));
      return;
    }
    sendJson(response, 500, errorBody(publicErrorMessage(error)));
  }
}

/**
 * `POST /v1/upload` (ADR 0020 D3). Reads the body under the byte cap while
 * streaming (never buffering an oversized body whole), sniffs the media type
 * from the bytes, sanitises the declared filename, writes the blob, and asks
 * the ACP process to ingest it by locator. A failed or not-yet-available
 * ingestion (the agent-side handler is A008-0043's, and may not exist on
 * this branch) never fails the upload: the blob is already durably stored
 * under a stable locator and can be re-extracted later (ADR 0020 D2).
 */
async function handleUpload(input: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly storeRoot: string | undefined;
  readonly maxUploadBytes: number;
  readonly getBridge: () => Promise<AcpBridge>;
}): Promise<void> {
  const { request, response, sendJson } = input;
  if (!isOctetStreamContentType(request)) {
    sendJson(
      response,
      415,
      errorBody("Content-Type must be application/octet-stream."),
    );
    return;
  }
  if (input.storeRoot === undefined) {
    sendJson(
      response,
      400,
      errorBody("A008_SOURCE_STORE_PATH is not configured."),
    );
    return;
  }
  const declaredFilename = firstHeaderValue(request.headers["x-a008-filename"]);
  const { buffer, sha256 } = await readUploadBody(request, input.maxUploadBytes);
  const mediaType = sniffSourceMediaType(buffer);
  const filename = sanitiseUploadFilename(declaredFilename);
  const stored = writeBlob(input.storeRoot, sha256, filename, buffer);

  let extracted = false;
  let artifactId: string | undefined;
  try {
    const bridge = await input.getBridge();
    const result = await bridge.ingestSource({
      locator: stored.locator,
      mediaType,
      filename,
    });
    extracted = true;
    artifactId = result.artifactId;
  } catch {
    // See the function comment: a stored blob outlives a failed ingestion.
  }

  sendJson(response, 200, {
    locator: stored.locator,
    sha256,
    bytes: buffer.length,
    mediaType,
    extracted,
    ...(artifactId === undefined ? {} : { artifactId }),
  });
}

function isOctetStreamContentType(request: IncomingMessage): boolean {
  const header = firstHeaderValue(request.headers["content-type"]);
  if (header === undefined) {
    return false;
  }
  const mime = header.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "application/octet-stream";
}

/**
 * Reads the upload body under `maxBytes`, hashing as it goes. The cap is
 * checked against the declared `Content-Length` before a single byte is
 * read, and again against the running total on every chunk, so an oversized
 * body is refused — and the connection torn down — without ever buffering
 * the whole thing.
 */
async function readUploadBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<{ readonly buffer: Buffer; readonly sha256: string }> {
  const declared = request.headers["content-length"];
  if (typeof declared === "string") {
    const length = Number.parseInt(declared, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      request.destroy();
      throw new ChatError("configuration", "Upload exceeds the maximum allowed size.", {
        status: 413,
      });
    }
  }
  const hash = createHash("sha256");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) {
      request.destroy();
      throw new ChatError("configuration", "Upload exceeds the maximum allowed size.", {
        status: 413,
      });
    }
    hash.update(buffer);
    chunks.push(buffer);
  }
  return { buffer: Buffer.concat(chunks), sha256: hash.digest("hex") };
}

/**
 * HTTP failure body. `message` is the field the A008 GUI shell client reads
 * (`gui/src/terminal/run-shell-command.ts`); `error` is kept for curl and log
 * readers.
 */
function errorBody(message: string): {
  readonly error: string;
  readonly message: string;
} {
  return { error: message, message };
}

function originAllowedBy(
  request: IncomingMessage,
  allowed: readonly string[],
): boolean {
  return isAllowedOrigin(
    firstHeaderValue(request.headers.origin),
    firstHeaderValue(request.headers.host),
    allowed,
  );
}

function isJsonContentType(request: IncomingMessage): boolean {
  const header = firstHeaderValue(request.headers["content-type"]);
  if (header === undefined) {
    return false;
  }
  const mime = header.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "application/json" || mime.endsWith("+json");
}

async function handleSocketMessage(input: {
  readonly raw: string;
  readonly ws: GuiWebSocket;
  readonly getBridge: () => Promise<AcpBridge>;
  readonly ownedSessions: Set<string>;
  readonly activePrompts: Map<string, AbortController>;
  readonly secrets: readonly string[];
}): Promise<void> {
  const parsed = parseClientMessage(input.raw);
  if ("error" in parsed) {
    sendSocket(input.ws, errorMessage(parsed), input.secrets);
    return;
  }
  try {
    if (parsed.type === "session/new") {
      const bridge = await input.getBridge();
      const created =
        parsed.model === undefined
          ? await bridge.newSession()
          : await bridge.newSession(parsed.model);
      input.ownedSessions.add(created.sessionId);
      sendSocket(
        input.ws,
        {
          type: "session/new/ok",
          requestId: parsed.requestId,
          sessionId: created.sessionId,
        },
        input.secrets,
      );
      return;
    }
    if (parsed.type === "cancel") {
      if (!input.ownedSessions.has(parsed.sessionId)) {
        sendSocket(
          input.ws,
          errorMessage({
            error: "Unknown session.",
            requestId: parsed.requestId,
            sessionId: parsed.sessionId,
          }),
          input.secrets,
        );
        return;
      }
      input.activePrompts.get(parsed.sessionId)?.abort();
      const bridge = await input.getBridge();
      bridge.cancel(parsed.sessionId);
      return;
    }
    if (!input.ownedSessions.has(parsed.sessionId)) {
      sendSocket(
        input.ws,
        errorMessage({
          error: "Unknown session.",
          requestId: parsed.requestId,
          sessionId: parsed.sessionId,
        }),
        input.secrets,
      );
      return;
    }
    if (input.activePrompts.has(parsed.sessionId)) {
      sendSocket(
        input.ws,
        errorMessage({
          error: "Session already has an active prompt.",
          requestId: parsed.requestId,
          sessionId: parsed.sessionId,
        }),
        input.secrets,
      );
      return;
    }
    const bridge = await input.getBridge();
    const controller = new AbortController();
    input.activePrompts.set(parsed.sessionId, controller);
    try {
      await bridge.prompt(
        parsed.sessionId,
        parsed.text,
        {
          onThought(text) {
            sendSocket(
              input.ws,
              { type: "thought", sessionId: parsed.sessionId, text },
              input.secrets,
            );
          },
          onAnswer(text) {
            sendSocket(
              input.ws,
              { type: "answer", sessionId: parsed.sessionId, text },
              input.secrets,
            );
          },
        },
        controller.signal,
      );
      sendSocket(
        input.ws,
        {
          type: "prompt/ok",
          requestId: parsed.requestId,
          sessionId: parsed.sessionId,
        },
        input.secrets,
      );
    } finally {
      input.activePrompts.delete(parsed.sessionId);
    }
  } catch (error) {
    sendSocket(
      input.ws,
      errorMessage(
        { message: publicErrorMessage(error) },
        {
          requestId: parsed.requestId,
          ...("sessionId" in parsed ? { sessionId: parsed.sessionId } : {}),
        },
      ),
      input.secrets,
    );
  }
}

function sendSocket(
  ws: GuiWebSocket,
  message: GuiHostServerMessage,
  secrets: readonly string[],
): void {
  ws.send(redactWireText(JSON.stringify(message), secrets));
}

function publicErrorMessage(error: unknown): string {
  if (isChatError(error) || error instanceof Error) {
    return error.message;
  }
  return "GUI host request failed.";
}

function requestPath(request: IncomingMessage): string {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  return url.pathname;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declared = request.headers["content-length"];
  if (typeof declared === "string") {
    const length = Number.parseInt(declared, 10);
    if (Number.isFinite(length) && length > MAX_JSON_BODY_BYTES) {
      throw new ChatError("configuration", "Request body is too large.");
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_JSON_BODY_BYTES) {
      throw new ChatError("configuration", "Request body is too large.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ChatError("configuration", "Request body is not valid JSON.");
  }
}

function tryServeStatic(
  staticDir: string,
  pathname: string,
  headOnly: boolean,
  response: ServerResponse,
): boolean {
  const target = safeStaticPath(staticDir, pathname);
  if (target === undefined || !existsSync(target)) {
    return false;
  }
  const stats = statSync(target);
  if (!stats.isFile()) {
    return false;
  }
  const mime = MIME_TYPES[extname(target).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, {
    "content-type": mime,
    "content-length": stats.size,
    "cache-control": "no-store",
  });
  if (headOnly) {
    response.end();
    return true;
  }
  createReadStream(target).pipe(response);
  return true;
}

function safeStaticPath(root: string, urlPath: string): string | undefined {
  const decoded = decodeURIComponent(urlPath);
  const relativeUrl = decoded === "/" ? "index.html" : decoded.replace(/^\/+/u, "");
  if (relativeUrl.split(/[/\\]/u).includes("..")) {
    return undefined;
  }
  const resolved = resolve(root, relativeUrl);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || rel.split(sep).includes("..")) {
    return undefined;
  }
  return resolved;
}

function resolveStaticDir(
  explicit: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  const configured = explicit ?? env.A008_GUI_STATIC_DIR?.trim();
  if (configured !== undefined && configured.length > 0 && existsSync(configured)) {
    return resolve(configured);
  }
  const fromCwd = join(cwd, "gui", "dist");
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromPackage = fileURLToPath(new URL("../../../gui/dist", import.meta.url));
  if (existsSync(fromPackage)) {
    return fromPackage;
  }
  return undefined;
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function parseListenOptions(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): { readonly host: string; readonly port: number } {
  let host = env.A008_GUI_HOST_BIND?.trim() || DEFAULT_GUI_HOST_BIND;
  let port = DEFAULT_GUI_HOST_PORT;
  const envPort = env.A008_GUI_HOST_PORT?.trim();
  if (envPort !== undefined && envPort.length > 0) {
    port = Number.parseInt(envPort, 10);
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--host" && value !== undefined) {
      host = value;
      index += 1;
      continue;
    }
    if (argument === "--port" && value !== undefined) {
      port = Number.parseInt(value, 10);
      index += 1;
    }
  }
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new ChatError(
      "configuration",
      "GUI host port must be an integer between 0 and 65535.",
    );
  }
  return { host, port };
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  const stderr = process.stderr;
  try {
    const listenOptions = parseListenOptions(process.argv.slice(2), process.env);
    const host = await startGuiHost({
      ...listenOptions,
      stderr,
    });
    stderr.write(`A008-gui-host listening on http://${host.host}:${String(host.port)}\n`);
  } catch (error: unknown) {
    stderr.write(
      `A008-gui-host failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  }
}
