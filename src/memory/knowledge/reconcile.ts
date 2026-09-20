import { KnowledgeModelError } from "./errors.js";
import { slotKey } from "./registry.js";
import {
  bindingValue,
  canSequenceAfter,
  isStateReconciliationEligible,
  intervalsEqual,
  intervalsOverlap,
  isOpenInterval,
  type KnowledgeState,
  valuesEqual,
} from "./state.js";
import type { ReconcileDecision, SlotClaim } from "./state-types.js";
import type { SlotDefinition } from "./types.js";

export function reconcile(
  state: KnowledgeState,
  proposal: SlotClaim,
  slot: SlotDefinition,
): ReconcileDecision {
  if (slotKey(proposal.slot) !== slotKey(slot.ref)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "RECONCILE requires a resolved slot matching the proposal",
    );
  }

  const current = state.current(proposal.slot);
  const history = state.history(proposal.slot);
  const claims = state.claims(proposal.slot);
  const competing = claims.filter(
    (claim) =>
      claim.id !== proposal.id &&
      isStateReconciliationEligible(claim) &&
      intervalsOverlap(claim.aboutInterval, proposal.aboutInterval) &&
      !valuesEqual(claim.value, proposal.value),
  );
  const competingClaimIds = competing.map((claim) => claim.id);
  const currentBinding = current[0];
  const currentValue =
    currentBinding === undefined ? null : bindingValue(currentBinding);

  if (proposal.kind === "retraction") {
    const targetId = proposal.retractsClaimId ?? proposal.id;
    const target = state.claim(targetId);
    if (target === undefined || target.status === "retracted") {
      return decision("no_op", {
        proposal,
        slot,
        from: currentValue,
        to: currentValue,
        competingClaimIds,
        targetInterval: null,
        reason: "retraction has no accepted claim to withdraw",
      });
    }
    return decision("retraction", {
      proposal,
      slot,
      from: currentValue,
      to: null,
      competingClaimIds,
      targetInterval: currentBinding?.interval ?? null,
      reason: "source retracted the claim that produced the binding",
    });
  }

  if (proposal.kind === "correction") {
    const targetInterval = proposal.targetInterval ?? proposal.aboutInterval;
    const target = history.find(
      (binding) =>
        intervalsOverlap(binding.interval, targetInterval) &&
        (proposal.targetInterval === undefined ||
          binding.interval.from === proposal.targetInterval.from ||
          intervalsOverlap(binding.interval, proposal.targetInterval)),
    );
    if (target === undefined) {
      return decision("no_op", {
        proposal,
        slot,
        from: null,
        to: proposal.value,
        competingClaimIds,
        targetInterval,
        reason: "correction has no past interval to amend",
      });
    }
    if (valuesEqual(bindingValue(target), proposal.value)) {
      return decision("re_assertion", {
        proposal,
        slot,
        from: bindingValue(target),
        to: proposal.value,
        competingClaimIds,
        targetInterval: target.interval,
        reason: "correction restates the already-recorded interval value",
      });
    }
    return decision("correction", {
      proposal,
      slot,
      from: bindingValue(target),
      to: proposal.value,
      competingClaimIds,
      targetInterval: target.interval,
      reason: "explicit correction amends a past interval in place",
    });
  }

  if (
    slot.cardinality === "single" &&
    !isOpenInterval(proposal.aboutInterval)
  ) {
    const overlappingBindings = history.filter((binding) =>
      intervalsOverlap(binding.interval, proposal.aboutInterval),
    );
    const exact = overlappingBindings.find(
      (binding) =>
        intervalsEqual(binding.interval, proposal.aboutInterval) &&
        valuesEqual(bindingValue(binding), proposal.value),
    );
    if (exact !== undefined) {
      return decision("re_assertion", {
        proposal,
        slot,
        from: bindingValue(exact),
        to: proposal.value,
        competingClaimIds,
        targetInterval: exact.interval,
        reason: "proposal restates an already-recorded historical interval",
      });
    }
    if (overlappingBindings.length > 0) {
      return decision("conflict", {
        proposal,
        slot,
        from: currentValue,
        to: proposal.value,
        competingClaimIds: uniqueIds([
          ...competingClaimIds,
          ...overlappingBindings.map((binding) => binding.claimId),
        ]),
        targetInterval: proposal.aboutInterval,
        reason: "historical interval overlaps an incompatible recorded interval",
      });
    }
    return decision("change", {
      proposal,
      slot,
      from: null,
      to: proposal.value,
      competingClaimIds,
      targetInterval: null,
      reason: "closed non-overlapping interval adds historical state without changing current state",
    });
  }

  if (slot.cardinality === "single") {
    if (currentBinding !== undefined) {
      if (valuesEqual(bindingValue(currentBinding), proposal.value)) {
        return decision("re_assertion", {
          proposal,
          slot,
          from: currentValue,
          to: proposal.value,
          competingClaimIds,
          targetInterval: currentBinding.interval,
          reason: "proposal restates the current binding",
        });
      }
      if (canSequenceAfter(currentBinding.interval, proposal.aboutInterval)) {
        return decision("change", {
          proposal,
          slot,
          from: currentValue,
          to: proposal.value,
          competingClaimIds,
          targetInterval: currentBinding.interval,
          reason:
            "new value at a later instant; close and open sequential intervals",
        });
      }
      return decision("conflict", {
        proposal,
        slot,
        from: currentValue,
        to: proposal.value,
        competingClaimIds: uniqueIds([
          ...competingClaimIds,
          currentBinding.claimId,
        ]),
        targetInterval: proposal.aboutInterval,
        reason:
          "different value on an overlapping interval cannot be sequenced as CHANGE",
      });
    }
    if (competing.length > 0) {
      return decision("conflict", {
        proposal,
        slot,
        from: currentValue,
        to: proposal.value,
        competingClaimIds,
        targetInterval: proposal.aboutInterval,
        reason:
          "acceptance-eligible claims disagree on an overlapping interval",
      });
    }
    return decision("change", {
      proposal,
      slot,
      from: null,
      to: proposal.value,
      competingClaimIds,
      targetInterval: null,
      reason: "no current binding; open the first interval",
    });
  }

  const openMember = current.find((binding) =>
    valuesEqual(bindingValue(binding), proposal.value),
  );
  if (openMember !== undefined) {
    return decision("re_assertion", {
      proposal,
      slot,
      from: proposal.value,
      to: proposal.value,
      competingClaimIds,
      targetInterval: openMember.interval,
      reason: "set member is already an open binding",
    });
  }
  return decision("change", {
    proposal,
    slot,
    from: null,
    to: proposal.value,
    competingClaimIds,
    targetInterval: null,
    reason: "open a new set-slot member interval",
  });
}

function decision(
  outcome: ReconcileDecision["outcome"],
  input: {
    readonly proposal: SlotClaim;
    readonly slot: SlotDefinition;
    readonly from: unknown | null;
    readonly to: unknown | null;
    readonly competingClaimIds: readonly string[];
    readonly targetInterval: ReconcileDecision["targetInterval"];
    readonly reason: string;
  },
): ReconcileDecision {
  return {
    outcome,
    slot: input.slot.ref,
    cardinality: input.slot.cardinality,
    proposal: input.proposal,
    from: input.from,
    to: input.to,
    at: input.proposal.aboutInterval.from,
    competingClaimIds: input.competingClaimIds,
    targetInterval: input.targetInterval,
    reason: input.reason,
  };
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}
