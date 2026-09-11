import { isKnowledgeSeverity, type KnowledgeSeverity } from "../core/memory-lifecycle-policy.js";
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

export interface KnowledgeSupportSpan {
  readonly source: "message" | "source";
  readonly start: number;
  readonly end: number;
}

/** Analyzer-facing evidence. Runtime turns an exact quote into a span. */
export interface AnalyzerSupportQuote {
  readonly source: "message" | "source";
  readonly quote: string;
  readonly occurrence?: number;
}

export interface AnalyzedKnowledgeDraft {
  readonly severity?: string;
  readonly support?: AnalyzerSupportQuote;
  readonly proposition: string;
  readonly kind: string;
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
  readonly entities?: readonly string[];
  readonly confidence?: number | string;
}

export type SupportQuoteResolution =
  | { readonly ok: true; readonly span: KnowledgeSupportSpan }
  | { readonly ok: false; readonly reason: string };

function quoteSearchForms(quote: string, sourceText: string): readonly string[] {
  const forms = [quote];
  if (sourceText.includes("\r\n") && quote.includes("\n") && !quote.includes("\r\n")) {
    forms.push(quote.replaceAll("\n", "\r\n"));
  }
  if (!sourceText.includes("\r\n") && quote.includes("\r\n")) {
    forms.push(quote.replaceAll("\r\n", "\n"));
  }
  return forms;
}

function exactQuotePositions(sourceText: string, quote: string): number[] {
  const positions: number[] = [];
  let from = 0;
  while (from + quote.length <= sourceText.length) {
    const index = sourceText.indexOf(quote, from);
    if (index < 0) break;
    positions.push(index);
    from = index + quote.length;
  }
  return positions;
}

function locateExactQuote(
  sourceText: string,
  quote: string,
  occurrence: number | undefined,
): SupportQuoteResolution {
  for (const form of quoteSearchForms(quote, sourceText)) {
    const positions = exactQuotePositions(sourceText, form);
    if (positions.length === 0) continue;
    if (occurrence !== undefined) {
      const start = positions[occurrence - 1];
      if (start === undefined) {
        return { ok: false, reason: "quote occurrence not found in source" };
      }
      return { ok: true, span: { source: "message", start, end: start + form.length } };
    }
    if (positions.length > 1) {
      return { ok: false, reason: "quote is ambiguous" };
    }
    const start = positions[0];
    if (start === undefined) continue;
    return { ok: true, span: { source: "message", start, end: start + form.length } };
  }
  return { ok: false, reason: "quote not found in source" };
}

/**
 * Exact quote in the original source, no case/whitespace folding. The model
 * names the evidence; runtime computes the UTF-16 span. Model-supplied
 * start/end are ignored. Newline encoding is the only mechanical variant.
 * A quote that exists only in the answer is omitted, not reinforced.
 */
export function resolveAnalyzerSupport(
  raw: unknown,
  expectedSource: "message" | "source",
  sourceText: string,
  extras: { readonly answer?: string; readonly proposition?: string } = {},
): SupportQuoteResolution | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid support" };
  }
  const value = raw as Record<string, unknown>;
  if (value.source !== expectedSource) {
    return { ok: false, reason: "invalid support source" };
  }
  let occurrence: number | undefined;
  if (value.occurrence !== undefined) {
    if (!Number.isSafeInteger(value.occurrence) || Number(value.occurrence) < 1) {
      return { ok: false, reason: "invalid quote occurrence" };
    }
    occurrence = Number(value.occurrence);
  }
  const tryLocate = (quote: string): SupportQuoteResolution => {
    const located = locateExactQuote(sourceText, quote, occurrence);
    if (located.ok === true) {
      return { ok: true, span: { source: expectedSource, start: located.span.start, end: located.span.end } };
    }
    return located;
  };
  if (typeof value.quote === "string" && value.quote.length > 0) {
    const fromQuote = tryLocate(value.quote);
    if (fromQuote.ok === true) return fromQuote;
    if (fromQuote.reason === "quote is ambiguous" || fromQuote.reason === "quote occurrence not found in source") {
      return fromQuote;
    }
  }
  if (typeof extras.proposition === "string" && extras.proposition.length > 0) {
    const fromProposition = tryLocate(extras.proposition);
    if (fromProposition.ok === true) return fromProposition;
  }
  if (typeof value.quote === "string" && extras.answer !== undefined && extras.answer.includes(value.quote)) {
    return undefined;
  }
  if (typeof value.quote !== "string" || value.quote.length === 0) {
    return { ok: false, reason: "quote not found in source" };
  }
  return { ok: false, reason: "quote not found in source" };
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
  readonly severity?: KnowledgeSeverity;
  readonly support?: KnowledgeSupportSpan;
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
/** Reasons individual proposals were dropped, so the loss is never silent. */
export type SkippedProposalReasons = readonly string[];

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
   * Analyzer items rejected individually rather than failing the batch. Empty
   * on a clean extraction. Carries this repository's own validation text and
   * never analyzer content.
   */
  readonly skippedProposals: SkippedProposalReasons;
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

/**
 * Ordinal confidence words, placed on the unit scale.
 *
 * The analyzer instruction names `confidence` without saying it must be a
 * number, and a model asked for confidence writes "high" far more often than it
 * writes 0.85. The parser demanded a finite number and threw on anything else,
 * so an entire extraction — every proposal in it — was skipped for a field that
 * is metadata about a proposition A008 had already read correctly.
 *
 * Converting a word to a number is lossy and the exact values are a judgement,
 * not a measurement. That is a much smaller loss than discarding the knowledge,
 * and the alternative on offer was silence. A word outside this set is still
 * refused by name rather than guessed at.
 */
const CONFIDENCE_WORDS: ReadonlyMap<string, number> = new Map([
  ["certain", 1],
  ["very high", 0.95],
  ["high", 0.85],
  ["likely", 0.75],
  ["medium", 0.6],
  ["moderate", 0.6],
  ["med", 0.6],
  ["low", 0.3],
  ["very low", 0.15],
  ["uncertain", 0.15],
]);

/**
 * Reads whatever the model put in `confidence`.
 *
 * A number stays a number. A word is looked up. A numeric string — "0.9" — is
 * read as the number it plainly is, because quoting a number is a formatting
 * slip and not a different claim.
 */
export function parseProposalConfidence(value: unknown, field: string): number {
  if (typeof value === "number") {
    return unit(value, field);
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase("und").replace(/[_-]+/g, " ");
    const word = CONFIDENCE_WORDS.get(normalized);
    if (word !== undefined) {
      return word;
    }
    if (normalized.length > 0 && /^[0-9]*\.?[0-9]+$/u.test(normalized)) {
      return unit(Number.parseFloat(normalized), field);
    }
  }
  throw new MemoryError(
    "invalid_input",
    `${field} must be a number between 0 and 1, or one of ${[...CONFIDENCE_WORDS.keys()].join(", ")}`,
  );
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
      ...(entry.severity === undefined ? {} : { severity: entry.severity }),
      ...(entry.support === undefined ? {} : { support: entry.support }),
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
    const skipped: string[] = [];
    /**
     * One bad item no longer discards the batch.
     *
     * The analyzer instruction asks for completeness and recursive splitting,
     * and the ceiling is 128, so a normal extraction is tens of items. Failing
     * the whole batch because item 5 came back with an empty proposition threw
     * away every good proposition with it — observed live.
     *
     * Nothing unsafe is admitted by this: a rejected item is still rejected,
     * it just no longer punishes its neighbours. Batch-level defects — output
     * that is not an array, more items than the ceiling, an over-budget
     * result — still fail closed, because those say the response as a whole
     * cannot be trusted rather than that one item was malformed.
     */
    const validateProposal = (
      value: unknown,
      index: number,
    ): StagedKnowledgeProposal => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new MemoryError(
          "policy",
          `proposal ${index + 1} must be an object`,
        );
      }
      const raw = value as Record<string, unknown>;
      if (!isKnowledgeSeverity(raw.severity)) throw new MemoryError("policy", `proposal ${index + 1} requires severity critical, important or minor`);
      const sourceText = analyzerInput.kind === "source" ? analyzerInput.content : analyzerInput.message;
      const expectedSource = analyzerInput.kind === "source" ? "source" : "message";
      const proposition = nonEmpty(
        raw.proposition,
        `proposal ${index + 1} proposition`,
      );
      const resolvedSupport = resolveAnalyzerSupport(raw.support, expectedSource, sourceText, {
        proposition,
        ...(analyzerInput.kind === "dialogue" ? { answer: analyzerInput.answer } : {}),
      });
      if (resolvedSupport?.ok === false) {
        skipped.push(`proposal ${index + 1} reinforcement skipped: ${resolvedSupport.reason}`);
      }
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
          : parseProposalConfidence(
              raw.confidence,
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
        severity: raw.severity,
        ...(resolvedSupport?.ok === true ? { support: resolvedSupport.span } : {}),
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
    };

    const proposals = untrusted.flatMap((value, index) => {
      try {
        return [validateProposal(value, index)];
      } catch (error) {
        // Every per-item rule lives inside `validateProposal`, and every
        // batch-level rule outside it, so catching MemoryError here cannot
        // swallow a batch-level failure. Both `policy` and `invalid_input`
        // describe one bad item.
        if (error instanceof MemoryError) {
          skipped.push(error.message);
          return [];
        }
        throw error;
      }
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
      skippedProposals: skipped,
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
