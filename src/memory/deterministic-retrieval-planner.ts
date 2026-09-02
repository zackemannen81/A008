import { MemoryError } from "./errors.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import type {
  DialogueTurn,
  MemoryReadRequest,
  RetrievalIntent,
  RetrievalPlan,
  RetrievalPlanner,
  WeightedRetrievalLabel,
} from "./retrieval-types.js";

export interface DeterministicRetrievalPlannerOptions {
  readonly knownTags?: readonly string[];
  readonly knownDomains?: readonly string[];
  readonly maxTerms?: number;
  readonly maxEntities?: number;
  readonly maxRecentTurns?: number;
  readonly maxTurnCharacters?: number;
  readonly maxSemanticQueries?: number;
}

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
const QUOTED_PATTERN = /["“”'`]([^"“”'`]{2,80})["“”'`]/gu;
const NON_ENTITY_LEAD_WORDS = new Set([
  "how",
  "hur",
  "när",
  "vad",
  "var",
  "varför",
  "vem",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
]);

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new MemoryError("invalid_input", `${field} must not be empty`);
  }
  return normalized;
}

function uniqueNormalized(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toLocaleLowerCase("und"))
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function boundedTurns(
  turns: readonly DialogueTurn[],
  maximumTurns: number,
  maximumCharacters: number,
): DialogueTurn[] {
  return turns.slice(-maximumTurns).map((turn) => {
    if (turn.role !== "user" && turn.role !== "assistant") {
      throw new MemoryError(
        "invalid_input",
        "recent turn role must be user or assistant",
      );
    }
    return {
      role: turn.role,
      content: requireNonEmpty(turn.content, "recent turn content").slice(
        0,
        maximumCharacters,
      ),
    };
  });
}

function extractTerms(message: string, maximum: number): string[] {
  return uniqueNormalized(message.match(WORD_PATTERN) ?? [])
    .filter((term) => term.length >= 2)
    .slice(0, maximum);
}

function extractEntities(message: string, maximum: number): string[] {
  const quoted = [...message.matchAll(QUOTED_PATTERN)].map(
    (match) => match[1] ?? "",
  );
  const capitalized = [
    ...message.matchAll(/(?:^|[.!?]\s+)([\p{Lu}][\p{L}\p{N}_-]{2,})/gu),
  ].map((match) => match[1] ?? "");
  return uniqueNormalized([...quoted, ...capitalized])
    .filter((value) => !NON_ENTITY_LEAD_WORDS.has(value))
    .slice(0, maximum);
}

function classifyIntents(message: string): RetrievalIntent[] {
  const lower = message.toLocaleLowerCase("und");
  const intents = new Set<RetrievalIntent>();
  if (message.includes("?") || /^(vad|vem|var|när|hur|varför|which|what|who|where|when|how|why)\b/u.test(lower)) {
    intents.add("question");
  }
  if (/\b(nej|istället|rättelse|korrigera|actually|instead|correction)\b/u.test(lower)) {
    intents.add("correction");
  }
  if (/\b(fortsätt|fortsatta|continue|same|samma|den|det|that|it)\b/u.test(lower)) {
    intents.add("continuation");
  }
  if (/^(gör|bygg|skapa|ändra|lägg|ta|implementera|do|build|create|change|add|remove|implement)\b/u.test(lower)) {
    intents.add("instruction");
  }
  if (intents.size === 0) {
    intents.add("statement");
  }
  return [...intents].sort((left, right) => left.localeCompare(right));
}

function matchTaxonomy(
  normalizedMessage: string,
  values: readonly string[],
): WeightedRetrievalLabel[] {
  return uniqueNormalized(values)
    .filter((value) => normalizedMessage.includes(value))
    .map((value) => ({ value, weight: 1 }));
}

export class DeterministicRetrievalPlanner implements RetrievalPlanner {
  private readonly knownTags: readonly string[];
  private readonly knownDomains: readonly string[];
  private readonly maxTerms: number;
  private readonly maxEntities: number;
  private readonly maxRecentTurns: number;
  private readonly maxTurnCharacters: number;
  private readonly maxSemanticQueries: number;

  constructor(options: DeterministicRetrievalPlannerOptions = {}) {
    this.knownTags = uniqueNormalized(options.knownTags ?? []);
    this.knownDomains = uniqueNormalized(options.knownDomains ?? []);
    this.maxTerms = requirePositiveInteger(options.maxTerms ?? 16, "maxTerms");
    this.maxEntities = requirePositiveInteger(
      options.maxEntities ?? 8,
      "maxEntities",
    );
    this.maxRecentTurns = requirePositiveInteger(
      options.maxRecentTurns ?? 2,
      "maxRecentTurns",
    );
    this.maxTurnCharacters = requirePositiveInteger(
      options.maxTurnCharacters ?? 1_000,
      "maxTurnCharacters",
    );
    this.maxSemanticQueries = requirePositiveInteger(
      options.maxSemanticQueries ?? 3,
      "maxSemanticQueries",
    );
    if (this.maxRecentTurns > 2) {
      throw new MemoryError("invalid_input", "maxRecentTurns cannot exceed 2");
    }
    if (this.maxSemanticQueries > 3) {
      throw new MemoryError(
        "invalid_input",
        "maxSemanticQueries cannot exceed 3",
      );
    }
  }

  plan(request: MemoryReadRequest): RetrievalPlan {
    const projectId = parseRuntimeId(request.projectId, "project");
    const conversationId = parseRuntimeId(
      request.conversationId,
      "conversation",
    );
    const taskId = parseRuntimeId(request.taskId, "task");
    const agentId = parseRuntimeId(request.agentId, "agent");
    const message = requireNonEmpty(request.message, "message");
    const scopes = uniqueNormalized(request.applicabilityScopes);
    const recent = boundedTurns(
      request.recentTurns ?? [],
      this.maxRecentTurns,
      this.maxTurnCharacters,
    );
    const normalizedMessage = message.toLocaleLowerCase("und");
    const previousUser = [...recent]
      .reverse()
      .find((turn) => turn.role === "user")?.content;
    const previousAssistant = [...recent]
      .reverse()
      .find((turn) => turn.role === "assistant")?.content;
    const semanticQueries = [
      message,
      previousUser ? `${previousUser}\n${message}` : "",
      previousAssistant ? `${previousAssistant}\n${message}` : "",
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, this.maxSemanticQueries);

    const lower = normalizedMessage;
    const intents = classifyIntents(message);
    const signalCount =
      intents.length +
      matchTaxonomy(lower, this.knownTags).length +
      matchTaxonomy(lower, this.knownDomains).length;
    return {
      projectId,
      conversationId,
      taskId,
      agentId,
      queryText: message,
      intents,
      domains: matchTaxonomy(lower, this.knownDomains),
      tags: matchTaxonomy(lower, this.knownTags),
      entities: extractEntities(message, this.maxEntities),
      terms: extractTerms(message, this.maxTerms),
      semanticQueries,
      temporalHints: {
        currentOnly: /\b(nu|aktuell|current|now|latest|senaste)\b/u.test(lower),
        mentionsPast: /\b(tidigare|förut|histor|past|previous|before)\b/u.test(lower),
        mentionsFuture: /\b(senare|framtid|future|later|next)\b/u.test(lower),
      },
      applicabilityScopes: scopes,
      confidence: Math.min(1, 0.5 + signalCount * 0.1),
    };
  }
}
