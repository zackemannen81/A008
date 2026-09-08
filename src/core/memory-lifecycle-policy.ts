/** Accepted ADR 0035 P1/P2. Seconds are operational durations, not world time. */
export type KnowledgeSeverity = "critical" | "important" | "minor";
export interface CreationLifecyclePolicy {
  readonly strength: number;
  readonly halfLifeSeconds: number;
  readonly threshold: number;
  readonly boost: number;
}
export interface MemoryLifecyclePolicy {
  readonly version: "exponential-v1";
  readonly critical: CreationLifecyclePolicy;
  readonly important: CreationLifecyclePolicy;
  readonly minor: CreationLifecyclePolicy;
  readonly association: CreationLifecyclePolicy;
}
export const RAW_LIFECYCLE_POLICY: CreationLifecyclePolicy = Object.freeze({
  strength: 1, halfLifeSeconds: 90 * 86400, threshold: 0.5, boost: 0.2,
});
export const DEFAULT_MEMORY_LIFECYCLE_POLICY: MemoryLifecyclePolicy = Object.freeze({
  version: "exponential-v1",
  association: Object.freeze({ strength: 0.4, halfLifeSeconds: 45 * 86400, threshold: 0.2, boost: 0.2 }),
  critical: Object.freeze({ strength: 1, halfLifeSeconds: 365 * 86400, threshold: 0.2, boost: 0.2 }),
  important: Object.freeze({ strength: 0.8, halfLifeSeconds: 90 * 86400, threshold: 0.2, boost: 0.2 }),
  minor: Object.freeze({ strength: 0.4, halfLifeSeconds: 14 * 86400, threshold: 0.2, boost: 0.2 }),
});
export function isKnowledgeSeverity(value: unknown): value is KnowledgeSeverity {
  return value === "critical" || value === "important" || value === "minor";
}
export function parseMemoryLifecyclePolicy(value: unknown): MemoryLifecyclePolicy {
  const raw = value as MemoryLifecyclePolicy | null;
  if (!raw || raw.version !== "exponential-v1" || !["critical,important,minor,version", "association,critical,important,minor,version"].includes(Object.keys(raw).sort().join())) {
    throw new Error("Invalid memory lifecycle policy");
  }
  const category = (input: CreationLifecyclePolicy): CreationLifecyclePolicy => {
    if (!input || Object.keys(input).sort().join() !== "boost,halfLifeSeconds,strength,threshold" ||
        !Number.isFinite(input.halfLifeSeconds) || input.halfLifeSeconds <= 0 ||
        !Number.isFinite(Math.LN2 / input.halfLifeSeconds) || Math.LN2 / input.halfLifeSeconds === 0 ||
        ![input.strength, input.threshold, input.boost].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || input.threshold === 0) {
      throw new Error("Invalid memory lifecycle category");
    }
    return Object.freeze({ ...input });
  };
  return Object.freeze({ version: raw.version, critical: category(raw.critical), important: category(raw.important), minor: category(raw.minor), association: category("association" in raw ? raw.association : DEFAULT_MEMORY_LIFECYCLE_POLICY.association) });
}
