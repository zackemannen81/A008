import { MemoryError } from "./errors.js";
import {
  isExactChannelCandidate,
  strengthWeightForChannels,
} from "./hybrid-retrieval-policy.js";
import { SemanticMemory } from "./memory-engine.js";
import type {
  CandidateScoreComponents,
  EmbeddingProvider,
  HybridMemoryReadPolicy,
  HybridMemoryReadResult,
  MemoryCandidateStore,
  MemoryReadRequest,
  RankedMemoryCandidate,
  RetrievalChannel,
  RetrievalPlanner,
  SemanticQueryVector,
} from "./retrieval-types.js";
import type { KnowledgeItem, MemoryTask } from "./types.js";

export interface HybridMemoryReaderOptions {
  readonly memory: SemanticMemory;
  readonly planner: RetrievalPlanner;
  readonly candidateStore: MemoryCandidateStore;
  readonly policy: HybridMemoryReadPolicy;
  readonly embeddingProvider?: EmbeddingProvider;
}

interface MutableCandidate {
  readonly item: KnowledgeItem;
  readonly channelScores: Map<RetrievalChannel, number>;
  readonly reasons: Set<string>;
}

function validateWeight(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "policy",
      `${field} must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function scoreComponents(
  candidate: MutableCandidate,
  policy: HybridMemoryReadPolicy,
): CandidateScoreComponents {
  const channel = (name: RetrievalChannel) =>
    validateWeight(candidate.channelScores.get(name) ?? 0, `${name} score`);
  return {
    exact: channel("exact") * policy.weights.exact,
    lexical: channel("lexical") * policy.weights.lexical,
    tag: channel("tag") * policy.weights.tag,
    domain: channel("domain") * policy.weights.domain,
    semantic: channel("semantic") * policy.weights.semantic,
    strength:
      validateWeight(candidate.item.relevanceScore, "knowledge strength") *
      strengthWeightForChannels(policy.weights, candidate.channelScores.keys()),
    authority:
      validateWeight(candidate.item.authority, "knowledge authority") *
      policy.weights.authority,
  };
}

function totalScore(components: CandidateScoreComponents): number {
  return Object.values(components).reduce((sum, value) => sum + value, 0);
}

function isProjectionEligible(candidate: MutableCandidate): boolean {
  return (
    candidate.item.activationStatus === "active" ||
    isExactChannelCandidate(candidate.channelScores.keys())
  );
}

export class HybridMemoryReader {
  private readonly memory: SemanticMemory;
  private readonly planner: RetrievalPlanner;
  private readonly candidateStore: MemoryCandidateStore;
  private readonly policy: HybridMemoryReadPolicy;
  private readonly embeddingProvider: EmbeddingProvider | undefined;

  constructor(options: HybridMemoryReaderOptions) {
    this.memory = options.memory;
    this.planner = options.planner;
    this.candidateStore = options.candidateStore;
    this.policy = options.policy;
    this.embeddingProvider = options.embeddingProvider;
  }

  async read(request: MemoryReadRequest): Promise<HybridMemoryReadResult> {
    const plan = this.planner.plan(request);
    if (
      plan.projectId !== request.projectId ||
      plan.conversationId !== request.conversationId ||
      plan.taskId !== request.taskId ||
      plan.agentId !== request.agentId
    ) {
      throw new MemoryError(
        "policy",
        "retrieval planner cannot change verified runtime identity",
      );
    }
    if (this.candidateStore.projectId !== request.projectId) {
      throw new MemoryError(
        "invalid_input",
        "candidate store project does not match the read request",
      );
    }
    if (
      this.memory.projectId !== undefined &&
      this.memory.projectId !== request.projectId
    ) {
      throw new MemoryError(
        "invalid_input",
        "memory repository project does not match the read request",
      );
    }

    const { vectors, status: semanticRetrieval } =
      await this.createSemanticVectors(plan.semanticQueries);
    const search = await this.candidateStore.retrieveCandidates(
      plan,
      vectors,
      this.policy.channelLimits,
    );

    const byId = new Map<string, MutableCandidate>();
    for (const hit of search.hits) {
      let candidate = byId.get(hit.knowledgeId);
      if (candidate === undefined) {
        const item = await this.memory.getKnowledge(hit.knowledgeId);
        if (item?.canonicalStatus !== "current") {
          throw new MemoryError(
            "illegal_state",
            `retrieval index returned non-current knowledge: ${hit.knowledgeId}`,
          );
        }
        candidate = {
          item,
          channelScores: new Map(),
          reasons: new Set(),
        };
        byId.set(hit.knowledgeId, candidate);
      }
      const prior = candidate.channelScores.get(hit.channel) ?? 0;
      candidate.channelScores.set(hit.channel, Math.max(prior, hit.score));
      candidate.reasons.add(hit.reason);
    }

    const fullyRanked = [...byId.values()]
      .map((candidate) => {
        const components = scoreComponents(candidate, this.policy);
        return {
          candidate,
          components,
          score: totalScore(components),
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.candidate.item.authority - left.candidate.item.authority ||
          left.candidate.item.id.localeCompare(right.candidate.item.id),
      );

    const admitted = fullyRanked.filter(
      (entry) => entry.score >= this.policy.candidateThreshold,
    );
    const bounded = admitted.slice(0, this.policy.maxCandidateItems);
    const projectionEligible = bounded
      .filter(
        (entry) =>
          entry.score >= this.policy.projectionThreshold &&
          isProjectionEligible(entry.candidate),
      )
      .slice(0, this.policy.maxProjectionItems);
    const rankedCandidateIds = projectionEligible.map(
      (entry) => entry.candidate.item.id,
    );

    const task: MemoryTask = {
      id: request.taskId,
      query: plan.queryText,
      scopes: [...plan.applicabilityScopes],
      terms: [...plan.terms],
      requiredKnowledgeIds: [...(request.requiredKnowledgeIds ?? [])],
    };
    const projection = await this.memory.projectSelected(
      task,
      { maximum: this.policy.projectionMaximum },
      rankedCandidateIds,
    );
    const selectedIds = new Set(
      projection.projection.items.map((item) => item.id),
    );

    const rankedCandidates: RankedMemoryCandidate[] = fullyRanked
      .slice(0, this.policy.maxCandidateItems)
      .map((entry, index) => {
        const id = entry.candidate.item.id;
        let exclusionReason: string | null = null;
        if (entry.score < this.policy.candidateThreshold) {
          exclusionReason = "below_candidate_threshold";
        } else if (index >= this.policy.maxCandidateItems) {
          exclusionReason = "candidate_limit";
        } else if (entry.score < this.policy.projectionThreshold) {
          exclusionReason = "below_projection_threshold";
        } else if (
          entry.candidate.item.activationStatus === "dormant" &&
          !isExactChannelCandidate(entry.candidate.channelScores.keys())
        ) {
          exclusionReason = "associative_activation_dormant";
        } else if (!rankedCandidateIds.includes(id)) {
          exclusionReason = "projection_item_limit";
        } else if (!selectedIds.has(id)) {
          exclusionReason = "projection_budget";
        }
        const reasons = new Set(entry.candidate.reasons);
        if (
          selectedIds.has(id) &&
          entry.candidate.item.activationStatus === "dormant" &&
          isExactChannelCandidate(entry.candidate.channelScores.keys())
        ) {
          reasons.add("direct_match_ignores_activation");
        }
        return {
          knowledgeId: id,
          score: entry.score,
          components: entry.components,
          channels: [...entry.candidate.channelScores.keys()].sort((a, b) =>
            a.localeCompare(b),
          ),
          reasons: [...reasons].sort((a, b) => a.localeCompare(b)),
          activationStatus: entry.candidate.item.activationStatus,
          activationThreshold: entry.candidate.item.activationThreshold,
          included: selectedIds.has(id),
          exclusionReason: selectedIds.has(id) ? null : exclusionReason,
        };
      });

    return {
      plan,
      projection,
      evidence: {
        persistentCurrentCount: search.persistentCurrentCount,
        channelCounts: search.channelCounts,
        uniqueCandidateCount: byId.size,
        admittedCandidateCount: admitted.length,
        rankedCandidates,
        dormantCandidateIds: bounded
          .filter(
            (entry) => entry.candidate.item.activationStatus === "dormant",
          )
          .map((entry) => entry.candidate.item.id),
        selectedKnowledgeIds: projection.projection.items.map(
          (item) => item.id,
        ),
        omittedKnowledgeIds: rankedCandidates
          .filter((candidate) => !candidate.included)
          .map((candidate) => candidate.knowledgeId),
        candidateThreshold: this.policy.candidateThreshold,
        projectionThreshold: this.policy.projectionThreshold,
        projectionMaximum: this.policy.projectionMaximum,
        projectionMeasuredUnits: projection.measuredUnits,
        projectionMeasurementUnit: projection.measurementUnit,
        semanticRetrieval,
      },
    };
  }

  private async createSemanticVectors(queries: readonly string[]): Promise<{
    readonly vectors: readonly SemanticQueryVector[];
    readonly status: "used" | "not_configured" | "no_vectors";
  }> {
    if (this.embeddingProvider === undefined) {
      return { vectors: [], status: "not_configured" };
    }
    const embedded = await this.embeddingProvider.embed(queries);
    if (embedded.length === 0) {
      return { vectors: [], status: "no_vectors" };
    }
    if (embedded.length !== queries.length) {
      throw new MemoryError(
        "policy",
        "embedding provider must return one vector per semantic query",
      );
    }
    return {
      vectors: embedded.map((vector) => ({
        model: this.embeddingProvider!.model,
        vector,
      })),
      status: "used",
    };
  }
}
