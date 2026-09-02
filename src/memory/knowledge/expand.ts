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

export class RelationIndex implements RelationIndexPort {
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
    return [...(this.#out.get(id) ?? [])];
  }
}

export function expand(
  retrieved: readonly RetrievedRecord[],
  scope: SemanticScope,
  context: KnowledgeReadContext,
  query: { readonly message: string },
): ExpandResult {
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
      seen.add(related.id);
      if (related.memoryState === "dormant") {
        omitted.push({
          record: related,
          reason: ASSOCIATIVE_DORMANT,
        });
        continue;
      }
      records.push(related);
    }
  }

  return { records, omitted };
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
  const utterance = context.evidence.listUtterances().find((item) => item.id === id);
  if (utterance !== undefined) {
    const viewed = viewLifecycle(context.lifecycle, utterance.id);
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
      tags: [...scope.tags],
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
    const viewed = viewLifecycle(context.lifecycle, claim.id);
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
      tags: [...scope.tags],
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
    const viewed = viewLifecycle(context.lifecycle, event.id);
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
      tags: [...scope.tags],
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
