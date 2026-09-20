import type {
  AttributeSlotRef,
  Instant,
  Interval,
  ReferentId,
  RelationSlotRef,
  SlotCardinality,
  SlotRef,
} from "./types.js";

export type ReconcileOutcomeKind =
  | "re_assertion"
  | "change"
  | "correction"
  | "conflict"
  | "retraction"
  | "no_op";

export type ClaimStatus =
  "asserted" | "accepted" | "contested" | "rejected" | "retracted";

export type ClaimKind =
  "assertion" | "event_effect" | "correction" | "retraction";

export type AttributeBinding = {
  readonly kind: "attribute";
  readonly slot: AttributeSlotRef;
  readonly value: unknown;
  readonly label: string;
  readonly interval: Interval;
  readonly causedBy: string;
  readonly claimId: string;
};

export type RelationshipBinding = {
  readonly kind: "relationship";
  readonly slot: RelationSlotRef;
  readonly object: ReferentId;
  readonly label: string;
  readonly interval: Interval;
  readonly causedBy: string;
  readonly claimId: string;
};

export type Binding = AttributeBinding | RelationshipBinding;

export interface StateTransition {
  readonly id: string;
  readonly slot: SlotRef;
  readonly from: unknown | null;
  readonly to: unknown | null;
  readonly at: Instant;
  readonly causedBy: string;
  readonly decidedBy: string;
  readonly outcome: "change" | "correction" | "retraction";
}

export interface CorrectionRecord {
  readonly transitionId: string;
  readonly slot: SlotRef;
  readonly amendedInterval: Interval;
  readonly from: unknown;
  readonly to: unknown | null;
  readonly causedBy: string;
  readonly correctedBy: string;
  readonly at: Instant;
}

export interface SlotClaim {
  readonly id: string;
  readonly slot: SlotRef;
  readonly value: unknown;
  readonly label: string;
  readonly aboutInterval: Interval;
  readonly status: ClaimStatus;
  readonly attributedTo: string;
  readonly causedBy: string;
  readonly kind: ClaimKind;
  /** New writes use semantic state eligibility; acceptance remains provenance. */
  readonly stateEligible?: boolean;
  /** Legacy persisted field retained for snapshot compatibility only. */
  readonly acceptanceEligible?: boolean;
  readonly retractsClaimId?: string;
  readonly targetInterval?: Interval;
}

export interface StubEvent {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly eventTime: Instant;
  readonly causedBy: string;
  readonly who?: string;
  readonly what?: string;
  readonly effects: readonly {
    readonly slot: SlotRef;
    readonly value: unknown;
  }[];
}

export interface ReconcileDecision {
  readonly outcome: ReconcileOutcomeKind;
  readonly slot: SlotRef;
  readonly cardinality: SlotCardinality;
  readonly proposal: SlotClaim;
  readonly from: unknown | null;
  readonly to: unknown | null;
  readonly at: Instant;
  readonly competingClaimIds: readonly string[];
  readonly targetInterval: Interval | null;
  readonly reason: string;
}

export interface UpdateResult {
  readonly closed: Binding | null;
  readonly opened: Binding | null;
  readonly amended: Binding | null;
  readonly transition: StateTransition;
}

export interface KnowledgeStateSnapshot {
  readonly bindings: readonly Binding[];
  readonly claims: readonly SlotClaim[];
  readonly transitions: readonly StateTransition[];
  readonly events: readonly StubEvent[];
  readonly corrections: readonly CorrectionRecord[];
  readonly contestedSlotKeys: readonly string[];
}
