import { isUnknownInstant } from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import { asEntityId } from "./ids.js";
import { slotKey } from "./registry.js";
import type {
  Binding,
  ClaimStatus,
  CorrectionRecord,
  KnowledgeStateSnapshot,
  ReconcileDecision,
  SlotClaim,
  StateTransition,
  StubEvent,
  UpdateResult,
} from "./state-types.js";
import type { Instant, Interval, ReferentId, SlotRef } from "./types.js";

export function bindingValue(binding: Binding): unknown {
  return binding.kind === "attribute" ? binding.value : binding.object;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function instantsEqual(
  left: Instant | null,
  right: Instant | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  if (isUnknownInstant(left) || isUnknownInstant(right)) {
    return isUnknownInstant(left) && isUnknownInstant(right);
  }
  return left === right;
}

export function intervalsEqual(left: Interval, right: Interval): boolean {
  return instantsEqual(left.from, right.from) && instantsEqual(left.to, right.to);
}

export function isKnownInstant(value: Instant): value is string {
  return typeof value === "string";
}

export function instantLessThan(
  left: Instant,
  right: Instant | null,
): boolean {
  if (right === null) {
    return true;
  }
  if (isUnknownInstant(left) || isUnknownInstant(right)) {
    return true;
  }
  return left < right;
}

export function intervalsOverlap(left: Interval, right: Interval): boolean {
  return (
    instantLessThan(left.from, right.to) && instantLessThan(right.from, left.to)
  );
}

export function isOpenInterval(interval: Interval): boolean {
  return interval.to === null;
}

export function canSequenceAfter(
  current: Interval,
  proposed: Interval,
): boolean {
  if (!isKnownInstant(current.from) || !isKnownInstant(proposed.from)) {
    return false;
  }
  return proposed.from > current.from;
}

export function isAcceptanceEligible(claim: SlotClaim): boolean {
  if (!claim.acceptanceEligible) {
    return false;
  }
  return claim.status === "asserted" || claim.status === "accepted";
}

export class KnowledgeState {
  readonly #bindings = new Map<string, Binding[]>();
  readonly #transitions = new Map<string, StateTransition[]>();
  readonly #claims = new Map<string, SlotClaim>();
  readonly #events = new Map<string, StubEvent>();
  readonly #corrections: CorrectionRecord[] = [];
  readonly #contested = new Set<string>();
  #nextTransition = 0;

  current(slot: SlotRef): readonly Binding[] {
    return this.history(slot).filter((binding) => isOpenInterval(binding.interval));
  }

  history(slot: SlotRef): readonly Binding[] {
    const items = this.#bindings.get(slotKey(slot)) ?? [];
    return items.map(cloneBinding).sort(compareBindings);
  }

  closedHistory(slot: SlotRef): readonly Binding[] {
    return this.history(slot).filter((binding) => !isOpenInterval(binding.interval));
  }

  currentValue(slot: SlotRef): unknown | undefined {
    const open = this.current(slot);
    const first = open[0];
    if (first === undefined) {
      return undefined;
    }
    return bindingValue(first);
  }

  transitions(slot: SlotRef): readonly StateTransition[] {
    const items = this.#transitions.get(slotKey(slot)) ?? [];
    return items.map(cloneTransition);
  }

  claims(slot?: SlotRef): readonly SlotClaim[] {
    const all = [...this.#claims.values()].map(cloneClaim);
    if (slot === undefined) {
      return all;
    }
    const key = slotKey(slot);
    return all.filter((claim) => slotKey(claim.slot) === key);
  }

  claim(id: string): SlotClaim | undefined {
    const found = this.#claims.get(id);
    return found === undefined ? undefined : cloneClaim(found);
  }

  events(): readonly StubEvent[] {
    return [...this.#events.values()].map(cloneEvent);
  }

  event(id: string): StubEvent | undefined {
    const found = this.#events.get(id);
    return found === undefined ? undefined : cloneEvent(found);
  }

  corrections(slot?: SlotRef): readonly CorrectionRecord[] {
    const items = this.#corrections.map(cloneCorrection);
    if (slot === undefined) {
      return items;
    }
    const key = slotKey(slot);
    return items.filter((record) => slotKey(record.slot) === key);
  }

  isContested(slot: SlotRef): boolean {
    return this.#contested.has(slotKey(slot));
  }

  recordClaim(claim: SlotClaim): void {
    if (this.#claims.has(claim.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `claim ${claim.id} is already recorded`,
      );
    }
    this.#claims.set(claim.id, cloneClaim(claim));
  }

  recordEvent(event: StubEvent): void {
    if (this.#events.has(event.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `event ${event.id} is already recorded`,
      );
    }
    this.#events.set(event.id, cloneEvent(event));
  }

  setClaimStatus(id: string, status: ClaimStatus): void {
    const existing = this.#claims.get(id);
    if (existing === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        `claim ${id} is not recorded`,
      );
    }
    this.#claims.set(id, cloneClaim({ ...existing, status }));
  }

  applyConflict(decision: ReconcileDecision): void {
    if (decision.outcome !== "conflict") {
      throw new KnowledgeModelError(
        "invalid_input",
        "applyConflict requires a conflict decision",
      );
    }
    if (this.claim(decision.proposal.id) === undefined) {
      this.recordClaim(decision.proposal);
    }
    const contestedIds = new Set(decision.competingClaimIds);
    contestedIds.add(decision.proposal.id);
    for (const id of contestedIds) {
      const existing = this.#claims.get(id);
      if (existing === undefined) {
        continue;
      }
      this.#claims.set(id, cloneClaim({ ...existing, status: "contested" }));
    }
    const key = slotKey(decision.slot);
    const remaining: Binding[] = [];
    for (const binding of this.#bindings.get(key) ?? []) {
      if (intervalsOverlap(binding.interval, decision.proposal.aboutInterval)) {
        continue;
      }
      remaining.push(binding);
    }
    this.#bindings.set(key, remaining);
    this.#contested.add(key);
  }

  applyAtomicUpdate(
    decision: ReconcileDecision,
    decidedBy: string,
  ): UpdateResult {
    if (this.isContested(decision.slot)) {
      throw new KnowledgeModelError(
        "invalid_input",
        "UPDATE fails when the slot is contested",
      );
    }
    if (decision.outcome === "change") {
      return this.#applyChange(decision, decidedBy);
    }
    if (decision.outcome === "correction") {
      return this.#applyCorrection(decision, decidedBy);
    }
    if (decision.outcome === "retraction") {
      return this.#applyRetraction(decision, decidedBy);
    }
    throw new KnowledgeModelError(
      "invalid_input",
      `UPDATE does not apply to outcome ${decision.outcome}`,
    );
  }

  snapshot(): KnowledgeStateSnapshot {
    return {
      bindings: [...this.#bindings.values()].flat().map(cloneBinding),
      claims: [...this.#claims.values()].map(cloneClaim),
      transitions: [...this.#transitions.values()].flat().map(cloneTransition),
      events: [...this.#events.values()].map(cloneEvent),
      corrections: this.#corrections.map(cloneCorrection),
      contestedSlotKeys: [...this.#contested],
    };
  }

  #applyChange(decision: ReconcileDecision, decidedBy: string): UpdateResult {
    const key = slotKey(decision.slot);
    const existing = [...(this.#bindings.get(key) ?? [])];
    const openIndexes = existing
      .map((binding, index) =>
        isOpenInterval(binding.interval) ? index : -1,
      )
      .filter((index) => index >= 0);

    let closed: Binding | null = null;
    if (decision.cardinality === "single") {
      if (openIndexes.length > 1) {
        throw new KnowledgeModelError(
          "invalid_input",
          "single slot already has more than one current binding",
        );
      }
      const openIndex = openIndexes[0];
      if (openIndex !== undefined) {
        const current = existing[openIndex];
        if (current === undefined) {
          throw new KnowledgeModelError(
            "invalid_input",
            "current binding is missing",
          );
        }
        if (!canSequenceAfter(current.interval, decision.proposal.aboutInterval)) {
          throw new KnowledgeModelError(
            "invalid_input",
            "CHANGE cannot sequence over an overlapping current interval",
          );
        }
        const closedBinding: Binding = {
          ...cloneBinding(current),
          interval: {
            from: cloneInstant(current.interval.from),
            to: cloneInstant(decision.proposal.aboutInterval.from),
          },
        };
        existing[openIndex] = closedBinding;
        closed = cloneBinding(closedBinding);
      }
    } else {
      const sameMember = existing.find(
        (binding) =>
          isOpenInterval(binding.interval) &&
          valuesEqual(bindingValue(binding), decision.proposal.value),
      );
      if (sameMember !== undefined) {
        throw new KnowledgeModelError(
          "invalid_input",
          "set slot already has an open binding for this member",
        );
      }
    }

    const opened = bindingFromProposal(decision.proposal);
    const next = [...existing, opened];
    const openAfter = next.filter((binding) => isOpenInterval(binding.interval));
    if (decision.cardinality === "single" && openAfter.length !== 1) {
      throw new KnowledgeModelError(
        "invalid_input",
        "CHANGE would violate single-slot cardinality",
      );
    }

    const transition = this.#writeTransition({
      slot: decision.slot,
      from: closed === null ? null : bindingValue(closed),
      to: decision.proposal.value,
      at: decision.at,
      causedBy: decision.proposal.causedBy,
      decidedBy,
      outcome: "change",
    });
    this.#bindings.set(key, next);
    return {
      closed,
      opened: cloneBinding(opened),
      amended: null,
      transition,
    };
  }

  #applyCorrection(
    decision: ReconcileDecision,
    decidedBy: string,
  ): UpdateResult {
    const key = slotKey(decision.slot);
    const existing = [...(this.#bindings.get(key) ?? [])];
    const targetInterval =
      decision.targetInterval ?? decision.proposal.targetInterval ?? null;
    const targetIndex = existing.findIndex((binding) =>
      targetInterval === null
        ? instantsEqual(binding.interval.from, decision.proposal.aboutInterval.from)
        : intervalsEqual(binding.interval, targetInterval) ||
          instantsEqual(binding.interval.from, targetInterval.from),
    );
    if (targetIndex < 0) {
      throw new KnowledgeModelError(
        "invalid_input",
        "CORRECTION target interval was not found",
      );
    }
    const target = existing[targetIndex];
    if (target === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        "CORRECTION target interval was not found",
      );
    }

    const previousValue = bindingValue(target);
    const replacement = decision.proposal.value;
    let amended: Binding | null = null;
    if (replacement === null) {
      existing.splice(targetIndex, 1);
    } else {
      const rewritten = rewriteBindingValue(target, replacement);
      existing[targetIndex] = rewritten;
      amended = cloneBinding(rewritten);
    }

    const transition = this.#writeTransition({
      slot: decision.slot,
      from: previousValue,
      to: replacement === null ? null : replacement,
      at: decision.at,
      causedBy: decision.proposal.causedBy,
      decidedBy,
      outcome: "correction",
    });
    this.#corrections.push({
      transitionId: transition.id,
      slot: cloneSlotRef(decision.slot),
      amendedInterval: cloneInterval(target.interval),
      from: previousValue,
      to: replacement === null ? null : replacement,
      causedBy: decision.proposal.causedBy,
      correctedBy: decision.proposal.attributedTo,
      at: cloneInstant(decision.at),
    });
    this.#bindings.set(key, existing);
    return {
      closed: null,
      opened: null,
      amended,
      transition,
    };
  }

  #applyRetraction(
    decision: ReconcileDecision,
    decidedBy: string,
  ): UpdateResult {
    const retractedId = decision.proposal.retractsClaimId ?? decision.proposal.id;
    const retracted = this.#claims.get(retractedId);
    if (retracted === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        "retraction target claim is not recorded",
      );
    }
    const key = slotKey(decision.slot);
    const existing = [...(this.#bindings.get(key) ?? [])];
    const targetIndex = existing.findIndex(
      (binding) =>
        binding.claimId === retractedId ||
        binding.causedBy === retracted.causedBy,
    );
    if (targetIndex < 0) {
      throw new KnowledgeModelError(
        "invalid_input",
        "retraction has no binding to close",
      );
    }
    const target = existing[targetIndex];
    if (target === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        "retraction has no binding to close",
      );
    }

    const remainingSupport = [...this.#claims.values()].some(
      (claim) =>
        claim.id !== retractedId &&
        claim.status === "accepted" &&
        slotKey(claim.slot) === key &&
        valuesEqual(claim.value, bindingValue(target)),
    );
    if (remainingSupport) {
      throw new KnowledgeModelError(
        "invalid_input",
        "retraction still has a surviving accepted claim",
      );
    }

    const closeAt = decision.proposal.aboutInterval.from;
    const closed: Binding = {
      ...cloneBinding(target),
      interval: {
        from: cloneInstant(target.interval.from),
        to: cloneInstant(closeAt),
      },
    };
    existing[targetIndex] = closed;
    const transition = this.#writeTransition({
      slot: decision.slot,
      from: bindingValue(target),
      to: null,
      at: closeAt,
      causedBy: decision.proposal.causedBy,
      decidedBy,
      outcome: "retraction",
    });
    this.#bindings.set(key, existing);
    return {
      closed: cloneBinding(closed),
      opened: null,
      amended: null,
      transition,
    };
  }

  #writeTransition(
    input: Omit<StateTransition, "id">,
  ): StateTransition {
    this.#nextTransition += 1;
    const transition: StateTransition = {
      id: `A008_knowledge_transition_${String(this.#nextTransition).padStart(4, "0")}`,
      slot: cloneSlotRef(input.slot),
      from: input.from,
      to: input.to,
      at: cloneInstant(input.at),
      causedBy: input.causedBy,
      decidedBy: input.decidedBy,
      outcome: input.outcome,
    };
    const key = slotKey(input.slot);
    const list = this.#transitions.get(key) ?? [];
    list.push(transition);
    this.#transitions.set(key, list);
    return cloneTransition(transition);
  }
}

function bindingFromProposal(proposal: SlotClaim): Binding {
  const interval: Interval = cloneInterval(proposal.aboutInterval);
  if (proposal.slot.kind === "attribute") {
    return {
      kind: "attribute",
      slot: {
        kind: "attribute",
        entity: proposal.slot.entity,
        name: proposal.slot.name,
      },
      value: proposal.value,
      label: proposal.label,
      interval,
      causedBy: proposal.causedBy,
      claimId: proposal.id,
    };
  }
  if (typeof proposal.value !== "string" || proposal.value.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "relationship binding value must be a referent id",
    );
  }
  const relationSlot =
    proposal.slot.object === undefined
      ? {
          kind: "relation" as const,
          subject: proposal.slot.subject,
          name: proposal.slot.name,
        }
      : {
          kind: "relation" as const,
          subject: proposal.slot.subject,
          name: proposal.slot.name,
          object: proposal.slot.object,
        };
  const object =
    proposal.slot.object === undefined
      ? asReferentId(proposal.value)
      : proposal.slot.object;
  return {
    kind: "relationship",
    slot: relationSlot,
    object,
    label: proposal.label,
    interval,
    causedBy: proposal.causedBy,
    claimId: proposal.id,
  };
}

function rewriteBindingValue(binding: Binding, value: unknown): Binding {
  if (binding.kind === "attribute") {
    const cloned = cloneBinding(binding);
    if (cloned.kind !== "attribute") {
      throw new KnowledgeModelError(
        "invalid_input",
        "attribute binding clone lost its kind",
      );
    }
    return {
      kind: "attribute",
      slot: cloned.slot,
      value,
      label: cloned.label,
      interval: cloned.interval,
      causedBy: cloned.causedBy,
      claimId: cloned.claimId,
    };
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "relationship correction value must be a referent id",
    );
  }
  const cloned = cloneBinding(binding);
  if (cloned.kind !== "relationship") {
    throw new KnowledgeModelError(
      "invalid_input",
      "relationship binding clone lost its kind",
    );
  }
  return {
    kind: "relationship",
    slot: cloned.slot,
    object: asReferentId(value),
    label: cloned.label,
    interval: cloned.interval,
    causedBy: cloned.causedBy,
    claimId: cloned.claimId,
  };
}

function asReferentId(value: string): ReferentId {
  return asEntityId(value);
}

function compareBindings(left: Binding, right: Binding): number {
  const leftFrom = left.interval.from;
  const rightFrom = right.interval.from;
  if (isUnknownInstant(leftFrom) && isUnknownInstant(rightFrom)) {
    return 0;
  }
  if (isUnknownInstant(leftFrom)) {
    return 1;
  }
  if (isUnknownInstant(rightFrom)) {
    return -1;
  }
  if (leftFrom < rightFrom) {
    return -1;
  }
  if (leftFrom > rightFrom) {
    return 1;
  }
  return 0;
}

function cloneBinding(binding: Binding): Binding {
  if (binding.kind === "attribute") {
    return {
      kind: "attribute",
      slot: {
        kind: "attribute",
        entity: binding.slot.entity,
        name: binding.slot.name,
      },
      value: binding.value,
      label: binding.label,
      interval: cloneInterval(binding.interval),
      causedBy: binding.causedBy,
      claimId: binding.claimId,
    };
  }
  const slot =
    binding.slot.object === undefined
      ? {
          kind: "relation" as const,
          subject: binding.slot.subject,
          name: binding.slot.name,
        }
      : {
          kind: "relation" as const,
          subject: binding.slot.subject,
          name: binding.slot.name,
          object: binding.slot.object,
        };
  return {
    kind: "relationship",
    slot,
    object: binding.object,
    label: binding.label,
    interval: cloneInterval(binding.interval),
    causedBy: binding.causedBy,
    claimId: binding.claimId,
  };
}

function cloneTransition(transition: StateTransition): StateTransition {
  return {
    id: transition.id,
    slot: cloneSlotRef(transition.slot),
    from: transition.from,
    to: transition.to,
    at: cloneInstant(transition.at),
    causedBy: transition.causedBy,
    decidedBy: transition.decidedBy,
    outcome: transition.outcome,
  };
}

function cloneClaim(claim: SlotClaim): SlotClaim {
  return {
    id: claim.id,
    slot: cloneSlotRef(claim.slot),
    value: claim.value,
    label: claim.label,
    aboutInterval: cloneInterval(claim.aboutInterval),
    status: claim.status,
    attributedTo: claim.attributedTo,
    causedBy: claim.causedBy,
    kind: claim.kind,
    acceptanceEligible: claim.acceptanceEligible,
    ...(claim.retractsClaimId === undefined
      ? {}
      : { retractsClaimId: claim.retractsClaimId }),
    ...(claim.targetInterval === undefined
      ? {}
      : { targetInterval: cloneInterval(claim.targetInterval) }),
  };
}

function cloneEvent(event: StubEvent): StubEvent {
  return {
    id: event.id,
    type: event.type,
    label: event.label,
    eventTime: cloneInstant(event.eventTime),
    causedBy: event.causedBy,
    ...(event.who === undefined ? {} : { who: event.who }),
    ...(event.what === undefined ? {} : { what: event.what }),
    effects: event.effects.map((effect) => ({
      slot: cloneSlotRef(effect.slot),
      value: effect.value,
    })),
  };
}

function cloneCorrection(record: CorrectionRecord): CorrectionRecord {
  return {
    transitionId: record.transitionId,
    slot: cloneSlotRef(record.slot),
    amendedInterval: cloneInterval(record.amendedInterval),
    from: record.from,
    to: record.to,
    causedBy: record.causedBy,
    correctedBy: record.correctedBy,
    at: cloneInstant(record.at),
  };
}

function cloneSlotRef(ref: SlotRef): SlotRef {
  if (ref.kind === "attribute") {
    return {
      kind: "attribute",
      entity: ref.entity,
      name: ref.name,
    };
  }
  return ref.object === undefined
    ? { kind: "relation", subject: ref.subject, name: ref.name }
    : {
        kind: "relation",
        subject: ref.subject,
        name: ref.name,
        object: ref.object,
      };
}

function cloneInterval(interval: Interval): Interval {
  return {
    from: cloneInstant(interval.from),
    to: interval.to === null ? null : cloneInstant(interval.to),
  };
}

function cloneInstant(instant: Instant): Instant {
  if (typeof instant === "string") {
    return instant;
  }
  return { unknown: true };
}
