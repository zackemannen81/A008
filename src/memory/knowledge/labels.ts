import { KnowledgeModelError } from "./errors.js";

/**
 * Tags and domains, stored against the record they describe.
 *
 * The analyzer has always produced these. Staging carried them and the relation
 * classifier read them, and then `live-commit` wrote a claim, an entity and a
 * binding and dropped both fields on the floor. Nothing downstream could match
 * on them because nothing upstream kept them.
 *
 * They live beside the record rather than inside `Claim` and `Utterance`, the
 * same way `EvidenceLifecycleStore` keeps strength and state beside evidence.
 * Two reasons. A label set is not part of what a claim asserts — it is how the
 * claim is found — and the two axes attach to different record kinds without
 * either type growing a field the other does not use.
 *
 * The distinction between the two axes is load-bearing and not a matter of
 * taste:
 *
 * - **domains** are broad reusable subject areas. They are what accumulates
 *   into the discussion-level scope across turns.
 * - **tags** are short reusable concepts. They match a single message and are
 *   deliberately never accumulated, because a common tag would become a match
 *   for everything — the same failure as a lexical token used as an entity
 *   alias.
 */

export type LabelRecordKind = "claim" | "utterance";

export interface KnowledgeLabels {
  readonly tags: readonly string[];
  readonly domains: readonly string[];
}

export interface LabelRecord extends KnowledgeLabels {
  readonly recordId: string;
  readonly recordKind: LabelRecordKind;
}

export interface AttachLabelsInput {
  readonly recordId: string;
  readonly recordKind: LabelRecordKind;
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
}

export interface LabelQuery {
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
}

export const EMPTY_LABELS: KnowledgeLabels = Object.freeze({
  tags: Object.freeze([]) as readonly string[],
  domains: Object.freeze([]) as readonly string[],
});

/**
 * The one normalisation, applied on both sides of every comparison.
 *
 * Labels are written by a model, and `Cognitive Science`, `cognitive science`
 * and `Cognitive  Science` are the same subject area written three ways. Left
 * unnormalised they are three different set members, and a set intersection
 * that misses for a capital letter is worse than no intersection at all — it
 * reads as a topic change.
 */
export function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");
}

function normalizedSet(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  if (values === undefined) {
    return [];
  }
  if (!Array.isArray(values)) {
    throw new KnowledgeModelError("invalid_input", `${field} must be an array`);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      throw new KnowledgeModelError(
        "invalid_input",
        `${field} entries must be strings`,
      );
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
 * Labels attached to claims and utterances, and the index that finds them.
 *
 * `attach` is idempotent per record and merges rather than replaces: a claim
 * reinforced by a second utterance keeps the labels it already had and gains
 * whichever are new. Losing a label because a later extraction phrased the
 * subject differently would silently narrow what the record can be found by.
 */
export class KnowledgeLabelStore {
  readonly #records = new Map<string, LabelRecord>();
  readonly #byTag = new Map<string, Set<string>>();
  readonly #byDomain = new Map<string, Set<string>>();

  attach(input: AttachLabelsInput): LabelRecord {
    const recordId = input.recordId.trim();
    if (recordId.length === 0) {
      throw new KnowledgeModelError(
        "invalid_input",
        "recordId must not be empty",
      );
    }
    if (input.recordKind !== "claim" && input.recordKind !== "utterance") {
      throw new KnowledgeModelError(
        "invalid_input",
        `recordKind must be claim or utterance, not ${String(input.recordKind)}`,
      );
    }

    const existing = this.#records.get(recordId);
    const tags = merge(existing?.tags, normalizedSet(input.tags, "tags"));
    const domains = merge(
      existing?.domains,
      normalizedSet(input.domains, "domains"),
    );
    const stored: LabelRecord = {
      recordId,
      recordKind: input.recordKind,
      tags,
      domains,
    };
    this.#records.set(recordId, stored);
    index(this.#byTag, tags, recordId);
    index(this.#byDomain, domains, recordId);
    return clone(stored);
  }

  get(recordId: string): LabelRecord | undefined {
    const found = this.#records.get(recordId);
    return found === undefined ? undefined : clone(found);
  }

  /** Never `undefined`, so a caller cannot forget the unlabelled case. */
  labelsFor(recordId: string): KnowledgeLabels {
    const found = this.#records.get(recordId);
    if (found === undefined) {
      return EMPTY_LABELS;
    }
    return { tags: [...found.tags], domains: [...found.domains] };
  }

  list(): readonly LabelRecord[] {
    return [...this.#records.values()].map(clone);
  }

  /** Replaces everything, for loading a persisted namespace. */
  hydrate(records: readonly LabelRecord[]): void {
    this.#records.clear();
    this.#byTag.clear();
    this.#byDomain.clear();
    for (const record of records) {
      this.attach(record);
    }
  }

  /** Distinct labels currently in the store, for seeding a classifier. */
  vocabulary(): KnowledgeLabels {
    return {
      tags: [...this.#byTag.keys()].sort(),
      domains: [...this.#byDomain.keys()].sort(),
    };
  }

  /**
   * Record ids matching any tag or any domain.
   *
   * Union, not intersection. A record is relevant if it shares a tag *or* a
   * domain; requiring both would make the broader signal useless exactly when
   * it is needed, which is when the message does not name the record's tags.
   */
  matching(query: LabelQuery): readonly string[] {
    const found = new Set<string>();
    for (const tag of normalizedSet(query.tags, "query tags")) {
      for (const id of this.#byTag.get(tag) ?? []) {
        found.add(id);
      }
    }
    for (const domain of normalizedSet(query.domains, "query domains")) {
      for (const id of this.#byDomain.get(domain) ?? []) {
        found.add(id);
      }
    }
    return [...found];
  }
}

function merge(
  existing: readonly string[] | undefined,
  incoming: readonly string[],
): readonly string[] {
  if (existing === undefined || existing.length === 0) {
    return incoming;
  }
  const result = [...existing];
  for (const value of incoming) {
    if (!result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

function index(
  target: Map<string, Set<string>>,
  values: readonly string[],
  recordId: string,
): void {
  for (const value of values) {
    const bucket = target.get(value);
    if (bucket === undefined) {
      target.set(value, new Set([recordId]));
      continue;
    }
    bucket.add(recordId);
  }
}

function clone(record: LabelRecord): LabelRecord {
  return {
    recordId: record.recordId,
    recordKind: record.recordKind,
    tags: [...record.tags],
    domains: [...record.domains],
  };
}
