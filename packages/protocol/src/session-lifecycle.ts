import { z } from "zod";

export const sessionProcessSchema = z.strictObject({
  sessionId: z.string(),
  workspaceId: z.string(),
  instanceId: z.string(),
  processId: z.number().int().nonnegative(),
  state: z.enum(["running", "stopped"]),
});
export const sessionProcessResponseSchema = z.strictObject({
  process: sessionProcessSchema.nullable(),
});
export const sessionEffectReviewSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  effectsReviewed: z.literal(true),
});
export const sessionActivityEventsSchema = z.strictObject({
  events: z
    .array(
      z.strictObject({
        cursor: z.number().int().positive(),
        changes: z.strictObject({
          answer: z
            .union([
              z.strictObject({ append: z.string() }),
              z.strictObject({ replace: z.string() }),
            ])
            .optional(),
          tools: z
            .array(
              z.object({
                id: z.string(),
                title: z.string(),
                status: z.string(),
                text: z.string(),
                outcome: z.string().optional(),
                modelVisibleBytes: z.number().int().nonnegative().optional(),
                startedAt: z.number().int().nonnegative().optional(),
                finishedAt: z.number().int().nonnegative().optional(),
              }),
            )
            .optional(),
          permission: z
            .object({ id: z.string(), title: z.string(), text: z.string() })
            .nullable()
            .optional(),
        }),
      }),
    )
    .max(100),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type SessionProcessResponse = z.infer<
  typeof sessionProcessResponseSchema
>;
export type SessionActivityEvents = z.infer<typeof sessionActivityEventsSchema>;
export type SessionEffectReview = z.infer<typeof sessionEffectReviewSchema>;
