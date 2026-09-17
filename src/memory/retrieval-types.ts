import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../identity/types.js";
import type { ActivationStatus, ProjectionResult } from "./types.js";

export type RetrievalIntent =
  "question" | "instruction" | "correction" | "continuation" | "statement";

export interface DialogueTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface WeightedRetrievalLabel {
  readonly value: string;
  readonly weight: number;
}

export interface RetrievalTemporalHints {
  readonly currentOnly: boolean;
  readonly mentionsPast: boolean;
  readonly mentionsFuture: boolean;
}

export interface MemoryReadRequest {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly taskId: RuntimeTaskId;
  readonly agentId: AgentId;
  readonly message: string;
  readonly recentTurns?: readonly DialogueTurn[];
  readonly applicabilityScopes: readonly string[];
  readonly requiredKnowledgeIds?: readonly string[];
}

export interface RetrievalPlan {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly taskId: RuntimeTaskId;
  readonly agentId: AgentId;
  readonly queryText: string;
  readonly intents: readonly RetrievalIntent[];
  readonly domains: readonly WeightedRetrievalLabel[];
  readonly tags: readonly WeightedRetrievalLabel[];
  readonly entities: readonly string[];
  readonly terms: readonly string[];
  readonly semanticQueries: readonly string[];
  readonly temporalHints: RetrievalTemporalHints;
  readonly applicabilityScopes: readonly string[];
  readonly confidence: number;
}

export interface RetrievalPlanner {
  plan(request: MemoryReadRequest): RetrievalPlan;
}

export interface RetrievalDocument {
  readonly knowledgeId: string;
  readonly entities?: readonly string[];
  readonly domains?: readonly string[];
  readonly embedding?: readonly number[];
  readonly embeddingModel?: string;
}

export interface SemanticQueryVector {
  readonly model: string;
  readonly vector: readonly number[];
}

export interface EmbeddingProvider {
  readonly model: string;
  embed(queries: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export type RetrievalChannel =
  "exact" | "lexical" | "tag" | "domain" | "semantic";

export interface CandidateChannelHit {
  readonly knowledgeId: string;
  readonly channel: RetrievalChannel;
  readonly score: number;
  readonly reason: string;
}

export interface CandidateChannelLimits {
  readonly exact: number;
  readonly lexical: number;
  readonly tag: number;
  readonly domain: number;
  readonly semantic: number;
}

export interface CandidateSearchResult {
  readonly persistentCurrentCount: number;
  readonly hits: readonly CandidateChannelHit[];
  readonly channelCounts: Readonly<Record<RetrievalChannel, number>>;
}

export interface MemoryCandidateStore {
  readonly projectId: ProjectId;
  upsertRetrievalDocument(document: RetrievalDocument): Promise<void>;
  retrieveCandidates(
    plan: RetrievalPlan,
    semanticVectors: readonly SemanticQueryVector[],
    limits: CandidateChannelLimits,
  ): Promise<CandidateSearchResult>;
}

export interface HybridRetrievalWeights {
  readonly exact: number;
  readonly lexical: number;
  readonly tag: number;
  readonly domain: number;
  readonly semantic: number;
  readonly strength: number;
  readonly authority: number;
}

export interface HybridMemoryReadPolicy {
  readonly candidateThreshold: number;
  readonly projectionThreshold: number;
  readonly projectionMaximum: number;
  readonly maxCandidateItems: number;
  readonly maxProjectionItems: number;
  readonly channelLimits: CandidateChannelLimits;
  readonly weights: HybridRetrievalWeights;
}

export interface CandidateScoreComponents extends HybridRetrievalWeights {}

export interface RankedMemoryCandidate {
  readonly knowledgeId: string;
  readonly score: number;
  readonly components: CandidateScoreComponents;
  readonly channels: readonly RetrievalChannel[];
  readonly reasons: readonly string[];
  readonly activationStatus: ActivationStatus;
  readonly activationThreshold: number;
  readonly included: boolean;
  readonly exclusionReason: string | null;
}

export interface MemoryReadEvidence {
  readonly persistentCurrentCount: number;
  readonly channelCounts: Readonly<Record<RetrievalChannel, number>>;
  readonly uniqueCandidateCount: number;
  readonly admittedCandidateCount: number;
  readonly rankedCandidates: readonly RankedMemoryCandidate[];
  readonly dormantCandidateIds: readonly string[];
  readonly selectedKnowledgeIds: readonly string[];
  readonly omittedKnowledgeIds: readonly string[];
  readonly candidateThreshold: number;
  readonly projectionThreshold: number;
  readonly projectionMaximum: number;
  readonly projectionMeasuredUnits: number;
  readonly projectionMeasurementUnit: string;
  readonly semanticRetrieval:
    "used" | "skipped" | "degraded" | "not_configured" | "no_vectors";
}

export interface HybridMemoryReadResult {
  readonly plan: RetrievalPlan;
  readonly projection: ProjectionResult;
  readonly evidence: MemoryReadEvidence;
}
