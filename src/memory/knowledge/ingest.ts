import { randomUUID } from "node:crypto";
import { UNKNOWN_INSTANT } from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import {
  EvidenceStore,
  asProvenanceId,
  asUtteranceId,
  cloneInstant,
} from "./evidence.js";
import type {
  ProvenanceRelation,
  SpeechAct,
  Utterance,
} from "./evidence-types.js";
import { asArtifactId } from "./ids.js";
import type {
  Artifact,
  ContentKind,
  Instant,
  KnowledgeIdFactory,
} from "./types.js";

const FADER_VAR_PATTERN = /fader\s+v[aå]r\s+som\s+[aä]r\s+i\s+himmelen/iu;

export interface IngestScope {
  readonly verified: boolean;
  readonly tags?: readonly string[];
}

export interface IngestBudget {
  readonly maximumUtf8Bytes: number;
}

/**
 * Utterance-to-artifact relation used when a caller names none.
 *
 * `appears_in` is correct for the dialogue path, where the utterance text is
 * literally part of the turn artifact. Content produced *about* an artifact
 * rather than taken *from* it must pass `derived_from` instead — a model's
 * description of an uploaded image never appeared in that image, and recording
 * it as though it did would put a false claim into the provenance graph.
 */
export const DEFAULT_INGEST_RELATION: ProvenanceRelation = "appears_in";

const INGEST_RELATIONS: readonly ProvenanceRelation[] = [
  "appears_in",
  "derived_from",
  "caused_by",
];

export interface IngestInput {
  readonly content: string;
  readonly speaker: string;
  readonly locator?: string;
  readonly contentKind?: ContentKind;
  readonly act?: SpeechAct;
  /** Defaults to {@link DEFAULT_INGEST_RELATION}. */
  readonly relation?: ProvenanceRelation;
  readonly assertedAt?: Instant;
  readonly ingestedAt?: Instant;
  readonly scope: IngestScope;
  readonly budget?: IngestBudget;
}

export interface IngestOptions {
  readonly store: EvidenceStore;
  readonly idFactory?: KnowledgeIdFactory;
}

export interface IngestResult {
  readonly artifact: Artifact;
  readonly utterances: readonly Utterance[];
}

export function ingest(
  input: IngestInput,
  options: IngestOptions,
): IngestResult {
  validateScope(input.scope);
  if (typeof input.content !== "string") {
    throw new KnowledgeModelError("invalid_input", "content must be a string");
  }
  const speaker = requireNonEmpty(input.speaker, "speaker");
  // Resolved before any store mutation so a rejected relation cannot leave a
  // half-written artifact behind.
  const relation = resolveRelation(input.relation);
  const content = input.content;
  const classified = classifySpeech(content, input.act, input.contentKind);
  const ingestedAt = input.ingestedAt ?? UNKNOWN_INSTANT;
  const assertedAt = input.assertedAt ?? UNKNOWN_INSTANT;
  const locator =
    input.locator === undefined || input.locator.trim().length === 0
      ? `message:${speaker}`
      : input.locator.trim();

  failIfOverBudget(input.budget, {
    locator,
    content,
    speaker,
    act: classified.act,
    contentKind: classified.contentKind,
  });

  const nextId = options.idFactory ?? randomUUID;
  const artifact: Artifact = {
    id: asArtifactId(`A008_knowledge_artifact_${nextId()}`),
    contentKind: classified.contentKind,
    locator,
    ingestedAt: cloneInstant(ingestedAt),
  };
  const storedArtifact = options.store.addArtifact(artifact);
  const utterance: Utterance = {
    id: asUtteranceId(`A008_knowledge_utterance_${nextId()}`),
    speaker,
    act: classified.act,
    contentKind: classified.contentKind,
    content,
    assertedAt: cloneInstant(assertedAt),
    ingestedAt: cloneInstant(ingestedAt),
    artifactId: storedArtifact.id,
  };
  const storedUtterance = options.store.addUtterance(utterance);
  options.store.addProvenance({
    id: asProvenanceId(`A008_knowledge_provenance_${nextId()}`),
    relation,
    fromKind: "utterance",
    fromId: storedUtterance.id,
    fromLabel: storedUtterance.content,
    toKind: "artifact",
    toId: storedArtifact.id,
    toLabel: storedArtifact.locator,
  });

  return {
    artifact: storedArtifact,
    utterances: [storedUtterance],
  };
}

export function classifySpeech(
  content: string,
  act?: SpeechAct,
  contentKind?: ContentKind,
): { readonly act: SpeechAct; readonly contentKind: ContentKind } {
  if (act !== undefined) {
    return {
      act,
      contentKind: contentKind ?? contentKindForAct(act, content),
    };
  }
  if (isKnownRecitation(content)) {
    return { act: "recitation", contentKind: contentKind ?? "prayer" };
  }
  const trimmed = content.trim();
  if (trimmed.endsWith("?")) {
    return {
      act: "question",
      contentKind: contentKind ?? "dialogue_assertion",
    };
  }
  if (isHypothetical(trimmed)) {
    return {
      act: "hypothetical",
      contentKind: contentKind ?? "dialogue_assertion",
    };
  }
  if (isQuotation(trimmed)) {
    return {
      act: "quotation",
      contentKind: contentKind ?? "dialogue_assertion",
    };
  }
  if (isPrediction(trimmed)) {
    return { act: "prediction", contentKind: contentKind ?? "forecast" };
  }
  return {
    act: "assertion",
    contentKind: contentKind ?? "dialogue_assertion",
  };
}

export function isKnownRecitation(content: string): boolean {
  return FADER_VAR_PATTERN.test(content);
}

function contentKindForAct(act: SpeechAct, content: string): ContentKind {
  if (act === "recitation" || isKnownRecitation(content)) {
    return "prayer";
  }
  if (act === "prediction") {
    return "forecast";
  }
  if (act === "instruction") {
    return "instruction";
  }
  return "dialogue_assertion";
}

function isHypothetical(content: string): boolean {
  return /^(suppose|hypothetically|imagine that)\b/iu.test(content.trim());
}

function isQuotation(content: string): boolean {
  const trimmed = content.trim();
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) ||
    (trimmed.startsWith("\u201c") && trimmed.endsWith("\u201d"))
  );
}

function isPrediction(content: string): boolean {
  return /\b(will probably|probably rain|it will)\b/iu.test(content);
}

function validateScope(scope: IngestScope | undefined): void {
  if (scope === undefined || scope.verified !== true) {
    throw new KnowledgeModelError(
      "invalid_input",
      "INGEST requires verified runtime scope",
    );
  }
}

function failIfOverBudget(
  budget: IngestBudget | undefined,
  record: {
    readonly locator: string;
    readonly content: string;
    readonly speaker: string;
    readonly act: SpeechAct;
    readonly contentKind: ContentKind;
  },
): void {
  if (budget === undefined) {
    return;
  }
  const serialized = JSON.stringify(record);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > budget.maximumUtf8Bytes) {
    throw new KnowledgeModelError(
      "invalid_input",
      `INGEST budget exceeded: ${bytes} utf8-bytes > ${budget.maximumUtf8Bytes}`,
    );
  }
}

function resolveRelation(
  relation: ProvenanceRelation | undefined,
): ProvenanceRelation {
  if (relation === undefined) {
    return DEFAULT_INGEST_RELATION;
  }
  if (!INGEST_RELATIONS.includes(relation)) {
    throw new KnowledgeModelError(
      "invalid_input",
      `relation must be one of ${INGEST_RELATIONS.join(", ")}`,
    );
  }
  return relation;
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      `${field} must not be empty`,
    );
  }
  return trimmed;
}
