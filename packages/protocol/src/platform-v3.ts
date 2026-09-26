import { z } from "zod";
import { chatContentSchema } from "./schemas.js";

const platformV3SafeInteger = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const platformV3BoundedText = (maximum: number) =>
  z.string().min(1).max(maximum);

/** Opaque platform identity. Authority comes from the backend, never this value. */
export const platformV3IdSchema = platformV3BoundedText(256);
export type PlatformV3Id = z.infer<typeof platformV3IdSchema>;
export const platformV3RevisionSchema = platformV3SafeInteger;
export type PlatformV3Revision = z.infer<typeof platformV3RevisionSchema>;
export const platformV3CursorSchema = platformV3SafeInteger;
export type PlatformV3Cursor = z.infer<typeof platformV3CursorSchema>;
export const platformV3TimestampSchema = platformV3SafeInteger;
export type PlatformV3Timestamp = z.infer<typeof platformV3TimestampSchema>;

export const PLATFORM_V3_RUN_STATUSES = [
  "queued",
  "running",
  "cancel_requested",
  "needs_reconciliation",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const platformV3RunStatusSchema = z.enum(PLATFORM_V3_RUN_STATUSES);
export type PlatformV3RunStatus = z.infer<typeof platformV3RunStatusSchema>;

export const PLATFORM_V3_EFFECT_STATUSES = [
  "none",
  "unknown",
  "known",
] as const;
export const platformV3EffectStatusSchema = z.enum(PLATFORM_V3_EFFECT_STATUSES);
export type PlatformV3EffectStatus = z.infer<
  typeof platformV3EffectStatusSchema
>;

export const PLATFORM_V3_ANSWER_STATUSES = [
  "pending",
  "completed",
  "failed",
  "unknown",
] as const;
export const platformV3AnswerStatusSchema = z.enum(PLATFORM_V3_ANSWER_STATUSES);
export type PlatformV3AnswerStatus = z.infer<
  typeof platformV3AnswerStatusSchema
>;

export const PLATFORM_V3_MEMORY_STATUSES = [
  "not_requested",
  "pending",
  "completed",
  "failed",
  "unknown",
] as const;
export const platformV3MemoryStatusSchema = z.enum(PLATFORM_V3_MEMORY_STATUSES);
export type PlatformV3MemoryStatus = z.infer<
  typeof platformV3MemoryStatusSchema
>;

export const PLATFORM_V3_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_REQUEST",
  "REVISION_CONFLICT",
  "CONVERSATION_BUSY",
  "COMMAND_CONFLICT",
  "CAPACITY_EXCEEDED",
  "LEASE_LOST",
  "NEEDS_RECONCILIATION",
  "INTERNAL_ERROR",
] as const;
export const platformV3ErrorCodeSchema = z.enum(PLATFORM_V3_ERROR_CODES);
export type PlatformV3ErrorCode = z.infer<typeof platformV3ErrorCodeSchema>;

export const platformV3ErrorSchema = z.strictObject({
  code: platformV3ErrorCodeSchema,
  message: platformV3BoundedText(4096),
});
export type PlatformV3Error = z.infer<typeof platformV3ErrorSchema>;

export const platformV3ConversationMessageSchema = z.strictObject({
  id: platformV3IdSchema,
  role: z.enum(["user", "assistant"]),
  content: chatContentSchema,
  createdAt: platformV3TimestampSchema,
  runId: platformV3IdSchema.optional(),
});
export type PlatformV3ConversationMessage = z.infer<
  typeof platformV3ConversationMessageSchema
>;

export const platformV3ConversationSchema = z.strictObject({
  id: platformV3IdSchema,
  tenantId: platformV3IdSchema,
  projectId: platformV3IdSchema,
  workspaceId: platformV3IdSchema,
  title: platformV3BoundedText(200),
  createdAt: platformV3TimestampSchema,
  updatedAt: platformV3TimestampSchema,
  revision: platformV3RevisionSchema,
  messages: z.array(platformV3ConversationMessageSchema).max(10_000),
});
export type PlatformV3Conversation = z.infer<
  typeof platformV3ConversationSchema
>;

export const platformV3RunSchema = z.strictObject({
  id: platformV3IdSchema,
  tenantId: platformV3IdSchema,
  projectId: platformV3IdSchema,
  conversationId: platformV3IdSchema,
  workspaceId: platformV3IdSchema,
  principalId: platformV3IdSchema,
  commandId: platformV3IdSchema,
  model: platformV3BoundedText(256),
  status: platformV3RunStatusSchema,
  revision: platformV3RevisionSchema,
  createdAt: platformV3TimestampSchema,
  updatedAt: platformV3TimestampSchema,
  leaseGeneration: platformV3RevisionSchema,
  effectStatus: platformV3EffectStatusSchema,
  answerStatus: platformV3AnswerStatusSchema,
  memoryStatus: platformV3MemoryStatusSchema,
  error: platformV3ErrorSchema.optional(),
});
export type PlatformV3Run = z.infer<typeof platformV3RunSchema>;

export const platformV3CommandReceiptSchema = z.strictObject({
  commandId: platformV3IdSchema,
  tenantId: platformV3IdSchema,
  principalId: platformV3IdSchema,
  operation: z.literal("run.create"),
  payloadDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  runId: platformV3IdSchema,
  createdAt: platformV3TimestampSchema,
});
export type PlatformV3CommandReceipt = z.infer<
  typeof platformV3CommandReceiptSchema
>;

export const PLATFORM_V3_EVENT_TYPES = [
  "conversation.created",
  "run.queued",
  "run.updated",
  "conversation.updated",
] as const;
export const platformV3EventTypeSchema = z.enum(PLATFORM_V3_EVENT_TYPES);
export type PlatformV3EventType = z.infer<typeof platformV3EventTypeSchema>;

export const platformV3EventSchema = z.strictObject({
  cursor: platformV3CursorSchema,
  tenantId: platformV3IdSchema,
  projectId: platformV3IdSchema,
  conversationId: platformV3IdSchema,
  runId: platformV3IdSchema.optional(),
  type: platformV3EventTypeSchema,
  resourceRevision: platformV3RevisionSchema,
  createdAt: platformV3TimestampSchema,
});
export type PlatformV3Event = z.infer<typeof platformV3EventSchema>;

export const platformV3InfoSchema = z.strictObject({
  protocolVersion: z.literal("a008.platform.v3"),
  available: z.boolean(),
  capabilities: z.array(z.string()),
});
export type PlatformV3Info = z.infer<typeof platformV3InfoSchema>;

export const platformV3ConversationListResponseSchema = z.strictObject({
  conversations: z.array(platformV3ConversationSchema),
});
export type PlatformV3ConversationListResponse = z.infer<
  typeof platformV3ConversationListResponseSchema
>;
export const platformV3ConversationCreateRequestSchema = z.strictObject({
  title: platformV3BoundedText(200),
});
export type PlatformV3ConversationCreateRequest = z.infer<
  typeof platformV3ConversationCreateRequestSchema
>;
export const platformV3ConversationResponseSchema = z.strictObject({
  conversation: platformV3ConversationSchema,
});
export type PlatformV3ConversationResponse = z.infer<
  typeof platformV3ConversationResponseSchema
>;

export const platformV3RunCreateRequestSchema = z.strictObject({
  commandId: platformV3IdSchema,
  expectedRevision: platformV3RevisionSchema,
  model: platformV3BoundedText(256),
  text: platformV3BoundedText(65_536),
});
export type PlatformV3RunCreateRequest = z.infer<
  typeof platformV3RunCreateRequestSchema
>;
export const platformV3RunCreateResponseSchema = z.strictObject({
  run: platformV3RunSchema,
  replayed: z.boolean(),
});
export type PlatformV3RunCreateResponse = z.infer<
  typeof platformV3RunCreateResponseSchema
>;
export const platformV3RunResponseSchema = z.strictObject({
  run: platformV3RunSchema,
});
export type PlatformV3RunResponse = z.infer<typeof platformV3RunResponseSchema>;
export const platformV3RunCancelRequestSchema = z.strictObject({
  expectedRevision: platformV3RevisionSchema,
});
export type PlatformV3RunCancelRequest = z.infer<
  typeof platformV3RunCancelRequestSchema
>;

export const platformV3EventsQuerySchema = z.strictObject({
  after: platformV3CursorSchema.optional(),
  limit: platformV3SafeInteger.min(1).max(1000).default(100),
  projectId: platformV3IdSchema,
});
export type PlatformV3EventsQuery = z.input<typeof platformV3EventsQuerySchema>;
export type PlatformV3EventsQueryResult = z.output<
  typeof platformV3EventsQuerySchema
>;
export const platformV3EventsResponseSchema = z.strictObject({
  events: z.array(platformV3EventSchema).max(1000),
  nextCursor: platformV3CursorSchema,
  hasMore: z.boolean(),
});
export type PlatformV3EventsResponse = z.infer<
  typeof platformV3EventsResponseSchema
>;
export const platformV3ErrorResponseSchema = z.strictObject({
  error: platformV3ErrorSchema,
});
export type PlatformV3ErrorResponse = z.infer<
  typeof platformV3ErrorResponseSchema
>;

/** Generated JSON Schema inputs for the durable V3 resource contracts. */
export function platformV3JsonSchemas() {
  return Object.fromEntries(
    Object.entries({
      "platform-v3-info": platformV3InfoSchema,
      "platform-v3-conversation": platformV3ConversationSchema,
      "platform-v3-run": platformV3RunSchema,
      "platform-v3-command-receipt": platformV3CommandReceiptSchema,
      "platform-v3-event": platformV3EventSchema,
      "platform-v3-error": platformV3ErrorSchema,
      "platform-v3-error-response": platformV3ErrorResponseSchema,
      "platform-v3-conversation-list-response":
        platformV3ConversationListResponseSchema,
      "platform-v3-conversation-create-request":
        platformV3ConversationCreateRequestSchema,
      "platform-v3-conversation-response": platformV3ConversationResponseSchema,
      "platform-v3-run-create-request": platformV3RunCreateRequestSchema,
      "platform-v3-run-create-response": platformV3RunCreateResponseSchema,
      "platform-v3-run-response": platformV3RunResponseSchema,
      "platform-v3-run-cancel-request": platformV3RunCancelRequestSchema,
      "platform-v3-events-query": platformV3EventsQuerySchema,
      "platform-v3-events-response": platformV3EventsResponseSchema,
    }).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }),
    ]),
  );
}

/** Descriptive route metadata only; it does not make a V3 host available. */
export function platformV3OpenApiDocument() {
  const json = (schema: string) => ({
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  });
  const errorResponses = Object.fromEntries(
    [400, 401, 403, 404, 409, 429, 500].map((status) => [
      status,
      {
        description: "Platform V3 error",
        content: json("platform-v3-error-response"),
      },
    ]),
  );
  const idParameter = (name: string) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string", minLength: 1, maxLength: 256 },
  });
  return {
    openapi: "3.1.1",
    info: { title: "A008 Platform V3 contract", version: "3.0.0" },
    paths: {
      "/v3/info": {
        get: {
          security: [],
          responses: {
            200: {
              description: "Public protocol metadata",
              content: json("platform-v3-info"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/projects/{projectId}/conversations": {
        get: {
          parameters: [idParameter("projectId")],
          responses: {
            200: {
              description: "Bounded conversation snapshot",
              content: json("platform-v3-conversation-list-response"),
            },
            ...errorResponses,
          },
        },
        post: {
          parameters: [idParameter("projectId")],
          requestBody: {
            required: true,
            content: json("platform-v3-conversation-create-request"),
          },
          responses: {
            200: {
              description: "Created conversation",
              content: json("platform-v3-conversation-response"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/conversations/{conversationId}": {
        get: {
          parameters: [idParameter("conversationId")],
          responses: {
            200: {
              description: "Conversation",
              content: json("platform-v3-conversation-response"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/conversations/{conversationId}/runs": {
        post: {
          parameters: [idParameter("conversationId")],
          requestBody: {
            required: true,
            content: json("platform-v3-run-create-request"),
          },
          responses: {
            200: {
              description: "Accepted or replayed run",
              content: json("platform-v3-run-create-response"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/runs/{runId}": {
        get: {
          parameters: [idParameter("runId")],
          responses: {
            200: {
              description: "Run",
              content: json("platform-v3-run-response"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/runs/{runId}/cancel": {
        post: {
          parameters: [idParameter("runId")],
          requestBody: {
            required: true,
            content: json("platform-v3-run-cancel-request"),
          },
          responses: {
            200: {
              description: "Revision-controlled run",
              content: json("platform-v3-run-response"),
            },
            ...errorResponses,
          },
        },
      },
      "/v3/events": {
        get: {
          parameters: [
            {
              name: "after",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                minimum: 0,
                maximum: Number.MAX_SAFE_INTEGER,
              },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 1000,
                default: 100,
              },
            },
            { ...idParameter("projectId"), in: "query" },
          ],
          responses: {
            200: {
              description: "Scoped body-free change notifications",
              content: json("platform-v3-events-response"),
            },
            ...errorResponses,
          },
        },
      },
    },
    components: { schemas: platformV3JsonSchemas() },
  };
}
