import type { Instant } from "./types.js";
import type {
  KnowledgeSeverity,
  MemoryLifecyclePolicy,
} from "../../core/memory-lifecycle-policy.js";

export type MemoryLifecycleState = "active" | "dormant";

export type LifecycleTransitionKind =
  "created" | "reinforced" | "weakened" | "reactivated" | "decayed";

export type EvidenceLifecycleKind =
  "utterance" | "event" | "claim" | "artifact_summary";

export interface MemoryLifecycle {
  readonly creationOccurrenceId?: string;
  readonly severity: KnowledgeSeverity | null;
  readonly policyVersion: "exponential-v1" | "legacy-exponential-v1";
  readonly decayLambda: number;
  readonly strengthUpdatedAt: string;
  readonly boost: number;
  readonly maximum: 1;
  readonly state: MemoryLifecycleState;
  readonly strength: number;
  readonly decayRate: number;
  readonly threshold: number;
  readonly pinned: boolean;
  readonly lastReinforcedAt: Instant;
}

export interface LifecycleRecord {
  readonly evidenceId: string;
  readonly evidenceKind: EvidenceLifecycleKind;
  readonly lifecycle: MemoryLifecycle;
}

export interface LifecycleTransition {
  readonly id: string;
  readonly evidenceId: string;
  readonly kind: LifecycleTransitionKind;
  readonly fromStrength: number;
  readonly toStrength: number;
  readonly fromState: MemoryLifecycleState;
  readonly toState: MemoryLifecycleState;
  readonly at: Instant;
  readonly caller: string;
  readonly reason: string;
}

export interface LifecycleSnapshot {
  readonly receipts?: readonly ReinforcementReceipt[];
  readonly records: readonly LifecycleRecord[];
  readonly transitions: readonly LifecycleTransition[];
}

export interface AttachLifecycleInput {
  readonly creationOccurrenceId?: string;
  readonly severity?: KnowledgeSeverity;
  readonly policy?: MemoryLifecyclePolicy;
  readonly decayLambda?: number;
  readonly evidenceId: string;
  readonly evidenceKind: EvidenceLifecycleKind;
  readonly strength?: number;
  readonly decayRate?: number;
  readonly threshold?: number;
  readonly pinned?: boolean;
  readonly lastReinforcedAt?: Instant;
  readonly at?: Instant;
  readonly caller?: string;
}

export interface ReinforcementReceipt {
  readonly occurrenceId: string;
  readonly evidenceId: string;
  readonly at: string;
  readonly support?: {
    readonly utteranceId: string;
    readonly start: number;
    readonly end: number;
  };
}

export interface LifecycleWriteInput {
  readonly evidenceIds: readonly string[];
  readonly caller: string;
  readonly reason: string;
  readonly at: Instant;
  readonly amount?: number;
}

export interface DecayInput {
  readonly caller: string;
  readonly reason: string;
  readonly at: Instant;
  readonly elapsed: number;
  readonly evidenceIds?: readonly string[];
}
