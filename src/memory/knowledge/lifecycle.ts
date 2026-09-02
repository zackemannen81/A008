import { UNKNOWN_INSTANT, isUnknownInstant } from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import type {
  AttachLifecycleInput,
  DecayInput,
  LifecycleRecord,
  LifecycleSnapshot,
  LifecycleTransition,
  LifecycleTransitionKind,
  LifecycleWriteInput,
  MemoryLifecycle,
  MemoryLifecycleState,
} from "./lifecycle-types.js";
import type { Instant } from "./types.js";

export const DEFAULT_LIFECYCLE_STRENGTH = 1;
export const DEFAULT_LIFECYCLE_DECAY_RATE = 0.1;
export const DEFAULT_LIFECYCLE_THRESHOLD = 0.5;
export const DEFAULT_REINFORCE_AMOUNT = 0.25;
export const DEFAULT_WEAKEN_AMOUNT = 0.2;
export const DEFAULT_REACTIVATE_AMOUNT = 0.5;

export function derivedLifecycleState(input: {
  readonly strength: number;
  readonly threshold: number;
  readonly pinned: boolean;
}): MemoryLifecycleState {
  return input.pinned || input.strength >= input.threshold ? "active" : "dormant";
}

export function clampUnitInterval(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new KnowledgeModelError("invalid_input", `${field} must be a finite number`);
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export class EvidenceLifecycleStore {
  readonly #records = new Map<string, LifecycleRecord>();
  readonly #transitions: LifecycleTransition[] = [];
  #nextTransition = 0;

  get(evidenceId: string): LifecycleRecord | undefined {
    const found = this.#records.get(evidenceId);
    return found === undefined ? undefined : cloneRecord(found);
  }

  list(): readonly LifecycleRecord[] {
    return [...this.#records.values()].map(cloneRecord);
  }

  transitions(): readonly LifecycleTransition[] {
    return this.#transitions.map(cloneTransition);
  }

  snapshot(): LifecycleSnapshot {
    return {
      records: this.list(),
      transitions: this.transitions(),
    };
  }

  transitionSequence(): number {
    return this.#nextTransition;
  }

  hydrate(snapshot: LifecycleSnapshot, nextTransition?: number): void {
    this.#records.clear();
    this.#transitions.length = 0;
    for (const record of snapshot.records) {
      this.#records.set(record.evidenceId, cloneRecord(record));
    }
    for (const transition of snapshot.transitions) {
      this.#transitions.push(cloneTransition(transition));
    }
    this.#nextTransition =
      nextTransition === undefined
        ? inferredLifecycleSequence(snapshot.transitions)
        : nextTransition;
  }

  attach(input: AttachLifecycleInput): LifecycleRecord {
    const evidenceId = requireNonEmpty(input.evidenceId, "evidenceId");
    if (this.#records.has(evidenceId)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `lifecycle for ${evidenceId} is already attached`,
      );
    }
    const strength = clampUnitInterval(
      input.strength ?? DEFAULT_LIFECYCLE_STRENGTH,
      "strength",
    );
    const decayRate = clampUnitInterval(
      input.decayRate ?? DEFAULT_LIFECYCLE_DECAY_RATE,
      "decayRate",
    );
    const threshold = clampUnitInterval(
      input.threshold ?? DEFAULT_LIFECYCLE_THRESHOLD,
      "threshold",
    );
    const pinned = input.pinned === true;
    const lastReinforcedAt = cloneInstant(input.lastReinforcedAt ?? UNKNOWN_INSTANT);
    const lifecycle = buildLifecycle({
      strength,
      decayRate,
      threshold,
      pinned,
      lastReinforcedAt,
    });
    const record: LifecycleRecord = {
      evidenceId,
      evidenceKind: input.evidenceKind,
      lifecycle,
    };
    this.#records.set(evidenceId, record);
    this.#writeTransition({
      evidenceId,
      kind: "created",
      fromStrength: strength,
      toStrength: strength,
      fromState: lifecycle.state,
      toState: lifecycle.state,
      at: cloneInstant(input.at ?? UNKNOWN_INSTANT),
      caller: input.caller ?? "lifecycle.attach",
      reason: "evidence lifecycle created",
    });
    return cloneRecord(record);
  }

  reinforce(input: LifecycleWriteInput): readonly LifecycleRecord[] {
    const amount = clampUnitInterval(
      input.amount ?? DEFAULT_REINFORCE_AMOUNT,
      "amount",
    );
    return this.#adjust(input, "reinforced", (current) => ({
      strength: clampUnitInterval(current.strength + amount, "strength"),
      lastReinforcedAt: cloneInstant(input.at),
    }));
  }

  weaken(input: LifecycleWriteInput): readonly LifecycleRecord[] {
    const amount = clampUnitInterval(
      input.amount ?? DEFAULT_WEAKEN_AMOUNT,
      "amount",
    );
    return this.#adjust(input, "weakened", (current) => ({
      strength: clampUnitInterval(current.strength - amount, "strength"),
    }));
  }

  reactivate(input: LifecycleWriteInput): readonly LifecycleRecord[] {
    const amount = clampUnitInterval(
      input.amount ?? DEFAULT_REACTIVATE_AMOUNT,
      "amount",
    );
    return this.#adjust(input, "reactivated", (current) => {
      const raised = clampUnitInterval(current.strength + amount, "strength");
      return {
        strength: Math.max(raised, current.threshold),
        lastReinforcedAt: cloneInstant(input.at),
      };
    });
  }

  decay(input: DecayInput): readonly LifecycleRecord[] {
    if (!Number.isFinite(input.elapsed) || input.elapsed < 0) {
      throw new KnowledgeModelError(
        "invalid_input",
        "DECAY elapsed must be a finite number >= 0",
      );
    }
    const ids =
      input.evidenceIds === undefined
        ? [...this.#records.keys()]
        : input.evidenceIds;
    return this.#adjust(
      {
        evidenceIds: ids,
        caller: input.caller,
        reason: input.reason,
        at: input.at,
      },
      "decayed",
      (current) => ({
        strength: clampUnitInterval(
          current.strength - current.decayRate * input.elapsed,
          "strength",
        ),
      }),
    );
  }

  #adjust(
    input: LifecycleWriteInput,
    kind: Exclude<LifecycleTransitionKind, "created">,
    next: (current: MemoryLifecycle) => {
      readonly strength: number;
      readonly lastReinforcedAt?: Instant;
    },
  ): readonly LifecycleRecord[] {
    const caller = requireNonEmpty(input.caller, "caller");
    const reason = requireNonEmpty(input.reason, "reason");
    const updated: LifecycleRecord[] = [];
    for (const evidenceId of input.evidenceIds) {
      const existing = this.#records.get(requireNonEmpty(evidenceId, "evidenceId"));
      if (existing === undefined) {
        throw new KnowledgeModelError(
          "invalid_input",
          `lifecycle for ${evidenceId} is not attached`,
        );
      }
      const patch = next(existing.lifecycle);
      const lifecycle = buildLifecycle({
        strength: patch.strength,
        decayRate: existing.lifecycle.decayRate,
        threshold: existing.lifecycle.threshold,
        pinned: existing.lifecycle.pinned,
        lastReinforcedAt: patch.lastReinforcedAt ?? existing.lifecycle.lastReinforcedAt,
      });
      const record: LifecycleRecord = {
        evidenceId: existing.evidenceId,
        evidenceKind: existing.evidenceKind,
        lifecycle,
      };
      this.#records.set(existing.evidenceId, record);
      this.#writeTransition({
        evidenceId: existing.evidenceId,
        kind,
        fromStrength: existing.lifecycle.strength,
        toStrength: lifecycle.strength,
        fromState: existing.lifecycle.state,
        toState: lifecycle.state,
        at: cloneInstant(input.at),
        caller,
        reason,
      });
      updated.push(cloneRecord(record));
    }
    return updated;
  }

  #writeTransition(input: Omit<LifecycleTransition, "id">): LifecycleTransition {
    this.#nextTransition += 1;
    const transition: LifecycleTransition = {
      id: `A008_knowledge_lifecycle_${String(this.#nextTransition).padStart(4, "0")}`,
      evidenceId: input.evidenceId,
      kind: input.kind,
      fromStrength: input.fromStrength,
      toStrength: input.toStrength,
      fromState: input.fromState,
      toState: input.toState,
      at: cloneInstant(input.at),
      caller: input.caller,
      reason: input.reason,
    };
    this.#transitions.push(transition);
    return cloneTransition(transition);
  }
}

export function reinforce(
  store: EvidenceLifecycleStore,
  input: LifecycleWriteInput,
): readonly LifecycleRecord[] {
  return store.reinforce(input);
}

export function weaken(
  store: EvidenceLifecycleStore,
  input: LifecycleWriteInput,
): readonly LifecycleRecord[] {
  return store.weaken(input);
}

export function decay(
  store: EvidenceLifecycleStore,
  input: DecayInput,
): readonly LifecycleRecord[] {
  return store.decay(input);
}

export function reactivate(
  store: EvidenceLifecycleStore,
  input: LifecycleWriteInput,
): readonly LifecycleRecord[] {
  return store.reactivate(input);
}

export function viewLifecycle(
  store: EvidenceLifecycleStore,
  evidenceId: string,
): { readonly strength: number; readonly memoryState: MemoryLifecycleState } {
  const attached = store.get(evidenceId);
  if (attached === undefined) {
    return {
      strength: DEFAULT_LIFECYCLE_STRENGTH,
      memoryState: "active",
    };
  }
  return {
    strength: attached.lifecycle.strength,
    memoryState: attached.lifecycle.state,
  };
}

function buildLifecycle(input: {
  readonly strength: number;
  readonly decayRate: number;
  readonly threshold: number;
  readonly pinned: boolean;
  readonly lastReinforcedAt: Instant;
}): MemoryLifecycle {
  return {
    state: derivedLifecycleState(input),
    strength: input.strength,
    decayRate: input.decayRate,
    threshold: input.threshold,
    pinned: input.pinned,
    lastReinforcedAt: cloneInstant(input.lastReinforcedAt),
  };
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new KnowledgeModelError("invalid_input", `${field} must not be empty`);
  }
  return trimmed;
}

function cloneInstant(instant: Instant): Instant {
  return isUnknownInstant(instant) ? UNKNOWN_INSTANT : instant;
}

function cloneLifecycle(lifecycle: MemoryLifecycle): MemoryLifecycle {
  return {
    state: lifecycle.state,
    strength: lifecycle.strength,
    decayRate: lifecycle.decayRate,
    threshold: lifecycle.threshold,
    pinned: lifecycle.pinned,
    lastReinforcedAt: cloneInstant(lifecycle.lastReinforcedAt),
  };
}

function cloneRecord(record: LifecycleRecord): LifecycleRecord {
  return {
    evidenceId: record.evidenceId,
    evidenceKind: record.evidenceKind,
    lifecycle: cloneLifecycle(record.lifecycle),
  };
}

function cloneTransition(transition: LifecycleTransition): LifecycleTransition {
  return {
    id: transition.id,
    evidenceId: transition.evidenceId,
    kind: transition.kind,
    fromStrength: transition.fromStrength,
    toStrength: transition.toStrength,
    fromState: transition.fromState,
    toState: transition.toState,
    at: cloneInstant(transition.at),
    caller: transition.caller,
    reason: transition.reason,
  };
}

function inferredLifecycleSequence(
  transitions: readonly LifecycleTransition[],
): number {
  let max = 0;
  for (const transition of transitions) {
    const match = /^A008_knowledge_lifecycle_(\d+)$/.exec(transition.id);
    if (match === null) {
      continue;
    }
    const parsed = Number(match[1]);
    if (Number.isSafeInteger(parsed) && parsed > max) {
      max = parsed;
    }
  }
  return max;
}
