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
  const truthScopedExpanded = protectCurrentTruthSurfaces(
    expanded,
    scope,
    context,
  );
  const filtered = filter({
    expanded: truthScopedExpanded,
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
    expanded: truthScopedExpanded,
    filtered,
    projected,
  };
}

function protectCurrentTruthSurfaces(
  expanded: ExpandResult,
  scope: SemanticScope,
  context: KnowledgeReadContext,
): ExpandResult {
  if (
    !scope.intents.includes("current_state") ||
    scope.intents.includes("history") ||
    scope.intents.includes("attribution")
  ) {
    return expanded;
  }

  const stateClaimIds = new Set(
    context.state.snapshot().bindings.map((binding) => binding.claimId),
  );
  if (stateClaimIds.size === 0) {
    return expanded;
  }
  const stateUtteranceIds = new Set(
    context.evidence
      .listClaims()
      .filter((claim) => stateClaimIds.has(claim.id))
      .flatMap((claim) =>
        claim.derivedFrom.kind === "utterance" ? [claim.derivedFrom.id] : [],
      ),
  );

  const records: RetrievedRecord[] = [];
  const omitted = [...expanded.omitted];
  for (const record of expanded.records) {
    const shadowedClaim =
      record.surface === "claim" &&
      record.evidenceId !== undefined &&
      stateClaimIds.has(record.evidenceId);
    const shadowedUtterance =
      record.surface === "utterance" &&
      record.evidenceId !== undefined &&
      stateUtteranceIds.has(record.evidenceId);
    if (shadowedClaim || shadowedUtterance) {
      omitted.push({ record, reason: "current_state_owned_by_binding" });
      continue;
    }
    records.push(record);
  }
  return { records, omitted };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
