import { z } from "zod";
import { sessionControlInputSchema, sessionParametersSchema } from "./schemas.js";
import { v2AuthenticateSchema, v2ErrorSchema, v2IdSchema, v2ProjectIdSchema } from "./v2-auth.js";

export const V2_SESSION_ACTIONS = [
  "session/new",
  "session/inspect",
  "session/prompt",
  "session/cancel",
  "session/control",
  "tool/permission",
] as const;

const baseCommand = {
  type: z.literal("command"),
  requestId: v2IdSchema,
  projectId: v2ProjectIdSchema,
};
const sessionCommand = { ...baseCommand, sessionId: v2IdSchema };

export const v2SessionCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...baseCommand, action: z.literal("session/new"), payload: z.object({ model: v2IdSchema.optional() }).strict().optional() }).strict(),
  z.object({ ...sessionCommand, action: z.literal("session/inspect") }).strict(),
  z.object({ ...sessionCommand, action: z.literal("session/prompt"), payload: z.object({ text: z.string().min(1) }).strict() }).strict(),
  z.object({ ...sessionCommand, action: z.literal("session/cancel") }).strict(),
  z.object({ ...sessionCommand, action: z.literal("session/control"), payload: z.object({ control: sessionControlInputSchema }).strict() }).strict(),
  z.object({ ...sessionCommand, action: z.literal("tool/permission"), payload: z.object({ permissionId: v2IdSchema, allow: z.boolean() }).strict() }).strict(),
]);

export type V2SessionCommand = z.infer<typeof v2SessionCommandSchema>;
export const v2SessionClientFrameSchema = z.union([v2AuthenticateSchema, v2SessionCommandSchema]);
export const v2SessionStateSchema = z.object({
  projectId: v2ProjectIdSchema,
  sessionId: v2IdSchema,
  model: z.string(),
  parameters: sessionParametersSchema,
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).readonly(),
  active: z.boolean(),
  tools: z.array(z.object({ name: z.string(), description: z.string() })).readonly().optional(),
  undone: z.boolean().optional(),
  closed: z.boolean().optional(),
}).strict();
export type V2SessionState = z.infer<typeof v2SessionStateSchema>;

export const v2SessionAuthenticatedSchema = z.object({
  type: z.literal("authenticated"),
  serverInstanceId: v2IdSchema,
  projectId: v2ProjectIdSchema,
  sessionId: v2IdSchema.optional(),
}).strict();

export const v2SessionResultSchema = z.object({
  type: z.literal("result"),
  serverInstanceId: v2IdSchema,
  requestId: v2IdSchema,
  action: z.enum(V2_SESSION_ACTIONS),
  projectId: v2ProjectIdSchema,
  sessionId: v2IdSchema.optional(),
  state: v2SessionStateSchema.optional(),
}).strict();

export const v2SessionSignalSchema = z.discriminatedUnion("signal", [
  z.object({ type: z.literal("signal"), signal: z.enum(["thought", "answer"]), sessionId: v2IdSchema, text: z.string() }).strict(),
  z.object({ type: z.literal("signal"), signal: z.literal("tool"), sessionId: v2IdSchema,
    id: z.string().min(1).max(512), title: z.string(), status: z.string(), text: z.string() }).strict(),
  z.object({ type: z.literal("signal"), signal: z.literal("tool/permission"), sessionId: v2IdSchema,
    permissionId: v2IdSchema, title: z.string(), text: z.string() }).strict(),
]);

export const v2SessionServerFrameSchema = z.union([
  v2SessionAuthenticatedSchema,
  v2SessionResultSchema,
  v2SessionSignalSchema,
  v2ErrorSchema,
]);
export type V2SessionServerFrame = z.infer<typeof v2SessionServerFrameSchema>;

export function v2SessionJsonSchemas() {
  return Object.fromEntries(Object.entries({
    "v2-session-client-frame": v2SessionClientFrameSchema,
    "v2-session-command": v2SessionCommandSchema,
    "v2-session-state": v2SessionStateSchema,
    "v2-session-authenticated": v2SessionAuthenticatedSchema,
    "v2-session-result": v2SessionResultSchema,
    "v2-session-signal": v2SessionSignalSchema,
    "v2-session-server-frame": v2SessionServerFrameSchema,
  }).map(([name, schema]) => [name, z.toJSONSchema(schema)]));
}
