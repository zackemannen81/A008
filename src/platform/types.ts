import type { ChatContent } from "../core/types.js";

/** Trusted backend authority. Callers must never derive this from a resource ID. */
export interface PlatformScope {
  readonly tenantId: string;
  readonly projectId: string;
  readonly principalId: string;
}

export type PlatformRunStatus =
  | "queued"
  | "running"
  | "cancel_requested"
  | "needs_reconciliation"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PlatformEffectStatus = "none" | "unknown" | "known";
export type PlatformAnswerStatus =
  "pending" | "completed" | "failed" | "unknown";
export type PlatformMemoryStatus =
  "not_requested" | "pending" | "completed" | "failed" | "unknown";

export interface PlatformError {
  readonly code: string;
  readonly message: string;
}

export interface PlatformMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: ChatContent;
  readonly createdAt: number;
  readonly runId?: string;
}

export interface PlatformConversation {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revision: number;
  readonly messages: readonly PlatformMessage[];
}

export interface PlatformRun {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly conversationId: string;
  readonly principalId: string;
  readonly commandId: string;
  readonly model: string;
  readonly status: PlatformRunStatus;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly leaseGeneration: number;
  readonly effectStatus: PlatformEffectStatus;
  readonly answerStatus: PlatformAnswerStatus;
  readonly memoryStatus: PlatformMemoryStatus;
  readonly error?: PlatformError;
}

export interface PlatformLease {
  readonly runId: string;
  readonly ownerToken: string;
  readonly generation: number;
  readonly expiresAt: number;
}

export type PlatformEventType =
  | "conversation.created"
  | "conversation.updated"
  | "run.queued"
  | "run.updated";

export interface PlatformEvent {
  readonly cursor: number;
  readonly tenantId: string;
  readonly projectId: string;
  readonly conversationId: string;
  readonly runId?: string;
  readonly type: PlatformEventType;
  readonly resourceRevision: number;
  readonly createdAt: number;
}

export interface PlatformEventPage {
  readonly events: readonly PlatformEvent[];
  readonly nextCursor: number;
  readonly hasMore: boolean;
}

export interface CreatePlatformConversation {
  readonly id?: string;
  readonly title: string;
}

export interface AcceptPlatformRun {
  readonly conversationId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly model: string;
  readonly text: string;
  readonly runId?: string;
  readonly messageId?: string;
  readonly memoryRequested?: boolean;
}

export interface AcceptedPlatformRun {
  readonly run: PlatformRun;
  readonly replayed: boolean;
}

export interface ClaimPlatformRun {
  readonly runId: string;
  readonly ownerToken: string;
  readonly leaseDurationMs: number;
}

export interface ClaimedPlatformRun {
  readonly run: PlatformRun;
  readonly lease: PlatformLease;
}

export interface RenewPlatformLease extends PlatformLease {
  readonly leaseDurationMs: number;
}

export interface LeaseWrite {
  readonly runId: string;
  readonly ownerToken: string;
  readonly generation: number;
  readonly expectedRevision: number;
}

export interface CommitPlatformAnswer extends LeaseWrite {
  readonly content: ChatContent;
  readonly messageId?: string;
}

export interface FailPlatformRun extends LeaseWrite {
  readonly error: PlatformError;
}

export interface CancelPlatformRun {
  readonly runId: string;
  readonly expectedRevision: number;
}

export interface RecordMemoryOutcome {
  readonly runId: string;
  readonly expectedRevision: number;
  readonly status: Exclude<PlatformMemoryStatus, "not_requested" | "pending">;
}

export interface ListPlatformRuns {
  readonly statuses?: readonly PlatformRunStatus[];
}
