import {
  AssociationLifecycle,
  associationKey,
  EMPTY_ASSOCIATIONS,
  evaluateAssociation,
  evaluateAssociationAttraction,
  type AssociationAttractionSignal,
  type AssociationIdentity,
  type AssociationReceipt,
  type AssociationSnapshot,
} from "./association-lifecycle.js";
import type { MemoryLifecyclePolicy } from "../../core/memory-lifecycle-policy.js";
import { viewLifecycle } from "./lifecycle.js";
import type {
  ExpandResult,
  KnowledgeReadContext,
  OmittedRecord,
  RelationHop,
  RelationIndexPort,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";
import { scoreRetrieved } from "./retrieve.js";

const ASSOCIATIVE_DORMANT = "associative_dormant";
const ASSOCIATION_ATTRACTION_WEIGHT = 0.5;

export interface RelationLink {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
}

export class RelationIndex implements RelationIndexPort {
  readonly #associations = new AssociationLifecycle();
  associationSnapshot(): AssociationSnapshot {
    return this.#associations.snapshot();
  }
  establishAssociation(
    edge: AssociationIdentity,
    occurrence: Omit<AssociationReceipt, "edgeKey">,
    policy?: MemoryLifecyclePolicy,
  ) {
    return this.#associations.establish(edge, occurrence, policy);
  }
  adjustAttraction(
    edgeKey: string,
    occurrenceId: string,
    at: string,
    signal: AssociationAttractionSignal,
    policy?: MemoryLifecyclePolicy,
  ) {
    return this.#associations.adjustAttraction(
      edgeKey,
      { occurrenceId, at, signal },
      policy,
    );
  }
  readonly #out = new Map<string, RelationHop[]>();

  link(from: string, to: string, relation: string): void {
    const hops = this.#out.get(from) ?? [];
    if (hops.some((hop) => hop.to === to && hop.relation === relation)) {
      return;
    }
    hops.push({ to, relation });
    this.#out.set(from, hops);
  }

  neighbors(id: string): readonly RelationHop[] {
    const tracked = this.#associations.outgoing(id);
    const keys = new Set(tracked.map((edge) => edge.key));
    const legacy = (this.#out.get(id) ?? []).filter(
      (hop) =>
        !keys.has(
          associationKey({
            from: id,
            to: hop.to,
            relation: hop.relation,
            scope: [],
          }),
        ),
    );
    return structuredClone([
      ...legacy,
      ...tracked.map((edge) => ({
        to: edge.to,
        relation: edge.relation,
        association: edge,
      })),
    ]);
  }

  exportLinks(): readonly RelationLink[] {
    const links: RelationLink[] = [];
    for (const [from, hops] of this.#out.entries()) {
      for (const hop of hops) {
        links.push({ from, to: hop.to, relation: hop.relation });
      }
    }
    return links;
  }

  hydrate(
    links: readonly RelationLink[],
    associations: AssociationSnapshot = EMPTY_ASSOCIATIONS,
  ): void {
    this.#associations.hydrate(associations);
    this.#out.clear();
    for (const link of links) {
      this.link(link.from, link.to, link.relation);
    }
  }
}

export function expand(
  retrieved: readonly RetrievedRecord[],
  scope: SemanticScope,
  context: KnowledgeReadContext,
  query: { readonly message: string },
): ExpandResult {
  context = {
    ...context,
    evaluatedAt: context.evaluatedAt ?? context.lifecycle.now(),
  };
  const records: RetrievedRecord[] = [...retrieved];
  const omitted: OmittedRecord[] = [];
  const seen = new Set(retrieved.map((record) => record.id));
  const seeds = expansionSeeds(retrieved, scope, context);

  for (const seed of seeds) {
    for (const hop of context.relations.neighbors(seed)) {
      const related = lookupRelated(hop.to, scope, context, query.message);
      if (related === undefined) {
        continue;
      }
      if (seen.has(related.id)) {
        continue;
      }
      let routed = related;
      if (hop.association !== undefined) {
        const edge = hop.association;
        const applicable =
          edge.scope.length === 0 ||
          edge.scope.some((name) =>
            context.applicabilityScopes?.includes(name),
          );
        if (
          !applicable ||
          evaluateAssociation(edge, context.evaluatedAt!).memoryState ===
            "dormant"
        ) {
          omitted.push({
            record: related,
            reason: applicable
              ? "association_dormant"
              : "association_not_applicable",
          });
          continue;
        }
        const attraction = evaluateAssociationAttraction(
          edge,
          context.evaluatedAt!,
        );
        routed = {
          ...related,
          retrievalScore:
            related.retrievalScore + ASSOCIATION_ATTRACTION_WEIGHT * attraction,
          reasons: [...related.reasons, "association_attraction"],
          attraction,
          associationKey: edge.key,
        };
      }
      if (routed.memoryState === "dormant") {
        omitted.push({
          record: routed,
          reason: ASSOCIATIVE_DORMANT,
        });
        continue;
      }
      seen.add(routed.id);
      records.push(routed);
    }
  }

  // A failed route must not suppress a later eligible one or leave contradictory diagnostics.
  const exclusions = new Set<string>();
  return {
    records,
    omitted: omitted.filter((item) => {
      const key = JSON.stringify([item.record.id, item.reason]);
      if (seen.has(item.record.id) || exclusions.has(key)) return false;
      exclusions.add(key);
      return true;
    }),
  };
}

function expansionSeeds(
  retrieved: readonly RetrievedRecord[],
  scope: SemanticScope,
  context: KnowledgeReadContext,
): readonly string[] {
  const seeds = new Set<string>();
  for (const record of retrieved) {
    if (record.evidenceId !== undefined) {
      seeds.add(record.evidenceId);
    }
  }
  for (const entity of context.entities.list()) {
    if (entity.labels.some((label) => scope.entities.includes(label))) {
      seeds.add(entity.id);
      for (const label of entity.labels) {
        seeds.add(label);
      }
    }
  }
  for (const label of scope.entities) {
    seeds.add(label);
  }
  return [...seeds];
}

function lookupRelated(
  id: string,
  scope: SemanticScope,
  context: KnowledgeReadContext,
  message: string,
): RetrievedRecord | undefined {
  const utterance = context.evidence
    .listUtterances()
    .find((item) => item.id === id);
  if (utterance !== undefined) {
    const viewed = viewLifecycle(
      context.lifecycle,
      utterance.id,
      context.evaluatedAt,
    );
    const score = scoreRetrieved({
      matchKind: "associative",
      exactSlot: false,
      exactEntity: true,
      lexical: true,
      strength: viewed.strength,
    });
    return {
      id: `utterance:${utterance.id}`,
      surface: "utterance",
      matchKind: "associative",
      retrievalScore: score,
      reasons: ["associative_expansion", "relation_depth_1"],
      ...expandedLabels(context, utterance.id),
      required: false,
      label: utterance.content,
      speaker: utterance.speaker,
      act: utterance.act,
      contentKind: utterance.contentKind,
      content: utterance.content,
      assertedAt: utterance.assertedAt,
      evidenceId: utterance.id,
      evidenceKind: "utterance",
      strength: viewed.strength,
      memoryState: viewed.memoryState,
    };
  }

  const claim = context.evidence.listClaims().find((item) => item.id === id);
  if (claim !== undefined) {
    const viewed = viewLifecycle(
      context.lifecycle,
      claim.id,
      context.evaluatedAt,
    );
    const score = scoreRetrieved({
      matchKind: "associative",
      exactSlot: false,
      exactEntity: true,
      lexical: true,
      certainty: claim.certainty,
      strength: viewed.strength,
    });
    return {
      id: `claim:${claim.id}`,
      surface: "claim",
      matchKind: "associative",
      retrievalScore: score,
      reasons: ["associative_expansion", "relation_depth_1"],
      ...expandedLabels(context, claim.id),
      required: false,
      label: claim.label,
      attributedTo: claim.attributedTo,
      status: claim.status,
      certainty: claim.certainty,
      proposition: claim.proposition,
      interval: claim.aboutInterval,
      evidenceId: claim.id,
      evidenceKind: "claim",
      strength: viewed.strength,
      memoryState: viewed.memoryState,
    };
  }

  const event = context.state.events().find((item) => item.id === id);
  if (event !== undefined) {
    const viewed = viewLifecycle(
      context.lifecycle,
      event.id,
      context.evaluatedAt,
    );
    const score = scoreRetrieved({
      matchKind: "associative",
      exactSlot: false,
      exactEntity: true,
      lexical: true,
      strength: viewed.strength,
    });
    const record: RetrievedRecord = {
      id: `event:${event.id}`,
      surface: "event",
      matchKind: "associative",
      retrievalScore: score,
      reasons: ["associative_expansion", "relation_depth_1"],
      ...expandedLabels(context, event.id),
      required: false,
      label: event.label,
      eventType: event.type,
      eventTime: event.eventTime,
      evidenceId: event.id,
      evidenceKind: "event",
      strength: viewed.strength,
      memoryState: viewed.memoryState,
    };
    if (event.who === undefined) {
      return record;
    }
    return { ...record, who: event.who };
  }

  void message;
  return undefined;
}

/**
 * Stored labels for a record reached by relation expansion.
 *
 * Same rule as the direct path: the record's own labels, never the query's. An
 * expanded record with no labels is unlabelled, not unmatched.
 */
function expandedLabels(
  context: KnowledgeReadContext,
  recordId: string,
): { readonly tags: readonly string[]; readonly domains: readonly string[] } {
  const labels = context.labels.labelsFor(recordId);
  return { tags: [...labels.tags], domains: [...labels.domains] };
}
