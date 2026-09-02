import { DeterministicRetrievalPlanner } from "../deterministic-retrieval-planner.js";
import {
  serializeContextProjection,
  Utf8ByteContextMeasurer,
} from "../serialization.js";
import type {
  HybridMemoryReadResult,
  MemoryReadRequest,
  RetrievalPlanner,
} from "../retrieval-types.js";
import type { ContextKnowledgeItem, SerializedContextMeasurer } from "../types.js";
import { readKnowledge } from "./read.js";
import type { KnowledgeReadContext } from "./read-types.js";
import type { ProjectionPayload } from "./evidence-types.js";

export interface KnowledgeMemoryReaderOptions {
  readonly context: KnowledgeReadContext;
  readonly planner?: RetrievalPlanner;
  readonly measurer?: SerializedContextMeasurer;
}

export class KnowledgeMemoryReader {
  readonly #context: KnowledgeReadContext;
  readonly #planner: RetrievalPlanner;
  readonly #measurer: SerializedContextMeasurer;

  constructor(options: KnowledgeMemoryReaderOptions) {
    this.#context = options.context;
    this.#planner = options.planner ?? new DeterministicRetrievalPlanner();
    this.#measurer = options.measurer ?? new Utf8ByteContextMeasurer();
  }

  async read(request: MemoryReadRequest): Promise<HybridMemoryReadResult> {
    const plan = this.#planner.plan(request);
    const result = readKnowledge(
      {
        message: request.message,
        verifiedScope: {
          verified: true,
          tags: request.applicabilityScopes,
          entities: plan.entities,
        },
        temporalHints: plan.temporalHints,
      },
      this.#context,
    );
    const items = payloadItems(result.projected.payload);
    const projection = {
      taskId: request.taskId,
      items,
    };
    const serialized = serializeContextProjection(projection);
    const measuredUnits = this.#measurer.measure(serialized);
    return {
      plan,
      projection: {
        projection,
        serialized,
        measuredUnits,
        measurementUnit: this.#measurer.unit,
      },
      evidence: {
        persistentCurrentCount: this.#context.state.snapshot().bindings.filter(
          (binding) => binding.interval.to === null,
        ).length,
        channelCounts: {
          exact: result.retrieved.filter((record) =>
            record.reasons.includes("direct_slot_match"),
          ).length,
          lexical: result.retrieved.filter((record) =>
            record.reasons.some((reason) => reason.includes("lexical")),
          ).length,
          tag: 0,
          domain: 0,
          semantic: 0,
        },
        uniqueCandidateCount: result.retrieved.length,
        admittedCandidateCount: items.length,
        rankedCandidates: [],
        dormantCandidateIds: result.retrieved
          .filter((record) => record.memoryState === "dormant")
          .map((record) => record.id),
        selectedKnowledgeIds: items.map((item) => item.id),
        omittedKnowledgeIds: result.filtered.omitted.map(
          (item) => item.record.id,
        ),
        candidateThreshold: 0,
        projectionThreshold: 0,
        projectionMaximum: items.length,
        projectionMeasuredUnits: measuredUnits,
        projectionMeasurementUnit: this.#measurer.unit,
        semanticRetrieval: "not_configured",
      },
    };
  }
}

function payloadItems(payload: ProjectionPayload): ContextKnowledgeItem[] {
  const items: ContextKnowledgeItem[] = [];
  for (const [index, entry] of payload.state.entries()) {
    items.push({
      id: `state:${index}`,
      proposition: propositionOf(entry.value, entry.slot),
      kind: "state",
      tags: [...payload.scope.tags],
      scope: [...payload.scope.entities],
      authority: 1,
    });
  }
  if (items.length > 0) {
    return items;
  }
  for (const [index, claim] of payload.claims.entries()) {
    items.push({
      id: `claim:${index}`,
      proposition: claim.label,
      kind: "claim",
      tags: [...payload.scope.tags],
      scope: [...payload.scope.entities],
      authority: 0.4,
    });
  }
  if (items.length > 0) {
    return items;
  }
  for (const [index, utterance] of payload.utterances.entries()) {
    items.push({
      id: `utterance:${index}`,
      proposition: utterance.content,
      kind: "utterance",
      tags: [...payload.scope.tags],
      scope: [...payload.scope.entities],
      authority: 0.2,
    });
  }
  return items;
}

function propositionOf(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
