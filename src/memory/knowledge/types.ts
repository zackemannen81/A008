declare const artifactIdBrand: unique symbol;
declare const entityIdBrand: unique symbol;

export type ArtifactId = string & { readonly [artifactIdBrand]: "artifact" };
export type EntityId = string & { readonly [entityIdBrand]: "entity" };
export type ReferentId = ArtifactId | EntityId;

export type ContentKind =
  | "source_code"
  | "event_report"
  | "forecast"
  | "prayer"
  | "recitation"
  | "instruction"
  | "dialogue_assertion";

export type SlotCardinality = "single" | "set";

export type Instant = string | { readonly unknown: true };

export interface Interval {
  readonly from: Instant;
  readonly to: Instant | null;
}

export interface Artifact {
  readonly id: ArtifactId;
  readonly contentKind: ContentKind;
  readonly locator: string;
  readonly ingestedAt: Instant;
}

export interface Entity {
  readonly id: EntityId;
  readonly type: string;
  readonly labels: readonly string[];
}

export type AttributeSlotRef = {
  readonly kind: "attribute";
  readonly entity: EntityId;
  readonly name: string;
};

export type RelationSlotRef = {
  readonly kind: "relation";
  readonly subject: ReferentId;
  readonly name: string;
  readonly object?: ReferentId;
};

export type SlotRef = AttributeSlotRef | RelationSlotRef;

export interface SlotDefinition {
  readonly ref: SlotRef;
  readonly cardinality: SlotCardinality;
  readonly valueType: string;
}

export type UnknownValue = { readonly unknown: true };

export type ProposedArtifact = Artifact & {
  readonly confidence: number;
  readonly language?: string | UnknownValue;
};

export type ProposedEntity = Entity & {
  readonly confidence: number;
};

export interface ProposedSlot {
  readonly definition: SlotDefinition;
  readonly confidence: number;
}

export type ProposedAttributeBinding = {
  readonly kind: "attribute";
  readonly slot: AttributeSlotRef;
  readonly value: unknown;
  readonly label: string;
  readonly confidence: number;
};

export type ProposedRelationshipBinding = {
  readonly kind: "relationship";
  readonly slot: RelationSlotRef;
  readonly object: ReferentId;
  readonly label: string;
  readonly confidence: number;
};

export type ProposedBinding =
  | ProposedAttributeBinding
  | ProposedRelationshipBinding;

export interface ProposedEvent {
  readonly type: string;
  readonly label: string;
  readonly eventTime: Instant;
  readonly confidence: number;
}

export interface ProposedClaim {
  readonly label: string;
  readonly certainty: "certain" | "probable" | "possible" | "unlikely";
  readonly aboutInterval: Interval;
  readonly confidence: number;
}

export interface UnresolvedReference {
  readonly label: string;
  readonly role: "entity" | "slot";
  readonly reason: string;
  readonly confidence: number;
}

export interface InterpretProposal {
  readonly artifacts: readonly ProposedArtifact[];
  readonly entities: readonly ProposedEntity[];
  readonly slots: readonly ProposedSlot[];
  readonly bindings: readonly ProposedBinding[];
  readonly events: readonly ProposedEvent[];
  readonly claims: readonly ProposedClaim[];
  readonly unresolvedReferences: readonly UnresolvedReference[];
}

export interface InterpretInput {
  readonly contentKind: ContentKind;
  readonly content: string;
  readonly locator?: string;
  readonly ingestedAt?: Instant;
  readonly assertedAt?: Instant;
  readonly eventTime?: Instant;
}

export type KnowledgeIdFactory = () => string;
