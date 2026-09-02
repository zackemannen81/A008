import type {
  ExpandResult,
  FilterResult,
  OmittedRecord,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";

const TAG_MISS = "tag_miss";
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
    if (!tagsApply(record, taskTags)) {
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

function tagsApply(record: RetrievedRecord, taskTags: readonly string[]): boolean {
  if (record.matchKind === "direct" || record.required) {
    return true;
  }
  if (taskTags.length === 0 || record.tags.length === 0) {
    return true;
  }
  const recordTags = uniqueLower(record.tags);
  return taskTags.some((tag) => recordTags.includes(tag));
}

function taskApplies(record: RetrievedRecord, scope: SemanticScope): boolean {
  if (record.matchKind === "direct" || record.required) {
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
