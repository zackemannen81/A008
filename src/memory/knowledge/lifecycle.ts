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
import { DEFAULT_MEMORY_LIFECYCLE_POLICY, RAW_LIFECYCLE_POLICY, isKnowledgeSeverity, parseMemoryLifecyclePolicy } from "../../core/memory-lifecycle-policy.js";
import type { ReinforcementReceipt } from "./lifecycle-types.js";
import type { Instant } from "./types.js";

export const DEFAULT_LIFECYCLE_STRENGTH = 1;
export const DEFAULT_LIFECYCLE_DECAY_RATE = 0.1;
export const DEFAULT_LIFECYCLE_THRESHOLD = 0.5;
export const DEFAULT_REINFORCE_AMOUNT = 0.2;
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
  readonly #receipts = new Map<string, ReinforcementReceipt>();
  constructor(readonly clock: () => string = () => new Date().toISOString()) {}
  now(): string { return operationalTime(this.clock()); }

  /** Runtime calls this only after source ownership and semantic support validation. */
  reinforceOccurrence(receipt: ReinforcementReceipt): boolean {
    validateReceipt(receipt);
    const key = JSON.stringify([receipt.occurrenceId, receipt.evidenceId]);
    requireNonEmpty(receipt.occurrenceId, "occurrenceId");
    operationalTime(receipt.at);
    if (this.#receipts.has(key)) return false;
    const current = this.#records.get(receipt.evidenceId);
    if (!current || current.evidenceKind !== "claim") throw new KnowledgeModelError("invalid_input", "Reinforcement target must be an existing claim");
    if (current.lifecycle.creationOccurrenceId === receipt.occurrenceId) return false;
    this.reinforce({ evidenceIds: [receipt.evidenceId], caller: "knowledge-commit", reason: "distinct supporting occurrence", at: receipt.at, amount: current.lifecycle.boost });
    this.#receipts.set(key, structuredClone(receipt));
    return true;
  }

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
      receipts: [...this.#receipts.values()].map(r => structuredClone(r)),
      records: this.list(),
      transitions: this.transitions(),
    };
  }

  transitionSequence(): number {
    return this.#nextTransition;
  }

  hydrate(snapshot: LifecycleSnapshot, nextTransition?: number): void {
    snapshot.records.forEach(r => validateLifecycle(r.lifecycle));
    (snapshot.receipts ?? []).forEach(validateReceipt);
    this.#receipts.clear();
    for (const receipt of snapshot.receipts ?? []) {
      this.#receipts.set(JSON.stringify([receipt.occurrenceId, receipt.evidenceId]), structuredClone(receipt));
    }
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
    if (!["claim", "utterance", "event", "artifact_summary"].includes(input.evidenceKind)) throw new KnowledgeModelError("invalid_input", "Invalid lifecycle carrier");
    const evidenceId = requireNonEmpty(input.evidenceId, "evidenceId");
    if (this.#records.has(evidenceId)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `lifecycle for ${evidenceId} is already attached`,
      );
    }
    if (input.severity !== undefined && (!isKnowledgeSeverity(input.severity) || input.evidenceKind !== "claim")) {
      throw new KnowledgeModelError("invalid_input", "Only a claim can have validated semantic severity");
    }
    const policy = parseMemoryLifecyclePolicy(input.policy ?? DEFAULT_MEMORY_LIFECYCLE_POLICY);
    const creation = input.severity === undefined ? RAW_LIFECYCLE_POLICY : policy[input.severity];
    const at = input.at === undefined || isUnknownInstant(input.at) ? this.now() : operationalTime(input.at);
    const strength = finiteUnit(
      input.strength ?? creation.strength,
      "strength",
    );
    const decayRate = clampUnitInterval(
      input.decayRate ?? DEFAULT_LIFECYCLE_DECAY_RATE,
      "decayRate",
    );
    const threshold = finiteUnit(
      input.threshold ?? creation.threshold,
      "threshold",
    );
    if (threshold === 0) throw new KnowledgeModelError("invalid_input", "New threshold must be greater than zero");
    const pinned = input.pinned === true;
    const lastReinforcedAt = cloneInstant(input.lastReinforcedAt ?? UNKNOWN_INSTANT);
    const lifecycle = buildLifecycle({
      ...(input.creationOccurrenceId === undefined ? {} : { creationOccurrenceId: input.creationOccurrenceId }),
      severity: input.severity ?? null,
      policyVersion: "exponential-v1",
      decayLambda: input.decayLambda ?? Math.LN2 / creation.halfLifeSeconds,
      strengthUpdatedAt: at,
      boost: creation.boost,
      maximum: 1,
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
      at,
      caller: input.caller ?? "lifecycle.attach",
      reason: "evidence lifecycle created",
    });
    return cloneRecord(record);
  }

  reinforce(input: LifecycleWriteInput): readonly LifecycleRecord[] {
    input = { ...input, at: typeof input.at === "string" ? operationalTime(input.at) : this.now() };
    const amount = finiteUnit(
      input.amount ?? DEFAULT_REINFORCE_AMOUNT,
      "amount",
    );
    return this.#adjust(input, "reinforced", (current) => ({
      strength: clampUnitInterval(current.strength + amount, "strength"),
      lastReinforcedAt: typeof input.at === "string" ? operationalTime(input.at) : this.now(),
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
    const at = typeof input.at === "string" ? operationalTime(input.at) : this.now();
    const ids = [...new Set(input.evidenceIds)];
    for (const id of ids) if (!this.#records.has(requireNonEmpty(id, "evidenceId"))) throw new KnowledgeModelError("invalid_input", "Lifecycle is not attached");
    const updated: LifecycleRecord[] = [];
    for (const evidenceId of ids) {
      const existing = this.#records.get(requireNonEmpty(evidenceId, "evidenceId"));
      if (existing === undefined) {
        throw new KnowledgeModelError(
          "invalid_input",
          `lifecycle for ${evidenceId} is not attached`,
        );
      }
      const evaluated = evaluateLifecycle(existing.lifecycle, at);
      const patch = next({ ...existing.lifecycle, strength: evaluated.strength, state: evaluated.memoryState });
      const baselineAt = new Date(Math.max(Date.parse(at), Date.parse(existing.lifecycle.strengthUpdatedAt))).toISOString();
      const lifecycle = buildLifecycle({
        ...existing.lifecycle,
        strengthUpdatedAt: baselineAt,
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
        fromStrength: evaluated.strength,
        toStrength: lifecycle.strength,
        fromState: evaluated.memoryState,
        toState: lifecycle.state,
        at: baselineAt,
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

export function viewLifecycle(store: EvidenceLifecycleStore, evidenceId: string, at = store.now()): { readonly strength: number; readonly memoryState: MemoryLifecycleState } {
  const attached = store.get(evidenceId);
  return attached === undefined ? { strength: 1, memoryState: "active" } : evaluateLifecycle(attached.lifecycle, at);
}

export function operationalTime(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new KnowledgeModelError("invalid_input", "Invalid operational timestamp");
  }
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0, 19) !== value.slice(0, 19)) throw new KnowledgeModelError("invalid_input", "Invalid operational date");
  return normalized;
}
export function finiteUnit(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new KnowledgeModelError("invalid_input", field + " must be between zero and one");
  return value;
}
export function validateLifecycle(life: MemoryLifecycle): void {
  if (!life || typeof life !== "object" || !["active", "dormant"].includes(life.state) ||
      !(typeof life.lastReinforcedAt === "string" || (life.lastReinforcedAt !== null && typeof life.lastReinforcedAt === "object" && life.lastReinforcedAt.unknown === true))) throw new KnowledgeModelError("invalid_input", "Invalid lifecycle metadata");
  finiteUnit(life.strength, "strength"); finiteUnit(life.threshold, "threshold"); finiteUnit(life.boost, "boost"); finiteUnit(life.decayRate, "legacy maintenance rate");
  if (!Number.isFinite(life.decayLambda) || life.decayLambda < 0 || life.maximum !== 1 || typeof life.pinned !== "boolean" ||
      (life.policyVersion !== "exponential-v1" && life.policyVersion !== "legacy-exponential-v1") ||
      (life.threshold === 0 && life.policyVersion !== "legacy-exponential-v1") ||
      (life.severity !== null && !isKnowledgeSeverity(life.severity))) throw new KnowledgeModelError("invalid_input", "Invalid lifecycle baseline");
  operationalTime(life.strengthUpdatedAt);
}
export function evaluateLifecycle(life: MemoryLifecycle, at: string) {
  validateLifecycle(life);
  return evaluatePersistence(life, at);
}
/** Pure arithmetic shared by independent evidence and association owners. */
export function evaluatePersistence(life: Pick<MemoryLifecycle, "strength" | "threshold" | "decayLambda" | "strengthUpdatedAt"> & { readonly pinned?: boolean }, at: string) {
  finiteUnit(life.strength, "strength"); finiteUnit(life.threshold, "threshold");
  if (!Number.isFinite(life.decayLambda) || life.decayLambda < 0) throw new KnowledgeModelError("invalid_input", "Invalid decay lambda");
  operationalTime(life.strengthUpdatedAt);
  const evaluatedAt = operationalTime(at);
  const elapsedSeconds = Math.max(0, (Date.parse(evaluatedAt) - Date.parse(life.strengthUpdatedAt)) / 1000);
  const strength = life.strength * Math.exp(-life.decayLambda * elapsedSeconds);
  const memoryState: MemoryLifecycleState = life.pinned || strength >= life.threshold ? "active" : "dormant";
  const delay = life.strength >= life.threshold && life.threshold > 0 && life.decayLambda > 0
    ? Math.log(life.strength / life.threshold) / life.decayLambda * 1000 : null;
  const crossing = delay === null ? null : Date.parse(life.strengthUpdatedAt) + delay;
  return { strength, memoryState, evaluatedAt,
    thresholdCrossingAt: crossing !== null && Number.isFinite(crossing) && Math.abs(crossing) <= 8640000000000000 ? new Date(crossing).toISOString() : null };
}
/** P4: one explicit migration instant, no fabricated historical age/severity. */
export function migrateLegacyLifecycle(record: LifecycleRecord, at: string): LifecycleRecord {
  const old = record.lifecycle;
  if ("strengthUpdatedAt" in old) { validateLifecycle(old); return structuredClone(record); }
  const legacy = record.lifecycle as Omit<MemoryLifecycle, "strengthUpdatedAt">;
  finiteUnit(legacy.strength, "legacy strength"); finiteUnit(legacy.threshold, "legacy threshold"); finiteUnit(legacy.decayRate, "legacy decayRate");
  if (typeof legacy.pinned !== "boolean" || !["active", "dormant"].includes(legacy.state) ||
      !(typeof legacy.lastReinforcedAt === "string" || isUnknownInstant(legacy.lastReinforcedAt))) throw new KnowledgeModelError("invalid_input", "Corrupt legacy lifecycle");
  const lifecycle: MemoryLifecycle = { ...legacy, severity: null, policyVersion: "legacy-exponential-v1", decayLambda: Math.LN2 / RAW_LIFECYCLE_POLICY.halfLifeSeconds, strengthUpdatedAt: operationalTime(at), boost: 0.2, maximum: 1 };
  validateLifecycle(lifecycle);
  return { ...record, lifecycle };
}
function buildLifecycle(input: Omit<MemoryLifecycle, "state">): MemoryLifecycle {
  const life = { ...input, state: derivedLifecycleState(input), lastReinforcedAt: cloneInstant(input.lastReinforcedAt) };
  validateLifecycle(life);
  return life;
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
  return { ...lifecycle, lastReinforcedAt: cloneInstant(lifecycle.lastReinforcedAt) };
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

function validateReceipt(receipt: ReinforcementReceipt): void {
  if (!receipt || typeof receipt.occurrenceId !== "string" || !receipt.occurrenceId.trim() || typeof receipt.evidenceId !== "string" || !receipt.evidenceId.trim() || !receipt.support || typeof receipt.support.utteranceId !== "string" || !receipt.support.utteranceId.trim() || !Number.isSafeInteger(receipt.support.start) || !Number.isSafeInteger(receipt.support.end) || receipt.support.start < 0 || receipt.support.end <= receipt.support.start) throw new KnowledgeModelError("invalid_input", "Invalid reinforcement receipt");
  operationalTime(receipt.at);
}
