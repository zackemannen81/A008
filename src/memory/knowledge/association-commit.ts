import { createHash } from "node:crypto";
import type { MemoryLifecyclePolicy } from "../../core/memory-lifecycle-policy.js";
import type { AssociationClassifierContext } from "../../orchestration/relation-gated-memory-commit.js";
import type { Claim } from "./evidence-types.js";
import { RelationIndex } from "./expand.js";
import type { KnowledgeReadContext } from "./read-types.js";
import type { Entity } from "./types.js";

/** Exact runtime handles, captured before the existing asynchronous comparator. */
export function prepareAssociations(
  context: KnowledgeReadContext,
  candidates: ReadonlyMap<string, Claim>,
  source: AssociationClassifierContext["source"] | undefined,
  locator: string,
  scope: readonly string[],
  additionalEntities: readonly Entity[] = [],
) {
  const entityById = new Map(
    context.entities.list().map((entity) => [String(entity.id), entity]),
  );
  for (const entity of additionalEntities) {
    if (!entityById.has(String(entity.id)))
      entityById.set(String(entity.id), entity);
  }
  const entities = new Map(
    [...entityById.values()].map((entity) => [
      associationEntityHandle(entity.id),
      entity,
    ]),
  );
  const byId = new Map<string, string>();
  candidates.forEach((claim, handle) => byId.set(claim.id, handle));
  entities.forEach((entity, handle) => byId.set(entity.id, handle));
  const associationContext: AssociationClassifierContext | undefined =
    source === undefined
      ? undefined
      : {
          source,
          entities: [...entities].map(([handle, entity]) => ({
            handle,
            labels: entity.labels,
            type: entity.type,
          })),
          existing:
            context.relations instanceof RelationIndex
              ? context.relations
                  .associationSnapshot()
                  .records.flatMap((edge) => {
                    const fromHandle = byId.get(edge.from),
                      toHandle = byId.get(edge.to);
                    return fromHandle && toHandle
                      ? [
                          {
                            fromHandle,
                            toHandle,
                            relation: edge.relation,
                            scope: edge.scope,
                          },
                        ]
                      : [];
                  })
              : [],
        };

  return {
    associationContext,
    // Invoke only inside atomicKnowledge, after SQLite reload and canonical creation/reuse.
    apply(
      value: unknown,
      proposalId: string,
      utteranceId: string,
      occurrenceId: string,
      at: string,
      policy: MemoryLifecyclePolicy,
    ): readonly string[] {
      if (value === undefined) return [];
      if (!Array.isArray(value)) return ["skipped_invalid_associations"];
      if (!(context.relations instanceof RelationIndex))
        return value.map(() => "skipped_unavailable_index");
      const index = context.relations;
      const currentClaims = new Map<string, Claim>(
        context.evidence.listClaims().map((c) => [c.id, c]),
      );
      const currentEntities = new Map<string, Entity>(
        context.entities.list().map((e) => [e.id, e]),
      );
      const resolve = (handle: unknown): string | undefined => {
        if (handle === "proposal")
          return currentClaims.has(proposalId) ? proposalId : undefined;
        if (typeof handle !== "string") return undefined;
        const claim = candidates.get(handle);
        if (
          claim &&
          JSON.stringify(currentClaims.get(claim.id)) === JSON.stringify(claim)
        )
          return claim.id;
        const entity = entities.get(handle);
        if (entity && currentEntities.has(entity.id)) return entity.id;
        return undefined;
      };
      const utterance = context.evidence
        .listUtterances()
        .find((u) => u.id === utteranceId);
      const artifact = context.evidence
        .listArtifacts()
        .find((a) => a.id === utterance?.artifactId);
      return value.map((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.relation !== "string" ||
          !item.relation.trim() ||
          item.relation.length > 128
        )
          return "skipped_invalid_relation";
        const from = resolve(item.fromHandle),
          to = resolve(item.toHandle);
        if (!from || !to) return "skipped_unresolved_edge";
        const proof = item.support;
        if (
          !source ||
          item.supportsRelation !== true ||
          !proof ||
          proof.source !== source.origin ||
          !Number.isSafeInteger(proof.start) ||
          !Number.isSafeInteger(proof.end) ||
          proof.start < 0 ||
          proof.end <= proof.start ||
          proof.end > source.content.length ||
          utterance?.content !== source.content ||
          artifact?.locator !== locator
        )
          return "skipped_unproven_edge";
        return index.establishAssociation(
          { from, to, relation: item.relation, scope },
          {
            occurrenceId,
            at,
            support: { utteranceId, start: proof.start, end: proof.end },
          },
          policy,
        );
      });
    },
  };
}

function associationEntityHandle(id: string): string {
  const digest = createHash("sha256").update(id).digest("hex").slice(0, 16);
  return `entity_${digest}`;
}
