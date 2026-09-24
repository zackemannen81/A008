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
import type { RetrievalScopeClassifier } from "../../orchestration/semantic-json-model.js";
import { ConversationScopes } from "./current-scope.js";
import { normalizeLabel } from "./labels.js";
import { projectionItems } from "./projection-items.js";
import { readKnowledge } from "./read.js";
import type { KnowledgeReadContext } from "./read-types.js";

export interface KnowledgeMemoryReaderOptions {
  readonly context: KnowledgeReadContext;
  readonly planner?: RetrievalPlanner;
  readonly measurer?: SerializedContextMeasurer;
  /**
   * Places the message in subject areas before the read, and is the only part
   * of retrieval that costs a provider call.
   *
   * Optional, and absent it the reader falls back to matching the message
   * against the store's vocabulary literally. That fallback is genuinely
   * weaker — it cannot reach a domain the message does not name, which is the
   * whole point of the call — but it keeps every offline path, test and
   * credential-free surface working unchanged.
   */
  readonly scopeClassifier?: RetrievalScopeClassifier;
  /**
   * Accumulating discussion scope, shared across reads. Supplied so a caller
   * can own its lifetime; the reader makes its own when none is given.
   */
  readonly scopes?: ConversationScopes;
  /**
   * Ceiling on the serialized projection. Defaults to
   * `DEFAULT_PROJECTION_BUDGET_BYTES`. Whatever it cuts is reported in
   * `omittedKnowledgeIds`, so a short answer is always explainable.
   */
  readonly maximumProjectionBytes?: number;
  readonly maximumScopeDomains?: number;
}

export class KnowledgeMemoryReader {
  readonly #context: KnowledgeReadContext;
  readonly #planner: RetrievalPlanner;
  readonly #measurer: SerializedContextMeasurer;
  readonly #maximumProjectionBytes: number | undefined;
  readonly #maximumScopeDomains: number | undefined;
  readonly #scopeClassifier: RetrievalScopeClassifier | undefined;
  readonly #scopes: ConversationScopes;

  constructor(options: KnowledgeMemoryReaderOptions) {
    this.#context = options.context;
    this.#planner = options.planner ?? new DeterministicRetrievalPlanner();
    this.#measurer = options.measurer ?? new Utf8ByteContextMeasurer();
    this.#maximumProjectionBytes = options.maximumProjectionBytes;
    this.#maximumScopeDomains = options.maximumScopeDomains;
    this.#scopeClassifier = options.scopeClassifier;
    this.#scopes = options.scopes ?? new ConversationScopes();
  }

  /**
   * Asks the classifier where this message belongs, and survives it failing.
   *
   * A retrieval-scope failure must not fail the turn. The call is an
   * improvement to what can be found, not a precondition for answering, and
   * turning a provider hiccup into a dead conversation would be a worse bug
   * than the narrower retrieval it is meant to avoid. On failure the reader
   * falls back to the lexical half, which is exactly the no-classifier path.
   */
  async #classifyScope(
    request: MemoryReadRequest,
    vocabulary: {
      readonly tags: readonly string[];
      readonly domains: readonly string[];
    },
    options: { readonly signal?: AbortSignal },
  ): Promise<{
    readonly retrieve: boolean;
    readonly semanticRetrieval:
      "used" | "skipped" | "degraded" | "not_configured";
    readonly domains: readonly string[];
    readonly relatedDomains: readonly string[];
    readonly tags: readonly string[];
    readonly relatedTags: readonly string[];
  }> {
    if (this.#scopeClassifier === undefined) {
      return {
        ...EMPTY_CLASSIFICATION,
        retrieve: true,
        semanticRetrieval: "not_configured",
      };
    }
    try {
      const draft = await this.#scopeClassifier.classify(
        {
          message: request.message,
          knownDomains: vocabulary.domains,
          knownTags: vocabulary.tags,
          currentDomains: this.#scopes.current(request.conversationId),
        },
        options,
      );
      const retrieve = draft.retrieve !== false;
      return {
        retrieve,
        semanticRetrieval: retrieve ? "used" : "skipped",
        domains: retrieve ? labelArray(draft.domains, 2) : [],
        relatedDomains: retrieve ? labelArray(draft.relatedDomains, 2) : [],
        tags: retrieve ? labelArray(draft.tags, 4) : [],
        relatedTags: retrieve ? labelArray(draft.relatedTags, 4) : [],
      };
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
      return {
        ...EMPTY_CLASSIFICATION,
        retrieve: true,
        semanticRetrieval: "degraded",
      };
    }
  }

  async read(
    request: MemoryReadRequest,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<HybridMemoryReadResult> {
    const plan = this.#planner.plan(request);
    const vocabulary = this.#context.labels.vocabulary();

    // Two sources for the same two axes, and they do different jobs.
    //
    // `mentionedLabels` finds a label the message literally names. It is free,
    // deterministic, and cannot reach a domain the message does not contain.
    //
    // The classifier places the message in subject areas it never mentions —
    // "hur fungerar människans minne?" becomes neuroscience — which is the whole
    // reason the call exists. Its result also drives the discussion scope. When
    // no classifier is composed the reader keeps working on the lexical half
    // alone, weaker but never broken.
    const mentioned = mentionedLabels(request.message, vocabulary);
    const classified = await this.#classifyScope(request, vocabulary, options);
    if (!classified.retrieve) {
      return emptyReadResult(
        request,
        plan,
        this.#context,
        this.#measurer,
        classified.semanticRetrieval,
      );
    }
    const scope = this.#scopes.advance(
      request.conversationId,
      {
        domains: classified.domains,
        relatedDomains: classified.relatedDomains,
      },
      this.#maximumScopeDomains === undefined
        ? {}
        : { maximumDomains: this.#maximumScopeDomains },
    );

    const result = readKnowledge(
      {
        message: request.message,
        applicabilityScopes: request.applicabilityScopes,
        verifiedScope: {
          verified: true,
          tags: [
            ...request.applicabilityScopes,
            ...plan.tags.map((tag) => tag.value),
            ...mentioned.tags,
            ...classified.tags,
            ...classified.relatedTags,
          ],
          // This turn's domains, plus the accumulated discussion scope. The
          // second is what carries continuity: a record stays reachable while
          // the conversation stays in its subject area, ten turns after the
          // turn that stored it.
          domains: [
            ...plan.domains.map((domain) => domain.value),
            ...mentioned.domains,
            ...classified.domains,
            ...classified.relatedDomains,
            ...scope.scope,
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
      records: result.projected.diagnostics.records,
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

    // Retrieval/filter/projection is read-only. Reinforcement belongs to
    // post-output extraction, where A008 can distinguish knowledge that merely
    // appeared in context from knowledge the completed turn materially reused.
    return {
      plan,
      projection: {
        projection,
        serialized,
        measuredUnits,
        measurementUnit: this.#measurer.unit,
      },
      evidence: {
        persistentCurrentCount: this.#context.state
          .snapshot()
          .bindings.filter((binding) => binding.interval.to === null).length,
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
        // "used" means a semantic step ran for this read. Scope classification
        // is that step: it is the only part of retrieval that asks a model
        // where the message belongs.
        semanticRetrieval: classified.semanticRetrieval,
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

function emptyReadResult(
  request: MemoryReadRequest,
  plan: ReturnType<RetrievalPlanner["plan"]>,
  context: KnowledgeReadContext,
  measurer: SerializedContextMeasurer,
  semanticRetrieval: "skipped" | "used" | "degraded" | "not_configured",
): HybridMemoryReadResult {
  const projection = { taskId: request.taskId, items: [] };
  const serialized = serializeContextProjection(projection);
  const measuredUnits = measurer.measure(serialized);
  return {
    plan,
    projection: {
      projection,
      serialized,
      measuredUnits,
      measurementUnit: measurer.unit,
    },
    evidence: {
      persistentCurrentCount: context.state
        .snapshot()
        .bindings.filter((binding) => binding.interval.to === null).length,
      channelCounts: { exact: 0, lexical: 0, tag: 0, domain: 0, semantic: 0 },
      uniqueCandidateCount: 0,
      admittedCandidateCount: 0,
      rankedCandidates: [],
      dormantCandidateIds: [],
      selectedKnowledgeIds: [],
      omittedKnowledgeIds: [],
      candidateThreshold: 0,
      projectionThreshold: 0,
      projectionMaximum: 0,
      projectionMeasuredUnits: measuredUnits,
      projectionMeasurementUnit: measurer.unit,
      semanticRetrieval,
    },
  };
}

function mentionedLabels(
  message: string,
  vocabulary: {
    readonly tags: readonly string[];
    readonly domains: readonly string[];
  },
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
    const before = at === 0 ? " " : (haystack[at - 1] ?? " ");
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

const EMPTY_CLASSIFICATION = Object.freeze({
  domains: Object.freeze([]) as readonly string[],
  relatedDomains: Object.freeze([]) as readonly string[],
  tags: Object.freeze([]) as readonly string[],
  relatedTags: Object.freeze([]) as readonly string[],
});

/**
 * Whatever the model returned, reduced to strings this repository will use.
 *
 * The draft is untrusted output. A non-array, a nested object, a number in the
 * middle of a list — all of it is silently dropped rather than allowed to reach
 * a store query, because a retrieval hint is not worth failing a turn over and
 * is certainly not worth trusting unchecked.
 */
function labelArray(value: unknown, maximum: number): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0 || result.includes(trimmed)) continue;
    result.push(trimmed);
    if (result.length >= maximum) break;
  }
  return result;
}
