import { KnowledgeModelError } from "./errors.js";
import { cloneInstant, cloneInterval, type EvidenceStore } from "./evidence.js";
import type {
  PayloadArtifact,
  PayloadClaim,
  PayloadEvent,
  PayloadHistoryEntry,
  PayloadProvenance,
  PayloadScope,
  PayloadStateEntry,
  PayloadUtterance,
  ProjectionPayload,
} from "./evidence-types.js";

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "id",
  "knowledgeId",
  "artifactId",
  "utteranceId",
  "claimId",
  "runtimeId",
  "taskId",
  "revision",
  "keepAlive",
  "strength",
  "memoryStrength",
  "activation",
  "activationStatus",
  "relevanceScore",
  "retrievalScore",
  "retrieval_score",
  "canonicalStatus",
  "supersededBy",
  "audit",
]);

export interface PayloadBudget {
  readonly maximumUtf8Bytes: number;
}

export interface ComposePayloadInput {
  readonly scope?: PayloadScope;
  readonly state?: readonly PayloadStateEntry[];
  readonly history?: readonly PayloadHistoryEntry[];
  readonly events?: readonly PayloadEvent[];
  readonly utterances?: readonly PayloadUtterance[];
  readonly claims?: readonly PayloadClaim[];
  readonly artifacts?: readonly PayloadArtifact[];
  readonly provenance?: readonly PayloadProvenance[];
  readonly budget?: PayloadBudget;
}

export interface ComposedPayload {
  readonly payload: ProjectionPayload;
  readonly serialized: string;
  readonly measuredUtf8Bytes: number;
}

export function emptyProjectionPayload(): ProjectionPayload {
  return {
    scope: { tags: [], entities: [], slots: [] },
    state: [],
    history: [],
    events: [],
    utterances: [],
    claims: [],
    artifacts: [],
    provenance: [],
  };
}

export function composeProjectionPayload(
  input: ComposePayloadInput,
): ComposedPayload {
  const payload = sanitizePayload({
    scope: copyScope(input.scope),
    state: (input.state ?? []).map(copyStateEntry),
    history: (input.history ?? []).map(copyHistoryEntry),
    events: (input.events ?? []).map(copyEvent),
    utterances: (input.utterances ?? []).map(copyUtterance),
    claims: (input.claims ?? []).map(copyClaim),
    artifacts: (input.artifacts ?? []).map(copyArtifact),
    provenance: (input.provenance ?? []).map(copyProvenance),
  });
  const serialized = serializeProjectionPayload(payload);
  const measuredUtf8Bytes = Buffer.byteLength(serialized, "utf8");
  if (
    input.budget !== undefined &&
    measuredUtf8Bytes > input.budget.maximumUtf8Bytes
  ) {
    throw new KnowledgeModelError(
      "invalid_input",
      `required projection payload does not fit the exact serialized budget: ${measuredUtf8Bytes} utf8-bytes > ${input.budget.maximumUtf8Bytes}`,
    );
  }
  return { payload, serialized, measuredUtf8Bytes };
}

export function payloadFromEvidence(
  store: EvidenceStore,
  options: {
    readonly scope?: PayloadScope;
    readonly budget?: PayloadBudget;
  } = {},
): ComposedPayload {
  return composeProjectionPayload({
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    state: [],
    history: [],
    events: [],
    utterances: store.listUtterances().map((utterance) => ({
      speaker: utterance.speaker,
      act: utterance.act,
      contentKind: utterance.contentKind,
      content: utterance.content,
      assertedAt: cloneInstant(utterance.assertedAt),
    })),
    claims: store.listClaims().map((claim) => ({
      label: claim.label,
      proposition: claim.proposition,
      certainty: claim.certainty,
      attributedTo: claim.attributedTo,
      status: claim.status,
      aboutInterval: cloneInterval(claim.aboutInterval),
    })),
    artifacts: store.listArtifacts().map((artifact) => ({
      locator: artifact.locator,
      contentKind: artifact.contentKind,
    })),
    provenance: store.listProvenance().map((record) => ({
      relation: record.relation,
      from: { kind: record.fromKind, label: record.fromLabel },
      to: { kind: record.toKind, label: record.toLabel },
    })),
    ...(options.budget === undefined ? {} : { budget: options.budget }),
  });
}

export function serializeProjectionPayload(payload: ProjectionPayload): string {
  return JSON.stringify({
    scope: {
      tags: [...payload.scope.tags],
      entities: [...payload.scope.entities],
      slots: [...payload.scope.slots],
    },
    state: payload.state.map((entry) => ({
      slot: entry.slot,
      value: entry.value,
      interval: serializeInterval(entry.interval),
    })),
    history: payload.history.map((entry) => ({
      slot: entry.slot,
      value: entry.value,
      interval: serializeInterval(entry.interval),
    })),
    events: payload.events.map((event) => ({
      type: event.type,
      label: event.label,
      eventTime: serializeInstant(event.eventTime),
    })),
    utterances: payload.utterances.map((utterance) => ({
      speaker: utterance.speaker,
      act: utterance.act,
      contentKind: utterance.contentKind,
      content: utterance.content,
      assertedAt: serializeInstant(utterance.assertedAt),
    })),
    claims: payload.claims.map((claim) => ({
      label: claim.label,
      proposition: claim.proposition,
      certainty: claim.certainty,
      attributedTo: claim.attributedTo,
      status: claim.status,
      aboutInterval: serializeInterval(claim.aboutInterval),
    })),
    artifacts: payload.artifacts.map((artifact) => ({
      locator: artifact.locator,
      contentKind: artifact.contentKind,
    })),
    provenance: payload.provenance.map((record) => ({
      relation: record.relation,
      from: { kind: record.from.kind, label: record.from.label },
      to: { kind: record.to.kind, label: record.to.label },
    })),
  });
}

function serializeInstant(instant: ProjectionPayload["utterances"][number]["assertedAt"]): unknown {
  if (typeof instant === "object" && instant.unknown === true) {
    return { unknown: true };
  }
  return instant;
}

function serializeInterval(interval: PayloadHistoryEntry["interval"]): unknown {
  return {
    from: serializeInstant(interval.from),
    to: interval.to === null ? null : serializeInstant(interval.to),
  };
}

function copyScope(scope: PayloadScope | undefined): PayloadScope {
  if (scope === undefined) {
    return { tags: [], entities: [], slots: [] };
  }
  return {
    tags: [...scope.tags],
    entities: [...scope.entities],
    slots: [...scope.slots],
  };
}

function copyStateEntry(entry: PayloadStateEntry): PayloadStateEntry {
  return {
    slot: entry.slot,
    value: entry.value,
    interval: cloneInterval(entry.interval),
  };
}

function copyHistoryEntry(entry: PayloadHistoryEntry): PayloadHistoryEntry {
  if (entry.interval === undefined) {
    throw new KnowledgeModelError(
      "invalid_input",
      "history entries always carry their interval",
    );
  }
  return {
    slot: entry.slot,
    value: entry.value,
    interval: cloneInterval(entry.interval),
  };
}

function copyEvent(event: PayloadEvent): PayloadEvent {
  return {
    type: event.type,
    label: event.label,
    eventTime: cloneInstant(event.eventTime),
  };
}

function copyUtterance(utterance: PayloadUtterance): PayloadUtterance {
  if (utterance.speaker.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "utterances always carry speaker and speech act",
    );
  }
  if (utterance.act.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "utterances always carry speaker and speech act",
    );
  }
  return {
    speaker: utterance.speaker,
    act: utterance.act,
    contentKind: utterance.contentKind,
    content: utterance.content,
    assertedAt: cloneInstant(utterance.assertedAt),
  };
}

function copyClaim(claim: PayloadClaim): PayloadClaim {
  if (claim.attributedTo.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "claims always carry attribution and status",
    );
  }
  if (claim.status.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "claims always carry attribution and status",
    );
  }
  return {
    label: claim.label,
    proposition: claim.proposition,
    certainty: claim.certainty,
    attributedTo: claim.attributedTo,
    status: claim.status,
    aboutInterval: cloneInterval(claim.aboutInterval),
  };
}

function copyArtifact(artifact: PayloadArtifact): PayloadArtifact {
  return {
    locator: artifact.locator,
    contentKind: artifact.contentKind,
  };
}

function copyProvenance(record: PayloadProvenance): PayloadProvenance {
  return {
    relation: record.relation,
    from: { kind: record.from.kind, label: record.from.label },
    to: { kind: record.to.kind, label: record.to.label },
  };
}

function sanitizePayload(payload: ProjectionPayload): ProjectionPayload {
  const forbidden = collectForbiddenKeys(payload);
  if (forbidden.length > 0) {
    throw new KnowledgeModelError(
      "invalid_proposal",
      `projection payload must not contain ${forbidden.join(", ")}`,
    );
  }
  return payload;
}

function collectForbiddenKeys(value: unknown, keys: string[] = []): string[] {
  if (typeof value !== "object" || value === null) {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectForbiddenKeys(item, keys);
    }
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key) && !keys.includes(key)) {
      keys.push(key);
    }
    collectForbiddenKeys(child, keys);
  }
  return keys;
}
