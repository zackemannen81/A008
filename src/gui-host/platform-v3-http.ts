import type { IncomingMessage, ServerResponse } from "node:http";
import {
  platformV3ConversationCreateRequestSchema,
  platformV3ConversationListResponseSchema,
  platformV3ConversationResponseSchema,
  platformV3ErrorResponseSchema,
  platformV3EventsQuerySchema,
  platformV3EventsResponseSchema,
  platformV3IdSchema,
  platformV3InfoSchema,
  platformV3RunCancelRequestSchema,
  platformV3RunCreateRequestSchema,
  platformV3RunCreateResponseSchema,
  platformV3RunResponseSchema,
  type PlatformV3ErrorCode,
} from "../../packages/protocol/src/index.js";
import { readProjectRegistry } from "../bootstrap/registry.js";
import type { RegisteredProject } from "../bootstrap/types.js";
import { IdentityError } from "../identity/errors.js";
import type { PlatformBackend } from "../platform/coordinator.js";
import {
  PLATFORM_MAX_RESPONSE_BYTES,
  type PlatformLocalConfig,
} from "../platform/local-config.js";
import { platformModelAvailable } from "../platform/runtime-adapter.js";
import { PlatformStoreError } from "../platform/platform-store.js";
import type { PlatformScope } from "../platform/types.js";
import { V2Auth, V2AuthError, type V2Principal } from "./v2-auth.js";

const CAPABILITIES = [
  "durable-conversations",
  "durable-runs",
  "command-receipts",
  "event-polling",
  "background-text-runs",
  "restart-uncertainty",
] as const;

const PROJECT_CONVERSATIONS = /^\/v3\/projects\/([^/]+)\/conversations$/u;
const CONVERSATION = /^\/v3\/conversations\/([^/]+)$/u;
const CONVERSATION_RUNS = /^\/v3\/conversations\/([^/]+)\/runs$/u;
const RUN = /^\/v3\/runs\/([^/]+)$/u;
const RUN_CANCEL = /^\/v3\/runs\/([^/]+)\/cancel$/u;

export class PlatformHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: PlatformV3ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlatformHttpError";
  }
}

export async function handlePlatformV3Http(options: {
  readonly backend: PlatformBackend | undefined;
  readonly auth: V2Auth | undefined;
  readonly env: NodeJS.ProcessEnv;
  readonly projectsPath: string;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly originAllowed: boolean;
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
}): Promise<void> {
  const { request, response, sendJson } = options;
  response.setHeader("cache-control", "no-store");
  try {
    if (!options.originAllowed) {
      throw new PlatformHttpError(
        403,
        "FORBIDDEN",
        "Cross-origin requests are refused.",
      );
    }
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    if (pathname === "/v3/info" && request.method === "GET") {
      sendChecked(sendJson, response, 200, platformV3InfoSchema, {
        protocolVersion: "a008.platform.v3",
        available: options.backend !== undefined,
        capabilities: options.backend === undefined ? [] : [...CAPABILITIES],
      }, options.backend?.config.maxResponseBytes ?? PLATFORM_MAX_RESPONSE_BYTES);
      return;
    }
    if (!pathname.startsWith("/v3/")) {
      throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
    }
    if (options.backend === undefined || options.auth === undefined) {
      throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
    }
    const principal = options.auth.authenticate(request);
    const backend = options.backend;
    const config = backend.config;
    if (request.method === "GET" && pathname === "/v3/events") {
      const query = parseEventsQuery(url);
      const scope = authorizeProject(
        options.auth,
        principal,
        query.projectId,
        options.projectsPath,
        config,
      );
      const page = backend.store.readEvents(scope, {
        ...(query.after === undefined ? {} : { after: query.after }),
        limit: query.limit,
      });
      sendChecked(
        sendJson,
        response,
        200,
        platformV3EventsResponseSchema,
        page,
        config.maxResponseBytes,
      );
      return;
    }
    const projectConversations = PROJECT_CONVERSATIONS.exec(pathname);
    if (projectConversations) {
      const projectId = pathId(projectConversations[1], "projectId");
      const scope = authorizeProject(
        options.auth,
        principal,
        projectId,
        options.projectsPath,
        config,
      );
      if (request.method === "GET") {
        sendChecked(
          sendJson,
          response,
          200,
          platformV3ConversationListResponseSchema,
          { conversations: backend.store.listConversations(scope) },
          config.maxResponseBytes,
        );
        return;
      }
      if (request.method === "POST") {
        const body = await readJson(request, config, platformV3ConversationCreateRequestSchema);
        const conversation = backend.store.createConversation(scope, {
          title: body.title,
        });
        sendChecked(
          sendJson,
          response,
          200,
          platformV3ConversationResponseSchema,
          { conversation },
          config.maxResponseBytes,
        );
        return;
      }
      throw new PlatformHttpError(400, "INVALID_REQUEST", "Method is not supported.");
    }
    const conversationMatch = CONVERSATION.exec(pathname);
    if (conversationMatch && request.method === "GET") {
      const found = findConversation(
        backend,
        options.auth,
        principal,
        pathId(conversationMatch[1], "conversationId"),
        options.projectsPath,
      );
      sendChecked(
        sendJson,
        response,
        200,
        platformV3ConversationResponseSchema,
        { conversation: found.conversation },
        config.maxResponseBytes,
      );
      return;
    }
    const runsMatch = CONVERSATION_RUNS.exec(pathname);
    if (runsMatch && request.method === "POST") {
      const body = await readJson(request, config, platformV3RunCreateRequestSchema);
      if (Buffer.byteLength(body.text, "utf8") > config.maxPromptBytes) {
        throw new PlatformHttpError(
          400,
          "INVALID_REQUEST",
          "Prompt exceeds the UTF-8 byte limit.",
        );
      }
      const found = findConversation(
        backend,
        options.auth,
        principal,
        pathId(runsMatch[1], "conversationId"),
        options.projectsPath,
      );
      const accepted = await backend.coordinator.admit(() => {
        const replay = backend.store.lookupRunReceipt(found.scope, {
          conversationId: found.conversation.id,
          commandId: body.commandId,
          expectedRevision: body.expectedRevision,
          model: body.model,
          text: body.text,
        });
        if (replay !== undefined) return replay;
        if (!platformModelAvailable(options.env, body.model)) {
          throw new PlatformHttpError(
            400,
            "INVALID_REQUEST",
            "The model is not registered.",
          );
        }
        const inProject = backend.coordinator.countNonterminal(found.scope.projectId);
        const across = backend.coordinator.countNonterminal();
        if (
          inProject >= config.maxNonterminalPerProject ||
          across >= config.maxNonterminal
        ) {
          throw new PlatformHttpError(
            429,
            "CAPACITY_EXCEEDED",
            "Platform run capacity is exhausted.",
          );
        }
        return backend.store.acceptRun(found.scope, {
          conversationId: found.conversation.id,
          commandId: body.commandId,
          expectedRevision: body.expectedRevision,
          model: body.model,
          text: body.text,
          memoryRequested: true,
        });
      });
      backend.coordinator.kick();
      sendChecked(
        sendJson,
        response,
        200,
        platformV3RunCreateResponseSchema,
        accepted,
        config.maxResponseBytes,
      );
      return;
    }
    const cancelMatch = RUN_CANCEL.exec(pathname);
    if (cancelMatch && request.method === "POST") {
      const body = await readJson(request, config, platformV3RunCancelRequestSchema);
      const found = findRun(
        backend,
        options.auth,
        principal,
        pathId(cancelMatch[1], "runId"),
        options.projectsPath,
      );
      const run = backend.store.requestCancel(found.scope, {
        runId: found.run.id,
        expectedRevision: body.expectedRevision,
      });
      sendChecked(sendJson, response, 200, platformV3RunResponseSchema, { run }, config.maxResponseBytes);
      return;
    }
    const runMatch = RUN.exec(pathname);
    if (runMatch && request.method === "GET") {
      const found = findRun(
        backend,
        options.auth,
        principal,
        pathId(runMatch[1], "runId"),
        options.projectsPath,
      );
      sendChecked(
        sendJson,
        response,
        200,
        platformV3RunResponseSchema,
        { run: found.run },
        config.maxResponseBytes,
      );
      return;
    }
    throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
  } catch (error) {
    const failure = toHttpError(error);
    const body = {
      error: {
        code: failure.code,
        message: sanitize(failure.message),
      },
    };
    if (!platformV3ErrorResponseSchema.safeParse(body).success) {
      sendJson(response, 500, {
        error: { code: "INTERNAL_ERROR", message: "The platform operation failed." },
      });
      return;
    }
    sendJson(response, failure.status, body);
  }
}

function authorizeProject(
  auth: V2Auth,
  principal: V2Principal,
  projectId: string,
  projectsPath: string,
  config: PlatformLocalConfig,
): PlatformScope {
  const current = auth.current(principal);
  const inGrant =
    current.projects === "all" || current.projects.includes(projectId);
  if (!inGrant) {
    throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
  }
  if (!current.capabilities.includes("session")) {
    throw new PlatformHttpError(
      403,
      "FORBIDDEN",
      "This credential does not permit the project operation.",
    );
  }
  if (!registeredProjects(projectsPath).some((project) => project.projectId === projectId)) {
    throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
  }
  return {
    tenantId: config.tenantId,
    projectId,
    principalId: current.id,
  };
}

function findConversation(
  backend: PlatformBackend,
  auth: V2Auth,
  principal: V2Principal,
  conversationId: string,
  projectsPath: string,
): { readonly scope: PlatformScope; readonly conversation: ReturnType<PlatformBackend["store"]["getConversation"]> } {
  const current = auth.current(principal);
  for (const project of visibleProjects(current, projectsPath)) {
    const scope: PlatformScope = {
      tenantId: backend.config.tenantId,
      projectId: project.projectId,
      principalId: current.id,
    };
    try {
      return { scope, conversation: backend.store.getConversation(scope, conversationId) };
    } catch (error) {
      if (error instanceof PlatformStoreError && error.code === "NOT_FOUND") continue;
      throw error;
    }
  }
  throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
}

function findRun(
  backend: PlatformBackend,
  auth: V2Auth,
  principal: V2Principal,
  runId: string,
  projectsPath: string,
) {
  const current = auth.current(principal);
  for (const project of visibleProjects(current, projectsPath)) {
    const scope: PlatformScope = {
      tenantId: backend.config.tenantId,
      projectId: project.projectId,
      principalId: current.id,
    };
    try {
      return { scope, run: backend.store.getRun(scope, runId) };
    } catch (error) {
      if (error instanceof PlatformStoreError && error.code === "NOT_FOUND") continue;
      throw error;
    }
  }
  throw new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
}

function visibleProjects(
  principal: V2Principal,
  projectsPath: string,
): readonly RegisteredProject[] {
  if (!principal.capabilities.includes("session")) return [];
  return registeredProjects(projectsPath).filter(
    (project) =>
      principal.projects === "all" || principal.projects.includes(project.projectId),
  );
}

function registeredProjects(projectsPath: string): readonly RegisteredProject[] {
  try {
    return readProjectRegistry(projectsPath).projects;
  } catch {
    return [];
  }
}

function pathId(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new PlatformHttpError(400, "INVALID_REQUEST", `${name} is invalid.`);
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new PlatformHttpError(400, "INVALID_REQUEST", `${name} is invalid.`);
  }
  if (!platformV3IdSchema.safeParse(decoded).success) {
    throw new PlatformHttpError(400, "INVALID_REQUEST", `${name} is invalid.`);
  }
  return decoded;
}

function parseEventsQuery(url: URL): { projectId: string; after?: number; limit: number } {
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const afterRaw = url.searchParams.get("after");
  const limitRaw = url.searchParams.get("limit");
  const candidate: { projectId?: string; after?: number; limit?: number } = {};
  if (projectId !== undefined) candidate.projectId = projectId;
  if (afterRaw !== null) {
    if (!/^\d+$/u.test(afterRaw)) {
      throw new PlatformHttpError(400, "INVALID_REQUEST", "Event cursor is invalid.");
    }
    candidate.after = Number(afterRaw);
  }
  if (limitRaw !== null) {
    if (!/^\d+$/u.test(limitRaw)) {
      throw new PlatformHttpError(400, "INVALID_REQUEST", "Event limit is invalid.");
    }
    candidate.limit = Number(limitRaw);
  }
  const parsed = platformV3EventsQuerySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PlatformHttpError(400, "INVALID_REQUEST", "Platform V3 request is invalid.");
  }
  return parsed.data.after === undefined
    ? { projectId: parsed.data.projectId, limit: parsed.data.limit }
    : {
        projectId: parsed.data.projectId,
        limit: parsed.data.limit,
        after: parsed.data.after,
      };
}

async function readJson<T>(
  request: IncomingMessage,
  config: PlatformLocalConfig,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): Promise<T> {
  const type = request.headers["content-type"];
  const mime = (Array.isArray(type) ? type[0] : type)?.split(";")[0]?.trim().toLowerCase();
  if (mime !== "application/json" && !mime?.endsWith("+json")) {
    throw new PlatformHttpError(
      400,
      "INVALID_REQUEST",
      "Content-Type must be application/json.",
    );
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  try {
    for await (const chunk of request) {
      if (tooLarge) continue;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > config.maxJsonBodyBytes) {
        tooLarge = true;
        chunks.length = 0;
        continue;
      }
      chunks.push(buffer);
    }
  } catch {
    throw new PlatformHttpError(400, "INVALID_REQUEST", "Request body is too large.");
  }
  if (tooLarge) {
    throw new PlatformHttpError(400, "INVALID_REQUEST", "Request body is too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new PlatformHttpError(400, "INVALID_REQUEST", "Request body is not valid JSON.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new PlatformHttpError(400, "INVALID_REQUEST", "Platform V3 request is invalid.");
  }
  return result.data;
}

function sendChecked(
  sendJson: (response: ServerResponse, status: number, body: unknown) => void,
  response: ServerResponse,
  status: number,
  schema: { safeParse(value: unknown): { success: true; data: unknown } | { success: false } },
  body: unknown,
  maxBytes: number,
): void {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    sendJson(response, 500, {
      error: { code: "INTERNAL_ERROR", message: "Platform response is invalid." },
    });
    return;
  }
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > maxBytes) {
    sendJson(response, 429, {
      error: {
        code: "CAPACITY_EXCEEDED",
        message: "Platform response exceeds the byte limit.",
      },
    });
    return;
  }
  sendJson(response, status, parsed.data);
}

function toHttpError(error: unknown): PlatformHttpError {
  if (error instanceof PlatformHttpError) return error;
  if (error instanceof V2AuthError) {
    if (error.code === "UNAUTHENTICATED") {
      return new PlatformHttpError(401, "UNAUTHENTICATED", error.message);
    }
    if (error.code === "FORBIDDEN") {
      return new PlatformHttpError(403, "FORBIDDEN", error.message);
    }
    if (error.code === "INVALID_REQUEST") {
      return new PlatformHttpError(400, "INVALID_REQUEST", error.message);
    }
    if (error.code === "CAPACITY_EXCEEDED") {
      return new PlatformHttpError(429, "CAPACITY_EXCEEDED", error.message);
    }
    if (error.status === 404) {
      return new PlatformHttpError(404, "NOT_FOUND", "Platform resource was not found.");
    }
    return new PlatformHttpError(401, "UNAUTHENTICATED", "A valid V2 credential is required.");
  }
  if (error instanceof PlatformStoreError) {
    return new PlatformHttpError(statusForStore(error.code), codeForStore(error.code), error.message);
  }
  if (error instanceof IdentityError) {
    return new PlatformHttpError(400, "INVALID_REQUEST", "Platform V3 request is invalid.");
  }
  return new PlatformHttpError(500, "INTERNAL_ERROR", "The platform operation failed.");
}

function statusForStore(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "INVALID_REQUEST":
      return 400;
    case "REVISION_CONFLICT":
    case "CONVERSATION_BUSY":
    case "COMMAND_CONFLICT":
    case "LEASE_LOST":
    case "NEEDS_RECONCILIATION":
      return 409;
    case "CAPACITY_EXCEEDED":
      return 429;
    default:
      return 500;
  }
}

function codeForStore(code: string): PlatformV3ErrorCode {
  switch (code) {
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "INVALID_REQUEST":
    case "REVISION_CONFLICT":
    case "CONVERSATION_BUSY":
    case "COMMAND_CONFLICT":
    case "LEASE_LOST":
    case "NEEDS_RECONCILIATION":
    case "CAPACITY_EXCEEDED":
    case "INTERNAL_ERROR":
      return code;
    default:
      return "INTERNAL_ERROR";
  }
}

function sanitize(message: string): string {
  const cleaned = message.replace(/bearer\s+\S+/giu, "bearer [redacted]").trim();
  if (cleaned.length === 0) return "The platform operation failed.";
  return cleaned.slice(0, 4096);
}
