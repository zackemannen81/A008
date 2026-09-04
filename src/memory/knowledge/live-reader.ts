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
import type { SerializedContextMeasurer } from "../types.js";
import { projectionItems } from "./projection-items.js";
import { readKnowledge } from "./read.js";
import type { KnowledgeReadContext } from "./read-types.js";

export interface KnowledgeMemoryReaderOptions {
  readonly context: KnowledgeReadContext;
  readonly planner?: RetrievalPlanner;
  readonly measurer?: SerializedContextMeasurer;
  /**
   * Ceiling on the serialized projection. Defaults to
   * `DEFAULT_PROJECTION_BUDGET_BYTES`. Whatever it cuts is reported in
   * `omittedKnowledgeIds`, so a short answer is always explainable.
   */
  readonly maximumProjectionBytes?: number;
}

export class KnowledgeMemoryReader {
  readonly #context: KnowledgeReadContext;
  readonly #planner: RetrievalPlanner;
  readonly #measurer: SerializedContextMeasurer;
  readonly #maximumProjectionBytes: number | undefined;

  constructor(options: KnowledgeMemoryReaderOptions) {
    this.#context = options.context;
    this.#planner = options.planner ?? new DeterministicRetrievalPlanner();
    this.#measurer = options.measurer ?? new Utf8ByteContextMeasurer();
    this.#maximumProjectionBytes = options.maximumProjectionBytes;
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
    const projected = projectionItems({
      taskId: request.taskId,
      payload: result.projected.payload,
      measurer: this.#measurer,
      ...(this.#maximumProjectionBytes === undefined
        ? {}
        : { maximumBytes: this.#maximumProjectionBytes }),
    });
    const items = [...projected.items];
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
        // Three different reasons to be missing, all of them reported. Anything
        // the retrieval path filtered out, anything a higher-ranked item
        // already said, and anything the budget cut.
        omittedKnowledgeIds: [
          ...result.filtered.omitted.map((item) => item.record.id),
          ...projected.deduplicated.map((item) => item.id),
          ...projected.omitted.map((item) => item.id),
        ],
        candidateThreshold: 0,
        projectionThreshold: 0,
        projectionMaximum: items.length + projected.omitted.length,
        projectionMeasuredUnits: measuredUnits,
        projectionMeasurementUnit: this.#measurer.unit,
        semanticRetrieval: "not_configured",
      },
    };
  }
}
