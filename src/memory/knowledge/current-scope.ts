import { normalizeLabel } from "./labels.js";

/**
 * The subject area of the ongoing discussion, accumulated across turns.
 *
 * Not a label a model invents and not a name for the conversation: a set of
 * domains that grows while the discussion stays in one area and is replaced
 * when it leaves. It is what lets a record about the hippocampus come back ten
 * turns later for "and what happens when we sleep after learning something",
 * where that turn's own tags name nothing about it.
 *
 * **Domains only, never tags.** The owner is explicit about this and the reason
 * is worth keeping: tags are fine-grained, and accumulating them into the
 * discussion-level signal would repeat the `heter` failure one level up, where
 * a single common label becomes a match for everything in the store.
 *
 * The whole point is topic continuity without carrying fifty old chat messages
 * in the prompt.
 */

export interface ScopeClassification {
  readonly domains: readonly string[];
  readonly relatedDomains: readonly string[];
}

export type ScopeOutcome = "started" | "widened" | "unchanged" | "replaced";

export interface ScopeUpdate {
  readonly scope: readonly string[];
  readonly outcome: ScopeOutcome;
  /** Domains dropped by the ceiling, least recently reinforced first. */
  readonly evicted: readonly string[];
}

/**
 * Ceiling on how many domains one discussion accumulates.
 *
 * This is not in the owner's specification and is added deliberately, with the
 * reason recorded rather than buried. The reset fires only on an *empty*
 * intersection, so a conversation that moves one step at a time — memory, sleep,
 * circadian rhythm, endocrinology, chemistry, materials, engineering — overlaps
 * at every consecutive pair and never resets. After forty turns the scope holds
 * forty domains and matches essentially the whole store.
 *
 * That is a silent degradation, which is the failure mode this project keeps
 * finding: excellent for five turns, quietly useless at fifty, and it looks like
 * retrieval got worse rather than like a rule doing what it was told.
 *
 * The ceiling is generous on purpose. Below it the owner's rule applies
 * unchanged, so a normal discussion behaves exactly as specified; it only bites
 * where the scope has already stopped discriminating. Eviction is
 * least-recently-reinforced, so the domains the discussion keeps returning to
 * are the ones that survive, and whatever it drops is reported.
 */
export const DEFAULT_MAXIMUM_SCOPE_DOMAINS = 32;

export interface AdvanceScopeOptions {
  readonly maximumDomains?: number;
}

/**
 * Applies one message's classification to the discussion scope.
 *
 * ```text
 * candidate = domains ∪ related_domains
 * current empty            → current = candidate           (started)
 * candidate ∩ current = ∅  → current = candidate           (replaced: new topic)
 * otherwise                → current = current ∪ candidate (widened)
 * ```
 *
 * A **related** domain overlapping is enough to hold the discussion in scope;
 * the primary domain does not have to match. That is deliberate and is what
 * makes the mechanism work: a message classified primarily as Learning Science
 * continues a Neuroscience discussion when Cognitive Science is among its
 * related domains.
 *
 * Order is preserved — existing domains keep their positions and new ones are
 * appended — so the scope is stable across identical reads and an eviction is
 * reproducible.
 */
export function advanceScope(
  current: readonly string[],
  classification: ScopeClassification,
  options: AdvanceScopeOptions = {},
): ScopeUpdate {
  const maximum = options.maximumDomains ?? DEFAULT_MAXIMUM_SCOPE_DOMAINS;
  const existing = normalizedSet(current);
  const candidate = normalizedSet([
    ...classification.domains,
    ...classification.relatedDomains,
  ]);

  if (candidate.length === 0) {
    // A message the classifier could place nowhere says nothing about the
    // topic. It must not empty the scope, and it must not count as a change of
    // subject either — silence is not a new topic.
    return { scope: existing, outcome: "unchanged", evicted: [] };
  }
  if (existing.length === 0) {
    return capped(candidate, "started", maximum);
  }

  const overlaps = candidate.some((domain) => existing.includes(domain));
  if (!overlaps) {
    return capped(candidate, "replaced", maximum);
  }

  // Reinforcement is what recency means here: a domain named again by this
  // message moves to the end of the list, so eviction drops what the discussion
  // has stopped returning to rather than what it merely mentioned first.
  const reinforced = existing.filter((domain) => !candidate.includes(domain));
  const widened = [...reinforced, ...candidate];
  const outcome: ScopeOutcome =
    widened.length === existing.length &&
    existing.every((domain) => widened.includes(domain))
      ? "unchanged"
      : "widened";
  return capped(widened, outcome, maximum);
}

function capped(
  scope: readonly string[],
  outcome: ScopeOutcome,
  maximum: number,
): ScopeUpdate {
  if (maximum < 1) {
    throw new RangeError("maximumDomains must be at least 1");
  }
  if (scope.length <= maximum) {
    return { scope, outcome, evicted: [] };
  }
  const overflow = scope.length - maximum;
  return {
    scope: scope.slice(overflow),
    outcome,
    evicted: scope.slice(0, overflow),
  };
}

function normalizedSet(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = normalizeLabel(value);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * One accumulating scope per conversation.
 *
 * Conversation state, not turn state, and in-session only: a restart starts a
 * fresh scope. For a memory system that is a slightly awkward place to land and
 * it is called out rather than left to be discovered — persisting it is a small
 * addition and deliberately not made here, because where conversation state
 * belongs is a decision of its own.
 */
export class ConversationScopes {
  readonly #byConversation = new Map<string, readonly string[]>();
  readonly #maximumDomains: number;

  constructor(options: AdvanceScopeOptions = {}) {
    this.#maximumDomains =
      options.maximumDomains ?? DEFAULT_MAXIMUM_SCOPE_DOMAINS;
  }

  current(conversationId: string): readonly string[] {
    return [...(this.#byConversation.get(conversationId) ?? [])];
  }

  advance(
    conversationId: string,
    classification: ScopeClassification,
    options: AdvanceScopeOptions = {},
  ): ScopeUpdate {
    const update = advanceScope(
      this.#byConversation.get(conversationId) ?? [],
      classification,
      { maximumDomains: options.maximumDomains ?? this.#maximumDomains },
    );
    this.#byConversation.set(conversationId, update.scope);
    return update;
  }

  forget(conversationId: string): void {
    this.#byConversation.delete(conversationId);
  }
}
