declare const runtimeIdentityBrand: unique symbol;

export type RuntimeIdentityKind =
  "project" | "conversation" | "task" | "agent" | "acp_session";

export type RuntimeId<Kind extends RuntimeIdentityKind> = string & {
  readonly [runtimeIdentityBrand]: Kind;
};

export type ProjectId = RuntimeId<"project">;
export type ConversationId = RuntimeId<"conversation">;
export type RuntimeTaskId = RuntimeId<"task">;
export type AgentId = RuntimeId<"agent">;
export type AcpSessionId = RuntimeId<"acp_session">;
export type AnyRuntimeId = RuntimeId<RuntimeIdentityKind>;

export interface ExternalIdentityReference {
  readonly system: string;
  readonly kind: string;
  readonly value: string;
}

export interface AcpIdentityBinding {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly taskId: RuntimeTaskId;
  readonly agentId: AgentId;
  readonly acpSessionId: AcpSessionId;
  readonly externalReferences: readonly ExternalIdentityReference[];
}

export type IdentityBindingRegistration = "created" | "existing";

export interface AcpIdentityBindingRepository {
  register(binding: AcpIdentityBinding): Promise<IdentityBindingRegistration>;
  resolveAcpSession(
    acpSessionId: AcpSessionId,
  ): Promise<AcpIdentityBinding | undefined>;
  resolveExternal(
    reference: ExternalIdentityReference,
  ): Promise<AcpIdentityBinding | undefined>;
  listConversation(
    conversationId: ConversationId,
  ): Promise<readonly AcpIdentityBinding[]>;
}

export type UuidFactory = () => string;
