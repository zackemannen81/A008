import { KnowledgeModelError } from "./errors.js";
import type { KnowledgeState } from "./state.js";
import type { ReconcileDecision, UpdateResult } from "./state-types.js";

export interface UpdateOptions {
  readonly decidedBy: string;
}

export function update(
  state: KnowledgeState,
  decision: ReconcileDecision,
  options: UpdateOptions,
): UpdateResult {
  if (options.decidedBy.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "UPDATE requires a decidedBy identifier",
    );
  }
  if (state.isContested(decision.slot)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "UPDATE fails when the slot is contested",
    );
  }
  if (
    decision.outcome !== "change" &&
    decision.outcome !== "correction" &&
    decision.outcome !== "retraction"
  ) {
    throw new KnowledgeModelError(
      "invalid_input",
      `UPDATE does not apply to outcome ${decision.outcome}`,
    );
  }
  return state.applyAtomicUpdate(decision, options.decidedBy);
}
