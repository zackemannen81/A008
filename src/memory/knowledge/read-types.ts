import type { EvidenceStore } from "./evidence.js";
import type {
  ClaimCertainty,
  ClaimProposition,
  ClaimStatus,
  ProvenanceRelation,
  SpeechAct,
} from "./evidence-types.js";
import type { EvidenceLifecycleStore } from "./lifecycle.js";
import type {
  EvidenceLifecycleKind,
  MemoryLifecycleState,
} from "./lifecycle-types.js";
import type { EntityRegistry, SlotRegistry } from "./registry.js";
import type { KnowledgeState } from "./state.js";
import type {
  ContentKind,
  Instant,
  Interval,
  SlotRef,
} from "./types.js";

export type RetrievalIntent =
  | "current_state"
  | "history"
  | "event"
  | "attribution"
  | "associative";

export interface TemporalHints {
  readonly currentOnly: boolean;
  readonly mentionsPast: boolean;
  readonly mentionsFuture: boolean;
}

export interface VerifiedReadScope {
  readonly verified: boolean;
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
  readonly entities?: readonly string[];
  readonly slots?: readonly SlotRef[];
}

export interface SemanticScope {
  readonly tags: readonly string[];
  readonly domains: readonly string[];
  readonly entities: readonly string[];
  readonly slots: readonly SlotRef[];
  readonly intents: readonly RetrievalIntent[];
  readonly temporalHints: TemporalHints;
}

export type MatchKind = "direct" | "associative";

export type RetrievedSurface =
  | "state"
  | "history"
  | "event"
  | "utterance"
  | "claim"
  | "artifact"
  | "provenance";

export interface RelationHop {
  readonly to: string;
  readonly relation: string;
}

export interface RelationIndexPort {
  neighbors(id: string): readonly RelationHop[];
}

export interface KnowledgeReadContext {
  readonly entities: EntityRegistry;
  readonly slots: SlotRegistry;
  readonly state: KnowledgeState;
  readonly evidence: EvidenceStore;
  readonly lifecycle: EvidenceLifecycleStore;
  readonly relations: RelationIndexPort;
}

export interface RetrievedRecord {
  readonly id: string;
  readonly surface: RetrievedSurface;
  readonly matchKind: MatchKind;
  readonly retrievalScore: number;
  readonly reasons: readonly string[];
  readonly tags: readonly string[];
  readonly required: boolean;
  readonly label: string;
  readonly slotLabel?: string;
  readonly value?: unknown;
  readonly interval?: Interval;
  readonly attributedTo?: string;
  readonly status?: ClaimStatus;
  readonly certainty?: ClaimCertainty;
  readonly speaker?: string;
  readonly act?: SpeechAct;
  readonly contentKind?: ContentKind;
  readonly content?: string;
  readonly assertedAt?: Instant;
  readonly eventTime?: Instant;
  readonly eventType?: string;
  readonly who?: string;
  readonly locator?: string;
  readonly proposition?: ClaimProposition;
  readonly provenanceRelation?: ProvenanceRelation;
  readonly fromLabel?: string;
  readonly toLabel?: string;
  readonly fromKind?: string;
  readonly toKind?: string;
  readonly strength?: number;
  readonly memoryState?: MemoryLifecycleState;
  readonly evidenceId?: string;
  readonly evidenceKind?: EvidenceLifecycleKind;
}

export interface OmittedRecord {
  readonly record: RetrievedRecord;
  readonly reason: string;
}

export interface ExpandResult {
  readonly records: readonly RetrievedRecord[];
  readonly omitted: readonly OmittedRecord[];
}

export interface FilterResult {
  readonly admitted: readonly RetrievedRecord[];
  readonly omitted: readonly OmittedRecord[];
}

export interface ComposedSet {
  readonly records: readonly RetrievedRecord[];
}

export interface ProjectDiagnostics {
  readonly records: readonly RetrievedRecord[];
  readonly omitted: readonly OmittedRecord[];
  readonly reactivationCandidates: readonly string[];
}
