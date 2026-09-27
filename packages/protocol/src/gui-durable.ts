import { z } from "zod";
import { sessionProcessSchema } from "./session-lifecycle.js";
export * from "./session-lifecycle.js";
import { sessionSnapshotSchema } from "./schemas.js";
import {
  platformV3ConversationSchema,
  platformV3RunSchema,
} from "./platform-v3.js";
import { workspaceSessionSchema } from "./http-schemas.js";

/** Live observer state; committed conversation/run records remain authoritative. */
export const guiRunActivitySchema = z.object({
  cursor: z.number().int().nonnegative().optional(),
  snapshot: sessionSnapshotSchema.optional(),
  thought: z.string(),
  answer: z.string(),
  tools: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      text: z.string(),
    }),
  ),
  permission: z
    .object({ id: z.string(), title: z.string(), text: z.string() })
    .optional(),
});
export const guiRunPermissionSchema = z
  .object({ id: z.string().min(1), allow: z.boolean() })
  .strict();
export type GuiRunActivity = z.infer<typeof guiRunActivitySchema>;

export const guiConversationViewSchema = z.object({
  conversation: platformV3ConversationSchema,
  runs: z.array(platformV3RunSchema),
  snapshot: sessionSnapshotSchema,
  workspace: workspaceSessionSchema.nullable(),
  process: sessionProcessSchema.optional(),
});
export type GuiConversationView = z.infer<typeof guiConversationViewSchema>;
