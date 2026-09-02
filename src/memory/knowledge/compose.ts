import type { ComposedSet, RetrievedRecord, RetrievedSurface } from "./read-types.js";

const SURFACE_ORDER: Readonly<Record<RetrievedSurface, number>> = {
  claim: 0,
  event: 1,
  utterance: 2,
  artifact: 3,
  provenance: 4,
  history: 5,
  state: 6,
};

export function compose(admitted: readonly RetrievedRecord[]): ComposedSet {
  const records = [...admitted].sort((left, right) => {
    const surface = SURFACE_ORDER[left.surface] - SURFACE_ORDER[right.surface];
    if (surface !== 0) {
      return surface;
    }
    const severity = claimSeverity(left) - claimSeverity(right);
    if (severity !== 0) {
      return severity;
    }
    const strength = strengthOf(left) - strengthOf(right);
    if (strength !== 0) {
      return strength;
    }
    return left.id.localeCompare(right.id);
  });
  return { records };
}

function claimSeverity(record: RetrievedRecord): number {
  if (record.surface === "claim" && record.status === "contested") {
    return 0;
  }
  return 1;
}

function strengthOf(record: RetrievedRecord): number {
  if (record.surface === "state" || record.surface === "history") {
    return 1;
  }
  return record.strength ?? 1;
}
