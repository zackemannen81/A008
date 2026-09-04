import type {
  ExpandResult,
  FilterResult,
  OmittedRecord,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";

const TAG_MISS = "label_miss";
const NOT_APPLICABLE = "not_applicable";

export interface FilterInput {
  readonly expanded: ExpandResult;
  readonly scope: SemanticScope;
  readonly taskTags?: readonly string[];
}

export function filter(input: FilterInput): FilterResult {
  const admitted: RetrievedRecord[] = [];
  const omitted: OmittedRecord[] = [...input.expanded.omitted];
  const taskTags = uniqueLower(input.taskTags ?? input.scope.tags);

  for (const record of input.expanded.records) {
    if (record.matchKind === "direct" || record.required) {
      admitted.push(record);
      continue;
    }
    if (!labelsApply(record, taskTags, input.scope.domains)) {
      omitted.push({ record, reason: TAG_MISS });
      continue;
    }
    if (!taskApplies(record, input.scope)) {
      omitted.push({ record, reason: NOT_APPLICABLE });
      continue;
    }
    admitted.push(record);
  }

  return { admitted, omitted };
}

/**
 * Admits an associative record whose labels overlap the query on either axis.
 *
 * Three things this must not do, each of which it used to do or would start
 * doing if written carelessly.
 *
 * It must not compare the query with itself. Before A008-0060 `record.tags` was
 * a copy of `scope.tags`, so the intersection was always non-empty and this gate
 * admitted everything while appearing to filter.
 *
 * It must not require both axes. Tag and domain are alternative routes to the
 * same record — a domain match is precisely the case where the message does not
 * name the record's tags — so requiring both would disable the broader signal
 * exactly when it is needed.
 *
 * It must not treat unlabelled as unmatched. Every record written before labels
 * existed has neither, and dropping those would make an upgrade look like
 * amnesia.
 */
function labelsApply(
  record: RetrievedRecord,
  taskTags: readonly string[],
  domains: readonly string[],
): boolean {
  if (record.matchKind === "direct" || record.required) {
    return true;
  }
  const hasQuery = taskTags.length > 0 || domains.length > 0;
  const hasRecord = record.tags.length > 0 || record.domains.length > 0;
  if (!hasQuery || !hasRecord) {
    return true;
  }
  const recordTags = uniqueLower(record.tags);
  const recordDomains = uniqueLower(record.domains);
  return (
    taskTags.some((tag) => recordTags.includes(tag)) ||
    uniqueLower(domains).some((domain) => recordDomains.includes(domain))
  );
}

function taskApplies(record: RetrievedRecord, scope: SemanticScope): boolean {
  if (record.matchKind === "direct" || record.required) {
    return true;
  }
  // A record found by its subject area has already justified itself. Requiring
  // it to also mention one of the message's entities would undo the label
  // channel entirely: a domain match is by definition the case where the
  // message does not name the record. Two gates in series, each reasonable
  // alone, is how the projection came to discard everything but state.
  if (record.reasons.some((reason) => reason.startsWith("label_"))) {
    return true;
  }
  if (scope.entities.length === 0) {
    return true;
  }
  const haystack = normalizeAll([
    record.label,
    record.speaker ?? "",
    record.attributedTo ?? "",
    record.content ?? "",
    record.who ?? "",
    record.slotLabel ?? "",
  ]);
  return scope.entities.some((entity) => haystack.includes(entity.toLocaleLowerCase("sv-SE")));
}

function uniqueLower(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const lower = value.trim().toLocaleLowerCase("sv-SE");
    if (lower.length === 0 || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    result.push(lower);
  }
  return result;
}

function normalizeAll(values: readonly string[]): string {
  return values
    .map((value) => value.toLocaleLowerCase("sv-SE"))
    .join(" ");
}
