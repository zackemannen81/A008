import { randomUUID } from "node:crypto";
import { MemoryError } from "./errors.js";
import { serializeContextProjection } from "./serialization.js";
import type {
  ContextKnowledgeItem,
  ContextProjection,
  ExpectedKnowledgeRevision,
  KnowledgeIdFactory,
  KnowledgeItem,
  KnowledgeProposal,
  MemoryAuditEvent,
  MemoryPolicy,
  MemoryRepository,
  MemoryTask,
  ProjectionBudget,
  ProjectionResult,
  ProvenanceRef,
  ReconciliationDecision,
  ReconciliationGuard,
  ReconciliationResult,
  SerializedContextMeasurer,
} from "./types.js";

export interface SemanticMemoryOptions {
  readonly repository: MemoryRepository;
  readonly policy: MemoryPolicy;
  readonly measurer: SerializedContextMeasurer;
  readonly idFactory?: KnowledgeIdFactory;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))];
}

function mergeProvenance(
  left: readonly ProvenanceRef[],
  right: readonly ProvenanceRef[],
): ProvenanceRef[] {
  const merged = new Map<string, ProvenanceRef>();
  for (const item of [...left, ...right]) {
    merged.set(`${item.sourceType}\u0000${item.sourceId}`, { ...item });
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.sourceType.localeCompare(b.sourceType) ||
      a.sourceId.localeCompare(b.sourceId),
  );
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function requireFiniteUnit(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a finite number between 0 and 1`,
    );
  }
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new MemoryError("invalid_input", `${field} must not be empty`);
  }
  return normalized;
}

function validateStringSet(values: readonly string[], field: string): string[] {
  const normalized = uniqueStrings(values);
  if (normalized.some((value) => value.length === 0)) {
    throw new MemoryError(
      "invalid_input",
      `${field} must not contain empty values`,
    );
  }
  return normalized.sort((left, right) => left.localeCompare(right));
}

function normalizeProvenance(
  values: readonly ProvenanceRef[],
): ProvenanceRef[] {
  return mergeProvenance(
    [],
    values.map((value) => ({
      sourceId: requireNonEmpty(value.sourceId, "provenance sourceId"),
      sourceType: requireNonEmpty(value.sourceType, "provenance sourceType"),
    })),
  );
}

function validateProposal(proposal: KnowledgeProposal): KnowledgeProposal {
  const relevanceScore = proposal.relevanceScore ?? 0;
  const activationThreshold = proposal.activationThreshold ?? 0.5;
  const authority = proposal.authority ?? 0.5;
  const confidence = proposal.confidence ?? 0.5;
  requireFiniteUnit(relevanceScore, "relevanceScore");
  requireFiniteUnit(activationThreshold, "activationThreshold");
  requireFiniteUnit(authority, "authority");
  requireFiniteUnit(confidence, "confidence");

  return {
    proposition: requireNonEmpty(proposal.proposition, "proposition"),
    kind: requireNonEmpty(proposal.kind, "kind"),
    tags: validateStringSet(proposal.tags ?? [], "tags"),
    scope: validateStringSet(proposal.scope, "scope"),
    relevanceScore,
    activationThreshold,
    keepAlive: proposal.keepAlive ?? false,
    authority,
    confidence,
    sourceBacked: proposal.sourceBacked ?? false,
    provenance: normalizeProvenance(proposal.provenance ?? []),
  };
}

function validateGuard(
  guard: ReconciliationGuard | undefined,
): readonly ExpectedKnowledgeRevision[] {
  if (guard === undefined) {
    return [];
  }
  const seen = new Set<string>();
  return guard.expectedRevisions.map((expected, index) => {
    const id = requireNonEmpty(
      expected.id,
      `expected revision ${index + 1} knowledge id`,
    );
    if (seen.has(id)) {
      throw new MemoryError(
        "invalid_input",
        `expected revision guard contains duplicate knowledge id: ${id}`,
      );
    }
    seen.add(id);
    if (!Number.isSafeInteger(expected.revision) || expected.revision < 1) {
      throw new MemoryError(
        "invalid_input",
        `expected revision for ${id} must be a positive safe integer`,
      );
    }
    return { id, revision: expected.revision };
  });
}

function validateTask(task: MemoryTask): MemoryTask {
  return {
    id: requireNonEmpty(task.id, "task id"),
    query: requireNonEmpty(task.query, "task query"),
    scopes: validateStringSet(task.scopes, "task scopes"),
    terms: validateStringSet(task.terms, "task terms"),
    requiredKnowledgeIds: validateStringSet(
      task.requiredKnowledgeIds,
      "required knowledge ids",
    ),
  };
}

function activationFor(
  item: KnowledgeItem,
  score: number,
): "active" | "dormant" {
  return item.keepAlive || score >= item.activationThreshold
    ? "active"
    : "dormant";
}

function toContextItem(item: KnowledgeItem): ContextKnowledgeItem {
  return {
    id: item.id,
    proposition: item.proposition,
    kind: item.kind,
    tags: [...item.tags],
    scope: [...item.scope],
    authority: item.authority,
  };
}

function createItem(id: string, proposal: KnowledgeProposal): KnowledgeItem {
  const score = proposal.relevanceScore ?? 0;
  const threshold = proposal.activationThreshold ?? 0.5;
  const keepAlive = proposal.keepAlive ?? false;
  return {
    id: requireNonEmpty(id, "generated knowledge id"),
    proposition: proposal.proposition,
    kind: proposal.kind,
    tags: [...(proposal.tags ?? [])],
    scope: [...proposal.scope],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: keepAlive || score >= threshold ? "active" : "dormant",
    relevanceScore: score,
    activationThreshold: threshold,
    keepAlive,
    authority: proposal.authority ?? 0.5,
    confidence: proposal.confidence ?? 0.5,
    sourceBacked: proposal.sourceBacked ?? false,
    provenance: [...(proposal.provenance ?? [])],
    revision: 1,
  };
}

function validatePolicyBoost(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "policy",
      `${field} must return a finite number between 0 and 1`,
    );
  }
  return value;
}

export class SemanticMemory {
  private readonly repository: MemoryRepository;
  private readonly policy: MemoryPolicy;
  private readonly measurer: SerializedContextMeasurer;
  private readonly idFactory: KnowledgeIdFactory;

  constructor(options: SemanticMemoryOptions) {
    this.repository = options.repository;
    this.policy = options.policy;
    this.measurer = options.measurer;
    this.idFactory = options.idFactory ?? (() => `knowledge_${randomUUID()}`);
    requireNonEmpty(this.measurer.unit, "measurement unit");
  }

  get projectId(): import("../identity/types.js").ProjectId | undefined {
    return this.repository.projectId;
  }

  async reconcile(
    unvalidatedProposal: KnowledgeProposal,
    decision: ReconciliationDecision,
    guard?: ReconciliationGuard,
  ): Promise<ReconciliationResult> {
    const proposal = validateProposal(unvalidatedProposal);
    const expectedRevisions = validateGuard(guard);

    return this.repository.transact((transaction) => {
      for (const expected of expectedRevisions) {
        const current = transaction.get(expected.id);
        if (
          current?.canonicalStatus !== "current" ||
          current.revision !== expected.revision
        ) {
          throw new MemoryError(
            "stale_state",
            `knowledge changed after candidate materialization: ${expected.id}`,
          );
        }
      }
      if (decision.type === "new") {
        const item = createItem(this.idFactory(), proposal);
        transaction.insert(item);
        transaction.appendAudit({
          type: "knowledge_created",
          knowledgeIds: [item.id],
          taskId: null,
          selectedKnowledgeIds: [],
          excludedCount: 0,
        });
        return {
          relation: decision.type,
          item,
          previousItem: null,
          conflictTargetIds: [],
        };
      }

      if (decision.type === "conflict") {
        const targetIds = validateStringSet(
          decision.targetIds,
          "conflict target ids",
        );
        if (targetIds.length === 0) {
          throw new MemoryError(
            "invalid_input",
            "a conflict decision requires at least one target",
          );
        }
        for (const targetId of targetIds) {
          const target = transaction.get(targetId);
          if (target?.canonicalStatus !== "current") {
            throw new MemoryError(
              "missing_target",
              `conflict target is not current knowledge: ${targetId}`,
            );
          }
        }
        transaction.appendAudit({
          type: "knowledge_conflict",
          knowledgeIds: targetIds,
          taskId: null,
          selectedKnowledgeIds: [],
          excludedCount: 0,
        });
        return {
          relation: decision.type,
          item: null,
          previousItem: null,
          conflictTargetIds: targetIds,
        };
      }

      const targetId = requireNonEmpty(decision.targetId, "target id");
      const target = transaction.get(targetId);
      if (target?.canonicalStatus !== "current") {
        throw new MemoryError(
          "missing_target",
          `reconciliation target is not current knowledge: ${targetId}`,
        );
      }

      if (decision.type === "supersede") {
        const replacement = createItem(this.idFactory(), proposal);
        const historical: KnowledgeItem = {
          ...target,
          canonicalStatus: "superseded",
          supersededBy: replacement.id,
          activationStatus: "dormant",
          revision: target.revision + 1,
        };
        transaction.replace(historical);
        transaction.insert(replacement);
        transaction.appendAudit({
          type: "knowledge_superseded",
          knowledgeIds: [historical.id, replacement.id],
          taskId: null,
          selectedKnowledgeIds: [],
          excludedCount: 0,
        });
        return {
          relation: decision.type,
          item: replacement,
          previousItem: historical,
          conflictTargetIds: [],
        };
      }

      const boost = validatePolicyBoost(
        this.policy.reconciliationReinforcement(target, proposal),
        "reconciliationReinforcement",
      );
      const score = clampUnit(target.relevanceScore + boost);
      const merged: KnowledgeItem = {
        ...target,
        proposition:
          decision.type === "extend"
            ? proposal.proposition
            : target.proposition,
        kind: decision.type === "extend" ? proposal.kind : target.kind,
        tags: validateStringSet(
          [...target.tags, ...(proposal.tags ?? [])],
          "merged tags",
        ),
        scope: validateStringSet(
          [...target.scope, ...proposal.scope],
          "merged scope",
        ),
        relevanceScore: score,
        activationStatus: activationFor(target, score),
        authority: Math.max(target.authority, proposal.authority ?? 0.5),
        confidence: Math.max(target.confidence, proposal.confidence ?? 0.5),
        sourceBacked: target.sourceBacked || (proposal.sourceBacked ?? false),
        provenance: mergeProvenance(
          target.provenance,
          proposal.provenance ?? [],
        ),
        revision: target.revision + 1,
      };
      transaction.replace(merged);
      transaction.appendAudit({
        type:
          decision.type === "extend"
            ? "knowledge_extended"
            : "knowledge_restated",
        knowledgeIds: [merged.id],
        taskId: null,
        selectedKnowledgeIds: [],
        excludedCount: 0,
      });
      return {
        relation: decision.type,
        item: merged,
        previousItem: target,
        conflictTargetIds: [],
      };
    });
  }

  async getKnowledge(id: string): Promise<KnowledgeItem | undefined> {
    const normalizedId = requireNonEmpty(id, "knowledge id");
    return this.repository.read((view) => view.get(normalizedId));
  }

  async getHistory(id: string): Promise<readonly KnowledgeItem[]> {
    const normalizedId = requireNonEmpty(id, "knowledge id");
    return this.repository.read((view) => view.historyFrom(normalizedId));
  }

  async discover(
    unvalidatedTask: MemoryTask,
  ): Promise<readonly KnowledgeItem[]> {
    const task = validateTask(unvalidatedTask);
    return this.repository.read((view) => {
      const relevant = view
        .listCurrent()
        .filter(
          (item) =>
            item.keepAlive ||
            task.requiredKnowledgeIds.includes(item.id) ||
            this.policy.isRelevant(item, task),
        );
      return this.validateRankedItems(
        this.policy.rankForContext(relevant, task),
        relevant,
      );
    });
  }

  async project(
    unvalidatedTask: MemoryTask,
    budget: ProjectionBudget,
  ): Promise<ProjectionResult> {
    const task = validateTask(unvalidatedTask);
    if (!Number.isSafeInteger(budget.maximum) || budget.maximum < 1) {
      throw new MemoryError(
        "invalid_input",
        "projection budget maximum must be a positive safe integer",
      );
    }

    return this.repository.read((view) => {
      const current = view.listCurrent();
      const currentById = new Map(current.map((item) => [item.id, item]));
      for (const requiredId of task.requiredKnowledgeIds) {
        if (!currentById.has(requiredId)) {
          throw new MemoryError(
            "required_not_found",
            `required current knowledge was not found: ${requiredId}`,
          );
        }
      }

      const relevant: KnowledgeItem[] = [];
      for (const item of current) {
        if (
          !item.keepAlive &&
          !task.requiredKnowledgeIds.includes(item.id) &&
          !this.policy.isRelevant(item, task)
        ) {
          continue;
        }
        relevant.push(item);
      }

      const requiredIds = new Set([
        ...task.requiredKnowledgeIds,
        ...current.filter((item) => item.keepAlive).map((item) => item.id),
      ]);

      const ranked = this.validateRankedItems(
        this.policy.rankForContext(relevant, task),
        relevant,
      );
      const ordered = [
        ...ranked.filter((item) => requiredIds.has(item.id)),
        ...ranked.filter((item) => !requiredIds.has(item.id)),
      ];

      const selected: ContextKnowledgeItem[] = [];
      let materialized = this.materialize(task.id, selected);
      if (materialized.measuredUnits > budget.maximum) {
        throw new MemoryError(
          "budget_exceeded",
          `empty projection exceeds ${budget.maximum} ${this.measurer.unit}`,
        );
      }

      for (const item of ordered) {
        const candidate = [...selected, toContextItem(item)];
        const next = this.materialize(task.id, candidate);
        if (next.measuredUnits <= budget.maximum) {
          selected.push(candidate[candidate.length - 1]!);
          materialized = next;
          continue;
        }
        if (requiredIds.has(item.id)) {
          throw new MemoryError(
            "budget_exceeded",
            `required knowledge ${item.id} exceeds ${budget.maximum} ${this.measurer.unit}`,
          );
        }
      }

      return materialized;
    });
  }

  async projectSelected(
    unvalidatedTask: MemoryTask,
    budget: ProjectionBudget,
    unvalidatedRankedCandidateIds: readonly string[],
  ): Promise<ProjectionResult> {
    const task = validateTask(unvalidatedTask);
    if (!Number.isSafeInteger(budget.maximum) || budget.maximum < 1) {
      throw new MemoryError(
        "invalid_input",
        "projection budget maximum must be a positive safe integer",
      );
    }
    const rankedCandidateIds = validateStringSet(
      unvalidatedRankedCandidateIds,
      "ranked candidate ids",
    );
    if (rankedCandidateIds.length !== unvalidatedRankedCandidateIds.length) {
      throw new MemoryError(
        "invalid_input",
        "ranked candidate ids must not contain duplicates",
      );
    }
    const requestedOrder = new Map(
      unvalidatedRankedCandidateIds.map((id, index) => [id.trim(), index]),
    );

    return this.repository.read((view) => {
      const requestedIds = [
        ...new Set([...rankedCandidateIds, ...task.requiredKnowledgeIds]),
      ];
      const requestedItems = view.list(requestedIds);
      const requestedById = new Map(
        requestedItems.map((item) => [item.id, item]),
      );

      for (const candidateId of rankedCandidateIds) {
        const candidate = requestedById.get(candidateId);
        if (candidate?.canonicalStatus !== "current") {
          throw new MemoryError(
            "missing_target",
            `ranked candidate is not current knowledge: ${candidateId}`,
          );
        }
      }
      for (const requiredId of task.requiredKnowledgeIds) {
        const required = requestedById.get(requiredId);
        if (required?.canonicalStatus !== "current") {
          throw new MemoryError(
            "required_not_found",
            `required current knowledge was not found: ${requiredId}`,
          );
        }
      }

      const keepAlive = view.listKeepAlive();
      const requiredIds = new Set([
        ...task.requiredKnowledgeIds,
        ...keepAlive.map((item) => item.id),
      ]);
      const combined = new Map<string, KnowledgeItem>();
      for (const item of [...keepAlive, ...requestedItems]) {
        if (item.canonicalStatus === "current") {
          combined.set(item.id, item);
        }
      }

      const ordered = [...combined.values()]
        .filter(
          (item) => requiredIds.has(item.id) || requestedOrder.has(item.id),
        )
        .sort((left, right) => {
          const leftRequired = requiredIds.has(left.id) ? 1 : 0;
          const rightRequired = requiredIds.has(right.id) ? 1 : 0;
          return (
            rightRequired - leftRequired ||
            (requestedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
              (requestedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
            left.id.localeCompare(right.id)
          );
        });

      const selected: ContextKnowledgeItem[] = [];
      let materialized = this.materialize(task.id, selected);
      if (materialized.measuredUnits > budget.maximum) {
        throw new MemoryError(
          "budget_exceeded",
          `empty projection exceeds ${budget.maximum} ${this.measurer.unit}`,
        );
      }
      for (const item of ordered) {
        const candidate = [...selected, toContextItem(item)];
        const next = this.materialize(task.id, candidate);
        if (next.measuredUnits <= budget.maximum) {
          selected.push(candidate[candidate.length - 1]!);
          materialized = next;
          continue;
        }
        if (requiredIds.has(item.id)) {
          throw new MemoryError(
            "budget_exceeded",
            `required knowledge ${item.id} exceeds ${budget.maximum} ${this.measurer.unit}`,
          );
        }
      }
      return materialized;
    });
  }

  async getAudit(): Promise<readonly MemoryAuditEvent[]> {
    return this.repository.readAudit();
  }

  private materialize(
    taskId: string,
    items: readonly ContextKnowledgeItem[],
  ): ProjectionResult {
    const projection: ContextProjection = {
      taskId,
      items: items.map((item) => ({
        ...item,
        tags: [...item.tags],
        scope: [...item.scope],
      })),
    };
    const serialized = serializeContextProjection(projection);
    const measuredUnits = this.measurer.measure(serialized);
    if (!Number.isSafeInteger(measuredUnits) || measuredUnits < 0) {
      throw new MemoryError(
        "policy",
        "context measurer must return a non-negative safe integer",
      );
    }
    return {
      projection,
      serialized,
      measuredUnits,
      measurementUnit: this.measurer.unit,
    };
  }

  private validateRankedItems(
    ranked: readonly KnowledgeItem[],
    candidates: readonly KnowledgeItem[],
  ): readonly KnowledgeItem[] {
    const candidateById = new Map(candidates.map((item) => [item.id, item]));
    const rankedIds = ranked.map((item) => item.id);
    if (
      rankedIds.length !== candidates.length ||
      new Set(rankedIds).size !== rankedIds.length ||
      rankedIds.some((id) => !candidateById.has(id))
    ) {
      throw new MemoryError(
        "policy",
        "rankForContext must return each candidate exactly once",
      );
    }
    return rankedIds.map((id) => candidateById.get(id)!);
  }
}
