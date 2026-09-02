import type {
  ArtifactId,
  ContentKind,
  Instant,
  Interval,
} from "./types.js";

declare const utteranceIdBrand: unique symbol;
declare const claimIdBrand: unique symbol;
declare const provenanceIdBrand: unique symbol;

export type UtteranceId = string & { readonly [utteranceIdBrand]: "utterance" };
export type ClaimId = string & { readonly [claimIdBrand]: "claim" };
export type ProvenanceId = string & { readonly [provenanceIdBrand]: "provenance" };

export type SpeechAct =
  | "assertion"
  | "question"
  | "prediction"
  | "instruction"
  | "recitation"
  | "performative"
  | "hypothetical"
  | "quotation";

export type ClaimCertainty = "certain" | "probable" | "possible" | "unlikely";

export type ClaimStatus =
  | "asserted"
  | "accepted"
  | "contested"
  | "rejected"
  | "retracted";

export type ProvenanceRelation = "derived_from" | "appears_in" | "caused_by";

export type ReconcileOutcome =
  | "re_assertion"
  | "change"
  | "correction"
  | "conflict"
  | "retraction"
  | "no_op";

export type AcceptanceDecision =
  | "accepted"
  | "rejected"
  | "contested"
  | "not_accepted";

export const USER_ASSERTION_POLICY_ID = "user-assertion-v1" as const;

export type AcceptancePolicyId = typeof USER_ASSERTION_POLICY_ID | string;

export type ClaimProposition =
  | {
      readonly kind: "attribute_binding";
      readonly entityLabel: string;
      readonly attribute: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "relationship_binding";
      readonly subjectLabel: string;
      readonly relation: string;
      readonly objectLabel: string;
    }
  | {
      readonly kind: "event_occurrence";
      readonly type: string;
      readonly participants?: readonly string[];
    }
  | {
      readonly kind: "predicate";
      readonly name: string;
      readonly arguments: readonly string[];
    }
  | {
      readonly kind: "negation";
      readonly of: ClaimProposition;
    };

export interface Utterance {
  readonly id: UtteranceId;
  readonly speaker: string;
  readonly act: SpeechAct;
  readonly contentKind: ContentKind;
  readonly content: string;
  readonly assertedAt: Instant;
  readonly ingestedAt: Instant;
  readonly artifactId: ArtifactId;
}

export interface Claim {
  readonly id: ClaimId;
  readonly label: string;
  readonly proposition: ClaimProposition;
  readonly certainty: ClaimCertainty;
  readonly attributedTo: string;
  readonly derivedFrom: {
    readonly kind: "utterance" | "event" | "artifact";
    readonly id: string;
  };
  readonly aboutInterval: Interval;
  readonly status: ClaimStatus;
  readonly acceptance?: {
    readonly policyId: string;
    readonly decision: AcceptanceDecision;
    readonly reason: string;
  };
}

export interface ProvenanceRecord {
  readonly id: ProvenanceId;
  readonly relation: ProvenanceRelation;
  readonly fromKind: "claim" | "utterance" | "binding";
  readonly fromId: string;
  readonly fromLabel: string;
  readonly toKind: "utterance" | "artifact" | "claim" | "event" | "transition";
  readonly toId: string;
  readonly toLabel: string;
}

export interface ClaimDraft {
  readonly label: string;
  readonly proposition: ClaimProposition;
  readonly certainty: ClaimCertainty;
  readonly aboutInterval: Interval;
}

export interface PayloadScope {
  readonly tags: readonly string[];
  readonly entities: readonly string[];
  readonly slots: readonly string[];
}

export interface PayloadStateEntry {
  readonly slot: string;
  readonly value: unknown;
  readonly interval: Interval;
}

export interface PayloadHistoryEntry {
  readonly slot: string;
  readonly value: unknown;
  readonly interval: Interval;
}

export interface PayloadEvent {
  readonly type: string;
  readonly label: string;
  readonly eventTime: Instant;
}

export interface PayloadUtterance {
  readonly speaker: string;
  readonly act: SpeechAct;
  readonly contentKind: ContentKind;
  readonly content: string;
  readonly assertedAt: Instant;
}

export interface PayloadClaim {
  readonly label: string;
  readonly proposition: ClaimProposition;
  readonly certainty: ClaimCertainty;
  readonly attributedTo: string;
  readonly status: ClaimStatus;
  readonly aboutInterval: Interval;
}

export interface PayloadArtifact {
  readonly locator: string;
  readonly contentKind: ContentKind;
}

export interface PayloadProvenance {
  readonly relation: ProvenanceRelation;
  readonly from: {
    readonly kind: "claim" | "utterance" | "binding";
    readonly label: string;
  };
  readonly to: {
    readonly kind: "utterance" | "artifact" | "claim" | "event" | "transition";
    readonly label: string;
  };
}

export interface ProjectionPayload {
  readonly scope: PayloadScope;
  readonly state: readonly PayloadStateEntry[];
  readonly history: readonly PayloadHistoryEntry[];
  readonly events: readonly PayloadEvent[];
  readonly utterances: readonly PayloadUtterance[];
  readonly claims: readonly PayloadClaim[];
  readonly artifacts: readonly PayloadArtifact[];
  readonly provenance: readonly PayloadProvenance[];
}
