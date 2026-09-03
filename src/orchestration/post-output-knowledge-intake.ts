import { parseRuntimeId } from "../identity/runtime-id.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../identity/types.js";
import { MemoryError } from "../memory/errors.js";
import type { KnowledgeProposal } from "../memory/types.js";
import type { SemanticOperationContext } from "./semantic-operation.js";

/**
 * A delivered conversation turn.
 *
 * The analyzer sees only the normalized original message and the final answer.
 * Reasoning and control state never reach it (ADR 0009).
 */
export interface DialogueAnalyzerInput {
  readonly kind: "dialogue";
  readonly message: string;
  readonly answer: string;
}

/**
 * An ingested source, such as an uploaded document.
 *
 * Deliberately not carried as a `message` or an `answer`. The serialized input
 * is what the model reads as untrusted data, so calling a document by a name it
 * does not have would put a false frame in that payload. The analyzer
 * instruction already speaks of "the source".
 */
export interface SourceAnalyzerInput {
  readonly kind: "source";
  readonly locator: string;
  readonly content: string;
}

export type PostOutputAnalyzerInput =
  | DialogueAnalyzerInput
  | SourceAnalyzerInput;

export interface AnalyzedKnowledgeDraft {
  readonly proposition: string;
  readonly kind: string;
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
  readonly entities?: readonly string[];
  readonly confidence?: number;
}

export interface PostOutputKnowledgeAnalyzer {
  analyze(
    input: PostOutputAnalyzerInput,
    context?: SemanticOperationContext,
  ): Promise<readonly AnalyzedKnowledgeDraft[]>;
}

export interface KnowledgeIntakeMeasurer {
  readonly unit: string;
  measure(serializedBatch: string): number;
}

export interface KnowledgeIntakeBudget {
  readonly maximum: number;
  readonly measurer: KnowledgeIntakeMeasurer;
}

export interface PostOutputKnowledgeIntakeLimits {
  readonly maximumProposals?: number;
  readonly maximumTagsPerProposal?: number;
  readonly maximumDomainsPerProposal?: number;
  readonly maximumEntitiesPerProposal?: number;
}

export interface PostOutputKnowledgeIntakeContext {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly agentId: AgentId;
}

export interface PostOutputKnowledgeIntakeOptions {
  readonly analyzer: PostOutputKnowledgeAnalyzer;
  readonly context: PostOutputKnowledgeIntakeContext;
  readonly budget: KnowledgeIntakeBudget;
  readonly limits?: PostOutputKnowledgeIntakeLimits;
  readonly defaultAuthority?: number;
  readonly defaultActivationThreshold?: number;
}

export interface StageDialogueKnowledgeInput {
  readonly kind?: "dialogue";
  readonly taskId: RuntimeTaskId;
  readonly message: string;
  readonly answer: string;
  readonly applicabilityScopes: readonly string[];
}

export interface StageSourceKnowledgeInput {
  readonly kind: "source";
  readonly taskId: RuntimeTaskId;
  readonly locator: string;
  readonly content: string;
  /**
   * The utterance `ingest()` already created for this source.
   *
   * Carried so the commit path attaches claims to it instead of ingesting the
   * content a second time under a fabricated speaker and locator.
   */
  readonly utteranceId: string;
  readonly applicabilityScopes: readonly string[];
}

/**
 * `kind` is optional on the dialogue variant so every existing caller keeps
 * working unchanged; a source must name itself.
 */
export type StagePostOutputKnowledgeInput =
  | StageDialogueKnowledgeInput
  | StageSourceKnowledgeInput;

export interface StagedKnowledgeProposal {
  readonly proposal: KnowledgeProposal;
  readonly domains: readonly string[];
  readonly entities: readonly string[];
}

/**
 * Where a staged batch came from, and what the commit path may assume about it.
 *
 * A dialogue turn was spoken by the user, so its text is ingested as a user
 * utterance and the `user-assertion-v1` acceptance policy applies to it. An
 * ingested source was not: uploading a document is not asserting its contents,
 * and the source already has an utterance with honest provenance. Conflating
 * the two would both duplicate the utterance and auto-accept every claim in the
 * document as though the user had stated it.
 */
export type StagedBatchOrigin =
  | { readonly kind: "dialogue" }
  | { readonly kind: "source"; readonly utteranceId: string };

export interface StagedKnowledgeBatch {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly taskId: RuntimeTaskId;
  readonly agentId: AgentId;
  readonly origin: StagedBatchOrigin;
  /**
   * Dialogue: the user's message, which the acceptance policy reads.
   * Source: the locator, never the content — a document contains every
   * proposition extracted from it, so passing the content here would make
   * `isExplicitUserAssertion` true for all of them.
   */
  readonly sourceMessage: string;
  readonly proposals: readonly StagedKnowledgeProposal[];
  readonly serialized: string;
  readonly measuredUnits: number;
  readonly measurementUnit: string;
}

interface ResolvedLimits {
  readonly maximumProposals: number;
  readonly maximumTagsPerProposal: number;
  readonly maximumDomainsPerProposal: number;
  readonly maximumEntitiesPerProposal: number;
}

/**
 * Staging ceiling per answer.
 *
 * `maximumProposals` was 8. Owner testing across several models showed an
 * ordinary factual text yielding 49 proposals, so 8 discarded more than half of
 * a normal extraction as `budget_exceeded`. Raised to 128.
 *
 * This is also a cost dial, not only a correctness one: the post-output
 * coordinator commits proposals strictly sequentially, one relation-classifier
 * call each, so the ceiling bounds provider calls per delivered answer at
 * 1 analyzer + N classifiers.
 */
const DEFAULT_LIMITS: ResolvedLimits = {
  maximumProposals: 128,
  maximumTagsPerProposal: 16,
  maximumDomainsPerProposal: 8,
  maximumEntitiesPerProposal: 16,
};

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryError("policy", `${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

function unit(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function normalizedStrings(
  value: unknown,
  field: string,
  maximum: number,
): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new MemoryError("policy", `${field} must be an array`);
  }
  if (value.length > maximum) {
    throw new MemoryError(
      "budget_exceeded",
      `${field} exceeds its maximum of ${maximum}`,
    );
  }
  const normalized = value.map((entry, index) =>
    nonEmpty(entry, `${field} ${index + 1}`),
  );
  return [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizedScopes(values: readonly string[]): string[] {
  return normalizedStrings(
    [...values],
    "applicabilityScopes",
    Number.MAX_SAFE_INTEGER,
  );
}

function resolveLimits(
  limits: PostOutputKnowledgeIntakeLimits | undefined,
): ResolvedLimits {
  return {
    maximumProposals: positiveSafeInteger(
      limits?.maximumProposals ?? DEFAULT_LIMITS.maximumProposals,
      "maximumProposals",
    ),
    maximumTagsPerProposal: positiveSafeInteger(
      limits?.maximumTagsPerProposal ?? DEFAULT_LIMITS.maximumTagsPerProposal,
      "maximumTagsPerProposal",
    ),
    maximumDomainsPerProposal: positiveSafeInteger(
      limits?.maximumDomainsPerProposal ??
        DEFAULT_LIMITS.maximumDomainsPerProposal,
      "maximumDomainsPerProposal",
    ),
    maximumEntitiesPerProposal: positiveSafeInteger(
      limits?.maximumEntitiesPerProposal ??
        DEFAULT_LIMITS.maximumEntitiesPerProposal,
      "maximumEntitiesPerProposal",
    ),
  };
}

export function serializeStagedKnowledgeProposals(
  proposals: readonly StagedKnowledgeProposal[],
): string {
  return JSON.stringify({
    proposals: proposals.map((entry) => ({
      proposition: entry.proposal.proposition,
      kind: entry.proposal.kind,
      tags: [...(entry.proposal.tags ?? [])],
      scope: [...entry.proposal.scope],
      domains: [...entry.domains],
      entities: [...entry.entities],
      relevanceScore: entry.proposal.relevanceScore,
      activationThreshold: entry.proposal.activationThreshold,
      keepAlive: entry.proposal.keepAlive,
      authority: entry.proposal.authority,
      confidence: entry.proposal.confidence,
      sourceBacked: entry.proposal.sourceBacked,
      provenance: [...(entry.proposal.provenance ?? [])],
    })),
  });
}

export class Utf8ByteKnowledgeIntakeMeasurer
  implements KnowledgeIntakeMeasurer
{
  readonly unit = "utf8_bytes";

  measure(serializedBatch: string): number {
    return Buffer.byteLength(serializedBatch, "utf8");
  }
}

export class PostOutputKnowledgeIntake {
  readonly #analyzer: PostOutputKnowledgeAnalyzer;
  readonly #context: PostOutputKnowledgeIntakeContext;
  readonly #budget: KnowledgeIntakeBudget;
  readonly #limits: ResolvedLimits;
  readonly #defaultAuthority: number;
  readonly #defaultActivationThreshold: number;

  constructor(options: PostOutputKnowledgeIntakeOptions) {
    this.#analyzer = options.analyzer;
    this.#context = {
      projectId: parseRuntimeId(options.context.projectId, "project"),
      conversationId: parseRuntimeId(
        options.context.conversationId,
        "conversation",
      ),
      agentId: parseRuntimeId(options.context.agentId, "agent"),
    };
    this.#budget = {
      maximum: positiveSafeInteger(options.budget.maximum, "budget maximum"),
      measurer: options.budget.measurer,
    };
    nonEmpty(this.#budget.measurer.unit, "measurement unit");
    this.#limits = resolveLimits(options.limits);
    this.#defaultAuthority = unit(
      options.defaultAuthority ?? 0.25,
      "defaultAuthority",
    );
    this.#defaultActivationThreshold = unit(
      options.defaultActivationThreshold ?? 0.5,
      "defaultActivationThreshold",
    );
    if (this.#defaultActivationThreshold === 0) {
      throw new MemoryError(
        "invalid_input",
        "defaultActivationThreshold must be greater than zero",
      );
    }
  }

  async stage(
    input: StagePostOutputKnowledgeInput,
    context: SemanticOperationContext = {},
  ): Promise<StagedKnowledgeBatch> {
    const taskId = parseRuntimeId(input.taskId, "task");
    const scopes = normalizedScopes(input.applicabilityScopes);
    const analyzerInput: PostOutputAnalyzerInput =
      input.kind === "source"
        ? {
            kind: "source",
            locator: nonEmpty(input.locator, "locator"),
            content: nonEmpty(input.content, "content"),
          }
        : {
            kind: "dialogue",
            message: nonEmpty(input.message, "message"),
            answer: nonEmpty(input.answer, "answer"),
          };

    const untrusted: unknown = await this.#analyzer.analyze(
      analyzerInput,
      context.signal === undefined ? {} : { signal: context.signal },
    );
    if (!Array.isArray(untrusted)) {
      throw new MemoryError("policy", "analyzer output must be an array");
    }
    if (untrusted.length > this.#limits.maximumProposals) {
      throw new MemoryError(
        "budget_exceeded",
        `analyzer output exceeds ${this.#limits.maximumProposals} proposals`,
      );
    }

    const seen = new Set<string>();
    const proposals = untrusted.map((value, index) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new MemoryError(
          "policy",
          `proposal ${index + 1} must be an object`,
        );
      }
      const raw = value as Record<string, unknown>;
      const proposition = nonEmpty(
        raw.proposition,
        `proposal ${index + 1} proposition`,
      );
      const kind = nonEmpty(raw.kind, `proposal ${index + 1} kind`);
      const semanticKey = `${kind.toLowerCase()}\u0000${proposition.toLowerCase()}`;
      if (seen.has(semanticKey)) {
        throw new MemoryError(
          "policy",
          `proposal ${index + 1} duplicates an earlier semantic proposal`,
        );
      }
      seen.add(semanticKey);
      const confidence =
        raw.confidence === undefined
          ? 0.5
          : unit(
              typeof raw.confidence === "number" ? raw.confidence : Number.NaN,
              `proposal ${index + 1} confidence`,
            );
      const proposal: KnowledgeProposal = {
        proposition,
        kind,
        tags: normalizedStrings(
          raw.tags,
          `proposal ${index + 1} tags`,
          this.#limits.maximumTagsPerProposal,
        ),
        scope: [...scopes],
        relevanceScore: 0,
        activationThreshold: this.#defaultActivationThreshold,
        keepAlive: false,
        authority: this.#defaultAuthority,
        confidence,
        sourceBacked: false,
        provenance: [],
      };
      return {
        proposal,
        domains: normalizedStrings(
          raw.domains,
          `proposal ${index + 1} domains`,
          this.#limits.maximumDomainsPerProposal,
        ),
        entities: normalizedStrings(
          raw.entities,
          `proposal ${index + 1} entities`,
          this.#limits.maximumEntitiesPerProposal,
        ),
      } satisfies StagedKnowledgeProposal;
    });

    const serialized = serializeStagedKnowledgeProposals(proposals);
    const measuredUnits = this.#budget.measurer.measure(serialized);
    if (!Number.isSafeInteger(measuredUnits) || measuredUnits < 0) {
      throw new MemoryError(
        "policy",
        "knowledge intake measurer must return a non-negative safe integer",
      );
    }
    if (measuredUnits > this.#budget.maximum) {
      throw new MemoryError(
        "budget_exceeded",
        `staged knowledge uses ${measuredUnits} ${this.#budget.measurer.unit}; maximum is ${this.#budget.maximum}`,
      );
    }

    return {
      ...this.#context,
      taskId,
      origin:
        analyzerInput.kind === "source"
          ? { kind: "source", utteranceId: nonEmpty(
              (input as StageSourceKnowledgeInput).utteranceId,
              "utteranceId",
            ) }
          : { kind: "dialogue" },
      sourceMessage:
        analyzerInput.kind === "source"
          ? analyzerInput.locator
          : analyzerInput.message,
      proposals,
      serialized,
      measuredUnits,
      measurementUnit: this.#budget.measurer.unit,
    };
  }
}
