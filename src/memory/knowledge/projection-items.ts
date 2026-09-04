import { serializeContextProjection } from "../serialization.js";
import type {
  ContextKnowledgeItem,
  SerializedContextMeasurer,
} from "../types.js";
import type { ProjectionPayload } from "./evidence-types.js";
import type { RetrievedSurface } from "./read-types.js";

/**
 * Turns a knowledge projection into provider context items.
 *
 * The rule this module exists to enforce: **retrieval is additive, not
 * exclusive.** Every surface that matched stays eligible. A state binding does
 * not suppress a claim, a claim does not suppress an utterance, and none of
 * them suppress events, history, artifacts or provenance.
 *
 * That has to be said out loud because the opposite was the behaviour for ten
 * tasks. The previous implementation pushed state, returned if it had any, then
 * pushed claims, returned if it had any, then pushed utterances — and never
 * read the other four surfaces at all. A single current-state hit was enough to
 * hide everything else the store had found, which is how a question about the
 * agent's own name came back carrying only a fact about a horse.
 *
 * Ranking, deduplication and the budget may still drop individual records. What
 * they may not do is drop a record because of the surface it happens to live
 * on.
 */

/**
 * Rank weight per surface, and nothing more.
 *
 * This orders items inside one projection; it is not a truth score and it is
 * not a filter. State outranks a claim because current truth is more useful
 * than an attributed assertion about it, and both outrank the raw utterance
 * they were derived from. The three values that existed before — state 1,
 * claim 0.4, utterance 0.2 — are unchanged, so the four surfaces added here
 * slot in around them without reordering anything that already worked.
 */
export const SURFACE_AUTHORITY: Readonly<Record<RetrievedSurface, number>> =
  Object.freeze({
    state: 1,
    claim: 0.4,
    event: 0.35,
    history: 0.3,
    utterance: 0.2,
    artifact: 0.15,
    provenance: 0.1,
  });

/**
 * Default ceiling on the serialized projection.
 *
 * Going additive multiplies how much can reach one turn, so a bound is needed;
 * without one the fix trades a silent omission for a silent overflow. It is a
 * byte budget rather than an item count because bytes are what the provider
 * charges for and what a long utterance actually costs.
 *
 * Anything dropped by it is reported in `omitted`, never discarded quietly.
 */
export const DEFAULT_PROJECTION_BUDGET_BYTES = 32_768;

export interface ProjectionItemsInput {
  readonly taskId: string;
  readonly payload: ProjectionPayload;
  readonly measurer: SerializedContextMeasurer;
  readonly maximumBytes?: number;
}

export interface ProjectionItemsResult {
  readonly items: readonly ContextKnowledgeItem[];
  /** Ranked out by the budget. Present so a caller can say what was cut. */
  readonly omitted: readonly ContextKnowledgeItem[];
  /** Dropped as a duplicate of a higher-ranked item carrying the same words. */
  readonly deduplicated: readonly ContextKnowledgeItem[];
}

export function projectionItems(
  input: ProjectionItemsInput,
): ProjectionItemsResult {
  const candidates = collect(input.payload);
  const { kept, deduplicated } = deduplicate(candidates);
  const ranked = rank(kept);
  return applyBudget(
    ranked,
    deduplicated,
    input.taskId,
    input.measurer,
    input.maximumBytes ?? DEFAULT_PROJECTION_BUDGET_BYTES,
  );
}

function collect(payload: ProjectionPayload): ContextKnowledgeItem[] {
  const tags = [...payload.scope.tags];
  const scope = [...payload.scope.entities];
  const item = (
    surface: RetrievedSurface,
    index: number,
    proposition: string,
  ): ContextKnowledgeItem => ({
    id: `${surface}:${index}`,
    proposition,
    kind: surface,
    tags,
    scope,
    authority: SURFACE_AUTHORITY[surface],
  });

  const items: ContextKnowledgeItem[] = [];
  for (const [index, entry] of payload.state.entries()) {
    items.push(item("state", index, propositionOf(entry.value, entry.slot)));
  }
  for (const [index, entry] of payload.claims.entries()) {
    items.push(item("claim", index, entry.label));
  }
  for (const [index, entry] of payload.events.entries()) {
    items.push(item("event", index, entry.label));
  }
  for (const [index, entry] of payload.history.entries()) {
    items.push(item("history", index, propositionOf(entry.value, entry.slot)));
  }
  for (const [index, entry] of payload.utterances.entries()) {
    items.push(item("utterance", index, entry.content));
  }
  for (const [index, entry] of payload.artifacts.entries()) {
    items.push(item("artifact", index, entry.locator));
  }
  for (const [index, entry] of payload.provenance.entries()) {
    items.push(
      item(
        "provenance",
        index,
        `${entry.from.label} --${entry.relation}--> ${entry.to.label}`,
      ),
    );
  }
  return items.filter((candidate) => candidate.proposition.trim().length > 0);
}

/**
 * Drops repeats of the same words, keeping the highest-ranked carrier.
 *
 * The same fact legitimately exists on several surfaces at once: a binding, the
 * claim that established it and the utterance the claim came from all say it.
 * Sending three copies spends budget on one fact and reads to a model as
 * emphasis. Deduplication is across surfaces on purpose — it is the one place
 * where a surface *may* lose to another, and it loses only when it adds nothing.
 */
function deduplicate(candidates: readonly ContextKnowledgeItem[]): {
  readonly kept: ContextKnowledgeItem[];
  readonly deduplicated: ContextKnowledgeItem[];
} {
  const best = new Map<string, ContextKnowledgeItem>();
  const deduplicated: ContextKnowledgeItem[] = [];
  for (const candidate of candidates) {
    const key = candidate.proposition.trim().toLocaleLowerCase("und");
    const existing = best.get(key);
    if (existing === undefined) {
      best.set(key, candidate);
      continue;
    }
    if (candidate.authority > existing.authority) {
      best.set(key, candidate);
      deduplicated.push(existing);
      continue;
    }
    deduplicated.push(candidate);
  }
  return { kept: [...best.values()], deduplicated };
}

/**
 * Authority first, insertion order second.
 *
 * The tiebreak matters: `collect` walks the payload in a fixed surface order
 * and each surface in store order, so an equal-authority pair ranks the same
 * way on every run. A projection that reorders between identical reads would
 * make a failure impossible to reproduce.
 */
function rank(items: readonly ContextKnowledgeItem[]): ContextKnowledgeItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      right.item.authority === left.item.authority
        ? left.index - right.index
        : right.item.authority - left.item.authority,
    )
    .map((entry) => entry.item);
}

function applyBudget(
  ranked: readonly ContextKnowledgeItem[],
  deduplicated: readonly ContextKnowledgeItem[],
  taskId: string,
  measurer: SerializedContextMeasurer,
  maximumBytes: number,
): ProjectionItemsResult {
  const items: ContextKnowledgeItem[] = [];
  const omitted: ContextKnowledgeItem[] = [];
  for (const candidate of ranked) {
    const measured = measurer.measure(
      serializeContextProjection({ taskId, items: [...items, candidate] }),
    );
    // `items.length > 0` on purpose: one item larger than the whole budget is
    // still sent. An empty projection is not a smaller answer, it is no memory
    // at all, and silently returning that is the failure this module exists to
    // stop.
    if (items.length > 0 && measured > maximumBytes) {
      // Every later candidate ranks no higher, but a short one can still fit
      // where a long one did not, so the loop continues rather than breaking.
      omitted.push(candidate);
      continue;
    }
    items.push(candidate);
  }
  return { items, omitted, deduplicated };
}

function propositionOf(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
