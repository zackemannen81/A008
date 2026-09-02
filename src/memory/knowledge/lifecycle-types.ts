import type { Instant } from "./types.js";

export type MemoryLifecycleState = "active" | "dormant";

export type LifecycleTransitionKind =
  | "created"
  | "reinforced"
  | "weakened"
  | "reactivated"
  | "decayed";

export type EvidenceLifecycleKind =
  | "utterance"
  | "event"
  | "claim"
  | "artifact_summary";

export interface MemoryLifecycle {
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
  readonly records: readonly LifecycleRecord[];
  readonly transitions: readonly LifecycleTransition[];
}

export interface AttachLifecycleInput {
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
