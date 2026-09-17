import { MemoryError } from "./errors.js";
import type {
  KnowledgeItem,
  KnowledgeProposal,
  MemoryPolicy,
  MemoryTask,
} from "./types.js";

export interface CodingAgentMemoryPolicyOptions {
  readonly projectionReinforcement?: number;
  readonly reconciliationReinforcement?: number;
}

function validateBoost(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function intersects(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export class CodingAgentMemoryPolicy implements MemoryPolicy {
  private readonly projectionBoost: number;
  private readonly reconciliationBoost: number;

  constructor(options: CodingAgentMemoryPolicyOptions = {}) {
    this.projectionBoost = validateBoost(
      options.projectionReinforcement ?? 0.25,
      "projectionReinforcement",
    );
    this.reconciliationBoost = validateBoost(
      options.reconciliationReinforcement ?? 0.2,
      "reconciliationReinforcement",
    );
  }

  isRelevant(item: KnowledgeItem, task: MemoryTask): boolean {
    if (item.keepAlive || task.requiredKnowledgeIds.includes(item.id)) {
      return true;
    }

    const scopeMatches =
      item.scope.length === 0 || intersects(item.scope, task.scopes);
    const termMatches =
      task.terms.length === 0 || intersects(item.tags, task.terms);
    return scopeMatches && termMatches;
  }

  projectionReinforcement(_item: KnowledgeItem, _task: MemoryTask): number {
    return this.projectionBoost;
  }

  reconciliationReinforcement(
    _item: KnowledgeItem,
    _proposal: KnowledgeProposal,
  ): number {
    return this.reconciliationBoost;
  }

  rankForContext(
    items: readonly KnowledgeItem[],
    task: MemoryTask,
  ): readonly KnowledgeItem[] {
    const required = new Set(task.requiredKnowledgeIds);
    return [...items].sort((left, right) => {
      const leftRequired = left.keepAlive || required.has(left.id) ? 1 : 0;
      const rightRequired = right.keepAlive || required.has(right.id) ? 1 : 0;
      return (
        rightRequired - leftRequired ||
        right.authority - left.authority ||
        right.relevanceScore - left.relevanceScore ||
        left.id.localeCompare(right.id)
      );
    });
  }
}
