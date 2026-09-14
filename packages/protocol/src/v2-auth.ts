import { z } from "zod";

export const V2_CAPABILITIES = ["session", "memory", "upload", "images", "shell", "projects:admin", "providers:admin", "browser:probe"] as const;
export const v2CapabilitySchema = z.enum(V2_CAPABILITIES);
export type V2Capability = z.infer<typeof v2CapabilitySchema>;
export const v2IdSchema = z.string().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/u);
export const v2ProjectIdSchema = z.string().regex(/^A008_v1_project_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const v2TicketRequestSchema = z.object({ projectId: v2ProjectIdSchema, sessionId: v2IdSchema.optional() }).strict();
export const v2TicketResponseSchema = z.object({ serverInstanceId: v2IdSchema, ticket: z.string().min(32).max(128), expiresAt: z.number().int(), projectId: v2ProjectIdSchema, sessionId: v2IdSchema.optional() });
export const v2AuthenticateSchema = z.object({ type: z.literal("authenticate"), ticket: z.string().min(32).max(128) }).strict();
export const V2_ERROR_CODES = ["INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "PROJECT_NOT_FOUND", "SESSION_EXPIRED", "SESSION_BUSY", "REVISION_CONFLICT", "UNSUPPORTED_CAPABILITY", "PROJECT_BINDING_CONFLICT", "COMMAND_CONFLICT", "COMMAND_UNKNOWN", "CAPACITY_EXCEEDED", "SNAPSHOT_TOO_LARGE", "RUNTIME_FAILED"] as const;
export const v2ErrorSchema = z.object({ type: z.literal("error"), serverInstanceId: v2IdSchema,
  requestId: v2IdSchema.optional(), code: z.enum(V2_ERROR_CODES), message: z.string(), retryable: z.boolean(),
  projectId: v2ProjectIdSchema.optional(), sessionId: v2IdSchema.optional() });
export const v2InfoSchema = z.object({ protocol: z.literal("a008.v2"), serverInstanceId: v2IdSchema,
  serverVersion: z.string(), authProfiles: z.array(z.enum(["device", "browser-pin"])), features: z.array(z.string()),
  limits: z.object({ ticketLifetimeMs: z.number().int(), preauthFrameBytes: z.number().int(), authenticationDeadlineMs: z.number().int(),
    inputFrameBytes: z.number().int(), outputFrameBytes: z.number().int(), promptBytes: z.number().int() }) });
export const v2DeviceGrantSchema = z.object({ name: z.string().trim().min(1).max(80),
  projects: z.array(v2ProjectIdSchema).min(1).max(100), capabilities: z.array(v2CapabilitySchema).min(1).max(8),
  expiresInDays: z.number().int().min(1).max(30).default(30) }).strict();
export type V2DeviceGrant = z.input<typeof v2DeviceGrantSchema>;
export type V2TicketRequest = z.infer<typeof v2TicketRequestSchema>;
export type V2ErrorCode = typeof V2_ERROR_CODES[number];

export function v2AuthJsonSchemas() {
  return Object.fromEntries(Object.entries({ "v2-info": v2InfoSchema, "v2-error": v2ErrorSchema,
    "v2-ticket-request": v2TicketRequestSchema, "v2-ticket-response": v2TicketResponseSchema,
    "v2-authenticate": v2AuthenticateSchema }).map(([name, schema]) => [name, z.toJSONSchema(schema)]));
}

export function v2AuthOpenApiDocument() {
  const json = (schema: string) => ({ "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } });
  const errors = Object.fromEntries([400, 401, 403, 404, 415, 429, 500].map(status => [status, { description: "Structured V2 error", content: json("v2-error") }]));
  return { openapi: "3.1.1", info: { title: "A008 V2 authentication", version: "2.0.0" },
    paths: {
      "/v2/info": { get: { security: [], responses: { 200: { description: "Public protocol discovery", content: json("v2-info") }, ...errors } } },
      "/v2/auth/ticket": { post: { security: [{ device: [] }, { browserPin: [] }], requestBody: { required: true, content: json("v2-ticket-request") },
        responses: { 200: { description: "One-use scoped ticket", content: json("v2-ticket-response") }, ...errors } } },
    }, components: { schemas: v2AuthJsonSchemas(), securitySchemes: {
      device: { type: "http", scheme: "bearer" }, browserPin: { type: "apiKey", in: "cookie", name: "a008_auth" },
    } } };
}
