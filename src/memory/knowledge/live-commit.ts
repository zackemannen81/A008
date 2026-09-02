import { randomUUID } from "node:crypto";
import { Utf8ByteKnowledgeIntakeMeasurer } from "../../orchestration/post-output-knowledge-intake.js";
import type {
  RelationClassifierDecision,
  RelationCommitInput,
  RelationGatedCommitResult,
  KnowledgeRelationClassifier,
  PendingRelationIndexRepair,
  UpdatedRelationIndex,
} from "../../orchestration/relation-gated-memory-commit.js";
import type { StagedProposalCommitter } from "../../orchestration/post-output-memory-coordinator.js";
import {
  serializeRelationClassifierInput,
} from "../../orchestration/relation-gated-memory-commit.js";
import type { ReconciliationDecision, ReconciliationRelation } from "../types.js";
import { accept } from "./accept.js";
import { UNKNOWN_INSTANT } from "./clocks.js";
import { asUtteranceId, recordClaimsFromUtterance } from "./evidence.js";
import {
  USER_ASSERTION_POLICY_ID,
  type ClaimDraft,
} from "./evidence-types.js";
import { asEntityId } from "./ids.js";
import { ingest } from "./ingest.js";
import { reinforce } from "./lifecycle.js";
import type { KnowledgeReadContext } from "./read-types.js";
import { reconcile } from "./reconcile.js";
import type { SlotClaim } from "./state-types.js";
import { update } from "./update.js";
import type {
  Entity,
  KnowledgeIdFactory,
  SlotDefinition,
} from "./types.js";

export interface KnowledgeEngineCommitOptions {
  readonly context: KnowledgeReadContext;
  readonly classifier: KnowledgeRelationClassifier;
  readonly idFactory?: KnowledgeIdFactory;
}

const STATEMENT_SLOT = "statement";
const ACCEPT_POLICY = { id: USER_ASSERTION_POLICY_ID };

export class KnowledgeEngineCommit implements StagedProposalCommitter {
  readonly #context: KnowledgeReadContext;
  readonly #classifier: KnowledgeRelationClassifier;
  readonly #idFactory: KnowledgeIdFactory;
  readonly #ingested = new Map<string, string>();
  readonly #measurer = new Utf8ByteKnowledgeIntakeMeasurer();

  constructor(options: KnowledgeEngineCommitOptions) {
    this.#context = options.context;
    this.#classifier = options.classifier;
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async commit(input: RelationCommitInput): Promise<RelationGatedCommitResult> {
    const staged = input.batch.proposals[input.proposalIndex];
    if (staged === undefined) {
      throw new Error(
        `proposal ${input.proposalIndex} is missing from the staged batch`,
      );
    }
    const candidates = this.#classifierCandidates();
    const classifierInput = {
      proposal: {
        proposition: staged.proposal.proposition,
        kind: staged.proposal.kind,
        tags: [...(staged.proposal.tags ?? [])],
        scope: [...staged.proposal.scope],
        domains: [...staged.domains],
        entities: [...staged.entities],
        confidence: staged.proposal.confidence ?? 0.5,
      },
      candidates,
    };
    const serialized = serializeRelationClassifierInput(classifierInput);
    const classifierDecision = await this.#classifier.classify(classifierInput);
    const utteranceId = this.#ingestOnce(input);
    const drafts: readonly ClaimDraft[] = [
      {
        label: staged.proposal.proposition,
        proposition: {
          kind: "attribute_binding",
          entityLabel: entityLabelOf(staged.entities, staged.proposal.proposition),
          attribute: STATEMENT_SLOT,
          value: staged.proposal.proposition,
        },
        certainty: "certain",
        aboutInterval: { from: UNKNOWN_INSTANT, to: null },
      },
    ];
    const recorded = recordClaimsFromUtterance(
      this.#context.evidence,
      asUtteranceId(utteranceId),
      drafts,
      { idFactory: this.#idFactory },
    );
    const evidenceClaim = recorded[0];
    if (evidenceClaim !== undefined) {
      this.#context.lifecycle.attach({
        evidenceId: evidenceClaim.id,
        evidenceKind: "claim",
        at: UNKNOWN_INSTANT,
        caller: "knowledge-commit",
      });
      accept(
        {
          claimId: evidenceClaim.id,
          policy: ACCEPT_POLICY,
          authority: { verified: true, speakerRole: "user" },
          sourceMessage: input.batch.sourceMessage,
        },
        this.#context.evidence,
      );
    }

    const accepted =
      evidenceClaim !== undefined &&
      this.#context.evidence.requireClaim(evidenceClaim.id).status === "accepted";
    const slot = this.#ensureSlot(staged.entities, staged.proposal.proposition);
    const slotClaim = statementClaim({
      id: evidenceClaim?.id ?? `slot:${this.#idFactory()}`,
      slot: slot.ref,
      value: staged.proposal.proposition,
      causedBy: utteranceId,
    });
    if (this.#context.state.claim(slotClaim.id) === undefined) {
      this.#context.state.recordClaim(slotClaim);
    }

    let relation: ReconciliationRelation = "new";
    const conflictTargetIds: string[] = [];
    if (accepted) {
      const decision = reconcile(this.#context.state, slotClaim, slot);
      if (classifierDecision.type === "conflict" || decision.outcome === "conflict") {
        this.#context.state.applyConflict(decision);
        relation = "conflict";
        conflictTargetIds.push(...decision.competingClaimIds);
      } else if (decision.outcome === "change") {
        update(this.#context.state, decision, { decidedBy: USER_ASSERTION_POLICY_ID });
        relation =
          classifierDecision.type === "supersede" ||
          classifierDecision.type === "extend"
            ? classifierDecision.type
            : "new";
      } else if (decision.outcome === "re_assertion") {
        relation = "restatement";
        this.#reinforceEvidence(slotClaim.id, utteranceId);
      } else if (
        decision.outcome === "correction" ||
        decision.outcome === "retraction"
      ) {
        update(this.#context.state, decision, { decidedBy: USER_ASSERTION_POLICY_ID });
        relation = "supersede";
      }
    } else if (classifierDecision.type === "restatement") {
      relation = "restatement";
      this.#reinforceMatchingEvidence(staged.proposal.proposition);
    }

    const mappedDecision = mappedReconciliation(classifierDecision, relation);
    return {
      classifierDecision,
      reconciliationDecision: mappedDecision,
      reconciliation: {
        relation,
        item: null,
        previousItem: null,
        conflictTargetIds,
      },
      evidence: {
        materializedCandidateIds: candidates.map((candidate) => candidate.handle),
        classifierCandidateIds: candidates.map((candidate) => candidate.handle),
        classifierInputSerialized: serialized,
        classifierInputMeasuredUnits: this.#measurer.measure(serialized),
        classifierInputMeasurementUnit: this.#measurer.unit,
      },
      index: { status: "not_required" },
    };
  }

  async repairIndex(
    pending: PendingRelationIndexRepair,
  ): Promise<UpdatedRelationIndex> {
    return { status: "updated", document: pending.document };
  }

  #ingestOnce(input: RelationCommitInput): string {
    const key = `${input.batch.taskId}:${input.batch.sourceMessage}`;
    const existing = this.#ingested.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const ingested = ingest(
      {
        content: input.batch.sourceMessage,
        speaker: "user",
        locator: `turn:${input.batch.taskId}`,
        assertedAt: UNKNOWN_INSTANT,
        ingestedAt: UNKNOWN_INSTANT,
        scope: {
          verified: true,
          ...(input.batch.proposals[0]?.proposal.scope === undefined
            ? {}
            : { tags: input.batch.proposals[0].proposal.scope }),
        },
      },
      { store: this.#context.evidence, idFactory: this.#idFactory },
    );
    const utterance = ingested.utterances[0];
    if (utterance === undefined) {
      throw new Error("INGEST did not record an utterance");
    }
    this.#context.lifecycle.attach({
      evidenceId: utterance.id,
      evidenceKind: "utterance",
      at: UNKNOWN_INSTANT,
      caller: "knowledge-commit",
    });
    this.#ingested.set(key, utterance.id);
    return utterance.id;
  }

  #ensureSlot(
    entities: readonly string[],
    proposition: string,
  ): SlotDefinition {
    const currentMatch = this.#context.state
      .snapshot()
      .bindings.find(
        (binding) =>
          binding.interval.to === null &&
          binding.kind === "attribute" &&
          (binding.label === proposition || binding.value === proposition),
      );
    if (currentMatch !== undefined && currentMatch.kind === "attribute") {
      const existingSlot = this.#context.slots.get(currentMatch.slot);
      if (existingSlot !== undefined) {
        return existingSlot;
      }
    }
    const label = entityLabelOf(entities, proposition);
    const existing = this.#context.entities.findByLabel(label)[0];
    const entity: Entity =
      existing ??
      ({
        id: asEntityId(slugEntityId(label)),
        type: "fact",
        labels: uniqueLabels([
          label,
          proposition,
          ...entities,
          ...tokenize(proposition),
        ]),
      } as Entity);
    if (existing === undefined) {
      this.#context.entities.register(entity);
    }
    const ref = {
      kind: "attribute" as const,
      entity: entity.id,
      name: STATEMENT_SLOT,
    };
    const found = this.#context.slots.get(ref);
    if (found !== undefined) {
      return found;
    }
    const definition: SlotDefinition = {
      ref,
      cardinality: "single",
      valueType: "string",
    };
    this.#context.slots.register(definition);
    return definition;
  }

  #classifierCandidates() {
    const current = this.#context.state
      .snapshot()
      .bindings.filter((binding) => binding.interval.to === null);
    return current.map((binding, index) => {
      const viewed = this.#context.lifecycle.get(binding.claimId);
      return {
        handle: `candidate_${index + 1}`,
        proposition: binding.label,
        kind: "fact",
        tags: [],
        scope: ["local"],
        authority: 1,
        confidence: 0.5,
        activationStatus: (viewed?.lifecycle.state === "dormant"
          ? "dormant"
          : "active") as "active" | "dormant",
      };
    });
  }

  #reinforceEvidence(claimId: string, utteranceId: string): void {
    const ids = [claimId, utteranceId].filter((id) =>
      this.#context.lifecycle.get(id) !== undefined,
    );
    if (ids.length === 0) {
      return;
    }
    reinforce(this.#context.lifecycle, {
      evidenceIds: ids,
      caller: "knowledge-commit",
      reason: "re_assertion after ACCEPT",
      at: UNKNOWN_INSTANT,
    });
  }

  #reinforceMatchingEvidence(proposition: string): void {
    const ids = this.#context.lifecycle
      .list()
      .filter((record) => {
        if (record.evidenceKind === "claim") {
          const claim = this.#context.evidence
            .listClaims()
            .find((item) => item.id === record.evidenceId);
          return claim?.label === proposition;
        }
        if (record.evidenceKind === "utterance") {
          const utterance = this.#context.evidence
            .listUtterances()
            .find((item) => item.id === record.evidenceId);
          return utterance?.content.includes(proposition) === true;
        }
        return false;
      })
      .map((record) => record.evidenceId);
    if (ids.length === 0) {
      return;
    }
    reinforce(this.#context.lifecycle, {
      evidenceIds: ids,
      caller: "knowledge-commit",
      reason: "classifier restatement comparator",
      at: UNKNOWN_INSTANT,
    });
  }
}

function statementClaim(input: {
  readonly id: string;
  readonly slot: SlotDefinition["ref"];
  readonly value: string;
  readonly causedBy: string;
}): SlotClaim {
  if (input.slot.kind !== "attribute") {
    throw new Error("live commit writes attribute statement slots only");
  }
  return {
    id: input.id,
    slot: input.slot,
    value: input.value,
    label: input.value,
    aboutInterval: { from: UNKNOWN_INSTANT, to: null },
    status: "asserted",
    attributedTo: "user",
    causedBy: input.causedBy,
    kind: "assertion",
    acceptanceEligible: true,
  };
}

function mappedReconciliation(
  classifier: RelationClassifierDecision,
  relation: ReconciliationRelation,
): ReconciliationDecision {
  if (relation === "conflict" || classifier.type === "conflict") {
    return { type: "conflict", targetIds: [] };
  }
  if (classifier.type === "new" || relation === "new") {
    return { type: "new" };
  }
  return { type: classifier.type, targetId: "" };
}

function entityLabelOf(entities: readonly string[], proposition: string): string {
  const first = entities[0];
  if (first !== undefined && first.trim().length > 0) {
    return first.trim();
  }
  return proposition;
}

function slugEntityId(label: string): string {
  const slug = label
    .trim()
    .toLocaleLowerCase("und")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  return slug.length > 0 ? slug : `entity_${randomUUID()}`;
}

function uniqueLabels(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function tokenize(value: string): readonly string[] {
  return value
    .trim()
    .toLocaleLowerCase("und")
    .split(/[^a-z0-9åäö]+/u)
    .filter((token) => token.length >= 4);
}
