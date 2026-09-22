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
  type PlatformV3Conversation,
  type PlatformV3ConversationCreateRequest,
  type PlatformV3ConversationListResponse,
  type PlatformV3ConversationResponse,
  type PlatformV3ErrorCode,
  type PlatformV3EventsQuery,
  type PlatformV3EventsResponse,
  type PlatformV3Info,
  type PlatformV3Run,
  type PlatformV3RunCancelRequest,
  type PlatformV3RunCreateRequest,
  type PlatformV3RunCreateResponse,
  type PlatformV3RunResponse,
} from "@a008/protocol";
import { requestJson, type HttpClientOptions } from "./http.js";

export type PlatformV3ClientErrorCode =
  | PlatformV3ErrorCode
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "TRANSPORT_ERROR";

export class PlatformV3ClientError extends Error {
  readonly code: PlatformV3ClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: PlatformV3ClientErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "PlatformV3ClientError";
    this.code = code;
    this.status = status;
  }
}

export interface PlatformV3ClientOptions extends HttpClientOptions {}

export interface PlatformV3Client {
  info(signal?: AbortSignal): Promise<PlatformV3Info>;
  listConversations(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<PlatformV3ConversationListResponse>;
  createConversation(
    projectId: string,
    input: PlatformV3ConversationCreateRequest,
    signal?: AbortSignal,
  ): Promise<PlatformV3ConversationResponse>;
  getConversation(
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<PlatformV3ConversationResponse>;
  createRun(
    conversationId: string,
    input: PlatformV3RunCreateRequest,
    signal?: AbortSignal,
  ): Promise<PlatformV3RunCreateResponse>;
  getRun(runId: string, signal?: AbortSignal): Promise<PlatformV3RunResponse>;
  cancelRun(
    runId: string,
    input: PlatformV3RunCancelRequest,
    signal?: AbortSignal,
  ): Promise<PlatformV3RunResponse>;
  events(
    input: PlatformV3EventsQuery,
    signal?: AbortSignal,
  ): Promise<PlatformV3EventsResponse>;
}

type PlatformV3Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function invalidRequest(message: string): PlatformV3ClientError {
  return new PlatformV3ClientError("INVALID_REQUEST", message);
}

function withSignal(signal?: AbortSignal): { readonly signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

function validatedId(value: string, name: string): string {
  if (value.trim().length === 0)
    throw invalidRequest(`${name} must not be blank.`);
  if (
    value === "." ||
    value === ".." ||
    /(?:^|[\\/])\.\.?(?:[\\/]|$)/u.test(value)
  ) {
    throw invalidRequest(`${name} must not be a traversal-like path segment.`);
  }
  if (!platformV3IdSchema.safeParse(value).success)
    throw invalidRequest(`${name} is invalid.`);
  return value;
}

function pathSegment(value: string, name: string): string {
  const id = validatedId(value, name);
  return encodeURIComponent(id);
}

function requestInput<T>(schema: PlatformV3Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidRequest("Platform V3 request is invalid.");
  return parsed.data;
}

async function requestPlatformV3<T>(
  client: PlatformV3ClientOptions,
  path: string,
  schema: PlatformV3Schema<T>,
  init: {
    readonly method?: string;
    readonly body?: string;
    readonly signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Awaited<ReturnType<typeof requestJson>>;
  try {
    response = await requestJson(client, path, {
      ...(init.method === undefined ? {} : { method: init.method }),
      ...(init.body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: init.body }),
      ...(init.signal === undefined ? {} : { signal: init.signal }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Platform V3 transport failed.";
    throw new PlatformV3ClientError("TRANSPORT_ERROR", message);
  }
  if (!response.response.ok) {
    const parsed = platformV3ErrorResponseSchema.safeParse(response.body);
    if (parsed.success) {
      throw new PlatformV3ClientError(
        parsed.data.error.code,
        parsed.data.error.message,
        response.response.status,
      );
    }
    throw new PlatformV3ClientError(
      "INVALID_RESPONSE",
      "Platform V3 error response is incompatible.",
      response.response.status,
    );
  }
  const parsed = schema.safeParse(response.body);
  if (!parsed.success) {
    throw new PlatformV3ClientError(
      "INVALID_RESPONSE",
      "Platform V3 response is incompatible.",
      response.response.status,
    );
  }
  return parsed.data;
}

export function createPlatformV3Client(
  options: PlatformV3ClientOptions,
): PlatformV3Client {
  return {
    info: (signal) =>
      requestPlatformV3(
        options,
        "/v3/info",
        platformV3InfoSchema,
        withSignal(signal),
      ),
    listConversations: (projectId, signal) =>
      requestPlatformV3(
        options,
        `/v3/projects/${pathSegment(projectId, "projectId")}/conversations`,
        platformV3ConversationListResponseSchema,
        withSignal(signal),
      ),
    createConversation: (projectId, input, signal) => {
      const body = requestInput(
        platformV3ConversationCreateRequestSchema,
        input,
      );
      return requestPlatformV3(
        options,
        `/v3/projects/${pathSegment(projectId, "projectId")}/conversations`,
        platformV3ConversationResponseSchema,
        { method: "POST", body: JSON.stringify(body), ...withSignal(signal) },
      );
    },
    getConversation: (conversationId, signal) =>
      requestPlatformV3(
        options,
        `/v3/conversations/${pathSegment(conversationId, "conversationId")}`,
        platformV3ConversationResponseSchema,
        withSignal(signal),
      ),
    createRun: (conversationId, input, signal) => {
      const body = requestInput(platformV3RunCreateRequestSchema, input);
      validatedId(body.commandId, "commandId");
      return requestPlatformV3(
        options,
        `/v3/conversations/${pathSegment(conversationId, "conversationId")}/runs`,
        platformV3RunCreateResponseSchema,
        { method: "POST", body: JSON.stringify(body), ...withSignal(signal) },
      );
    },
    getRun: (runId, signal) =>
      requestPlatformV3(
        options,
        `/v3/runs/${pathSegment(runId, "runId")}`,
        platformV3RunResponseSchema,
        withSignal(signal),
      ),
    cancelRun: (runId, input, signal) => {
      const body = requestInput(platformV3RunCancelRequestSchema, input);
      return requestPlatformV3(
        options,
        `/v3/runs/${pathSegment(runId, "runId")}/cancel`,
        platformV3RunResponseSchema,
        { method: "POST", body: JSON.stringify(body), ...withSignal(signal) },
      );
    },
    events: (input, signal) => {
      const query = requestInput(platformV3EventsQuerySchema, input);
      const projectId = validatedId(query.projectId, "projectId");
      const search = new URLSearchParams({
        projectId,
        limit: String(query.limit),
        ...(query.after === undefined ? {} : { after: String(query.after) }),
      });
      return requestPlatformV3(
        options,
        `/v3/events?${search.toString()}`,
        platformV3EventsResponseSchema,
        withSignal(signal),
      );
    },
  };
}

export type {
  PlatformV3Conversation,
  PlatformV3ConversationCreateRequest,
  PlatformV3ConversationListResponse,
  PlatformV3ConversationResponse,
  PlatformV3EventsQuery,
  PlatformV3EventsResponse,
  PlatformV3Info,
  PlatformV3Run,
  PlatformV3RunCancelRequest,
  PlatformV3RunCreateRequest,
  PlatformV3RunCreateResponse,
  PlatformV3RunResponse,
};
