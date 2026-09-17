import { UNKNOWN_INSTANT, isUnknownInstant } from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import { asArtifactId } from "./ids.js";
import type {
  AcceptanceDecision,
  Claim,
  ClaimDraft,
  ClaimId,
  ClaimStatus,
  ProvenanceId,
  ProvenanceRecord,
  ProvenanceRelation,
  SpeechAct,
  Utterance,
  UtteranceId,
} from "./evidence-types.js";
import type { Artifact, ArtifactId, Instant, Interval } from "./types.js";

const NEVER_WORLD_CLAIM_ACTS: ReadonlySet<SpeechAct> = new Set([
  "recitation",
  "quotation",
  "hypothetical",
  "question",
  "instruction",
  "performative",
]);

export function allowsUserAssertionAcceptance(act: SpeechAct): boolean {
  return act === "assertion";
}

export function asUtteranceId(value: string): UtteranceId {
  return requireNonEmpty(value, "utterance id") as UtteranceId;
}

export function asClaimId(value: string): ClaimId {
  return requireNonEmpty(value, "claim id") as ClaimId;
}

export function asProvenanceId(value: string): ProvenanceId {
  return requireNonEmpty(value, "provenance id") as ProvenanceId;
}

export function allowsWorldClaims(act: SpeechAct): boolean {
  return !NEVER_WORLD_CLAIM_ACTS.has(act);
}

export function isCurrentInterval(interval: Interval): boolean {
  return interval.to === null;
}

export class EvidenceStore {
  readonly #artifacts = new Map<ArtifactId, Artifact>();
  readonly #utterances = new Map<UtteranceId, Utterance>();
  readonly #claims = new Map<ClaimId, Claim>();
  readonly #provenance = new Map<ProvenanceId, ProvenanceRecord>();

  getArtifact(id: ArtifactId): Artifact | undefined {
    const artifact = this.#artifacts.get(id);
    return artifact === undefined ? undefined : cloneArtifact(artifact);
  }

  getUtterance(id: UtteranceId): Utterance | undefined {
    const utterance = this.#utterances.get(id);
    return utterance === undefined ? undefined : cloneUtterance(utterance);
  }

  getClaim(id: ClaimId): Claim | undefined {
    const claim = this.#claims.get(id);
    return claim === undefined ? undefined : cloneClaim(claim);
  }

  requireUtterance(id: UtteranceId): Utterance {
    const utterance = this.getUtterance(id);
    if (utterance === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        `utterance ${id} is not in the evidence store`,
      );
    }
    return utterance;
  }

  requireClaim(id: ClaimId): Claim {
    const claim = this.getClaim(id);
    if (claim === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        `claim ${id} is not in the evidence store`,
      );
    }
    return claim;
  }

  listArtifacts(): readonly Artifact[] {
    return [...this.#artifacts.values()].map(cloneArtifact);
  }

  listUtterances(): readonly Utterance[] {
    return [...this.#utterances.values()].map(cloneUtterance);
  }

  listClaims(): readonly Claim[] {
    return [...this.#claims.values()].map(cloneClaim);
  }

  listProvenance(): readonly ProvenanceRecord[] {
    return [...this.#provenance.values()].map(cloneProvenance);
  }

  addArtifact(artifact: Artifact): Artifact {
    if (this.#artifacts.has(artifact.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `artifact ${artifact.id} is already recorded`,
      );
    }
    const stored = cloneArtifact(artifact);
    this.#artifacts.set(stored.id, stored);
    return cloneArtifact(stored);
  }

  addUtterance(utterance: Utterance): Utterance {
    if (this.#utterances.has(utterance.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `utterance ${utterance.id} is already recorded`,
      );
    }
    if (!this.#artifacts.has(utterance.artifactId)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `utterance ${utterance.id} references unknown artifact ${utterance.artifactId}`,
      );
    }
    const stored = cloneUtterance(utterance);
    this.#utterances.set(stored.id, stored);
    return cloneUtterance(stored);
  }

  addProvenance(record: ProvenanceRecord): ProvenanceRecord {
    if (this.#provenance.has(record.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `provenance ${record.id} is already recorded`,
      );
    }
    const stored = cloneProvenance(record);
    this.#provenance.set(stored.id, stored);
    return cloneProvenance(stored);
  }

  recordClaim(input: {
    readonly id: ClaimId;
    readonly label: string;
    readonly proposition: Claim["proposition"];
    readonly certainty: Claim["certainty"];
    readonly attributedTo: string;
    readonly derivedFrom: Claim["derivedFrom"];
    readonly aboutInterval: Interval;
    readonly provenanceId: ProvenanceId;
  }): Claim {
    if (this.#claims.has(input.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `claim ${input.id} is already recorded`,
      );
    }
    const stored: Claim = {
      id: input.id,
      label: requireNonEmpty(input.label, "claim label"),
      proposition: cloneProposition(input.proposition),
      certainty: input.certainty,
      attributedTo: requireNonEmpty(input.attributedTo, "claim attributedTo"),
      derivedFrom: {
        kind: input.derivedFrom.kind,
        id: requireNonEmpty(input.derivedFrom.id, "claim derivedFrom.id"),
      },
      aboutInterval: cloneInterval(input.aboutInterval),
      status: "asserted",
    };
    this.#claims.set(stored.id, stored);
    if (input.derivedFrom.kind === "utterance") {
      const utterance = this.#utterances.get(
        asUtteranceId(input.derivedFrom.id),
      );
      this.addProvenance({
        id: input.provenanceId,
        relation: "derived_from",
        fromKind: "claim",
        fromId: stored.id,
        fromLabel: stored.label,
        toKind: "utterance",
        toId: input.derivedFrom.id,
        toLabel: utterance?.content ?? stored.attributedTo,
      });
    }
    return cloneClaim(stored);
  }

  hydrate(input: {
    readonly artifacts: readonly Artifact[];
    readonly utterances: readonly Utterance[];
    readonly claims: readonly Claim[];
    readonly provenance: readonly ProvenanceRecord[];
  }): void {
    this.#artifacts.clear();
    this.#utterances.clear();
    this.#claims.clear();
    this.#provenance.clear();
    for (const artifact of input.artifacts) {
      this.#artifacts.set(artifact.id, cloneArtifact(artifact));
    }
    for (const utterance of input.utterances) {
      this.#utterances.set(utterance.id, cloneUtterance(utterance));
    }
    for (const claim of input.claims) {
      this.#claims.set(claim.id, cloneClaim(claim));
    }
    for (const record of input.provenance) {
      this.#provenance.set(record.id, cloneProvenance(record));
    }
  }

  applyAcceptance(
    claimId: ClaimId,
    status: ClaimStatus,
    decision: {
      readonly policyId: string;
      readonly decision: AcceptanceDecision;
      readonly reason: string;
    },
  ): Claim {
    const existing = this.#claims.get(claimId);
    if (existing === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        `claim ${claimId} is not in the evidence store`,
      );
    }
    const updated: Claim = {
      id: existing.id,
      label: existing.label,
      proposition: cloneProposition(existing.proposition),
      certainty: existing.certainty,
      attributedTo: existing.attributedTo,
      derivedFrom: {
        kind: existing.derivedFrom.kind,
        id: existing.derivedFrom.id,
      },
      aboutInterval: cloneInterval(existing.aboutInterval),
      status,
      acceptance: {
        policyId: decision.policyId,
        decision: decision.decision,
        reason: decision.reason,
      },
    };
    this.#claims.set(claimId, updated);
    return cloneClaim(updated);
  }
}

export function recordClaimsFromUtterance(
  store: EvidenceStore,
  utteranceId: UtteranceId,
  drafts: readonly ClaimDraft[],
  options: { readonly idFactory: () => string },
): readonly Claim[] {
  const utterance = store.requireUtterance(utteranceId);
  if (!allowsWorldClaims(utterance.act)) {
    return [];
  }
  const recorded: Claim[] = [];
  for (const draft of drafts) {
    const aboutInterval =
      utterance.act === "prediction"
        ? requireNonCurrentInterval(draft.aboutInterval)
        : cloneInterval(draft.aboutInterval);
    recorded.push(
      store.recordClaim({
        id: asClaimId(`A008_knowledge_claim_${options.idFactory()}`),
        label: draft.label,
        proposition: draft.proposition,
        certainty: draft.certainty,
        attributedTo: utterance.speaker,
        derivedFrom: { kind: "utterance", id: utterance.id },
        aboutInterval,
        provenanceId: asProvenanceId(
          `A008_knowledge_provenance_${options.idFactory()}`,
        ),
      }),
    );
  }
  return recorded;
}

export function cloneInstant(instant: Instant): Instant {
  return isUnknownInstant(instant) ? UNKNOWN_INSTANT : instant;
}

export function cloneInterval(interval: Interval): Interval {
  return {
    from: cloneInstant(interval.from),
    to: interval.to === null ? null : cloneInstant(interval.to),
  };
}

function requireNonCurrentInterval(interval: Interval): Interval {
  if (isCurrentInterval(interval)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "prediction never opens a current-state binding",
    );
  }
  return cloneInterval(interval);
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

function cloneArtifact(artifact: Artifact): Artifact {
  return {
    id: asArtifactId(artifact.id),
    contentKind: artifact.contentKind,
    locator: artifact.locator,
    ingestedAt: cloneInstant(artifact.ingestedAt),
  };
}

function cloneUtterance(utterance: Utterance): Utterance {
  return {
    id: utterance.id,
    speaker: utterance.speaker,
    act: utterance.act,
    contentKind: utterance.contentKind,
    content: utterance.content,
    assertedAt: cloneInstant(utterance.assertedAt),
    ingestedAt: cloneInstant(utterance.ingestedAt),
    artifactId: utterance.artifactId,
  };
}

function cloneClaim(claim: Claim): Claim {
  const cloned: Claim = {
    id: claim.id,
    label: claim.label,
    proposition: cloneProposition(claim.proposition),
    certainty: claim.certainty,
    attributedTo: claim.attributedTo,
    derivedFrom: {
      kind: claim.derivedFrom.kind,
      id: claim.derivedFrom.id,
    },
    aboutInterval: cloneInterval(claim.aboutInterval),
    status: claim.status,
  };
  if (claim.acceptance === undefined) {
    return cloned;
  }
  return {
    ...cloned,
    acceptance: {
      policyId: claim.acceptance.policyId,
      decision: claim.acceptance.decision,
      reason: claim.acceptance.reason,
    },
  };
}

function cloneProvenance(record: ProvenanceRecord): ProvenanceRecord {
  return {
    id: record.id,
    relation: record.relation,
    fromKind: record.fromKind,
    fromId: record.fromId,
    fromLabel: record.fromLabel,
    toKind: record.toKind,
    toId: record.toId,
    toLabel: record.toLabel,
  };
}

function cloneProposition(
  proposition: Claim["proposition"],
): Claim["proposition"] {
  switch (proposition.kind) {
    case "attribute_binding":
      return {
        kind: "attribute_binding",
        entityLabel: proposition.entityLabel,
        attribute: proposition.attribute,
        value: proposition.value,
      };
    case "relationship_binding":
      return {
        kind: "relationship_binding",
        subjectLabel: proposition.subjectLabel,
        relation: proposition.relation,
        objectLabel: proposition.objectLabel,
      };
    case "event_occurrence": {
      const cloned: Claim["proposition"] = {
        kind: "event_occurrence",
        type: proposition.type,
      };
      if (proposition.participants === undefined) {
        return cloned;
      }
      return {
        kind: "event_occurrence",
        type: proposition.type,
        participants: [...proposition.participants],
      };
    }
    case "predicate":
      return {
        kind: "predicate",
        name: proposition.name,
        arguments: [...proposition.arguments],
      };
    case "negation":
      return {
        kind: "negation",
        of: cloneProposition(proposition.of),
      };
  }
}
