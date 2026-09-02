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
export {
  EvidenceLifecycleStore,
  decay,
  derivedLifecycleState,
  reactivate,
  reinforce,
  weaken,
} from "./lifecycle.js";
export type {
  AttachLifecycleInput,
  DecayInput,
  EvidenceLifecycleKind,
  LifecycleRecord,
  LifecycleSnapshot,
  LifecycleTransition,
  LifecycleWriteInput,
  MemoryLifecycle,
  MemoryLifecycleState,
} from "./lifecycle-types.js";
export { classifyIntents, define } from "./define.js";
export type { DefineInput } from "./define.js";
export { retrieve, scoreRetrieved } from "./retrieve.js";
export { RelationIndex, expand } from "./expand.js";
export { filter } from "./filter.js";
export { compose } from "./compose.js";
export { project } from "./project.js";
export type { ProjectResult } from "./project.js";
export { createKnowledgeContext, readKnowledge } from "./read.js";
export type { ReadResult } from "./read.js";
export type {
  KnowledgeReadContext,
  RetrievedRecord,
  RetrievalIntent,
  SemanticScope,
  TemporalHints,
} from "./read-types.js";
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
