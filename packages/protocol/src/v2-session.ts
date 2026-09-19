import { z } from "zod";
import {
  sessionControlInputSchema,
  sessionParametersSchema,
} from "./schemas.js";
import {
  v2AuthenticateSchema,
  v2ErrorSchema,
  v2IdSchema,
  v2ProjectIdSchema,
} from "./v2-auth.js";

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
  z
    .object({
      ...baseCommand,
      action: z.literal("session/new"),
      payload: z.object({ model: v2IdSchema.optional() }).strict().optional(),
    })
    .strict(),
  z
    .object({ ...sessionCommand, action: z.literal("session/inspect") })
    .strict(),
  z
    .object({
      ...sessionCommand,
      action: z.literal("session/prompt"),
      payload: z.object({ text: z.string().min(1) }).strict(),
    })
    .strict(),
  z.object({ ...sessionCommand, action: z.literal("session/cancel") }).strict(),
  z
    .object({
      ...sessionCommand,
      action: z.literal("session/control"),
      payload: z.object({ control: sessionControlInputSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...sessionCommand,
      action: z.literal("tool/permission"),
      payload: z
        .object({ permissionId: v2IdSchema, allow: z.boolean() })
        .strict(),
    })
    .strict(),
]);

export type V2SessionCommand = z.infer<typeof v2SessionCommandSchema>;
export const v2SessionClientFrameSchema = z.union([
  v2AuthenticateSchema,
  v2SessionCommandSchema,
]);
export const v2TurnOutcomeSchema = z.enum([
  "completed",
  "cancelled",
  "interrupted",
  "failed",
]);
export type V2TurnOutcome = z.infer<typeof v2TurnOutcomeSchema>;

export const v2SessionMessageSchema = z
  .object({
    messageId: v2IdSchema,
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })
  .strict();

export const v2ActiveTurnSchema = z
  .object({ turnId: v2IdSchema, status: z.literal("running") })
  .strict();

export const v2SessionStateSchema = z
  .object({
    projectId: v2ProjectIdSchema,
    sessionId: v2IdSchema,
    sequence: z.number().int().nonnegative(),
    model: z.string(),
    parameters: sessionParametersSchema,
    messages: z.array(v2SessionMessageSchema).readonly(),
    active: z.boolean(),
    activeTurn: v2ActiveTurnSchema.optional(),
    tools: z
      .array(z.object({ name: z.string(), description: z.string() }))
      .readonly()
      .optional(),
    undone: z.boolean().optional(),
    closed: z.boolean().optional(),
  })
  .strict();
export type V2SessionState = z.infer<typeof v2SessionStateSchema>;

export const v2SessionAuthenticatedSchema = z
  .object({
    type: z.literal("authenticated"),
    serverInstanceId: v2IdSchema,
    projectId: v2ProjectIdSchema,
    sessionId: v2IdSchema.optional(),
  })
  .strict();

export const v2SessionResultSchema = z
  .object({
    type: z.literal("result"),
    serverInstanceId: v2IdSchema,
    requestId: v2IdSchema,
    action: z.enum(V2_SESSION_ACTIONS),
    projectId: v2ProjectIdSchema,
    sessionId: v2IdSchema.optional(),
    state: v2SessionStateSchema.optional(),
  })
  .strict();

const v2EventBase = {
  type: z.literal("event"),
  serverInstanceId: v2IdSchema,
  sessionId: v2IdSchema,
  sequence: z.number().int().positive(),
};
const v2TurnEventBase = { ...v2EventBase, turnId: v2IdSchema };

export const v2SessionEventSchema = z.discriminatedUnion("event", [
  z.object({ ...v2TurnEventBase, event: z.literal("turn/started") }).strict(),
  z
    .object({
      ...v2TurnEventBase,
      event: z.literal("answer/delta"),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...v2TurnEventBase,
      event: z.literal("thought/delta"),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...v2TurnEventBase,
      event: z.literal("tool"),
      id: z.string().min(1).max(512),
      title: z.string(),
      status: z.string(),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...v2TurnEventBase,
      event: z.literal("tool/permission"),
      permissionId: v2IdSchema,
      title: z.string(),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...v2EventBase,
      event: z.literal("state/changed"),
      reason: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      ...v2TurnEventBase,
      event: z.literal("turn/terminal"),
      outcome: v2TurnOutcomeSchema,
      answerStatus: v2TurnOutcomeSchema,
      memoryStatus: z.string().min(1).max(64),
    })
    .strict(),
]);
export type V2SessionEvent = z.infer<typeof v2SessionEventSchema>;

/** Clients apply only strictly newer events after replacing state from a snapshot. */
export function isV2SessionEventNewer(
  lastAppliedSequence: number,
  event: Pick<V2SessionEvent, "sequence">,
): boolean {
  return event.sequence > lastAppliedSequence;
}

export const v2SessionServerFrameSchema = z.union([
  v2SessionAuthenticatedSchema,
  v2SessionResultSchema,
  v2SessionEventSchema,
  v2ErrorSchema,
]);
export type V2SessionServerFrame = z.infer<typeof v2SessionServerFrameSchema>;

export function v2SessionJsonSchemas() {
  return Object.fromEntries(
    Object.entries({
      "v2-session-client-frame": v2SessionClientFrameSchema,
      "v2-session-command": v2SessionCommandSchema,
      "v2-session-state": v2SessionStateSchema,
      "v2-session-authenticated": v2SessionAuthenticatedSchema,
      "v2-session-result": v2SessionResultSchema,
      "v2-session-event": v2SessionEventSchema,
      "v2-session-server-frame": v2SessionServerFrameSchema,
    }).map(([name, schema]) => [name, z.toJSONSchema(schema)]),
  );
}
