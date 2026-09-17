import { define, type DefineInput } from "./define.js";
import { EvidenceStore } from "./evidence.js";
import { ClaimEntityReferenceStore } from "./entity-references.js";
import { RelationIndex } from "./expand.js";
import { expand } from "./expand.js";
import { compose } from "./compose.js";
import { filter } from "./filter.js";
import { KnowledgeLabelStore } from "./labels.js";
import { EvidenceLifecycleStore } from "./lifecycle.js";
import { EntityRegistry, SlotRegistry } from "./registry.js";
import { project, type ProjectBudget, type ProjectResult } from "./project.js";
import type {
  ExpandResult,
  FilterResult,
  KnowledgeReadContext,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";
import { retrieve } from "./retrieve.js";
import { KnowledgeState } from "./state.js";

export interface ReadInput extends DefineInput {
  readonly applicabilityScopes?: readonly string[];
  readonly budget?: ProjectBudget;
  readonly taskTags?: readonly string[];
}

export interface ReadResult {
  readonly scope: SemanticScope;
  readonly retrieved: readonly RetrievedRecord[];
  readonly expanded: ExpandResult;
  readonly filtered: FilterResult;
  readonly projected: ProjectResult;
}

export function createKnowledgeContext(
  clock?: () => string,
): KnowledgeReadContext {
  return {
    entities: new EntityRegistry(),
    slots: new SlotRegistry(),
    state: new KnowledgeState(),
    evidence: new EvidenceStore(),
    entityReferences: new ClaimEntityReferenceStore(),
    labels: new KnowledgeLabelStore(),
    lifecycle: new EvidenceLifecycleStore(clock),
    relations: new RelationIndex(),
  };
}

export function readKnowledge(
  input: ReadInput,
  context: KnowledgeReadContext,
): ReadResult {
  context = {
    ...context,
    ...(input.applicabilityScopes === undefined
      ? {}
      : { applicabilityScopes: input.applicabilityScopes }),
    evaluatedAt: context.evaluatedAt ?? context.lifecycle.now(),
  };
  const scope = define(input, context);
  const retrieved = retrieve(scope, context, { message: input.message });
  const expanded = expand(retrieved, scope, context, {
    message: input.message,
  });
  const filtered = filter({
    expanded,
    scope,
    ...(input.taskTags === undefined ? {} : { taskTags: input.taskTags }),
  });
  const composed = compose(filtered.admitted);
  const reactivationCandidates = unique(
    [...retrieved, ...expanded.records]
      .filter(
        (record) =>
          record.matchKind === "direct" &&
          record.memoryState === "dormant" &&
          record.evidenceId !== undefined,
      )
      .map((record) => record.evidenceId as string),
  );
  const projected = project({
    scope,
    composed,
    omitted: filtered.omitted,
    reactivationCandidates,
    ...(input.budget === undefined ? {} : { budget: input.budget }),
  });
  return {
    scope,
    retrieved,
    expanded,
    filtered,
    projected,
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
