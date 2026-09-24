import {
  composeChatInvocation,
  type ChatInvocationBudget,
  type ComposedChatInvocation,
} from "../core/chat-invocation.js";
import { ChatError } from "../core/errors.js";
import type {
  ChatGenerationOptions,
  ChatRequest,
  ChatTransport,
} from "../core/types.js";
import type {
  PostOutputAnalyzerInput,
  PostOutputKnowledgeAnalysis,
  PostOutputKnowledgeAnalyzer,
} from "./post-output-knowledge-intake.js";
import {
  serializeRelationClassifierBatchInput,
  serializeRelationClassifierInput,
  type KnowledgeRelationClassifier,
  type RelationClassifierBatchDecision,
  type RelationClassifierBatchInput,
  type RelationClassifierDecision,
  type RelationClassifierInput,
} from "./relation-gated-memory-commit.js";
import type { SemanticOperationContext } from "./semantic-operation.js";

export type SemanticJsonOperation =
  "knowledge_analysis" | "relation_classification" | "retrieval_scope";

export interface SemanticJsonGenerateInput extends SemanticOperationContext {
  readonly operation: SemanticJsonOperation;
  readonly systemInstruction: string;
  readonly serializedInput: string;
}

export interface SemanticJsonGenerator {
  generate(input: SemanticJsonGenerateInput): Promise<unknown>;
}

export interface ChatTransportSemanticJsonGeneratorOptions {
  readonly transport: ChatTransport;
  readonly model: string;
  readonly budget: ChatInvocationBudget;
  readonly generation?: Omit<ChatGenerationOptions, "stream">;
}

/** Owner-authored extraction semantics; A008-0085 clarifies response syntax and
 * durable selection without weakening source fidelity, untrusted-data framing,
 * array-only output, or completeness for qualifying claims. */
import { KNOWLEDGE_EXTRACTOR_INSTRUCTION } from "../prompt-contracts/KNOWLEDGE_EXTRACTOR_INSTRUCTION.js";
export { KNOWLEDGE_EXTRACTOR_INSTRUCTION };
import { POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION } from "../prompt-contracts/POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION.js";
export { POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION };
import { KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION } from "../prompt-contracts/KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION.js";
export { KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION };
import { KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION } from "../prompt-contracts/KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION.js";
export { KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION };

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ChatError("configuration", `${field} must not be empty.`);
  }
  return value.trim();
}

function optionalFiniteNumber(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ChatError(
      "configuration",
      `${field} must be a finite number when provided.`,
    );
  }
  return value;
}

function optionalPositiveInteger(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ChatError(
      "configuration",
      `${field} must be a positive safe integer when provided.`,
    );
  }
  return value;
}

export const SEMANTIC_JSON_GENERATION: ChatGenerationOptions = Object.freeze({
  temperature: 0,
  topP: 1,
  /**
   * Raised from 1024 alongside the staging ceiling. A 128-proposal extraction
   * does not fit in 1024 output tokens, and a truncated array is not partial
   * knowledge — it is invalid JSON that fails the strict parse and discards the
   * whole batch.
   *
   * 16384 is what the verified model profile declares, not a measured ceiling
   * for the model itself: the provider playground accepts 32768 for this same
   * model. Raising the profile is a separate decision, because "verified" in
   * `src/core/model-registry.ts` means checked against the model card.
   */
  maxTokens: 16_384,
  enableThinking: false,
  stream: false,
});

function generationOptions(
  value: Omit<ChatGenerationOptions, "stream"> | undefined,
): ChatGenerationOptions {
  const raw = (value ?? {}) as Record<string, unknown>;
  const temperature =
    raw.temperature === null
      ? undefined
      : (optionalFiniteNumber(raw.temperature, "temperature") ??
        SEMANTIC_JSON_GENERATION.temperature);
  // Null deliberately omits an unsupported control; undefined keeps the default.
  // Capability selection belongs to the runtime, not this provider-neutral owner.
  const topP =
    raw.topP === null
      ? undefined
      : (optionalFiniteNumber(raw.topP, "topP") ??
        SEMANTIC_JSON_GENERATION.topP);
  const maxTokens =
    optionalPositiveInteger(raw.maxTokens, "maxTokens") ??
    SEMANTIC_JSON_GENERATION.maxTokens;
  const reasoningEffort =
    raw.reasoningEffort === null || raw.reasoningEffort === undefined
      ? undefined
      : nonEmpty(raw.reasoningEffort, "reasoningEffort");
  const enableThinking =
    raw.enableThinking === null
      ? undefined
      : typeof raw.enableThinking === "boolean"
        ? raw.enableThinking
        : SEMANTIC_JSON_GENERATION.enableThinking;
  return {
    ...(temperature === undefined ? {} : { temperature }),
    ...(topP === undefined ? {} : { topP }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    ...(enableThinking === undefined ? {} : { enableThinking }),
    stream: false,
  };
}

function parsedSemanticInput(serializedInput: string): unknown {
  const serialized = nonEmpty(serializedInput, "Semantic JSON input");
  try {
    return JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new ChatError(
      "configuration",
      "Semantic JSON input must be strict JSON.",
      { cause: error },
    );
  }
}

export function serializeSemanticJsonRequest(
  operation: SemanticJsonOperation,
  serializedInput: string,
): string {
  return JSON.stringify({
    operation,
    input: parsedSemanticInput(serializedInput),
  });
}

function validCompletionContent(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ChatError(
      "invalid_response",
      "Semantic model returned an invalid completion.",
    );
  }
  const message = (value as { readonly message?: unknown }).message;
  if (
    typeof message !== "object" ||
    message === null ||
    Array.isArray(message)
  ) {
    throw new ChatError(
      "invalid_response",
      "Semantic model returned an invalid assistant message.",
    );
  }
  const raw = message as {
    readonly role?: unknown;
    readonly content?: unknown;
  };
  if (raw.role !== "assistant") {
    throw new ChatError(
      "invalid_response",
      "Semantic model completion must contain an assistant message.",
    );
  }
  if (typeof raw.content !== "string" || raw.content.trim().length === 0) {
    throw new ChatError(
      "invalid_response",
      "Semantic model assistant content must not be empty.",
    );
  }
  return raw.content.trim();
}

/**
 * Everything that can reasonably be read as the JSON the model was asked for.
 *
 * Two candidates, tried in order: the content verbatim, then the inside of a
 * markdown fence that wraps the whole of it.
 *
 * ADR 0012 rejected "accept Markdown fences or extract the first JSON
 * fragment", and the second half of that stays rejected for the reason it gave:
 * pulling a fragment out of prose lets injected text be reinterpreted as the
 * model's answer. A source document containing a JSON array, quoted back by a
 * model that is refusing, would be parsed as the extraction.
 *
 * A fence is a different thing and ADR 0023-era experience says so. The whole
 * content is one fenced block; nothing is selected from among alternatives, and
 * removing it either yields the exact payload or fails as before. See ADR 0012
 * D6.
 *
 * This is recovery, not repair. Nothing here fixes malformed JSON, guesses at a
 * missing bracket, or joins fragments.
 */
function jsonCandidates(content: string): readonly string[] {
  const candidates = [content];

  const fenced = /^```[A-Za-z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/u.exec(
    content,
  );
  if (fenced?.[1] !== undefined) {
    candidates.push(fenced[1].trim());
  }

  return candidates.filter(
    (candidate, index) =>
      candidate.length > 0 && candidates.indexOf(candidate) === index,
  );
}

const DIAGNOSTIC_EXCERPT_CHARACTERS = 200;

/**
 * Says what arrived, because "must be strict JSON" said nothing at all.
 *
 * The three causes need three different responses and the old message
 * distinguished none of them: a truncated answer needs a larger budget, a
 * fenced answer needs the recovery above, and a refusal or an explanation needs
 * the prompt looked at. `finishReason` already told them apart and was sitting
 * unread on the completion.
 *
 * The excerpt is the model's own output, bounded and flattened to one line. It
 * carries no credential — the semantic call sends none — and without it the
 * failure is unactionable from a log.
 */
function describeNonJsonResponse(completion: unknown, content: string): string {
  const finishReason = (completion as { readonly finishReason?: unknown })
    .finishReason;
  const excerpt = content
    .slice(0, DIAGNOSTIC_EXCERPT_CHARACTERS)
    .replace(/\s+/gu, " ")
    .trim();
  const truncated = content.length > DIAGNOSTIC_EXCERPT_CHARACTERS ? "…" : "";

  if (finishReason === "length") {
    return (
      "Semantic model answer was cut off by the output budget before the JSON " +
      `closed (${content.length} characters, finishReason=length). Raise ` +
      "A008_CHAT_MAX_TOKENS or lower the staging ceiling. " +
      `Received: ${excerpt}${truncated}`
    );
  }

  const reason =
    typeof finishReason === "string" ? `, finishReason=${finishReason}` : "";
  return (
    "Semantic model assistant content must be strict JSON " +
    `(${content.length} characters${reason}). ` +
    `Received: ${excerpt}${truncated}`
  );
}

function parseSemanticResponse(value: unknown): unknown {
  const content = validCompletionContent(value);
  let lastError: unknown;
  for (const candidate of jsonCandidates(content)) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }
  throw new ChatError(
    "invalid_response",
    describeNonJsonResponse(value, content),
    { cause: lastError },
  );
}

export class ChatTransportSemanticJsonGenerator implements SemanticJsonGenerator {
  readonly #transport: ChatTransport;
  readonly #model: string;
  readonly #budget: ChatInvocationBudget;
  readonly #generation: ChatGenerationOptions;

  constructor(options: ChatTransportSemanticJsonGeneratorOptions) {
    this.#transport = options.transport;
    this.#model = nonEmpty(options.model, "Semantic model");
    this.#budget = {
      ...options.budget,
      maximum: options.budget.maximum,
      measurer: options.budget.measurer,
    };
    this.#generation = generationOptions(options.generation);
  }

  async generate(input: SemanticJsonGenerateInput): Promise<unknown> {
    if (input.signal?.aborted === true) {
      throw new ChatError("cancelled", "Semantic model call was cancelled.");
    }
    const operation = input.operation;
    if (
      operation !== "knowledge_analysis" &&
      operation !== "relation_classification" &&
      operation !== "retrieval_scope"
    ) {
      throw new ChatError(
        "configuration",
        "Semantic JSON operation is not supported.",
      );
    }
    const userContent = serializeSemanticJsonRequest(
      operation,
      input.serializedInput,
    );
    const invocation: ComposedChatInvocation = composeChatInvocation(
      [],
      userContent,
      {
        systemMessages: [
          nonEmpty(input.systemInstruction, "Semantic system instruction"),
        ],
        providerUserContent: userContent,
        historyMessageLimit: 0,
        budget: this.#budget,
      },
    );
    const request: ChatRequest = {
      model: this.#model,
      messages: invocation.messages.map((message) => ({ ...message })),
      options: { ...this.#generation },
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    };
    const completion = await this.#transport.complete(request);
    try {
      return parseSemanticResponse(completion);
    } catch (error) {
      if (error instanceof ChatError && error.code === "invalid_response") {
        throw new ChatError(
          "invalid_response",
          `Semantic ${operation} (${this.#model}): ${error.message}`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}

export class ModelBackedPostOutputKnowledgeAnalyzer implements PostOutputKnowledgeAnalyzer {
  readonly #generator: SemanticJsonGenerator;

  constructor(generator: SemanticJsonGenerator) {
    this.#generator = generator;
  }

  async analyze(
    input: PostOutputAnalyzerInput,
    context: SemanticOperationContext = {},
  ): Promise<PostOutputKnowledgeAnalysis> {
    const untrusted = await this.#generator.generate({
      operation: "knowledge_analysis",
      systemInstruction:
        input.kind === "source"
          ? POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION
          : KNOWLEDGE_EXTRACTOR_INSTRUCTION,
      // Source extraction remains source-only. Dialogue extraction receives
      // exactly the knowledge projection used by the worker plus the user
      // message and final provider response; it never performs a second read.
      serializedInput:
        input.kind === "source"
          ? JSON.stringify({ locator: input.locator, content: input.content })
          : JSON.stringify({
              retrievedContext: {
                items: input.retrievedContext.items.map((item) => ({
                  ...item,
                  tags: [...item.tags],
                  ...(item.domains === undefined
                    ? {}
                    : { domains: [...item.domains] }),
                  scope: [...item.scope],
                })),
              },
              userMessage: input.userMessage,
              responseText: input.responseText,
            }),
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
    return untrusted as PostOutputKnowledgeAnalysis;
  }
}

export class ModelBackedKnowledgeRelationClassifier implements KnowledgeRelationClassifier {
  readonly #generator: SemanticJsonGenerator;

  constructor(generator: SemanticJsonGenerator) {
    this.#generator = generator;
  }

  async classify(
    input: RelationClassifierInput,
    context: SemanticOperationContext = {},
  ): Promise<RelationClassifierDecision> {
    const untrusted = await this.#generator.generate({
      operation: "relation_classification",
      systemInstruction: KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION,
      serializedInput: serializeRelationClassifierInput(input),
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
    return untrusted as RelationClassifierDecision;
  }

  async classifyBatch(
    input: RelationClassifierBatchInput,
    context: SemanticOperationContext = {},
  ): Promise<readonly RelationClassifierBatchDecision[]> {
    const untrusted = await this.#generator.generate({
      operation: "relation_classification",
      systemInstruction: KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION,
      serializedInput: serializeRelationClassifierBatchInput(input),
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
    if (Array.isArray(untrusted)) {
      return untrusted as readonly RelationClassifierBatchDecision[];
    }
    // Backward-compatible one-item adapter for existing semantic fixtures and
    // embedders. A real multi-proposal batch must still return the batch array;
    // we never fan it back out into N provider calls.
    if (
      input.items.length === 1 &&
      typeof untrusted === "object" &&
      untrusted !== null
    ) {
      return [
        {
          ...(untrusted as RelationClassifierDecision),
          proposalHandle: input.items[0]!.proposalHandle,
        },
      ];
    }
    return untrusted as readonly RelationClassifierBatchDecision[];
  }
}

/**
 * Places a user message in subject areas, before anything is retrieved.
 *
 * Two things it must do that a naive prompt does not.
 *
 * It must return **related** domains and tags, not only the ones the message
 * literally contains. "Hur fungerar människans minne?" names no domain at all;
 * the point of the call is that it comes back as neuroscience, cognitive
 * science and psychology so that stored knowledge under those can be found.
 *
 * And it must prefer the vocabulary the store already holds. Observed in the
 * owner's own trace: the retrieval step answered in English and the extraction
 * step in Swedish, and those two sets never intersect no matter how they are
 * normalised. Offering the existing labels makes the model select from them
 * rather than invent a parallel taxonomy in whichever language the question
 * happened to use — while still allowing a genuinely new subject to be named.
 */
import { RETRIEVAL_SCOPE_INSTRUCTION } from "../prompt-contracts/RETRIEVAL_SCOPE_INSTRUCTION.js";
export { RETRIEVAL_SCOPE_INSTRUCTION };

export interface RetrievalScopeRequest {
  readonly message: string;
  readonly knownDomains: readonly string[];
  readonly knownTags: readonly string[];
}

export interface RetrievalScopeDraft {
  readonly retrieve?: boolean;
  readonly domains?: readonly string[];
  readonly relatedDomains?: readonly string[];
  readonly tags?: readonly string[];
  readonly relatedTags?: readonly string[];
}

export interface RetrievalScopeClassifier {
  classify(
    request: RetrievalScopeRequest,
    context?: SemanticOperationContext,
  ): Promise<RetrievalScopeDraft>;
}

/** How much stored vocabulary is offered to the classifier. */
export const MAXIMUM_OFFERED_VOCABULARY = 200;

export class ModelBackedRetrievalScopeClassifier implements RetrievalScopeClassifier {
  readonly #generator: SemanticJsonGenerator;
  readonly #maximumVocabulary: number;

  constructor(
    generator: SemanticJsonGenerator,
    options: { readonly maximumVocabulary?: number } = {},
  ) {
    this.#generator = generator;
    this.#maximumVocabulary =
      options.maximumVocabulary ?? MAXIMUM_OFFERED_VOCABULARY;
  }

  async classify(
    request: RetrievalScopeRequest,
    context: SemanticOperationContext = {},
  ): Promise<RetrievalScopeDraft> {
    const untrusted = await this.#generator.generate({
      operation: "retrieval_scope",
      systemInstruction: RETRIEVAL_SCOPE_INSTRUCTION,
      serializedInput: JSON.stringify({
        message: request.message,
        // Bounded because the vocabulary grows without limit and this is a
        // prompt, not a database dump. Domains are the smaller and more
        // load-bearing axis, so they are offered whole for far longer than tags.
        knownDomains: request.knownDomains.slice(0, this.#maximumVocabulary),
        knownTags: request.knownTags.slice(0, this.#maximumVocabulary),
      }),
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
    return untrusted as RetrievalScopeDraft;
  }
}
