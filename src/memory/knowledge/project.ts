import { composeProjectionPayload } from "./payload.js";
import type {
  PayloadArtifact,
  PayloadClaim,
  PayloadEvent,
  PayloadHistoryEntry,
  PayloadProvenance,
  PayloadStateEntry,
  PayloadUtterance,
  ProjectionPayload,
} from "./evidence-types.js";
import type {
  ComposedSet,
  OmittedRecord,
  ProjectDiagnostics,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";

export interface ProjectBudget {
  readonly maximumUtf8Bytes: number;
}

export interface ProjectInput {
  readonly scope: SemanticScope;
  readonly composed: ComposedSet;
  readonly omitted?: readonly OmittedRecord[];
  readonly reactivationCandidates?: readonly string[];
  readonly budget?: ProjectBudget;
}

export interface ProjectResult {
  readonly payload: ProjectionPayload;
  readonly serialized: string;
  readonly measuredUtf8Bytes: number;
  readonly diagnostics: ProjectDiagnostics;
}

export function project(input: ProjectInput): ProjectResult {
  const records = input.composed.records;
  const payloadInput = {
    scope: {
      tags: [...input.scope.tags],
      entities: [...input.scope.entities],
      slots: input.scope.slots.map((slot) =>
        slot.kind === "attribute"
          ? `${slot.entity}.${slot.name}`
          : `${String(slot.subject)} --${slot.name}--> ${slot.object === undefined ? "?" : String(slot.object)}`,
      ),
    },
    state: records
      .filter((record) => record.surface === "state")
      .map(toStateEntry),
    history: records
      .filter((record) => record.surface === "history")
      .map(toHistoryEntry),
    events: records.filter((record) => record.surface === "event").map(toEvent),
    utterances: records
      .filter((record) => record.surface === "utterance")
      .map(toUtterance),
    claims: records.filter((record) => record.surface === "claim").map(toClaim),
    artifacts: records
      .filter((record) => record.surface === "artifact")
      .map(toArtifact),
    provenance: records
      .filter((record) => record.surface === "provenance")
      .map(toProvenance),
    ...(input.budget === undefined ? {} : { budget: input.budget }),
  };

  const composed = composeProjectionPayload(payloadInput);
  const payload = composed.payload;
  const serialized = composed.serialized;
  const measuredUtf8Bytes = composed.measuredUtf8Bytes;

  return {
    payload,
    serialized,
    measuredUtf8Bytes,
    diagnostics: {
      records,
      omitted: input.omitted ?? [],
      reactivationCandidates: input.reactivationCandidates ?? [],
    },
  };
}

function toStateEntry(record: RetrievedRecord): PayloadStateEntry {
  return {
    slot: record.slotLabel ?? record.label,
    value: record.value,
    interval: requireInterval(record),
  };
}

function toHistoryEntry(record: RetrievedRecord): PayloadHistoryEntry {
  return {
    slot: record.slotLabel ?? record.label,
    value: record.value,
    interval: requireInterval(record),
  };
}

function toEvent(record: RetrievedRecord): PayloadEvent {
  return {
    type: record.eventType ?? "event",
    label: record.label,
    eventTime: record.eventTime ?? { unknown: true },
  };
}

function toUtterance(record: RetrievedRecord): PayloadUtterance {
  return {
    speaker: record.speaker ?? "",
    act: record.act ?? "assertion",
    contentKind: record.contentKind ?? "dialogue_assertion",
    content: record.content ?? record.label,
    assertedAt: record.assertedAt ?? { unknown: true },
  };
}

function toClaim(record: RetrievedRecord): PayloadClaim {
  return {
    label: record.label,
    proposition: record.proposition ?? {
      kind: "attribute_binding",
      entityLabel: record.slotLabel ?? record.label,
      attribute: "value",
      value: record.value,
    },
    certainty: record.certainty ?? "certain",
    attributedTo: record.attributedTo ?? "",
    status: record.status ?? "asserted",
    aboutInterval: requireInterval(record),
  };
}

function toArtifact(record: RetrievedRecord): PayloadArtifact {
  return {
    locator: record.locator ?? record.label,
    contentKind: record.contentKind ?? "dialogue_assertion",
  };
}

function toProvenance(record: RetrievedRecord): PayloadProvenance {
  return {
    relation: record.provenanceRelation ?? "derived_from",
    from: {
      kind: asFromKind(record.fromKind),
      label: record.fromLabel ?? record.label,
    },
    to: {
      kind: asToKind(record.toKind),
      label: record.toLabel ?? record.label,
    },
  };
}

function requireInterval(
  record: RetrievedRecord,
): NonNullable<RetrievedRecord["interval"]> {
  if (record.interval === undefined) {
    return { from: { unknown: true }, to: null };
  }
  return record.interval;
}

function asFromKind(
  value: string | undefined,
): "claim" | "utterance" | "binding" {
  if (value === "utterance" || value === "binding") {
    return value;
  }
  return "claim";
}

function asToKind(
  value: string | undefined,
): "utterance" | "artifact" | "claim" | "event" | "transition" {
  if (
    value === "utterance" ||
    value === "artifact" ||
    value === "claim" ||
    value === "event" ||
    value === "transition"
  ) {
    return value;
  }
  return "utterance";
}
