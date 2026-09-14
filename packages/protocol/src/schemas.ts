import { z } from "zod";

// V1 schemas describe transport, not runtime policy or provider limits. Object
// schemas accept additive keys; adapters retain the original snapshot object.
const text = z.string();
const finite = z.number();
const nonempty = text.min(1);
const commandId = text.regex(/\S/u);
const resumeToken = text.regex(/^[a-f0-9]{64}$/u);
export const sessionParametersSchema = z.object({
  stream: z.boolean(), temperature: finite.nullable(), topP: finite.nullable(),
  maxTokens: finite, enableThinking: z.boolean().nullable(),
  reasoningBudget: finite.nullable(), reasoningEffort: text.nullable(),
  seed: finite.nullable(), stop: z.array(text).readonly().nullable(),
});
export type SessionParameters = z.infer<typeof sessionParametersSchema>;
export const generationCapabilitiesSchema = z.object({
  maxTokens: finite, topP: z.boolean(), thinking: z.boolean(),
  reasoningBudget: finite.nullable(), reasoningEfforts: z.array(text).readonly(),
  seed: z.boolean(), stop: z.boolean(), verifiedOn: text,
});
export type GenerationCapabilities = z.infer<typeof generationCapabilitiesSchema>;
export const modelSchema = z.object({ id: text, name: text,
  defaults: sessionParametersSchema, capabilities: generationCapabilitiesSchema });
export type GuiModel = z.infer<typeof modelSchema>;
export const modelsResponseSchema = z.object({ models: z.array(modelSchema) });

export const runtimeBudgetFieldSchema = z.object({
  key: text, label: text, unit: text, description: text,
  minimum: finite.int().min(0).max(Number.MAX_SAFE_INTEGER),
  maximum: finite.int().max(Number.MAX_SAFE_INTEGER),
});
export type RuntimeBudgetField = z.infer<typeof runtimeBudgetFieldSchema>;
export const runtimePreferencesSchema = z.object({ instructions: text, budgets: z.record(text, finite) });
export type RuntimePreferences = z.infer<typeof runtimePreferencesSchema>;
export const runtimePreferencesSnapshotSchema = z.object({
  revision: text, settings: runtimePreferencesSchema, defaults: runtimePreferencesSchema,
  fields: z.array(runtimeBudgetFieldSchema).min(1).readonly(), storagePath: text.nullable(),
}).superRefine((snapshot, ctx) => {
  const keys = new Set(snapshot.fields.map(field => field.key));
  const invalid = keys.size !== snapshot.fields.length || snapshot.fields.some(field => field.maximum < field.minimum) ||
    [snapshot.settings, snapshot.defaults].some(settings =>
      Object.keys(settings.budgets).length !== keys.size || snapshot.fields.some(field => {
        const value = settings.budgets[field.key];
        return value === undefined || !Number.isSafeInteger(value) || value < field.minimum || value > field.maximum;
      }));
  if (invalid) ctx.addIssue({ code: "custom", message: "Runtime budgets must match their declared fields and bounds." });
});
export type RuntimePreferencesSnapshot = z.infer<typeof runtimePreferencesSnapshotSchema>;
export const sessionSnapshotSchema = z.object({
  runtimePreferences: runtimePreferencesSnapshotSchema.optional(), model: text,
  parameters: sessionParametersSchema,
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: text })).readonly(),
  runtime: z.object({ cwd: text, projectId: text.nullable(), memoryPath: text.nullable(),
    tools: z.array(z.object({ name: text, description: text })).readonly().optional() }),
  undone: z.boolean().optional(), closed: z.boolean().optional(),
});
export type SessionSnapshot<R = RuntimePreferencesSnapshot> =
  Omit<z.infer<typeof sessionSnapshotSchema>, "runtimePreferences"> & { readonly runtimePreferences?: R };

// Host accepts control payload envelopes before runtime policy validation.
export const sessionControlInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["inspect", "reset", "undo", "close"]) }),
  z.object({ action: z.literal("model"), model: commandId }),
  z.object({ action: z.literal("configure"), parameters: z.unknown() }),
  z.object({ action: z.literal("configureRuntime"), settings: z.unknown(), revision: text }),
]);
export type SessionControlInput = z.infer<typeof sessionControlInputSchema>;
export type SessionControl = Exclude<SessionControlInput, { action: "configure" | "configureRuntime" }> |
  { action: "configure"; parameters: SessionParameters } |
  { action: "configureRuntime"; settings: RuntimePreferences; revision: string };
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session/new"), requestId: commandId, model: commandId.optional() }),
  z.object({ type: z.literal("session/resume"), requestId: commandId, sessionId: commandId, resumeToken }),
  z.object({ type: z.literal("prompt"), requestId: commandId, sessionId: commandId, text }),
  z.object({ type: z.literal("cancel"), requestId: commandId, sessionId: commandId }),
  z.object({ type: z.literal("tool/permission"), requestId: commandId, sessionId: commandId, permissionId: text, allow: z.boolean() }),
  z.object({ type: z.literal("session/control"), requestId: commandId, sessionId: commandId, control: sessionControlInputSchema }),
]);
type WithControl<T, C> = T extends { control: unknown } ? Omit<T, "control"> & { control: C } : T;
export type ClientMessage<C = SessionControl> = WithControl<z.infer<typeof clientMessageSchema>, C>;

const newSession = z.object({ type: z.literal("session/new/ok"), requestId: nonempty,
  sessionId: nonempty, resumeToken: resumeToken.optional(), state: sessionSnapshotSchema.optional() });
const replies = [
  z.object({ type: z.literal("session/resume/ok"), requestId: nonempty, sessionId: nonempty, resumeToken, state: sessionSnapshotSchema.optional() }),
  z.object({ type: z.literal("prompt/ok"), requestId: nonempty, sessionId: nonempty, state: sessionSnapshotSchema.optional() }),
  z.object({ type: z.literal("session/control/ok"), requestId: nonempty, sessionId: nonempty, state: sessionSnapshotSchema }),
  z.object({ type: z.literal("thought"), sessionId: nonempty, text }),
  z.object({ type: z.literal("answer"), sessionId: nonempty, text }),
  z.object({ type: z.literal("error"), message: text, requestId: text.optional(), sessionId: text.optional() }),
  z.object({ type: z.literal("tool"), sessionId: text, id: text, title: text, status: text, text }),
  z.object({ type: z.literal("tool/permission"), sessionId: text, id: text, title: text, text }),
  z.object({ type: z.literal("session/activity"), sessionId: nonempty, active: z.boolean(), text: text.optional(), state: sessionSnapshotSchema.optional() }),
] as const;
export const serverMessageSchema = z.discriminatedUnion("type", [newSession, ...replies]);
export const hostServerMessageSchema = z.discriminatedUnion("type", [newSession.required({ resumeToken: true }), ...replies]);
type WithState<T, S> = T extends { state: unknown } ? Omit<T, "state"> & { state: S } :
  "state" extends keyof T ? Omit<T, "state"> & { state?: S } : T;
export type ServerMessage<S = SessionSnapshot> = WithState<z.infer<typeof serverMessageSchema>, S>;
export type HostServerMessage<S = SessionSnapshot> = WithState<z.infer<typeof hostServerMessageSchema>, S>;

export function isParameters(value: unknown): value is SessionParameters { return sessionParametersSchema.safeParse(value).success; }
export function isRuntimePreferencesSnapshot(value: unknown): value is RuntimePreferencesSnapshot { return runtimePreferencesSnapshotSchema.safeParse(value).success; }
export function parseSessionSnapshot(value: unknown): SessionSnapshot {
  if (!sessionSnapshotSchema.safeParse(value).success) throw new Error("Host sent an invalid session snapshot.");
  return value as SessionSnapshot;
}
export const v1JsonSchemas = () => Object.fromEntries(Object.entries({
  clientMessage: clientMessageSchema, serverMessage: serverMessageSchema,
  hostServerMessage: hostServerMessageSchema, sessionSnapshot: sessionSnapshotSchema,
  modelsResponse: modelsResponseSchema,
}).map(([name, schema]) => [name, z.toJSONSchema(schema, { target: "draft-2020-12", io: "input", reused: "ref" })]));
