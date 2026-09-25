import { z } from "zod";
import { modelSchema } from "./schemas.js";

const text = z.string();
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const strings = z.array(text).readonly();
const nonempty = text.min(1);

// Current HTTP producer includes `added`; the legacy model reader deliberately
// keeps its older, more tolerant schema in schemas.ts.
export const hostModelSchema = modelSchema.extend({ added: z.boolean() });
export type HostModel = z.infer<typeof hostModelSchema>;
export const hostModelsResponseSchema = z.object({
  models: z.array(hostModelSchema),
});

export const MEMORY_KINDS = [
  "entity",
  "state",
  "history",
  "claim",
  "event",
  "utterance",
  "artifact",
  "provenance",
] as const;
export const memoryKindSchema = z.enum(MEMORY_KINDS);
export type MemoryKind = z.infer<typeof memoryKindSchema>;
export const memoryQuerySchema = z.strictObject({
  query: text.max(300).optional(),
  kind: memoryKindSchema.optional(),
  domain: text.max(300).optional(),
  status: text.max(300).optional(),
  offset: count.max(1_000_000).optional(),
  limit: count.min(1).max(100).optional(),
});
export type MemoryInspectionQuery = z.infer<typeof memoryQuerySchema>;
export const memoryRecordSchema = z.object({
  id: text,
  sourceId: text,
  kind: memoryKindSchema,
  label: text,
  status: text,
  activation: text,
  tags: strings,
  domains: strings,
  storedDomains: strings.optional(),
  effectiveDomains: strings.optional(),
  primaryEffectiveDomain: text.nullable().optional(),
  detail: text,
  truncated: z.boolean(),
});
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export const memoryEdgeSchema = z.object({
  from: text,
  to: text,
  relation: text,
});
export type MemoryEdge = z.infer<typeof memoryEdgeSchema>;
const memoryCounts = z.object(
  Object.fromEntries(MEMORY_KINDS.map((kind) => [kind, count])) as Record<
    MemoryKind,
    typeof count
  >,
);
export const memorySnapshotSchema = z
  .object({
    protocol: z.literal("A008_MEMORY_INSPECT_V1"),
    projectId: text,
    durable: z.boolean(),
    summary: z.object({
      total: count,
      counts: memoryCounts,
      active: count,
      dormant: count,
      contestedSlots: count,
      domains: z.array(z.object({ name: text, count })).readonly(),
      statuses: strings,
    }),
    records: z.array(memoryRecordSchema).max(100).readonly(),
    matched: count,
    offset: count,
    limit: count,
    graph: z.object({
      nodes: z.array(memoryRecordSchema).max(80).readonly(),
      edges: z.array(memoryEdgeSchema).max(240).readonly(),
      totalNodes: count,
      totalEdges: count,
    }),
  })
  .superRefine((snapshot, ctx) => {
    const ids = new Set(snapshot.graph.nodes.map((node) => node.id));
    if (
      snapshot.graph.edges.some(
        (edge) => !ids.has(edge.from) || !ids.has(edge.to),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Graph edges must reference returned nodes.",
      });
    }
  });
export type MemorySnapshot = z.infer<typeof memorySnapshotSchema>;

export const projectBootstrapConfigSchema = z.object({
  projectName: text,
  rootFolder: text,
  repository: z.object({ initialize: z.boolean(), name: text.optional() }),
  continuity: z.object({
    docsFirst: z.boolean(),
    multiAgent: z.object({
      enabled: z.boolean(),
      maxWorkers: z.number().optional(),
      workerCloneRoot: text.optional(),
    }),
  }),
  memory: z.object({ useGlobalA008Memory: z.boolean() }),
});
export type ProjectBootstrapConfig = z.infer<
  typeof projectBootstrapConfigSchema
>;
export const existingProjectRegistrationSchema = z.object({
  projectName: nonempty,
  rootFolder: nonempty,
  memory: z.object({ useGlobalA008Memory: z.boolean() }),
});
export type ExistingProjectRegistration = z.infer<
  typeof existingProjectRegistrationSchema
>;
export const plannedMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mkdir"), path: text }),
  z.object({ kind: z.literal("write"), path: text, bytes: count }),
  z.object({ kind: z.literal("git-init"), path: text }),
]);
export type PlannedMutation = z.infer<typeof plannedMutationSchema>;
const multiAgent = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    maxWorkers: z.number(),
    workerCloneRoot: text,
  }),
]);
export const projectPlanSchema = z.object({
  projectId: text,
  projectName: text,
  rootFolder: text,
  repositoryName: text,
  mutations: z.array(plannedMutationSchema).readonly(),
  memory: z.object({ useGlobalStore: z.boolean(), namespace: text }),
  multiAgent,
});
export type ProjectBootstrapPlan = z.infer<typeof projectPlanSchema>;
export const registeredProjectSchema = z.object({
  projectId: text,
  name: text,
  rootFolder: text,
  createdAt: text,
  pinned: z.boolean().optional(),
  repository: z.object({ initialize: z.boolean(), name: text }),
  continuity: z.object({ docsFirst: z.boolean(), multiAgent }),
  memory: z.object({ useGlobalA008Memory: z.boolean() }),
});
export type RegisteredProject = z.infer<typeof registeredProjectSchema>;
export const projectsResponseSchema = z.object({
  currentId: text.nullable(),
  projects: z.array(registeredProjectSchema).readonly(),
});
export type ProjectsResponse = z.infer<typeof projectsResponseSchema>;
export const projectSidebarSchema = z.object({
  currentId: text.nullable(),
  projects: z.array(
    registeredProjectSchema.extend({
      conversations: z.array(
        z.object({
          conversationId: text,
          title: text,
          updatedAt: text,
          current: z.boolean(),
        }),
      ),
    }),
  ),
});
export type ProjectSidebar = z.infer<typeof projectSidebarSchema>;
export const projectUpdateSchema = z
  .object({
    projectId: nonempty,
    name: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
  })
  .strict();
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export const projectChatActionSchema = z
  .object({
    projectId: nonempty,
    action: z.enum(["new", "open"]),
    conversationId: nonempty.optional(),
  })
  .strict();
export type ProjectChatAction = z.infer<typeof projectChatActionSchema>;
export const workspaceGitStatusSchema = z.object({
  modifiedFiles: count,
  commitsAhead: count,
  clean: z.boolean(),
});
export const workspaceSessionSchema = z.object({
  id: nonempty,
  projectId: nonempty,
  workspaceMode: z.enum(["shared", "worktree"]),
  workspacePath: text,
  branchName: text.optional(),
  baseBranch: text.optional(),
  disposition: z.enum(["active", "kept", "discarded"]),
  createdAt: text,
  status: workspaceGitStatusSchema,
});
export type WorkspaceSession = z.infer<typeof workspaceSessionSchema>;
export const workspaceSessionsSchema = z.object({
  workspaceRoot: text.nullable(),
  sessions: z.array(workspaceSessionSchema),
});
export type WorkspaceSessions = z.infer<typeof workspaceSessionsSchema>;
export const workspaceSettingsSchema = z.object({ workspaceRoot: text.nullable() });
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export const workspaceSettingsInputSchema = z.object({ workspaceRoot: nonempty }).strict();
export const workspaceCreateInputSchema = z.object({ baseBranch: text.trim().min(1).optional() }).strict();
export const projectCreatedSchema = z.object({
  plan: projectPlanSchema,
  project: registeredProjectSchema,
});
export type ProjectCreated = z.infer<typeof projectCreatedSchema>;
export const workspaceBindingSchema = z.object({
  cwd: text,
  projectId: text,
  useGlobalMemory: z.boolean(),
});
export type WorkspaceBinding = z.infer<typeof workspaceBindingSchema>;
export const directoryListSchema = z.object({ path: text, entries: strings });
export type DirectoryList = z.infer<typeof directoryListSchema>;
export const workspaceFileEntrySchema = z.object({ name: nonempty, path: nonempty, type: z.enum(["directory", "file"]) });
export const workspaceFilesSchema = z.object({ path: text, entries: z.array(workspaceFileEntrySchema).readonly() });
export type WorkspaceFiles = z.infer<typeof workspaceFilesSchema>;
export const workspaceTextFileSchema = z.object({ path: nonempty, content: text.max(256 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/u) });
export type WorkspaceTextFile = z.infer<typeof workspaceTextFileSchema>;
export const workspaceTextFileSaveSchema = workspaceTextFileSchema.pick({ path: true, content: true }).extend({ expectedSha256: z.string().regex(/^[a-f0-9]{64}$/u) });
// V1 accepts missing/non-object optional groups and normalizes defaults in the
// bootstrap owner. This input envelope must not claim its normalized DTO is required.
export const projectBootstrapInputSchema = z.object({
  projectName: nonempty,
  rootFolder: nonempty,
  repository: z.unknown().optional(),
  continuity: z.unknown().optional(),
  memory: z.unknown().optional(),
  projectId: z.unknown().optional(),
});
export const projectOpenSchema = z.object({ projectId: nonempty });

export const userChatModelSchema = z.object({
  id: text,
  name: text,
  provider: text,
  inputModalities: z
    .array(z.enum(["text", "image", "video", "audio"]))
    .readonly(),
  baseUrl: text.optional(),
  apiStyle: z
    .enum(["openai-chat-completions", "openai-responses"])
    .optional(),
});
export type UserChatModel = z.infer<typeof userChatModelSchema>;
export const nvidiaCatalogModelSchema = z.object({
  id: text,
  ownedBy: text,
  added: z.boolean(),
});
export type NvidiaCatalogModel = z.infer<typeof nvidiaCatalogModelSchema>;
export const nvidiaCatalogSchema = z.object({
  source: text,
  browse: text,
  note: text,
  models: z.array(nvidiaCatalogModelSchema).readonly(),
});
export type NvidiaCatalog = z.infer<typeof nvidiaCatalogSchema>;
export const kieCatalogModelSchema = z.object({
  id: text,
  name: text,
  kind: z.enum(["chat", "image", "video"]),
  added: z.boolean(),
});
export type KieCatalogModel = z.infer<typeof kieCatalogModelSchema>;
export const kieCatalogSchema = z.object({
  source: text,
  browse: text,
  note: text,
  models: z.array(kieCatalogModelSchema).readonly(),
});
export type KieCatalog = z.infer<typeof kieCatalogSchema>;

export const skillSchema = z.object({
  id: nonempty,
  name: nonempty,
  description: text,
  instructions: text.max(65_536),
  sourcePath: nonempty,
});
export type Skill = z.infer<typeof skillSchema>;
export const installedSkillsSchema = z.object({ skills: z.array(skillSchema).readonly() });
export const skillCatalogEntrySchema = skillSchema.omit({ instructions: true }).extend({ installed: z.boolean() });
export const skillDiscoverySchema = z.object({ source: nonempty, skills: z.array(skillCatalogEntrySchema).readonly() });
export const skillInstallInputSchema = z.object({ sourcePath: nonempty });
export const skillInstalledSchema = z.object({ skill: skillSchema });
export const skillRemovedSchema = z.object({ removed: nonempty });

export const zeroCostAccessSchema = z.enum([
  "free-endpoint",
  "free-model",
  "free-tier",
]);
export const zeroCostLifecycleSchema = z.enum([
  "recurring",
  "dynamic",
  "preview",
  "trial",
]);
export const zeroCostApiStyleSchema = z.enum([
  "openai-chat-completions",
  "openai-responses",
]);
export const zeroCostInputModalitySchema = z.enum([
  "text",
  "image",
  "audio",
  "video",
  "pdf",
]);
export const zeroCostCapabilitySchema = z.enum([
  "agentic",
  "coding",
  "reasoning",
  "tools",
  "structured-output",
  "code-execution",
  "long-context",
  "multimodal",
]);
export const zeroCostDataPolicySchema = z.enum([
  "review-before-sensitive-use",
  "do-not-send-sensitive-data",
]);
export const zeroCostModelRouteSchema = z.object({
  key: nonempty,
  provider: z.enum(["nvidia", "opencode", "openrouter", "groq", "google"]),
  modelId: nonempty,
  name: nonempty,
  baseUrl: nonempty,
  apiStyle: zeroCostApiStyleSchema,
  access: zeroCostAccessSchema,
  lifecycle: zeroCostLifecycleSchema,
  contextWindow: count.optional(),
  maxOutputTokens: count.optional(),
  inputModalities: z.array(zeroCostInputModalitySchema).readonly().optional(),
  capabilities: z.array(zeroCostCapabilitySchema).readonly().optional(),
  quota: text.optional(),
  expiresAt: text.optional(),
  dataPolicy: zeroCostDataPolicySchema,
  a008ProfileId: text.optional(),
  note: text.optional(),
  verifiedAt: nonempty,
  sourceUrls: z.array(nonempty).min(1).readonly(),
});
export type ZeroCostModelRouteDto = z.infer<typeof zeroCostModelRouteSchema>;
export const zeroCostCatalogSchema = z.object({
  verifiedAt: nonempty,
  routes: z.array(zeroCostModelRouteSchema).readonly(),
});
export type ZeroCostCatalog = z.infer<typeof zeroCostCatalogSchema>;
export const mcpServerSchema = z.object({
  name: nonempty,
  command: nonempty,
  args: z.array(text),
  env: z.array(z.object({ name: nonempty, value: text })),
  enabled: z.boolean(),
});
export type McpServer = z.infer<typeof mcpServerSchema>;
export const mcpServerCatalogSchema = z.object({
  servers: z.array(mcpServerSchema).readonly(),
});
export type McpServerCatalog = z.infer<typeof mcpServerCatalogSchema>;
export const mcpServerCatalogInputSchema = z.object({ servers: z.unknown() });
export const mcpServerHealthStatusSchema = z.enum([
  "ready",
  "failed",
  "restart_required",
  "untested",
]);
export const mcpProbeStageSchema = z.enum([
  "process",
  "handshake",
  "catalog",
  "close",
]);
export const mcpServerHealthEntrySchema = z.object({
  name: nonempty,
  status: mcpServerHealthStatusSchema,
  stage: mcpProbeStageSchema.optional(),
  toolCount: count.optional(),
  testedAt: text.optional(),
  lines: z.array(nonempty).readonly(),
});
export type McpServerHealthEntry = z.infer<typeof mcpServerHealthEntrySchema>;
export const mcpServerHealthSchema = z.object({
  restartRequired: z.boolean(),
  servers: z.array(mcpServerHealthEntrySchema).readonly(),
});
export type McpServerHealth = z.infer<typeof mcpServerHealthSchema>;
export const mcpServerProbeInputSchema = z.object({ name: nonempty });
export const providerSettingsSchema = z.object({
  nvidiaApiKeyConfigured: z.boolean(),
  kieApiKeyConfigured: z.boolean(),
  openAiApiKeyConfigured: z.boolean(),
  openRouterApiKeyConfigured: z.boolean(),
  groqApiKeyConfigured: z.boolean(),
  geminiApiKeyConfigured: z.boolean(),
  openCodeApiKeyConfigured: z.boolean(),
  imageModel: text,
  imageEndpoint: text,
  chatProvider: z.enum(["nvidia", "kie", "openai"]),
  imageProvider: z.enum(["nvidia", "kie"]),
  kieChatModel: text,
  kieChatEndpoint: text,
  kieImageModel: text,
  keySource: text,
  kieKeySource: text,
  openAiKeySource: text,
  openRouterKeySource: text,
  groqKeySource: text,
  geminiKeySource: text,
  openCodeKeySource: text,
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export const providerSettingsUpdateSchema = z.object({
  nvidiaApiKey: text.optional(),
  kieApiKey: text.optional(),
  openAiApiKey: text.optional(),
  openRouterApiKey: text.optional(),
  groqApiKey: text.optional(),
  geminiApiKey: text.optional(),
  openCodeApiKey: text.optional(),
  imageModel: text.optional(),
  imageEndpoint: text.optional(),
  chatProvider: z.enum(["nvidia", "kie", "openai"]).optional(),
  imageProvider: z.enum(["nvidia", "kie"]).optional(),
  kieChatModel: text.optional(),
  kieChatEndpoint: text.optional(),
  kieImageModel: text.optional(),
});
export type ProviderSettingsUpdate = z.infer<
  typeof providerSettingsUpdateSchema
>;
// Existing settings handler ignores wrong-typed optional fields. The typed
// writer above is narrower than the accepted raw input envelope below.
export const providerSettingsInputSchema = z.object(
  Object.fromEntries(
    Object.keys(providerSettingsUpdateSchema.shape).map((key) => [
      key,
      z.unknown().optional(),
    ]),
  ),
);
export const catalogAddInputSchema = z.object({
  id: nonempty,
  name: z.unknown().optional(),
  provider: z.unknown().optional(),
});
export const zeroCostCatalogAddInputSchema = z.object({
  key: nonempty,
});
export const catalogAddedSchema = z.object({ added: userChatModelSchema });
export const catalogRemovedSchema = z.object({ removed: text });
export const imageInputSchema = z.object({
  prompt: text,
  width: z.unknown().optional(),
  height: z.unknown().optional(),
  seed: z.unknown().optional(),
});
export const generatedImageSchema = z.object({
  locator: nonempty,
  sha256: nonempty,
  bytes: count,
  mediaType: nonempty,
  filename: nonempty,
});
export type GeneratedImage = z.infer<typeof generatedImageSchema>;
export const uploadedSourceSchema = generatedImageSchema
  .omit({ filename: true })
  .extend({ extracted: z.boolean(), artifactId: nonempty.optional() });
export type UploadedSource = z.infer<typeof uploadedSourceSchema>;
export const shellInputSchema = z.object({ command: text });
export const shellResultSchema = z.object({
  stdout: text,
  stderr: text,
  exitCode: z
    .number()
    .int()
    .min(Number.MIN_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  timedOut: z.boolean(),
  truncated: z.boolean(),
});
export type ShellHostResult = z.infer<typeof shellResultSchema>;
export const frameCheckSchema = z.object({
  url: text,
  embeddable: z.boolean(),
  reason: text.optional(),
});
export type FrameCheck = z.infer<typeof frameCheckSchema>;
export const httpErrorSchema = z.object({ error: text, message: text });
export type HttpError = z.infer<typeof httpErrorSchema>;
export const healthSchema = z.object({ ok: z.literal(true), name: text });
export const loginInputSchema = z.object({ pin: text });
export const loginResultSchema = z.object({ ok: z.literal(true) });

export const v1HttpSchemas = {
  memoryQuery: memoryQuerySchema,
  memorySnapshot: memorySnapshotSchema,
  projectBootstrapInput: projectBootstrapInputSchema,
  projectBootstrapConfig: projectBootstrapConfigSchema,
  existingProjectRegistration: existingProjectRegistrationSchema,
  projectPlan: projectPlanSchema,
  registeredProject: registeredProjectSchema,
  projects: projectsResponseSchema,
  projectSidebar: projectSidebarSchema,
  projectUpdate: projectUpdateSchema,
  projectChatAction: projectChatActionSchema,
  workspaceSession: workspaceSessionSchema,
  workspaceSessions: workspaceSessionsSchema,
  workspaceSettings: workspaceSettingsSchema,
  workspaceSettingsInput: workspaceSettingsInputSchema,
  workspaceCreateInput: workspaceCreateInputSchema,
  projectCreated: projectCreatedSchema,
  projectOpen: projectOpenSchema,
  workspaceBinding: workspaceBindingSchema,
  directoryList: directoryListSchema,
  workspaceFiles: workspaceFilesSchema,
  workspaceTextFile: workspaceTextFileSchema,
  workspaceTextFileSave: workspaceTextFileSaveSchema,
  nvidiaCatalog: nvidiaCatalogSchema,
  kieCatalog: kieCatalogSchema,
  installedSkills: installedSkillsSchema,
  skillDiscovery: skillDiscoverySchema,
  skillInstallInput: skillInstallInputSchema,
  skillInstalled: skillInstalledSchema,
  skillRemoved: skillRemovedSchema,
  zeroCostCatalog: zeroCostCatalogSchema,
  mcpServerCatalog: mcpServerCatalogSchema,
  mcpServerCatalogInput: mcpServerCatalogInputSchema,
  mcpServerHealth: mcpServerHealthSchema,
  mcpServerProbeInput: mcpServerProbeInputSchema,
  providerSettings: providerSettingsSchema,
  providerSettingsUpdate: providerSettingsUpdateSchema,
  providerSettingsInput: providerSettingsInputSchema,
  catalogAddInput: catalogAddInputSchema,
  zeroCostCatalogAddInput: zeroCostCatalogAddInputSchema,
  catalogAdded: catalogAddedSchema,
  catalogRemoved: catalogRemovedSchema,
  imageInput: imageInputSchema,
  generatedImage: generatedImageSchema,
  uploadedSource: uploadedSourceSchema,
  shellInput: shellInputSchema,
  shellResult: shellResultSchema,
  frameCheck: frameCheckSchema,
  httpError: httpErrorSchema,
  health: healthSchema,
  loginInput: loginInputSchema,
  loginResult: loginResultSchema,
} as const;
