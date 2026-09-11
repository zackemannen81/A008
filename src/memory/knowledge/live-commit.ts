import { prepareAssociations } from "./association-commit.js";
import { DEFAULT_MEMORY_LIFECYCLE_POLICY, isKnowledgeSeverity, parseMemoryLifecyclePolicy, type MemoryLifecyclePolicy } from "../../core/memory-lifecycle-policy.js";
import type { SemanticOperationContext } from "../../orchestration/semantic-operation.js";
import { atomicKnowledge } from "./knowledge-transaction.js";
import { createHash, randomUUID } from "node:crypto";
import { Utf8ByteKnowledgeIntakeMeasurer } from "../../orchestration/post-output-knowledge-intake.js";
import type {
  RelationClassifierDecision,
  RelationClassifierCandidate,
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
import { entitySlug } from "./registry.js";
import type { KnowledgeState } from "./state.js";
import type { ReconcileDecision } from "./state-types.js";
import { ingest } from "./ingest.js";
import { viewLifecycle } from "./lifecycle.js";
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
  readonly policy?: MemoryLifecyclePolicy;
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
  readonly #policy: MemoryLifecyclePolicy;
  readonly #measurer = new Utf8ByteKnowledgeIntakeMeasurer();

  constructor(options: KnowledgeEngineCommitOptions) {
    this.#policy = parseMemoryLifecyclePolicy(options.policy ?? DEFAULT_MEMORY_LIFECYCLE_POLICY);
    this.#context = options.context;
    this.#classifier = options.classifier;
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async commit(input: RelationCommitInput, operation: SemanticOperationContext = {}): Promise<RelationGatedCommitResult> {
    operation.signal?.throwIfAborted();
    input = structuredClone(input);
    const staged = input.batch.proposals[input.proposalIndex];
    if (staged === undefined) {
      throw new Error(
        `proposal ${input.proposalIndex} is missing from the staged batch`,
      );
    }
    if (!isKnowledgeSeverity(staged.severity)) throw new Error("Live claim requires validated severity");
    const at = this.#context.lifecycle.now();
    const candidateRecords = this.#context.evidence.listClaims();
    const targets = new Map(candidateRecords.map((claim, index) => [`candidate_${index + 1}`, claim]));
    const candidates = this.#classifierCandidates(candidateRecords, at);
    const origin = input.batch.origin;
    const sourceUtterance = origin.kind === "source" ? this.#context.evidence.listUtterances().find(u => u.id === origin.utteranceId) : undefined;
    const sourceArtifact = sourceUtterance === undefined ? undefined : this.#context.evidence.listArtifacts().find(a => a.id === sourceUtterance.artifactId);
    const source = origin.kind === "source" ? sourceUtterance?.content : input.batch.sourceMessage;
    const span = staged.support;
    const validSupport = span !== undefined && source !== undefined &&
      span.source === (origin.kind === "source" ? "source" : "message") &&
      (origin.kind !== "source" || sourceArtifact?.locator === input.batch.sourceMessage) &&
      Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= source.length;
    const occurrenceId = origin.kind === "source"
      ? "source:" + createHash("sha256").update(JSON.stringify([input.batch.sourceMessage, source])).digest("hex")
      : `turn:${input.batch.conversationId}:${input.batch.taskId}`;
    const associations = prepareAssociations(this.#context, targets,
      source !== undefined && (origin.kind !== "source" || sourceArtifact?.locator === input.batch.sourceMessage)
        ? { origin: origin.kind === "source" ? "source" : "message", content: source } : undefined,
      origin.kind === "source" ? input.batch.sourceMessage : occurrenceId,
      staged.proposal.scope,
    );
    const classifierInput = {
      ...(associations.associationContext === undefined ? {} : { associationContext: associations.associationContext }),
      ...(validSupport ? { sourceSupport: { origin: span.source, content: source, start: span.start, end: span.end } } : {}),
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
    const classifierDecision = await this.#classifier.classify(structuredClone(classifierInput), operation);
    operation.signal?.throwIfAborted();
    if (!classifierDecision || !["new", "restatement", "extend", "supersede", "conflict"].includes(classifierDecision.type)) throw new Error("Invalid live relation decision");
    return atomicKnowledge(this.#context, () => {
      operation.signal?.throwIfAborted();
      const applyAssociations = (claimId: string, utteranceId: string): readonly string[] => {
        const result = associations.apply(classifierDecision.associations, claimId, utteranceId, occurrenceId, at, this.#policy);
        operation.signal?.throwIfAborted();
        return result;
      };
      const priorCreation = this.#context.evidence.listClaims().find(claim => claim.label === staged.proposal.proposition && this.#context.lifecycle.get(claim.id)?.lifecycle.creationOccurrenceId === occurrenceId);
      if (priorCreation !== undefined) {
        return this.#reusedClaimResult(classifierDecision, priorCreation.id, "duplicate_creation", candidates, serialized, classifierDecision.associations === undefined ? [] : applyAssociations(priorCreation.id, this.#ingestOnce(input, at)));
      }
      const utteranceId = this.#ingestOnce(input, at);
      const selected = "targetHandle" in classifierDecision ? targets.get(classifierDecision.targetHandle) : undefined;
      const currentTarget = selected === undefined ? undefined : this.#context.evidence.listClaims().find(c => c.id === selected.id);
      const resolved = selected !== undefined && currentTarget !== undefined && JSON.stringify(selected) === JSON.stringify(currentTarget) && this.#context.lifecycle.get(selected.id)?.evidenceKind === "claim";
      let reinforcement = "not_eligible";
      const targetBinding = selected === undefined ? undefined : this.#context.state.snapshot().bindings.find(b => b.claimId === selected.id && b.interval.to === null);
      // A restatement reuses its canonical carrier. Retain the new attributed utterance;
      // do not create another identical claim that a later retry could select instead.
      if (resolved && classifierDecision.type === "restatement" &&
          (origin.kind === "source" || currentTarget.status === "accepted") &&
          !["contested", "retracted", "rejected"].includes(currentTarget.status) &&
          (targetBinding === undefined || !this.#context.state.isContested(targetBinding.slot))) {
        this.#context.labels.attach({ recordId: utteranceId, recordKind: "utterance", tags: [...(staged.proposal.tags ?? [])], domains: [...staged.domains] });
        const committedSource = this.#context.evidence.listUtterances().find(u => u.id === utteranceId);
        reinforcement = !validSupport || classifierDecision.supportsTarget !== true || committedSource?.content !== source
          ? "skipped_unproven_source"
          : this.#context.lifecycle.reinforceOccurrence({ occurrenceId, evidenceId: selected.id, at, support: { utteranceId, start: span.start, end: span.end } }) ? "applied" : "duplicate_or_creation";
        return this.#reusedClaimResult(classifierDecision, selected.id, reinforcement, candidates, serialized, applyAssociations(selected.id, utteranceId));
      }

      const drafts: readonly ClaimDraft[] = [
        {
          label: staged.proposal.proposition,
          proposition: claimPropositionFor(staged.proposal.proposition, staged.entities),
          certainty: "probable",
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
      // Tags and domains have always been extracted by the analyzer, carried
      // through staging and read by the relation classifier. Until A008-0060 this
      // is where they stopped: a claim, an entity and a binding were written and
      // both label sets were dropped, so nothing downstream could ever match on
      // them. They are attached to the utterance as well as the claim because the
      // utterance is what a source ingest already created and what the projection
      // sends when no claim was accepted.
      const labelInput = {
        tags: [...(staged.proposal.tags ?? [])],
        domains: [...staged.domains],
      };
      this.#context.labels.attach({
        recordId: utteranceId,
        recordKind: "utterance",
        ...labelInput,
      });
      if (evidenceClaim !== undefined) {
        this.#context.labels.attach({
          recordId: evidenceClaim.id,
          recordKind: "claim",
          ...labelInput,
        });
        this.#context.lifecycle.attach({
          evidenceId: evidenceClaim.id,
          evidenceKind: "claim",
          severity: staged.severity!,
          policy: this.#policy,
          creationOccurrenceId: occurrenceId,
          at,
          caller: "knowledge-commit",
        });
        // `user-assertion-v1` applies only to something the user actually said.
        // An uploaded document is not a user assertion, and its text contains
        // every proposition extracted from it, so running the policy over a
        // source batch would accept the whole document as though the user had
        // stated each claim. Source claims stay `asserted`, attributed to the
        // source.
        if (input.batch.origin.kind !== "source") {
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
      let permitsReinforcement = true;
      if (accepted) {
        const decision = reconcile(this.#context.state, slotClaim, slot);
        if (classifierDecision.type === "conflict" || decision.outcome === "conflict") {
          // The two can now disagree, and before A008-0062 they almost never did.
          // With `<entity>.statement` single-valued, a second distinct value was
          // mechanically a conflict, so `reconcile` agreed with any classifier
          // that said so. As a set it does not: two statements about one entity
          // coexist, and `reconcile` returns `change`.
          //
          // When only the classifier calls it a conflict, its judgement is the one
          // that counts — it is the semantic judge and reconcile is the mechanical
          // bookkeeper — but `applyConflict` requires a conflict decision and
          // would throw on the `change` it was handed. So the decision is
          // restated as the conflict the classifier found, naming the open
          // members it competes with.
          this.#context.state.applyConflict(
            decision.outcome === "conflict"
              ? decision
              : asClassifierConflict(decision, this.#context.state, slot),
          );
          permitsReinforcement = false;
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

        } else if (
          decision.outcome === "correction" ||
          decision.outcome === "retraction"
        ) {
          update(this.#context.state, decision, { decidedBy: USER_ASSERTION_POLICY_ID });
          permitsReinforcement = false;
          relation = "supersede";
        }
      } else if (classifierDecision.type === "restatement") {
        relation = "restatement";

      }

      if (permitsReinforcement && (classifierDecision.type === "restatement" || classifierDecision.type === "extend")) {
        if (!resolved) reinforcement = "skipped_unresolved_target";
        else if (!validSupport || classifierDecision.supportsTarget !== true) reinforcement = "skipped_unproven_source";
        else {
          const committedSource = this.#context.evidence.listUtterances().find(u => u.id === utteranceId);
          if (committedSource?.content !== source) reinforcement = "skipped_changed_source";
          else reinforcement = this.#context.lifecycle.reinforceOccurrence({ occurrenceId, evidenceId: selected.id, at, support: { utteranceId, start: span.start, end: span.end } }) ? "applied" : "duplicate_or_creation";
        }
      }
      const associationResults = applyAssociations(evidenceClaim?.id ?? "", utteranceId);
      operation.signal?.throwIfAborted();
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
          associations: associationResults,
          reinforcement,
          materializedCandidateIds: candidates.map((candidate) => candidate.handle),
          classifierCandidateIds: candidates.map((candidate) => candidate.handle),
          classifierInputSerialized: serialized,
          classifierInputMeasuredUnits: this.#measurer.measure(serialized),
          classifierInputMeasurementUnit: this.#measurer.unit,
        },
        index: { status: "not_required" },
      };
    });
  }

  #reusedClaimResult(
    classifierDecision: RelationClassifierDecision,
    targetId: string,
    reinforcement: string,
    candidates: readonly RelationClassifierCandidate[],
    serialized: string,
    associations: readonly string[],
  ): RelationGatedCommitResult {
    return {
      classifierDecision,
      reconciliationDecision: { type: "restatement", targetId },
      reconciliation: { relation: "restatement", item: null, previousItem: null, conflictTargetIds: [] },
      evidence: {
        associations,
        reinforcement,
        materializedCandidateIds: candidates.map(candidate => candidate.handle),
        classifierCandidateIds: candidates.map(candidate => candidate.handle),
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

  #ingestOnce(input: RelationCommitInput, at: string): string {
    // A source was already ingested by `LocalMemoryRuntime.ingestSource`, with
    // the extractor's own speaker, relation and locator. Re-ingesting it here
    // would duplicate the utterance and replace that provenance with
    // `speaker: "user"` and a fabricated `turn:` locator.
    if (input.batch.origin.kind === "source") {
      const sourceId = input.batch.origin.utteranceId;
      if (!this.#context.evidence.listUtterances().some(u => u.id === sourceId)) throw new Error("Source utterance does not belong to this namespace");
      if (!this.#context.lifecycle.get(sourceId)) this.#context.lifecycle.attach({ evidenceId: sourceId, evidenceKind: "utterance", at });
      return sourceId;
    }
    const locator = `turn:${input.batch.conversationId}:${input.batch.taskId}`;
    const artifact = this.#context.evidence.listArtifacts().find(a => a.locator === locator);
    const existing = artifact === undefined ? undefined : this.#context.evidence.listUtterances().find(u => u.artifactId === artifact.id && u.content === input.batch.sourceMessage)?.id;
    if (existing !== undefined) {
      return existing;
    }
    const ingested = ingest(
      {
        content: input.batch.sourceMessage,
        speaker: "user",
        locator,
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
      at,
      caller: "knowledge-commit",
    });

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
    const existing = this.#context.entities.findByIdentity(label);
    const entity: Entity =
      existing ??
      ({
        id: asEntityId(slugEntityId(label)),
        type: "fact",
        // No `tokenize(proposition)`. It split the whole proposition and kept
        // every word of four characters or more, so "Zorros häst heter Fresca"
        // made `heter` an alias of that fact and "Vad heter du?" matched it.
        //
        // Lexical search terms are not semantic identity. Entity labels answer
        // "what is this thing called"; finding a record by the words in it is
        // what tags and domains are for, and until A008-0060 they were extracted
        // and then dropped, which left entity labels as the only retrieval
        // signal that varied with the message. That is why the pollution was
        // load-bearing rather than merely untidy, and why removing it had to
        // wait until there was something to replace it.
        labels: uniqueLabels([label, proposition, ...entities]),
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
      if (found.cardinality !== "single") {
        return found;
      }
      // A statement slot registered before this task carries the old
      // cardinality, and a slot definition is durable, so leaving it would keep
      // producing false conflicts in every store that already exists. Upgrading
      // widens what the slot admits and invalidates no binding it already
      // holds: every current binding stays open and stays current.
      return this.#context.slots.widenToSet(ref);
    }
    const definition: SlotDefinition = {
      ref,
      // A set, not a single value. `<entity>.statement` is a bag of things said
      // about an entity, and the analyzer instruction asks for *every* distinct
      // durable claim — so an entity routinely has many. Single cardinality
      // encoded "an entity has exactly one statement", which is false by
      // construction, and `reconcile` then read two different true facts as a
      // disagreement: conflict, `applyConflict`, and a slot marked contested
      // permanently. The next proposal on that entity threw "UPDATE fails when
      // the slot is contested", the batch died, and every later turn about the
      // same subject died with it.
      //
      // The relation classifier had said `new` for all of them. Its judgement
      // was correct and a mechanical cardinality rule overruled it. Genuine
      // contradiction detection belongs to the classifier, which is what
      // ADR 0018 makes it; single cardinality was catching real disagreement
      // only by accident and false disagreement constantly.
      cardinality: "set",
      valueType: "string",
    };
    this.#context.slots.register(definition);
    return definition;
  }

  #classifierCandidates(claims: ReturnType<KnowledgeReadContext["evidence"]["listClaims"]>, at: string) {
    // Comparison includes dormant and source-attributed claims; activation is not truth.
    return claims.map((claim, index) => ({
      handle: `candidate_${index + 1}`, proposition: claim.label, kind: "fact", tags: [], scope: ["local"], authority: 1, confidence: 0.5,
      activationStatus: viewLifecycle(this.#context.lifecycle, claim.id, at).memoryState,
    }));
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

/**
 * Restates a non-conflict decision as the conflict the classifier judged.
 *
 * Every open member of the slot becomes a competing claim, because the
 * classifier judged the proposal against the slot's current contents and not
 * against one particular binding.
 */
function asClassifierConflict(
  decision: ReconcileDecision,
  state: KnowledgeState,
  slot: SlotDefinition,
): ReconcileDecision {
  const competing = state
    .current(slot.ref)
    .map((binding) => binding.claimId)
    .filter((id) => id !== decision.proposal.id);
  return {
    ...decision,
    outcome: "conflict",
    competingClaimIds: [
      ...new Set([...decision.competingClaimIds, ...competing]),
    ],
    targetInterval: decision.proposal.aboutInterval,
    reason: "relation classifier judged the proposal to conflict",
  };
}

function claimPropositionFor(
  proposition: string,
  entities: readonly string[],
): ClaimDraft["proposition"] {
  const normalized = proposition.trim();
  const relationship = /^(?<subject>[^\s]+)\s+--(?<relation>[^>]+)-->(?<object>.+)$/u.exec(normalized);
  if (relationship?.groups?.subject && relationship.groups.relation && relationship.groups.object) {
    return {
      kind: "relationship_binding",
      subjectLabel: relationship.groups.subject,
      relation: relationship.groups.relation.trim(),
      objectLabel: relationship.groups.object.trim(),
    };
  }
  const attribute = /^(?<entity>[^.]+)\.(?<name>[^=]+)=\s*(?<value>.+)$/u.exec(normalized);
  if (attribute?.groups?.entity && attribute.groups.name && attribute.groups.value) {
    return {
      kind: "attribute_binding",
      entityLabel: attribute.groups.entity.trim(),
      attribute: attribute.groups.name.trim(),
      value: attribute.groups.value.trim(),
    };
  }
  const predicate = /^(?<name>[A-Za-z_][A-Za-z0-9_]*)\((?<arguments>.*)\)$/u.exec(normalized);
  if (predicate?.groups?.name && predicate.groups.arguments !== undefined) {
    return {
      kind: "predicate",
      name: predicate.groups.name,
      arguments: predicate.groups.arguments.trim().length === 0
        ? []
        : predicate.groups.arguments.split(",").map((value) => value.trim()),
    };
  }
  return {
    kind: "attribute_binding",
    entityLabel: entityLabelOf(entities, normalized),
    attribute: STATEMENT_SLOT,
    value: normalized,
  };
}

function entityLabelOf(entities: readonly string[], proposition: string): string {
  const first = entities[0];
  if (first !== undefined && first.trim().length > 0) {
    return first.trim();
  }
  return proposition;
}

function slugEntityId(label: string): string {
  const slug = entitySlug(label);
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
