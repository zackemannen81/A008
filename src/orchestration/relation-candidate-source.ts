import { parseRuntimeId } from "../identity/runtime-id.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../identity/types.js";
import { MemoryError } from "../memory/errors.js";
import type { SemanticMemory } from "../memory/memory-engine.js";
import type {
  CandidateChannelLimits,
  MemoryCandidateStore,
  RetrievalChannel,
  RetrievalPlan,
  WeightedRetrievalLabel,
} from "../memory/retrieval-types.js";
import type { KnowledgeItem } from "../memory/types.js";
import type { StagedKnowledgeProposal } from "./post-output-knowledge-intake.js";

export interface RelationCandidateRequest {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly taskId: RuntimeTaskId;
  readonly agentId: AgentId;
  readonly staged: StagedKnowledgeProposal;
}

export interface RelationCandidate {
  readonly item: KnowledgeItem;
  readonly aggregateScore: number;
  readonly channels: readonly RetrievalChannel[];
}

export interface RelationCandidateSource {
  find(
    request: RelationCandidateRequest,
  ): Promise<readonly RelationCandidate[]>;
}

export interface IndexedRelationCandidateSourceOptions {
  readonly memory: Pick<SemanticMemory, "projectId" | "getKnowledge">;
  readonly candidateStore: MemoryCandidateStore;
  readonly maximumCandidates?: number;
  readonly channelLimits?: Partial<CandidateChannelLimits>;
}

const CHANNELS: readonly RetrievalChannel[] = [
  "exact",
  "lexical",
  "tag",
  "domain",
  "semantic",
];

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

function normalizedStrings(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function labels(values: readonly string[]): WeightedRetrievalLabel[] {
  return normalizedStrings(values).map((value) => ({ value, weight: 1 }));
}

function lexicalTerms(staged: StagedKnowledgeProposal): string[] {
  const semanticText = [
    staged.proposal.proposition,
    staged.proposal.kind,
    ...(staged.proposal.tags ?? []),
    ...staged.domains,
    ...staged.entities,
  ].join(" ");
  return normalizedStrings(
    semanticText
      .toLocaleLowerCase("en-US")
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((term) => term.length >= 2),
  ).slice(0, 32);
}

function cloneItem(item: KnowledgeItem): KnowledgeItem {
  return {
    ...item,
    tags: [...item.tags],
    scope: [...item.scope],
    provenance: item.provenance.map((entry) => ({ ...entry })),
  };
}

export class IndexedRelationCandidateSource implements RelationCandidateSource {
  readonly #memory: Pick<SemanticMemory, "projectId" | "getKnowledge">;
  readonly #candidateStore: MemoryCandidateStore;
  readonly #maximumCandidates: number;
  readonly #channelLimits: CandidateChannelLimits;

  constructor(options: IndexedRelationCandidateSourceOptions) {
    this.#memory = options.memory;
    this.#candidateStore = options.candidateStore;
    this.#maximumCandidates = positiveSafeInteger(
      options.maximumCandidates ?? 8,
      "maximumCandidates",
    );
    this.#channelLimits = {
      exact: positiveSafeInteger(
        options.channelLimits?.exact ?? 16,
        "channelLimits.exact",
      ),
      lexical: positiveSafeInteger(
        options.channelLimits?.lexical ?? 24,
        "channelLimits.lexical",
      ),
      tag: positiveSafeInteger(
        options.channelLimits?.tag ?? 16,
        "channelLimits.tag",
      ),
      domain: positiveSafeInteger(
        options.channelLimits?.domain ?? 16,
        "channelLimits.domain",
      ),
      semantic: positiveSafeInteger(
        options.channelLimits?.semantic ?? 1,
        "channelLimits.semantic",
      ),
    };
    if (
      this.#memory.projectId !== undefined &&
      this.#memory.projectId !== this.#candidateStore.projectId
    ) {
      throw new MemoryError(
        "invalid_input",
        "relation memory and candidate store project namespaces differ",
      );
    }
  }

  async find(
    request: RelationCandidateRequest,
  ): Promise<readonly RelationCandidate[]> {
    const projectId = parseRuntimeId(request.projectId, "project");
    const conversationId = parseRuntimeId(
      request.conversationId,
      "conversation",
    );
    const taskId = parseRuntimeId(request.taskId, "task");
    const agentId = parseRuntimeId(request.agentId, "agent");
    if (
      projectId !== this.#candidateStore.projectId ||
      (this.#memory.projectId !== undefined &&
        projectId !== this.#memory.projectId)
    ) {
      throw new MemoryError(
        "invalid_input",
        "relation candidate request project does not match storage namespace",
      );
    }

    const plan: RetrievalPlan = {
      projectId,
      conversationId,
      taskId,
      agentId,
      queryText: request.staged.proposal.proposition,
      intents: ["statement"],
      domains: labels(request.staged.domains),
      tags: labels(request.staged.proposal.tags ?? []),
      entities: normalizedStrings(request.staged.entities),
      terms: lexicalTerms(request.staged),
      semanticQueries: [],
      temporalHints: {
        currentOnly: true,
        mentionsPast: false,
        mentionsFuture: false,
      },
      applicabilityScopes: normalizedStrings(request.staged.proposal.scope),
      confidence: request.staged.proposal.confidence ?? 0.5,
    };
    const search = await this.#candidateStore.retrieveCandidates(
      plan,
      [],
      this.#channelLimits,
    );
    const aggregated = new Map<
      string,
      { readonly scores: Map<RetrievalChannel, number> }
    >();
    for (const hit of search.hits) {
      const candidate = aggregated.get(hit.knowledgeId) ?? {
        scores: new Map<RetrievalChannel, number>(),
      };
      candidate.scores.set(
        hit.channel,
        Math.max(candidate.scores.get(hit.channel) ?? 0, hit.score),
      );
      aggregated.set(hit.knowledgeId, candidate);
    }

    const ranked = [...aggregated.entries()]
      .map(([id, candidate]) => ({
        id,
        aggregateScore: [...candidate.scores.values()].reduce(
          (sum, score) => sum + score,
          0,
        ),
        channels: CHANNELS.filter((channel) => candidate.scores.has(channel)),
      }))
      .sort(
        (left, right) =>
          right.aggregateScore - left.aggregateScore ||
          left.id.localeCompare(right.id),
      )
      .slice(0, this.#maximumCandidates);

    const result: RelationCandidate[] = [];
    for (const candidate of ranked) {
      const item = await this.#memory.getKnowledge(candidate.id);
      if (item?.canonicalStatus !== "current") {
        throw new MemoryError(
          "illegal_state",
          `relation index returned non-current knowledge: ${candidate.id}`,
        );
      }
      result.push({
        item: cloneItem(item),
        aggregateScore: candidate.aggregateScore,
        channels: [...candidate.channels],
      });
    }
    return result;
  }
}
