import { randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  V2_CAPABILITIES,
  v2TicketRequestSchema,
  type V2Capability,
  type V2ErrorCode,
  type V2TicketRequest,
} from "../../packages/protocol/src/index.js";
import { DeviceRegistry } from "./device-registry.js";
import type { PinAuthGate } from "./pin-auth.js";

export interface V2Principal {
  readonly id: string;
  readonly kind: "device" | "browser-pin";
  readonly projects: readonly string[] | "all";
  readonly capabilities: readonly V2Capability[];
  readonly expiresAt: number;
}
export class V2AuthError extends Error {
  constructor(
    readonly code: V2ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
interface Ticket {
  principal: V2Principal;
  scope: V2TicketRequest;
  expiresAt: number;
}
export const V2_LIMITS = {
  ticketLifetimeMs: 30_000,
  preauthFrameBytes: 4096,
  authenticationDeadlineMs: 5000,
  inputFrameBytes: 1_048_576,
  outputFrameBytes: 8_388_608,
  promptBytes: 65_536,
} as const;

export class V2Auth {
  readonly serverInstanceId = `server_${randomUUID()}`;
  readonly #tickets = new Map<string, Ticket>();
  constructor(
    readonly options: {
      devices: DeviceRegistry;
      pin: PinAuthGate;
      projectExists: (id: string) => boolean;
      sessionAuthorized?: (
        principal: V2Principal,
        projectId: string,
        sessionId: string,
      ) => boolean;
      now?: () => number;
    },
  ) {}
  #now() {
    return (this.options.now ?? Date.now)();
  }
  authenticate(request: IncomingMessage): V2Principal {
    const authorization = request.headers.authorization;
    if (authorization !== undefined) {
      const device =
        authorization.startsWith("Bearer ") &&
        this.options.devices.authenticate(authorization.slice(7));
      if (!device)
        throw new V2AuthError(
          "UNAUTHENTICATED",
          401,
          "A valid V2 credential is required.",
        );
      return {
        id: device.id,
        kind: "device",
        projects: device.projects,
        capabilities: device.capabilities,
        expiresAt: device.expiresAt,
      };
    }
    if (this.options.pin.enabled && this.options.pin.authorized(request)) {
      return {
        id: "owner_browser",
        kind: "browser-pin",
        projects: "all",
        capabilities: V2_CAPABILITIES,
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
    }
    throw new V2AuthError(
      "UNAUTHENTICATED",
      401,
      "A configured browser PIN or device credential is required for V2.",
    );
  }
  current(principal: V2Principal): V2Principal {
    if (principal.kind === "browser-pin" && this.options.pin.enabled)
      return principal;
    const device =
      principal.kind === "device" && this.options.devices.current(principal.id);
    if (!device)
      throw new V2AuthError(
        "UNAUTHENTICATED",
        401,
        "The V2 credential expired or was revoked.",
      );
    return {
      id: device.id,
      kind: "device",
      projects: device.projects,
      capabilities: device.capabilities,
      expiresAt: device.expiresAt,
    };
  }
  authorize(
    principal: V2Principal,
    projectId: string,
    capability: V2Capability,
  ): V2Principal {
    const current = this.current(principal);
    if (
      (current.projects !== "all" && !current.projects.includes(projectId)) ||
      !current.capabilities.includes(capability)
    ) {
      throw new V2AuthError(
        "FORBIDDEN",
        403,
        "This credential does not permit the project operation.",
      );
    }
    if (!this.options.projectExists(projectId))
      throw new V2AuthError(
        "PROJECT_NOT_FOUND",
        404,
        "Project is not registered.",
      );
    return current;
  }
  #authorizeTicket(
    principal: V2Principal,
    scope: V2TicketRequest,
  ): V2Principal {
    const current = this.authorize(principal, scope.projectId, "session");
    if (
      scope.sessionId &&
      !this.options.sessionAuthorized?.(
        current,
        scope.projectId,
        scope.sessionId,
      )
    ) {
      throw new V2AuthError(
        "SESSION_EXPIRED",
        404,
        "The project session is unavailable to this principal.",
      );
    }
    return current;
  }
  issue(principal: V2Principal, input: unknown) {
    const parsed = v2TicketRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new V2AuthError("INVALID_REQUEST", 400, "Invalid ticket scope.");
    const scope = parsed.data,
      current = this.#authorizeTicket(principal, scope),
      now = this.#now();
    for (const [key, ticket] of this.#tickets)
      if (ticket.expiresAt <= now) this.#tickets.delete(key);
    if (
      this.#tickets.size >= 4096 ||
      [...this.#tickets.values()].filter(
        (ticket) => ticket.principal.id === current.id,
      ).length >= 128
    ) {
      throw new V2AuthError(
        "CAPACITY_EXCEEDED",
        429,
        "Too many outstanding authentication tickets.",
      );
    }
    const ticket = randomBytes(32).toString("base64url"),
      expiresAt = Math.min(now + V2_LIMITS.ticketLifetimeMs, current.expiresAt);
    this.#tickets.set(ticket, { principal: current, scope, expiresAt });
    return {
      serverInstanceId: this.serverInstanceId,
      ticket,
      expiresAt,
      ...scope,
    };
  }
  consume(value: string): { principal: V2Principal; scope: V2TicketRequest } {
    const ticket = this.#tickets.get(value);
    this.#tickets.delete(value);
    if (!ticket || ticket.expiresAt <= this.#now())
      throw new V2AuthError(
        "UNAUTHENTICATED",
        401,
        "Authentication ticket is invalid or expired.",
      );
    return {
      principal: this.#authorizeTicket(ticket.principal, ticket.scope),
      scope: ticket.scope,
    };
  }
  clear() {
    this.#tickets.clear();
  }
  info() {
    return {
      protocol: "a008.v2" as const,
      serverInstanceId: this.serverInstanceId,
      serverVersion: "0.0.0",
      authProfiles: [
        "device",
        ...(this.options.pin.enabled ? ["browser-pin"] : []),
      ],
      features: ["auth.tickets", "session.websocket"],
      limits: V2_LIMITS,
    };
  }
}

export async function handleV2AuthHttp(options: {
  auth: V2Auth;
  request: IncomingMessage;
  response: ServerResponse;
  originAllowed: boolean;
  readJson: (request: IncomingMessage) => Promise<unknown>;
  sendJson: (response: ServerResponse, status: number, data: unknown) => void;
}): Promise<void> {
  const { auth, request, response, sendJson } = options;
  response.setHeader("cache-control", "no-store");
  try {
    if (!options.originAllowed)
      throw new V2AuthError(
        "FORBIDDEN",
        403,
        "Cross-origin requests are refused.",
      );
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path === "/v2/info" && request.method === "GET") {
      sendJson(response, 200, auth.info());
      return;
    }
    const principal = auth.authenticate(request);
    if (path === "/v2/auth/ticket" && request.method === "POST") {
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw new V2AuthError(
          "INVALID_REQUEST",
          415,
          "Content-Type must be application/json.",
        );
      let body: unknown;
      try {
        body = await options.readJson(request);
      } catch {
        throw new V2AuthError(
          "INVALID_REQUEST",
          400,
          "Invalid or oversized JSON body.",
        );
      }
      sendJson(response, 200, auth.issue(principal, body));
      return;
    }
    throw new V2AuthError(
      "UNSUPPORTED_CAPABILITY",
      404,
      "This V2 operation is not available.",
    );
  } catch (error) {
    const failure =
      error instanceof V2AuthError
        ? error
        : new V2AuthError(
            "RUNTIME_FAILED",
            500,
            "The authentication operation failed.",
          );
    sendJson(response, failure.status, {
      type: "error",
      serverInstanceId: auth.serverInstanceId,
      code: failure.code,
      message: failure.message,
      retryable: false,
    });
  }
}
