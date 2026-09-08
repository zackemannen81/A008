import { DEFAULT_MEMORY_LIFECYCLE_POLICY, parseMemoryLifecyclePolicy, type MemoryLifecyclePolicy } from "../../core/memory-lifecycle-policy.js";
import { evaluatePersistence, finiteUnit, operationalTime } from "./lifecycle.js";

/** Namespace is owned by the enclosing knowledge context/SQLite project. */
export interface AssociationIdentity {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly scope: readonly string[];
}
export interface AssociationRecord extends AssociationIdentity {
  readonly key: string;
  readonly lifecycle: {
    readonly policyVersion: "association-exponential-v1";
    readonly strength: number;
    readonly decayLambda: number;
    readonly threshold: number;
    readonly boost: number;
    readonly maximum: 1;
    readonly strengthUpdatedAt: string;
    readonly lastReinforcedAt: string | null;
  };
}
export interface AssociationReceipt {
  readonly edgeKey: string;
  readonly occurrenceId: string;
  readonly at: string;
  readonly support: { readonly utteranceId: string; readonly start: number; readonly end: number };
}
export interface AssociationTransition {
  readonly edgeKey: string;
  readonly occurrenceId: string;
  readonly kind: "created" | "reinforced";
  readonly fromStrength: number;
  readonly toStrength: number;
  readonly at: string;
  readonly observedAt: string;
}
export interface AssociationSnapshot {
  readonly records: readonly AssociationRecord[];
  readonly receipts: readonly AssociationReceipt[];
  readonly transitions: readonly AssociationTransition[];
}
export const EMPTY_ASSOCIATIONS: AssociationSnapshot = Object.freeze({ records: [], receipts: [], transitions: [] });

function nonEmpty(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid association identity");
}
export function associationIdentity(edge: AssociationIdentity): AssociationIdentity {
  if (!edge || typeof edge !== "object") throw new Error("Invalid association");
  nonEmpty(edge.from); nonEmpty(edge.to); nonEmpty(edge.relation);
  if (!Array.isArray(edge.scope)) throw new Error("Invalid association scope");
  edge.scope.forEach(nonEmpty);
  return { from: edge.from, to: edge.to, relation: edge.relation, scope: [...new Set(edge.scope)].sort() };
}
export function associationKey(edge: AssociationIdentity): string {
  const e = associationIdentity(edge);
  return JSON.stringify([e.from, e.to, e.relation, e.scope]);
}
function receiptKey(receipt: AssociationReceipt): string {
  nonEmpty(receipt.edgeKey); nonEmpty(receipt.occurrenceId);
  operationalTime(receipt.at);
  const proof = receipt.support;
  if (!proof) throw new Error("Missing association provenance");
  nonEmpty(proof.utteranceId);
  if (!Number.isSafeInteger(proof.start) || !Number.isSafeInteger(proof.end) || proof.start < 0 || proof.end <= proof.start) throw new Error("Invalid association provenance");
  return JSON.stringify([receipt.occurrenceId, receipt.edgeKey]);
}
export function evaluateAssociation(record: AssociationRecord, at: string) {
  validateRecord(record);
  return evaluatePersistence(record.lifecycle, at);
}
function validateRecord(record: AssociationRecord): void {
  if (record.key !== associationKey(record)) throw new Error("Corrupt association key");
  const life = record.lifecycle;
  if (!life || Object.keys(life).sort().join() !== "boost,decayLambda,lastReinforcedAt,maximum,policyVersion,strength,strengthUpdatedAt,threshold" ||
      life.policyVersion !== "association-exponential-v1" || life.maximum !== 1 || life.threshold === 0) throw new Error("Invalid association lifecycle");
  finiteUnit(life.boost, "association boost");
  evaluatePersistence(life, life.strengthUpdatedAt);
  if (life.lastReinforcedAt !== null) operationalTime(life.lastReinforcedAt);
}

/** Owned alongside RelationIndex, never by EvidenceLifecycleStore or a binding. */
export class AssociationLifecycle {
  #records = new Map<string, AssociationRecord>();
  #receipts = new Map<string, AssociationReceipt>();
  #transitions: AssociationTransition[] = [];

  outgoing(from: string): readonly AssociationRecord[] {
    return structuredClone([...this.#records.values()].filter(edge => edge.from === from));
  }

  snapshot(): AssociationSnapshot {
    return structuredClone({ records: [...this.#records.values()], receipts: [...this.#receipts.values()], transitions: this.#transitions });
  }

  hydrate(snapshot: AssociationSnapshot): void {
    const copy = structuredClone(snapshot);
    if (!copy || !Array.isArray(copy.records) || !Array.isArray(copy.receipts) || !Array.isArray(copy.transitions)) throw new Error("Invalid association snapshot");
    const records = new Map<string, AssociationRecord>();
    for (const record of copy.records) {
      validateRecord(record);
      if (records.has(record.key)) throw new Error("Duplicate association");
      records.set(record.key, record);
    }
    const receipts = new Map<string, AssociationReceipt>();
    for (const receipt of copy.receipts) {
      const key = receiptKey(receipt);
      if (!records.has(receipt.edgeKey) || receipts.has(key)) throw new Error("Corrupt association receipt");
      receipts.set(key, receipt);
    }
    const audited = new Set<string>();
    const latest = new Map<string, AssociationTransition>();
    for (const transition of copy.transitions) {
      const key = JSON.stringify([transition.occurrenceId, transition.edgeKey]);
      const receipt = receipts.get(key);
      const previous = latest.get(transition.edgeKey);
      if (!receipt || audited.has(key) || receipt.at !== transition.observedAt ||
          transition.kind !== (previous ? "reinforced" : "created") ||
          (previous && Date.parse(transition.at) < Date.parse(previous.at))) throw new Error("Corrupt association audit");
      operationalTime(transition.at); operationalTime(transition.observedAt);
      finiteUnit(transition.fromStrength, "association audit"); finiteUnit(transition.toStrength, "association audit");
      audited.add(key); latest.set(transition.edgeKey, transition);
    }
    if (audited.size !== receipts.size || latest.size !== records.size) throw new Error("Missing association provenance/audit");
    for (const record of records.values()) {
      const last = latest.get(record.key)!;
      if (last.toStrength !== record.lifecycle.strength || last.at !== record.lifecycle.strengthUpdatedAt ||
          record.lifecycle.lastReinforcedAt !== (last.kind === "created" ? null : last.at)) throw new Error("Corrupt association baseline");
    }
    this.#records = records; this.#receipts = receipts; this.#transitions = copy.transitions;
  }

  /** Caller must resolve endpoints and validate semantic support against the source. */
  establish(edge: AssociationIdentity, occurrence: Omit<AssociationReceipt, "edgeKey">, policy: MemoryLifecyclePolicy = DEFAULT_MEMORY_LIFECYCLE_POLICY): "created" | "reinforced" | "duplicate" {
    const identity = associationIdentity(edge);
    const edgeKey = associationKey(identity);
    const receipt = structuredClone({ ...occurrence, at: operationalTime(occurrence.at), edgeKey });
    const key = receiptKey(receipt);
    if (this.#receipts.has(key)) return "duplicate";
    const previous = this.#records.get(edgeKey);
    const creation = parseMemoryLifecyclePolicy(policy).association;
    const fromStrength = previous ? evaluateAssociation(previous, receipt.at).strength : 0;
    const at = previous && Date.parse(previous.lifecycle.strengthUpdatedAt) > Date.parse(receipt.at) ? previous.lifecycle.strengthUpdatedAt : receipt.at;
    const lifecycle: AssociationRecord["lifecycle"] = previous ? {
      ...previous.lifecycle,
      strength: Math.min(1, fromStrength + previous.lifecycle.boost),
      strengthUpdatedAt: at, lastReinforcedAt: at,
    } : {
      policyVersion: "association-exponential-v1", strength: creation.strength,
      decayLambda: Math.LN2 / creation.halfLifeSeconds, threshold: creation.threshold,
      boost: creation.boost, maximum: 1, strengthUpdatedAt: at, lastReinforcedAt: null,
    };
    const record = { ...identity, key: edgeKey, lifecycle };
    validateRecord(record);
    const kind = previous ? "reinforced" : "created";
    this.#records.set(edgeKey, record);
    this.#receipts.set(key, receipt);
    this.#transitions.push({ edgeKey, occurrenceId: receipt.occurrenceId, kind, fromStrength, toStrength: lifecycle.strength, at, observedAt: receipt.at });
    return kind;
  }
}
