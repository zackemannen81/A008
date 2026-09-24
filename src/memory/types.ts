export type CanonicalStatus = "current" | "superseded";
export type ActivationStatus = "active" | "dormant";

export interface ProvenanceRef {
  readonly sourceId: string;
  readonly sourceType: string;
}

export interface KnowledgeItem {
  readonly id: string;
  readonly proposition: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly scope: readonly string[];
  readonly canonicalStatus: CanonicalStatus;
  readonly supersededBy: string | null;
  readonly activationStatus: ActivationStatus;
  readonly relevanceScore: number;
  readonly activationThreshold: number;
  readonly keepAlive: boolean;
  readonly authority: number;
  readonly confidence: number;
  readonly sourceBacked: boolean;
  readonly provenance: readonly ProvenanceRef[];
  readonly revision: number;
}

export interface KnowledgeProposal {
  readonly proposition: string;
  readonly kind: string;
  readonly structuredProposition?: import("./knowledge/evidence-types.js").ClaimProposition;
  readonly tags?: readonly string[];
  readonly scope: readonly string[];
  readonly relevanceScore?: number;
  readonly activationThreshold?: number;
  readonly keepAlive?: boolean;
  readonly authority?: number;
  readonly confidence?: number;
  readonly sourceBacked?: boolean;
  readonly provenance?: readonly ProvenanceRef[];
}

export type ReconciliationRelation =
  "new" | "restatement" | "extend" | "supersede" | "conflict";

export type ReconciliationDecision =
  | { readonly type: "new" }
  | {
      readonly type: "restatement" | "extend" | "supersede";
      readonly targetId: string;
    }
  | { readonly type: "conflict"; readonly targetIds: readonly string[] };

export interface ReconciliationResult {
  readonly relation: ReconciliationRelation;
  readonly item: KnowledgeItem | null;
  readonly previousItem: KnowledgeItem | null;
  readonly conflictTargetIds: readonly string[];
}

export interface ExpectedKnowledgeRevision {
  readonly id: string;
  readonly revision: number;
}

export interface ReconciliationGuard {
  readonly expectedRevisions: readonly ExpectedKnowledgeRevision[];
}

export interface MemoryTask {
  readonly id: string;
  readonly query: string;
  readonly scopes: readonly string[];
  readonly terms: readonly string[];
  readonly requiredKnowledgeIds: readonly string[];
}

export interface ContextKnowledgeItem {
  readonly id: string;
  /** Stable semantic address when the retrieved record resolves to one. */
  readonly semanticAddress?: string;
  /** Lifecycle/evidence identity used for exact reinforcement when available. */
  readonly evidenceId?: string;
  /** Current value for state-surface records. */
  readonly currentState?: unknown;
  readonly proposition: string;
  readonly kind: string;
  readonly tags: readonly string[];
  /** Stored subject classifications, when supplied by the knowledge reader. */
  readonly domains?: readonly string[];
  readonly scope: readonly string[];
  readonly authority: number;
}

export interface ContextProjection {
  readonly taskId: string;
  readonly items: readonly ContextKnowledgeItem[];
}

export interface ProjectionBudget {
  readonly maximum: number;
}

export interface SerializedContextMeasurer {
  readonly unit: string;
  measure(serializedContext: string): number;
}

export interface ProjectionResult {
  readonly projection: ContextProjection;
  readonly serialized: string;
  readonly measuredUnits: number;
  readonly measurementUnit: string;
}

export interface MemoryPolicy {
  isRelevant(item: KnowledgeItem, task: MemoryTask): boolean;
  projectionReinforcement(item: KnowledgeItem, task: MemoryTask): number;
  reconciliationReinforcement(
    item: KnowledgeItem,
    proposal: KnowledgeProposal,
  ): number;
  rankForContext(
    items: readonly KnowledgeItem[],
    task: MemoryTask,
  ): readonly KnowledgeItem[];
}

export type MemoryAuditEventType =
  | "knowledge_created"
  | "knowledge_restated"
  | "knowledge_extended"
  | "knowledge_superseded"
  | "knowledge_conflict"
  | "projection_built";

export interface MemoryAuditEventInput {
  readonly type: MemoryAuditEventType;
  readonly knowledgeIds: readonly string[];
  readonly taskId: string | null;
  readonly selectedKnowledgeIds: readonly string[];
  readonly excludedCount: number;
}

export interface MemoryAuditEvent extends MemoryAuditEventInput {
  readonly sequence: number;
}

export interface MemoryReadView {
  get(id: string): KnowledgeItem | undefined;
  list(ids: readonly string[]): readonly KnowledgeItem[];
  listKeepAlive(): readonly KnowledgeItem[];
  listCurrent(): readonly KnowledgeItem[];
  listAll(): readonly KnowledgeItem[];
  historyFrom(id: string): readonly KnowledgeItem[];
}

export interface MemoryTransaction extends MemoryReadView {
  insert(item: KnowledgeItem): void;
  replace(item: KnowledgeItem): void;
  appendAudit(event: MemoryAuditEventInput): MemoryAuditEvent;
}

export interface MemoryRepository {
  readonly projectId?: import("../identity/types.js").ProjectId;
  read<T>(reader: (view: MemoryReadView) => T | Promise<T>): Promise<T>;
  transact<T>(
    operation: (transaction: MemoryTransaction) => T | Promise<T>,
  ): Promise<T>;
  readAudit(): Promise<readonly MemoryAuditEvent[]>;
}

export type KnowledgeIdFactory = () => string;
