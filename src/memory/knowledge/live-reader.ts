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
import { normalizeLabel } from "./labels.js";
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
    // The planner can only match a taxonomy it was given, and it is constructed
    // without one, so `plan.tags` and `plan.domains` are empty in every live
    // composition. The store's own labels are the taxonomy that actually exists,
    // so the message is matched against those.
    //
    // This is lexical: it finds a label the message literally names. The
    // semantic step the owner specified — classify the message into domains and
    // *related* domains, which the message does not contain — is a provider call
    // and is not built here. What this does give is a real tag and domain axis
    // with no new call, and a vocabulary for that classifier to be seeded with
    // when it arrives.
    const mentioned = mentionedLabels(
      request.message,
      this.#context.labels.vocabulary(),
    );
    const result = readKnowledge(
      {
        message: request.message,
        verifiedScope: {
          verified: true,
          tags: [
            ...request.applicabilityScopes,
            ...plan.tags.map((tag) => tag.value),
            ...mentioned.tags,
          ],
          domains: [
            ...plan.domains.map((domain) => domain.value),
            ...mentioned.domains,
          ],
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
          tag: result.retrieved.filter((record) =>
            record.reasons.includes("label_tag_match"),
          ).length,
          domain: result.retrieved.filter((record) =>
            record.reasons.includes("label_domain_match"),
          ).length,
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

/**
 * Labels the message literally names.
 *
 * Whole-word-ish containment on the normalised forms, so `neuroscience` in
 * "what does neuroscience say" matches and `science` alone does not pick up
 * every label containing it. A label of one or two characters is ignored: it
 * would match half the store and is the `heter` failure in another costume.
 */
function mentionedLabels(
  message: string,
  vocabulary: { readonly tags: readonly string[]; readonly domains: readonly string[] },
): { readonly tags: readonly string[]; readonly domains: readonly string[] } {
  const haystack = normalizeLabel(message);
  const mentions = (label: string): boolean => {
    const needle = normalizeLabel(label);
    if (needle.length < 3) {
      return false;
    }
    const at = haystack.indexOf(needle);
    if (at < 0) {
      return false;
    }
    const before = at === 0 ? " " : haystack[at - 1] ?? " ";
    const after = haystack[at + needle.length] ?? " ";
    return !isWordCharacter(before) && !isWordCharacter(after);
  };
  return {
    tags: vocabulary.tags.filter(mentions),
    domains: vocabulary.domains.filter(mentions),
  };
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}
