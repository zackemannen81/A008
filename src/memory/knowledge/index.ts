export {
  deserializeInstant,
  deserializeInterval,
  isUnknownInstant,
  serializeInstant,
  serializeInterval,
  UNKNOWN_INSTANT,
} from "./clocks.js";
export {
  isKnowledgeModelError,
  KnowledgeModelError,
} from "./errors.js";
export type { KnowledgeModelErrorCode } from "./errors.js";
export { asArtifactId, asEntityId, isArtifactId, isEntityId } from "./ids.js";
export { interpret } from "./interpret.js";
export type { InterpretOptions } from "./interpret.js";
export { EntityRegistry, SlotRegistry, slotKey } from "./registry.js";
export type {
  Artifact,
  ArtifactId,
  AttributeSlotRef,
  ContentKind,
  Entity,
  EntityId,
  Instant,
  InterpretInput,
  InterpretProposal,
  Interval,
  KnowledgeIdFactory,
  ProposedArtifact,
  ProposedAttributeBinding,
  ProposedBinding,
  ProposedClaim,
  ProposedEntity,
  ProposedEvent,
  ProposedRelationshipBinding,
  ProposedSlot,
  ReferentId,
  RelationSlotRef,
  SlotCardinality,
  SlotDefinition,
  SlotRef,
  UnknownValue,
  UnresolvedReference,
} from "./types.js";
