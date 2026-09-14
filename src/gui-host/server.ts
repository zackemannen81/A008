#!/usr/bin/env node
import type { HttpError, UploadedSource, ShellHostResult } from '../../packages/protocol/src/index.js';

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
import { type AcpBridge } from "./acp-bridge.js";
import { createLocalAcpBridge } from "./local-acp-bridge.js";
import { ProjectRuntimeRegistry } from "../engine/project-runtime-registry.js";
import { DeviceRegistry } from "./device-registry.js";
import { V2Auth, handleV2AuthHttp } from "./v2-auth.js";
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
import { createPinAuthGate, GUI_PIN_ENV, GUI_PIN_LOGIN_PATH } from "./pin-auth.js";
import {
  resolveSourceStorePath,
  sanitiseUploadFilename,
  writeBlob,
} from "./source-store.js";
import { acceptWebSocket, isWebSocketUpgrade, type GuiWebSocket } from "./websocket.js";
import {
  assertPathOutsideRepo,
  defaultCatalogPath,
} from "../core/user-catalog.js";
import {
  defaultSecretsPath,
  resolveKieApiKey,
  resolveNvidiaApiKey,
  resolveOpenAiApiKey,
} from "../core/provider-secrets.js";
import { findRepositoryRoot, moduleDirectory } from "../runtime/local-runtime-config.js";
import { handleBrowserFrameCheck } from "./browser-frame.js";
import {
  bindingFor,
  handleDirectoryList,
  handleProjectBootstrap,
  handleProjectList,
  handleProjectOpen,
  handleProjectPreview,
} from "./project-routes.js";
import { readProjectRegistry, resolveProjectsPath } from "../bootstrap/registry.js";
import { defaultSqlitePath, PROJECT_ID_ENV, SQLITE_PATH_ENV } from "../runtime/local-runtime-config.js";
import {
  handleBlobGet,
  handleImageGenerate,
  handleNvidiaCatalogAdd,
  handleKieCatalogGet,
  handleNvidiaCatalogGet,
  handleNvidiaCatalogRemove,
  handleProviderSettingsPost,
  mergedModels,
  providerSettingsView,
  type FetchLike,
} from "./provider-routes.js";

const MAX_JSON_BODY_BYTES = 64 * 1024;
/** Default cap for `POST /v1/upload`; overridable via `GuiHostOptions.maxUploadBytes`. */
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_WEBSOCKET_HEARTBEAT_MS = 25_000;
const DEFAULT_SESSION_RESUME_GRACE_MS = 45_000;

interface SessionLease {
  readonly resumeToken: string;
  attached: boolean;
  releaseTimer?: ReturnType<typeof setTimeout>;
}
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
  /** Borrowed shared runtime owner; caller disposes it after all hosts close. */
  readonly projectRegistry?: ProjectRuntimeRegistry;
  /** Engine-only bearer capability; standalone host remains unchanged. */
  readonly accessToken?: string;
  /** Optional standalone six-digit browser PIN. */
  readonly pin?: string;
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
  readonly fetch?: FetchLike;
  readonly catalogPath?: string;
  readonly secretsPath?: string;
  readonly projectsPath?: string;
  /** Host WebSocket ping cadence; defaults to 25 seconds. */
  readonly webSocketHeartbeatMs?: number;
  /** How long a disconnected ACP session may be resumed; defaults to 45 seconds. */
  readonly sessionResumeGraceMs?: number;
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
  const configuredPin = options.pin?.trim();
  const pin = configuredPin === undefined || configuredPin === "" ? undefined : configuredPin;
  if (pin !== undefined && !/^\d{6}$/u.test(pin)) {
    throw new ChatError("configuration", "A008 GUI PIN must contain exactly six digits.");
  }
  const pinAuth = createPinAuthGate(pin);
  const configuredWorkspace = options.cwd ?? (env.A008_GUI_WORKSPACE?.trim() || process.cwd());
  if (!isAbsolute(configuredWorkspace)) throw new ChatError("configuration", "GUI workspace must be an absolute directory.");
  const cwd = realpathSync(configuredWorkspace);
  if (!statSync(cwd).isDirectory()) throw new ChatError("configuration", "GUI workspace must be a directory.");
  const projectsPath = options.projectsPath ?? resolveProjectsPath(env);
  const workspace = {
    cwd,
    projectId: undefined as string | undefined,
    useGlobalMemory: true,
  };
  const host = options.host ?? DEFAULT_GUI_HOST_BIND;
  const port = options.port ?? DEFAULT_GUI_HOST_PORT;
  const registry = options.registry ?? defaultModelRegistry;
  const runTerminal = options.runTerminal ?? runTerminalCommand;
  const staticDir = resolveStaticDir(options.staticDir, cwd, env);
  const storeRoot = resolveSourceStorePath(options.sourceStorePath, cwd, env);
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const webSocketHeartbeatMs = positiveDuration(options.webSocketHeartbeatMs ?? DEFAULT_WEBSOCKET_HEARTBEAT_MS, "WebSocket heartbeat");
  const sessionResumeGraceMs = positiveDuration(options.sessionResumeGraceMs ?? DEFAULT_SESSION_RESUME_GRACE_MS, "Session resume grace");
  const allowedOrigins =
    options.allowedOrigins ?? parseAllowedOrigins(env[ALLOWED_ORIGINS_ENV]);
  const fetchImpl = options.fetch ?? fetch;
  const repoRoot = findRepositoryRoot(moduleDirectory(import.meta.url));
  const catalogPath = options.catalogPath ?? defaultCatalogPath(env);
  const secretsPath = options.secretsPath ?? defaultSecretsPath(env);
  assertPathOutsideRepo(catalogPath, repoRoot, "A008_CATALOG_PATH");
  assertPathOutsideRepo(secretsPath, repoRoot, "A008_SECRETS_PATH");
  const secrets = [
    ...wireSecrets(env),
    resolveNvidiaApiKey(env, secretsPath),
    resolveKieApiKey(env, secretsPath),
    resolveOpenAiApiKey(env, secretsPath),
    pin,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const requestOriginAllowed = (request: IncomingMessage): boolean =>
    originAllowedBy(request, allowedOrigins);
  const sockets = new Set<GuiWebSocket>();
  const sessionLeases = new Map<string, SessionLease>();
  let bridge: AcpBridge | undefined;
  let bridgePending: Promise<AcpBridge> | undefined;
  const projectRegistry = options.projectRegistry ?? new ProjectRuntimeRegistry({ env, ...(options.stderr ? { stderr: options.stderr } : {}) });
  const v2Auth = options.accessToken ? undefined : new V2Auth({ devices: new DeviceRegistry(env), pin: pinAuth,
    projectExists: id => readProjectRegistry(projectsPath).projects.some(project => project.projectId === id) });

  const acpEnv = (): NodeJS.ProcessEnv => ({
    ...env,
    ...(resolveNvidiaApiKey(env, secretsPath)
      ? { NVIDIA_API_KEY: resolveNvidiaApiKey(env, secretsPath) }
      : {}),
    ...(resolveKieApiKey(env, secretsPath)
      ? { KIE_API_KEY: resolveKieApiKey(env, secretsPath) }
      : {}),
    ...(resolveOpenAiApiKey(env, secretsPath)
      ? { OPENAI_API_KEY: resolveOpenAiApiKey(env, secretsPath) }
      : {}),
    ...(workspace.projectId ? { [PROJECT_ID_ENV]: workspace.projectId } : {}),
    ...(workspace.useGlobalMemory
      ? {}
      : { [SQLITE_PATH_ENV]: ":memory:" }),
    ...(workspace.useGlobalMemory && !env[SQLITE_PATH_ENV]
      ? { [SQLITE_PATH_ENV]: defaultSqlitePath() }
      : {}),
  });
  const getBridge = async (): Promise<AcpBridge> => {
    if (bridge !== undefined) {
      return bridge;
    }
    if (bridgePending === undefined) {
      bridgePending = Promise.resolve().then(() =>
        options.createAcpBridge?.() ??
          createLocalAcpBridge({
            registry: projectRegistry,
            env: acpEnv(),
            cwd: workspace.cwd,
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
  const applyWorkspace = async (next: {
    cwd: string;
    projectId: string;
    useGlobalMemory: boolean;
  }): Promise<void> => {
    const pending = bridgePending;
    bridgePending = undefined;
    if (pending !== undefined) {
      const started = await pending.catch(() => undefined);
      await started?.close();
    } else if (bridge !== undefined) {
      await bridge.close();
    }
    bridge = undefined;
    workspace.cwd = next.cwd;
    workspace.projectId = next.projectId;
    workspace.useGlobalMemory = next.useGlobalMemory;
  };

  const forgetLease = (sessionId: string): void => {
    const lease = sessionLeases.get(sessionId);
    if (lease?.releaseTimer !== undefined) clearTimeout(lease.releaseTimer);
    sessionLeases.delete(sessionId);
  };

  const releaseDetachedSession = async (sessionId: string): Promise<void> => {
    const lease = sessionLeases.get(sessionId);
    if (lease === undefined || lease.attached) return;
    forgetLease(sessionId);
    const started = bridge;
    if (started === undefined) return;
    try { await started.closeSession(sessionId); } catch { /* detached release is best-effort */ }
  };

  const detachSessions = (sessionIds: Set<string>): void => {
    for (const sessionId of sessionIds) {
      const lease = sessionLeases.get(sessionId);
      if (lease === undefined) continue;
      lease.attached = false;
      if (lease.releaseTimer !== undefined) clearTimeout(lease.releaseTimer);
      lease.releaseTimer = setTimeout(() => { void releaseDetachedSession(sessionId); }, sessionResumeGraceMs);
      lease.releaseTimer.unref?.();
    }
    sessionIds.clear();
  };

  const registerLease = (sessionId: string): string => {
    const resumeToken = randomBytes(32).toString("hex");
    sessionLeases.set(sessionId, { resumeToken, attached: true });
    return resumeToken;
  };

  const claimLease = (sessionId: string, resumeToken: string): boolean => {
    const lease = sessionLeases.get(sessionId);
    if (lease === undefined || lease.attached || !safeTextEqual(lease.resumeToken, resumeToken)) return false;
    if (lease.releaseTimer !== undefined) clearTimeout(lease.releaseTimer);
    delete lease.releaseTimer;
    lease.attached = true;
    return true;
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

  const accessAuthorized = (request: IncomingMessage): boolean => {
    if (options.accessToken === undefined) return false;
    const token = request.headers.authorization?.replace(/^Bearer /, "") ?? new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("access") ?? "";
    const expected = Buffer.from(options.accessToken);
    const actual = Buffer.from(token);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  };
  const requestAuthorized = (request: IncomingMessage): boolean => {
    if (options.accessToken === undefined && !pinAuth.enabled) return true;
    return accessAuthorized(request) || (pinAuth.enabled && pinAuth.authorized(request));
  };
  const sendHtml = (response: ServerResponse, status: number, text: string): void => {
    response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(text) });
    response.end(text);
  };
  const handlePinLogin = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!requestOriginAllowed(request)) { sendJson(response, 403, errorBody("Cross-origin requests are refused.")); return; }
    if (request.method !== "POST") { sendJson(response, 405, errorBody("PIN login supports POST only.")); return; }
    if (!isJsonContentType(request)) { sendJson(response, 415, errorBody("Content-Type must be application/json.")); return; }
    const body = await readJsonBody(request);
    const candidate = isRecord(body) && typeof body.pin === "string" ? body.pin : "";
    const result = pinAuth.attempt(request, candidate);
    if (!result.ok) {
      if (result.retryAfterSeconds !== undefined) response.setHeader("retry-after", String(result.retryAfterSeconds));
      sendJson(response, result.retryAfterSeconds === undefined ? 401 : 429, errorBody(result.retryAfterSeconds === undefined ? "Invalid PIN." : "Too many PIN attempts. Try again shortly."));
      return;
    }
    response.setHeader("set-cookie", pinAuth.sessionCookie(request));
    sendJson(response, 200, { ok: true });
  };
  const server = createServer((request, response) => {
    const pathname = requestPath(request);
    if (v2Auth && pathname.startsWith("/v2/")) {
      void handleV2AuthHttp({ auth: v2Auth, request, response, originAllowed: requestOriginAllowed(request), readJson: readJsonBody, sendJson });
      return;
    }
    if (pinAuth.enabled && pathname === GUI_PIN_LOGIN_PATH) {
      void handlePinLogin(request, response);
      return;
    }
    if (pinAuth.enabled && (pathname === "/" || pathname === "/index.html") && !pinAuth.authorized(request)) {
      sendHtml(response, 200, pinAuth.loginPage());
      return;
    }
    if (pathname.startsWith("/v1/") && !requestAuthorized(request)) {
      const message = pinAuth.enabled ? "Authentication required." : "Engine panel authorization required.";
      sendJson(response, 401, errorBody(message));
      return;
    }
    void handleHttp({
      request,
      response,
      cwd: workspace.cwd,
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
      fetchImpl,
      catalogPath,
      secretsPath,
      projectsPath,
      applyWorkspace,
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = requestPath(request);
    if (pathname !== "/v1/session" || !isWebSocketUpgrade(request)) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    if (!requestOriginAllowed(request) || !requestAuthorized(request)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const ownedSessions = new Set<string>();
    const observers = new Map<string, () => void>();
    const activePrompts = new Map<string, AbortController>();
    const lifetime = { closed: false };
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
        observers,
        activePrompts,
        lifetime,
        secrets,
        registerLease,
        claimLease,
        forgetLease,
        detachSession(sessionId) { detachSessions(new Set([sessionId])); },
      });
    });
    if (ws === undefined) {
      return;
    }
    session.ws = ws;
    sockets.add(ws);
    const heartbeat = setInterval(() => {
      if (!ws.ping()) ws.close(1001, "heartbeat timeout");
    }, webSocketHeartbeatMs);
    heartbeat.unref?.();
    void ws.closed.then(async () => {
      clearInterval(heartbeat);
      lifetime.closed = true;
      sockets.delete(ws);
      for (const unsubscribe of observers.values()) unsubscribe();
      observers.clear();
      for (const controller of activePrompts.values()) {
        controller.abort();
      }
      activePrompts.clear();
      detachSessions(ownedSessions);
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
      v2Auth?.clear();
      for (const socket of sockets) {
        socket.close();
      }
      sockets.clear();
      for (const lease of sessionLeases.values()) if (lease.releaseTimer !== undefined) clearTimeout(lease.releaseTimer);
      sessionLeases.clear();
      const pending = bridgePending;
      bridgePending = undefined;
      if (pending !== undefined) {
        const started = await pending.catch(() => undefined);
        await started?.close();
      }
      bridge = undefined;
      if (!options.projectRegistry) projectRegistry.close();
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
  readonly fetchImpl: FetchLike;
  readonly catalogPath: string;
  readonly secretsPath: string;
  readonly projectsPath: string;
  readonly applyWorkspace: (next: {
    cwd: string;
    projectId: string;
    useGlobalMemory: boolean;
  }) => Promise<void>;
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
    if (method === "GET" && pathname === "/v1/browser/frame-check") {
      const target = new URL(request.url ?? "/", "http://localhost").searchParams.get("url") ?? "";
      const originHeader = firstHeaderValue(request.headers.origin);
      const host = firstHeaderValue(request.headers.host);
      const embedderOrigin = originHeader || (host ? `http://${host}` : "http://127.0.0.1");
      sendJson(
        response,
        200,
        await handleBrowserFrameCheck({
          url: target,
          embedderOrigin,
          fetch: input.fetchImpl,
        }),
      );
      return;
    }
    if (method === "GET" && pathname === "/v1/models") {
      sendJson(response, 200, {
        models: mergedModels(input.registry, input.catalogPath),
      });
      return;
    }
    if (method === "GET" && pathname === "/v1/catalog/kie") {
      sendJson(response, 200, handleKieCatalogGet(input.catalogPath));
      return;
    }
    if (method === "GET" && pathname === "/v1/catalog/nvidia") {
      sendJson(
        response,
        200,
        await handleNvidiaCatalogGet({
          apiKey: resolveNvidiaApiKey(input.env, input.secretsPath),
          fetch: input.fetchImpl,
          registry: input.registry,
          catalogPath: input.catalogPath,
        }),
      );
      return;
    }
    if (method === "POST" && pathname === "/v1/catalog/nvidia") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      const added = handleNvidiaCatalogAdd(input.catalogPath, await readJsonBody(request));
      sendJson(response, 200, { added });
      return;
    }
    if (method === "DELETE" && pathname === "/v1/catalog/nvidia") {
      const id = new URL(request.url ?? "/", "http://localhost").searchParams.get("id") ?? "";
      handleNvidiaCatalogRemove(input.catalogPath, id);
      sendJson(response, 200, { removed: id });
      return;
    }
    if (method === "GET" && pathname === "/v1/provider-settings") {
      sendJson(
        response,
        200,
        providerSettingsView(input.catalogPath, input.secretsPath, input.env),
      );
      return;
    }
    if (method === "POST" && pathname === "/v1/provider-settings") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      sendJson(
        response,
        200,
        handleProviderSettingsPost({
          catalogPath: input.catalogPath,
          secretsPath: input.secretsPath,
          env: input.env,
          body: await readJsonBody(request),
        }),
      );
      return;
    }
    if (method === "POST" && pathname === "/v1/images") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      sendJson(
        response,
        200,
        await handleImageGenerate({
          apiKey: resolveNvidiaApiKey(input.env, input.secretsPath),
          kieApiKey: resolveKieApiKey(input.env, input.secretsPath),
          fetch: input.fetchImpl,
          catalogPath: input.catalogPath,
          storeRoot: input.storeRoot,
          body: await readJsonBody(request),
        }),
      );
      return;
    }
    const blob = /^\/v1\/blobs\/([a-f0-9]{64})\/([^/]+)$/u.exec(pathname);
    if (method === "GET" && blob) {
      if (handleBlobGet(input.storeRoot, blob[1]!, blob[2]!, response)) return;
      sendJson(response, 404, errorBody("Image not found."));
      return;
    }
    if (method === "GET" && pathname === "/v1/projects") {
      sendJson(response, 200, handleProjectList({ registryPath: input.projectsPath }));
      return;
    }
    if (method === "GET" && pathname === "/v1/projects/browse") {
      const pathValue = new URL(request.url ?? "/", "http://localhost").searchParams.get("path");
      sendJson(response, 200, handleDirectoryList(pathValue));
      return;
    }
    if (method === "POST" && pathname === "/v1/projects/preview") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      sendJson(
        response,
        200,
        handleProjectPreview({ registryPath: input.projectsPath }, await readJsonBody(request)),
      );
      return;
    }
    if (method === "POST" && pathname === "/v1/projects/bootstrap") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      const created = handleProjectBootstrap(
        { registryPath: input.projectsPath },
        await readJsonBody(request),
      );
      await input.applyWorkspace(bindingFor(created.project));
      sendJson(response, 200, created);
      return;
    }
    if (method === "POST" && pathname === "/v1/projects/open") {
      if (!isJsonContentType(request)) {
        sendJson(response, 415, errorBody("Content-Type must be application/json."));
        return;
      }
      const opened = handleProjectOpen(
        { registryPath: input.projectsPath },
        await readJsonBody(request),
      );
      await input.applyWorkspace(opened);
      sendJson(response, 200, opened);
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
      } satisfies ShellHostResult);
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
  } satisfies UploadedSource);
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
function errorBody(message: string): HttpError {
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
  readonly observers: Map<string, () => void>;
  readonly activePrompts: Map<string, AbortController>;
  readonly lifetime: { closed: boolean };
  readonly secrets: readonly string[];
  readonly registerLease: (sessionId: string) => string;
  readonly claimLease: (sessionId: string, resumeToken: string) => boolean;
  readonly forgetLease: (sessionId: string) => void;
  readonly detachSession: (sessionId: string) => void;
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
      let state;
      try { state = await bridge.controlSession?.(created.sessionId, { action: "inspect" }); }
      catch (error) { await bridge.closeSession(created.sessionId).catch(() => undefined); throw error; }
      if (input.lifetime.closed) { await bridge.closeSession(created.sessionId).catch(() => undefined); return; }
      input.ownedSessions.add(created.sessionId);
      const resumeToken = input.registerLease(created.sessionId);
      sendSocket(
        input.ws,
        {
          type: "session/new/ok",
          requestId: parsed.requestId,
          sessionId: created.sessionId,
          resumeToken,
          ...(state === undefined ? {} : { state }),
        },
        input.secrets,
      );
      if (bridge.subscribeSession) {
        input.observers.get(created.sessionId)?.();
        input.observers.set(created.sessionId, bridge.subscribeSession(created.sessionId, message => sendSocket(input.ws, message, input.secrets)));
      }
      return;
    }
    if (parsed.type === "session/resume") {
      if (!input.claimLease(parsed.sessionId, parsed.resumeToken)) {
        sendSocket(input.ws, errorMessage({ message: "Session resume is unavailable or expired." }, { requestId: parsed.requestId, sessionId: parsed.sessionId }), input.secrets);
        return;
      }
      input.ownedSessions.add(parsed.sessionId);
      try {
        const bridge = await input.getBridge();
        const state = await bridge.controlSession?.(parsed.sessionId, { action: "inspect" });
        if (input.lifetime.closed) { input.ownedSessions.delete(parsed.sessionId); input.detachSession(parsed.sessionId); return; }
        sendSocket(input.ws, { type: "session/resume/ok", requestId: parsed.requestId, sessionId: parsed.sessionId, resumeToken: parsed.resumeToken, ...(state === undefined ? {} : { state }) }, input.secrets);
        if (bridge.subscribeSession) {
          input.observers.get(parsed.sessionId)?.();
          input.observers.set(parsed.sessionId, bridge.subscribeSession(parsed.sessionId, message => sendSocket(input.ws, message, input.secrets)));
        }
      } catch (error) {
        input.ownedSessions.delete(parsed.sessionId);
        input.detachSession(parsed.sessionId);
        throw error;
      }
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
    if (parsed.type === "tool/permission") {
      const bridge = await input.getBridge();
      if (!bridge.resolveToolPermission) throw new Error("Approve this action in the native client.");
      bridge.resolveToolPermission(parsed.sessionId, parsed.permissionId, parsed.allow);
      return;
    }
    if (parsed.type === "session/control" && parsed.control.action === "close") {
      input.activePrompts.get(parsed.sessionId)?.abort();
      const bridge = await input.getBridge();
      if (bridge.controlSession === undefined) throw new Error("Session controls require the current A008 runtime.");
      const state = await bridge.controlSession(parsed.sessionId, parsed.control);
      input.ownedSessions.delete(parsed.sessionId);
      input.forgetLease(parsed.sessionId);
      sendSocket(input.ws, { type: "session/control/ok", requestId: parsed.requestId, sessionId: parsed.sessionId, state }, input.secrets);
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
    const controller = new AbortController();
    input.activePrompts.set(parsed.sessionId, controller);
    try {
      const bridge = await input.getBridge();
      if (parsed.type === "session/control") {
        if (bridge.controlSession === undefined) throw new Error("Session controls require the current A008 runtime.");
        const state = await bridge.controlSession(parsed.sessionId, parsed.control);
        sendSocket(input.ws, { type: "session/control/ok", requestId: parsed.requestId, sessionId: parsed.sessionId, state }, input.secrets);
        return;
      }
      await bridge.prompt(
        parsed.sessionId,
        parsed.text,
        {
          onTool(message) { sendSocket(input.ws, message, input.secrets); },
          onPermission(message) { sendSocket(input.ws, message, input.secrets); },
          onThought(text) {
            if (controller.signal.aborted || !input.ownedSessions.has(parsed.sessionId)) return;
            sendSocket(
              input.ws,
              { type: "thought", sessionId: parsed.sessionId, text },
              input.secrets,
            );
          },
          onAnswer(text) {
            if (controller.signal.aborted || !input.ownedSessions.has(parsed.sessionId)) return;
            sendSocket(
              input.ws,
              { type: "answer", sessionId: parsed.sessionId, text },
              input.secrets,
            );
          },
        },
        controller.signal,
      );
      if (!input.ownedSessions.has(parsed.sessionId)) return;
      const state = await bridge.controlSession?.(parsed.sessionId, { action: "inspect" });
      sendSocket(
        input.ws,
        {
          type: "prompt/ok",
          requestId: parsed.requestId,
          sessionId: parsed.sessionId,
          ...(state === undefined ? {} : { state }),
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

function safeTextEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function positiveDuration(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new ChatError("configuration", `${label} must be greater than zero.`);
  return Math.floor(value);
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
    const configuredPin = process.env[GUI_PIN_ENV]?.trim();
    const host = await startGuiHost({
      ...listenOptions,
      ...(configuredPin ? { pin: configuredPin } : {}),
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
