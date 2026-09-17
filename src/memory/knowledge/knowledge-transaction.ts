import type { EvidenceStore } from "./evidence.js";
import type { ClaimEntityReferenceStore } from "./entity-references.js";
import { RelationIndex } from "./expand.js";
import type { KnowledgeLabelStore } from "./labels.js";
import type { EvidenceLifecycleStore } from "./lifecycle.js";
import type { EntityRegistry, SlotRegistry } from "./registry.js";
import type { KnowledgeReadContext } from "./read-types.js";
import type { KnowledgeState } from "./state.js";
import type { KnowledgeNamespaceSnapshot } from "./sqlite-store.js";
export function atomicKnowledge<T>(
  context: KnowledgeReadContext,
  operation: () => T,
): T {
  if (context.atomic) return context.atomic(operation);
  const before = captureSnapshot(context);
  try {
    return operation();
  } catch (error) {
    loadSnapshot(context, before);
    throw error;
  }
}

export function loadSnapshot(
  target: {
    readonly entities: EntityRegistry;
    readonly slots: SlotRegistry;
    readonly state: KnowledgeState;
    readonly evidence: EvidenceStore;
    readonly entityReferences: ClaimEntityReferenceStore;
    readonly labels: KnowledgeLabelStore;
    readonly lifecycle: EvidenceLifecycleStore;
    readonly relations: KnowledgeReadContext["relations"];
  },
  snapshot: KnowledgeNamespaceSnapshot,
): void {
  target.entities.hydrate(snapshot.entities);
  target.slots.hydrate(snapshot.slots);
  target.state.hydrate(snapshot.state, snapshot.stateNextTransition);
  target.evidence.hydrate({
    artifacts: snapshot.artifacts,
    utterances: snapshot.utterances,
    claims: snapshot.claims,
    provenance: snapshot.provenance,
  });
  target.entityReferences.hydrate(snapshot.entityReferences ?? []);
  target.labels.hydrate(snapshot.labels);
  target.lifecycle.hydrate(
    snapshot.lifecycle,
    snapshot.lifecycleNextTransition,
  );
  if (target.relations instanceof RelationIndex)
    target.relations.hydrate(snapshot.relations, snapshot.associations);
}

export function captureSnapshot(
  context: KnowledgeReadContext,
): KnowledgeNamespaceSnapshot {
  const relations =
    context.relations instanceof RelationIndex
      ? context.relations.exportLinks()
      : [];
  const entityReferences = context.entityReferences.list();
  return {
    entities: context.entities.list(),
    slots: context.slots.list(),
    state: context.state.snapshot(),
    stateNextTransition: context.state.transitionSequence(),
    artifacts: context.evidence.listArtifacts(),
    utterances: context.evidence.listUtterances(),
    claims: context.evidence.listClaims(),
    ...(entityReferences.length === 0 ? {} : { entityReferences }),
    labels: context.labels.list(),
    provenance: context.evidence.listProvenance(),
    lifecycle: context.lifecycle.snapshot(),
    lifecycleNextTransition: context.lifecycle.transitionSequence(),
    relations,
    ...(context.relations instanceof RelationIndex
      ? { associations: context.relations.associationSnapshot() }
      : {}),
  };
}
