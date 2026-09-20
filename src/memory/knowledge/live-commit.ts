import { prepareAssociations } from "./association-commit.js";
import {
  DEFAULT_MEMORY_LIFECYCLE_POLICY,
  isKnowledgeSeverity,
  parseMemoryLifecyclePolicy,
  type MemoryLifecyclePolicy,
} from "../../core/memory-lifecycle-policy.js";
import type { SemanticOperationContext } from "../../orchestration/semantic-operation.js";
import { atomicKnowledge } from "./knowledge-transaction.js";
import { createHash, randomUUID } from "node:crypto";
import { Utf8ByteKnowledgeIntakeMeasurer } from "../../orchestration/post-output-knowledge-intake.js";
import type {
  RelationClassifierDecision,
  RelationClassifierCandidate,
  RelationClassifierBatchInput,
  RelationClassifierBatchDecision,
  RelationCommitInput,
  RelationGatedCommitResult,
  KnowledgeRelationClassifier,
  PendingRelationIndexRepair,
  UpdatedRelationIndex,
} from "../../orchestration/relation-gated-memory-commit.js";
import type {
  RelationBatchCommitInput,
  RelationBatchCommitStep,
  StagedProposalCommitter,
} from "../../orchestration/post-output-memory-coordinator.js";
import {
  serializeRelationClassifierBatchInput,
  serializeRelationClassifierInput,
} from "../../orchestration/relation-gated-memory-commit.js";
import type {
  ReconciliationDecision,
  ReconciliationRelation,
} from "../types.js";
import { accept } from "./accept.js";
import { UNKNOWN_INSTANT } from "./clocks.js";
import { asUtteranceId, recordClaimsFromUtterance } from "./evidence.js";
import {
  USER_ASSERTION_POLICY_ID,
  type ClaimDraft,
  type ClaimProposition,
} from "./evidence-types.js";
import { asEntityId } from "./ids.js";
import { entitySlug, slotKey } from "./registry.js";
import type { KnowledgeState } from "./state.js";
import type { ReconcileDecision } from "./state-types.js";
import { ingest } from "./ingest.js";
import { viewLifecycle } from "./lifecycle.js";
import type { KnowledgeReadContext } from "./read-types.js";
import { reconcile } from "./reconcile.js";
import type { SlotClaim } from "./state-types.js";
import { update } from "./update.js";
import {
  certaintyFromConfidence,
  selectUtteranceDomains,
  statementEntityLabel,
} from "./write-policy.js";
import type {
  Entity,
  Instant,
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

const DETERMINISTIC_BATCH_COMMIT_CODES = new Set([
  "invalid_input",
  "invalid_proposal",
  "policy",
  "illegal_state",
]);

function isDeterministicBatchCommitFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" && DETERMINISTIC_BATCH_COMMIT_CODES.has(code);
}

export class KnowledgeEngineCommit implements StagedProposalCommitter {
  readonly #context: KnowledgeReadContext;
  readonly #classifier: KnowledgeRelationClassifier;
  readonly #idFactory: KnowledgeIdFactory;
  readonly #policy: MemoryLifecyclePolicy;
  readonly #measurer = new Utf8ByteKnowledgeIntakeMeasurer();

  constructor(options: KnowledgeEngineCommitOptions) {
    this.#policy = parseMemoryLifecyclePolicy(
      options.policy ?? DEFAULT_MEMORY_LIFECYCLE_POLICY,
    );
    this.#context = options.context;
    this.#classifier = options.classifier;
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async commit(
    input: RelationCommitInput,
    operation: SemanticOperationContext = {},
  ): Promise<RelationGatedCommitResult> {
    return this.#commitInternal(input, operation);
  }

  async #commitInternal(
    input: RelationCommitInput,
    operation: SemanticOperationContext = {},
    preclassifiedDecision?: RelationClassifierDecision,
  ): Promise<RelationGatedCommitResult> {
    operation.signal?.throwIfAborted();
    input = structuredClone(input);
    const staged = input.batch.proposals[input.proposalIndex];
    if (staged === undefined) {
      throw new Error(
        `proposal ${input.proposalIndex} is missing from the staged batch`,
      );
    }
    if (!isKnowledgeSeverity(staged.severity))
      throw new Error("Live claim requires validated severity");
    const utteranceDomains = selectUtteranceDomains(input.batch.proposals);
    const at = this.#context.lifecycle.now();
    const candidateRecords = this.#context.evidence.listClaims();
    const targets = new Map(
      candidateRecords.map((claim, index) => [`candidate_${index + 1}`, claim]),
    );
    const candidates = this.#classifierCandidates(candidateRecords, at);
    const origin = input.batch.origin;
    const sourceUtterance =
      origin.kind === "source"
        ? this.#context.evidence
            .listUtterances()
            .find((u) => u.id === origin.utteranceId)
        : undefined;
    const sourceArtifact =
      sourceUtterance === undefined
        ? undefined
        : this.#context.evidence
            .listArtifacts()
            .find((a) => a.id === sourceUtterance.artifactId);
    const source =
      origin.kind === "source"
        ? sourceUtterance?.content
        : input.batch.sourceMessage;
    // A delivered dialogue turn has a real occurrence order. Do not discard it
    // as UNKNOWN_INSTANT before the state machine can sequence later updates.
    // Source material keeps its own assertedAt value because ingestion time is
    // not a substitute for world/event time.
    const stateFrom: Instant =
      origin.kind === "dialogue"
        ? at
        : (sourceUtterance?.assertedAt ?? UNKNOWN_INSTANT);
    const aboutInterval = staged.aboutInterval ?? {
      from: stateFrom,
      to: null,
    };
    const span = staged.support;
    const validSupport =
      span !== undefined &&
      source !== undefined &&
      span.source === (origin.kind === "source" ? "source" : "message") &&
      (origin.kind !== "source" ||
        sourceArtifact?.locator === input.batch.sourceMessage) &&
      Number.isSafeInteger(span.start) &&
      Number.isSafeInteger(span.end) &&
      span.start >= 0 &&
      span.end > span.start &&
      span.end <= source.length;
    const inferredMessageSpan =
      origin.kind === "dialogue"
        ? exactUniqueSpan(
            input.batch.sourceMessage,
            staged.proposal.proposition,
          )
        : undefined;
    const claimSourceSpan = validSupport
      ? { start: span.start, end: span.end }
      : inferredMessageSpan;
    const claimOrigin: "source" | "message" | "answer" =
      origin.kind === "source"
        ? "source"
        : claimSourceSpan !== undefined
          ? "message"
          : "answer";
    const occurrenceId =
      origin.kind === "source"
        ? "source:" +
          createHash("sha256")
            .update(JSON.stringify([input.batch.sourceMessage, source]))
            .digest("hex")
        : `turn:${input.batch.conversationId}:${input.batch.taskId}`;
    const associationEntities = this.#previewBatchEntities(
      input.batch.proposals,
    );
    const associations = prepareAssociations(
      this.#context,
      targets,
      source !== undefined &&
        (origin.kind !== "source" ||
          sourceArtifact?.locator === input.batch.sourceMessage)
        ? {
            origin: origin.kind === "source" ? "source" : "message",
            content: source,
          }
        : undefined,
      origin.kind === "source" ? input.batch.sourceMessage : occurrenceId,
      staged.proposal.scope,
      associationEntities,
    );
    const classifierInput = {
      ...(associations.associationContext === undefined
        ? {}
        : { associationContext: associations.associationContext }),
      ...(validSupport
        ? {
            sourceSupport: {
              origin: span.source,
              content: source,
              start: span.start,
              end: span.end,
            },
          }
        : {}),
      proposal: {
        proposition: staged.proposal.proposition,
        ...(staged.proposal.structuredProposition === undefined
          ? {}
          : {
              structuredProposition: structuredClone(
                staged.proposal.structuredProposition,
              ),
            }),
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
    const classifierDecision =
      preclassifiedDecision ??
      (await this.#classifier.classify(
        structuredClone(classifierInput),
        operation,
      ));
    operation.signal?.throwIfAborted();
    if (
      !classifierDecision ||
      !["new", "restatement", "extend", "supersede", "conflict"].includes(
        classifierDecision.type,
      )
    )
      throw new Error("Invalid live relation decision");
    return atomicKnowledge(this.#context, () => {
      operation.signal?.throwIfAborted();
      // Entity identity is referential, not truth-bearing. Materialize the
      // validated batch identities before applying preclassified associations
      // so current-batch opaque entity handles resolve deterministically.
      this.#materializeBatchEntities(input.batch.proposals);
      const structuralEntities = this.#materializeEntities(staged.entities);
      const applyAssociations = (claimId: string): readonly string[] => {
        if (classifierDecision.associations === undefined) return [];
        const evidenceUtteranceId =
          origin.kind === "source"
            ? this.#ingestOnce(input, at, "source")
            : this.#ingestOnce(input, at, "message");
        const result = associations.apply(
          classifierDecision.associations,
          claimId,
          evidenceUtteranceId,
          occurrenceId,
          at,
          this.#policy,
        );
        operation.signal?.throwIfAborted();
        return result;
      };
      const priorCreation = this.#context.evidence
        .listClaims()
        .find(
          (claim) =>
            claim.label === staged.proposal.proposition &&
            this.#context.lifecycle.get(claim.id)?.lifecycle
              .creationOccurrenceId === occurrenceId,
        );
      if (priorCreation !== undefined) {
        this.#context.entityReferences.attach(
          priorCreation.id,
          structuralEntities.map((entity) => entity.id),
        );
        return this.#reusedClaimResult(
          classifierDecision,
          priorCreation.id,
          "duplicate_creation",
          candidates,
          serialized,
          applyAssociations(priorCreation.id),
        );
      }
      const utteranceId = this.#ingestOnce(input, at, claimOrigin);
      const selected =
        "targetHandle" in classifierDecision
          ? targets.get(classifierDecision.targetHandle)
          : undefined;
      const currentTarget =
        selected === undefined
          ? undefined
          : this.#context.evidence
              .listClaims()
              .find((c) => c.id === selected.id);
      const resolved =
        selected !== undefined &&
        currentTarget !== undefined &&
        JSON.stringify(selected) === JSON.stringify(currentTarget) &&
        this.#context.lifecycle.get(selected.id)?.evidenceKind === "claim";
      let reinforcement = "not_eligible";
      const targetBinding =
        selected === undefined
          ? undefined
          : this.#context.state
              .snapshot()
              .bindings.find(
                (b) => b.claimId === selected.id && b.interval.to === null,
              );
      // A restatement reuses its canonical carrier. Retain the new attributed utterance;
      // do not create another identical claim that a later retry could select instead.
      if (
        resolved &&
        classifierDecision.type === "restatement" &&
        (origin.kind === "source" || currentTarget.status === "accepted") &&
        !["contested", "retracted", "rejected"].includes(
          currentTarget.status,
        ) &&
        (targetBinding === undefined ||
          !this.#context.state.isContested(targetBinding.slot))
      ) {
        this.#context.labels.attach({
          recordId: utteranceId,
          recordKind: "utterance",
          tags: [...(staged.proposal.tags ?? [])],
          domains: [...utteranceDomains],
        });
        reinforcement = this.#context.lifecycle.reinforceOccurrence({
          occurrenceId,
          evidenceId: selected.id,
          at,
          ...(validSupport
            ? {
                support: {
                  utteranceId,
                  start: span.start,
                  end: span.end,
                },
              }
            : {}),
        })
          ? "applied"
          : "duplicate_or_creation";
        this.#context.entityReferences.attach(
          selected.id,
          structuralEntities.map((entity) => entity.id),
        );
        return this.#reusedClaimResult(
          classifierDecision,
          selected.id,
          reinforcement,
          candidates,
          serialized,
          applyAssociations(selected.id),
        );
      }

      const drafts: readonly ClaimDraft[] = [
        {
          label: staged.proposal.proposition,
          proposition: staged.proposal.structuredProposition ?? {
            kind: "attribute_binding",
            entityLabel: statementEntityLabel(staged.proposal.proposition),
            attribute: STATEMENT_SLOT,
            value: staged.proposal.proposition,
          },
          certainty: certaintyFromConfidence(staged.proposal.confidence),
          aboutInterval,
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
      // them. Utterance domains are bounded at the write surface while each
      // claim retains the domains that describe that proposal.
      const claimLabelInput = {
        tags: [...(staged.proposal.tags ?? [])],
        domains: [...staged.domains],
      };
      this.#context.labels.attach({
        recordId: utteranceId,
        recordKind: "utterance",
        tags: [...(staged.proposal.tags ?? [])],
        domains: [...utteranceDomains],
      });
      if (evidenceClaim !== undefined) {
        this.#context.entityReferences.attach(
          evidenceClaim.id,
          structuralEntities.map((entity) => entity.id),
        );
        this.#context.labels.attach({
          recordId: evidenceClaim.id,
          recordKind: "claim",
          ...claimLabelInput,
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
        // `user-assertion-v1` applies only to a claim with runtime-verified
        // support in the original user message. Dialogue proposals without
        // that span are assistant-answer discoveries and must remain asserted
        // under assistant provenance rather than inheriting user authority.
        if (claimOrigin === "message") {
          accept(
            {
              claimId: evidenceClaim.id,
              policy: ACCEPT_POLICY,
              authority: { verified: true, speakerRole: "user" },
              sourceMessage: input.batch.sourceMessage,
              ...(claimSourceSpan === undefined
                ? {}
                : { sourceSpan: claimSourceSpan }),
            },
            this.#context.evidence,
          );
        }
      }

      const accepted =
        evidenceClaim !== undefined &&
        this.#context.evidence.requireClaim(evidenceClaim.id).status ===
          "accepted";

      // Only propositions with an explicit semantic address may own current
      // state. Free text, predicates, events and negations remain evidence
      // until INTERPRET can resolve them to a concrete slot; inventing a
      // sentence-hash statement slot would turn wording into truth identity.
      const stateAddressable =
        staged.proposal.structuredProposition?.kind === "attribute_binding" ||
        staged.proposal.structuredProposition?.kind === "relationship_binding";
      if (!stateAddressable) {
        let reinforcement = "not_eligible";
        if (
          resolved &&
          (classifierDecision.type === "restatement" ||
            classifierDecision.type === "extend")
        ) {
          reinforcement = this.#context.lifecycle.reinforceOccurrence({
            occurrenceId,
            evidenceId: selected.id,
            at,
            ...(validSupport
              ? {
                  support: {
                    utteranceId,
                    start: span.start,
                    end: span.end,
                  },
                }
              : {}),
          })
            ? "applied"
            : "duplicate_or_creation";
        } else if (
          classifierDecision.type === "restatement" ||
          classifierDecision.type === "extend"
        ) {
          reinforcement = "unresolved_target";
        }
        const relation: ReconciliationRelation = classifierDecision.type;
        const conflictTargetIds: string[] =
          classifierDecision.type === "conflict"
            ? classifierDecision.targetHandles.flatMap((handle) => {
                const id = targets.get(handle)?.id;
                return id === undefined ? [] : [String(id)];
              })
            : [];
        const associationResults = applyAssociations(evidenceClaim?.id ?? "");
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
            materializedCandidateIds: candidates.map(
              (candidate) => candidate.handle,
            ),
            classifierCandidateIds: candidates.map(
              (candidate) => candidate.handle,
            ),
            classifierInputSerialized: serialized,
            classifierInputMeasuredUnits: this.#measurer.measure(serialized),
            classifierInputMeasurementUnit: this.#measurer.unit,
          },
          index: { status: "not_required" },
        };
      }

      const conflictTargetBindings =
        classifierDecision.type === "conflict"
          ? classifierDecision.targetHandles.map((handle) => {
              const target = targets.get(handle);
              return target === undefined
                ? undefined
                : this.#context.state
                    .snapshot()
                    .bindings.find(
                      (binding) =>
                        binding.claimId === target.id &&
                        binding.interval.to === null,
                    );
            })
          : [];
      const firstConflictBinding = conflictTargetBindings[0];
      const conflictTargetSlot =
        staged.proposal.structuredProposition === undefined &&
        firstConflictBinding !== undefined &&
        conflictTargetBindings.every(
          (binding) =>
            binding !== undefined &&
            slotKey(binding.slot) === slotKey(firstConflictBinding.slot),
        )
          ? this.#context.slots.get(firstConflictBinding.slot)
          : undefined;
      const slot =
        conflictTargetSlot ??
        this.#ensureSlot(
          staged.proposal.structuredProposition,
          staged.proposal.proposition,
        );
      const slotClaim = statementClaim({
        id: evidenceClaim?.id ?? `slot:${this.#idFactory()}`,
        slot: slot.ref,
        proposition: staged.proposal.structuredProposition,
        fallbackValue: staged.proposal.proposition,
        causedBy: utteranceId,
        attributedTo: evidenceClaim?.attributedTo ?? claimOrigin,
        acceptanceEligible: claimOrigin === "message",
        status: accepted ? "accepted" : "asserted",
        aboutInterval,
        resolveEntity: (label) => this.#context.entities.ensure(label, "entity").id,
      });
      if (this.#context.state.claim(slotClaim.id) === undefined) {
        this.#context.state.recordClaim(slotClaim);
      }

      let relation: ReconciliationRelation = "new";
      const conflictTargetIds: string[] = [];
      let permitsReinforcement = true;
      if (accepted) {
        const decision = reconcile(this.#context.state, slotClaim, slot);
        if (
          classifierDecision.type === "conflict" ||
          decision.outcome === "conflict"
        ) {
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
          const appliedConflict =
            decision.outcome === "conflict"
              ? decision
              : asClassifierConflict(decision, this.#context.state, slot);
          this.#context.state.applyConflict(appliedConflict);
          if (evidenceClaim !== undefined) {
            const evidenceClaims = new Map(
              this.#context.evidence
                .listClaims()
                .map((claim) => [String(claim.id), claim] as const),
            );
            accept(
              {
                claimId: evidenceClaim.id,
                policy: ACCEPT_POLICY,
                authority: { verified: true, speakerRole: "user" },
                reconcileOutcome: "conflict",
                competingClaimIds: appliedConflict.competingClaimIds.flatMap(
                  (id) => {
                    const competing = evidenceClaims.get(id);
                    return competing === undefined ? [] : [competing.id];
                  },
                ),
              },
              this.#context.evidence,
            );
          }
          permitsReinforcement = false;
          relation = "conflict";
          conflictTargetIds.push(...appliedConflict.competingClaimIds);
        } else if (decision.outcome === "change") {
          update(this.#context.state, decision, {
            decidedBy: USER_ASSERTION_POLICY_ID,
          });
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
          update(this.#context.state, decision, {
            decidedBy: USER_ASSERTION_POLICY_ID,
          });
          permitsReinforcement = false;
          relation = "supersede";
        }
      } else if (classifierDecision.type === "restatement") {
        relation = "restatement";
      }

      if (
        permitsReinforcement &&
        (classifierDecision.type === "restatement" ||
          classifierDecision.type === "extend")
      ) {
        if (!resolved) {
          reinforcement = "unresolved_target";
        } else {
          reinforcement = this.#context.lifecycle.reinforceOccurrence({
            occurrenceId,
            evidenceId: selected.id,
            at,
            ...(validSupport
              ? {
                  support: {
                    utteranceId,
                    start: span.start,
                    end: span.end,
                  },
                }
              : {}),
          })
            ? "applied"
            : "duplicate_or_creation";
        }
      }
      const associationResults = applyAssociations(evidenceClaim?.id ?? "");
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
          materializedCandidateIds: candidates.map(
            (candidate) => candidate.handle,
          ),
          classifierCandidateIds: candidates.map(
            (candidate) => candidate.handle,
          ),
          classifierInputSerialized: serialized,
          classifierInputMeasuredUnits: this.#measurer.measure(serialized),
          classifierInputMeasurementUnit: this.#measurer.unit,
        },
        index: { status: "not_required" },
      };
    });
  }

  async commitBatch(
    input: RelationBatchCommitInput,
    operation: SemanticOperationContext = {},
  ): Promise<readonly RelationBatchCommitStep[]> {
    operation.signal?.throwIfAborted();
    const batch = structuredClone(input.batch);
    const start = input.startProposalIndex;
    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      start > batch.proposals.length
    ) {
      throw new Error("batch startProposalIndex is out of range");
    }
    if (start === batch.proposals.length) return [];

    if (this.#classifier.classifyBatch === undefined) {
      const fallback: RelationBatchCommitStep[] = [];
      for (
        let proposalIndex = start;
        proposalIndex < batch.proposals.length;
        proposalIndex += 1
      ) {
        try {
          fallback.push({
            proposalIndex,
            result: await this.#commitInternal(
              { batch, proposalIndex },
              operation,
            ),
          });
        } catch (error) {
          fallback.push({ proposalIndex, error });
          if (!isDeterministicBatchCommitFailure(error)) break;
        }
      }
      return fallback;
    }

    const at = this.#context.lifecycle.now();
    const initialClaims = this.#context.evidence.listClaims();
    const initialTargets = new Map(
      initialClaims.map((claim, index) => [`candidate_${index + 1}`, claim]),
    );
    const candidates = this.#classifierCandidates(initialClaims, at);
    const origin = batch.origin;
    const sourceUtterance =
      origin.kind === "source"
        ? this.#context.evidence
            .listUtterances()
            .find((entry) => entry.id === origin.utteranceId)
        : undefined;
    const sourceArtifact =
      sourceUtterance === undefined
        ? undefined
        : this.#context.evidence
            .listArtifacts()
            .find((entry) => entry.id === sourceUtterance.artifactId);
    const source =
      origin.kind === "source" ? sourceUtterance?.content : batch.sourceMessage;
    const sourceIsUsable =
      source !== undefined &&
      (origin.kind !== "source" ||
        sourceArtifact?.locator === batch.sourceMessage);
    const occurrenceId =
      origin.kind === "source"
        ? "source:" +
          createHash("sha256")
            .update(JSON.stringify([batch.sourceMessage, source]))
            .digest("hex")
        : `turn:${batch.conversationId}:${batch.taskId}`;
    const associationContext = prepareAssociations(
      this.#context,
      initialTargets,
      sourceIsUsable
        ? {
            origin: origin.kind === "source" ? "source" : "message",
            content: source,
          }
        : undefined,
      origin.kind === "source" ? batch.sourceMessage : occurrenceId,
      batch.proposals[start]?.proposal.scope ?? [],
      this.#previewBatchEntities(batch.proposals.slice(start)),
    ).associationContext;
    const items = batch.proposals.slice(start).map((staged, offset) => {
      if (!isKnowledgeSeverity(staged.severity)) {
        throw new Error("Live claim requires validated severity");
      }
      const span = staged.support;
      const validSupport =
        span !== undefined &&
        sourceIsUsable &&
        span.source === (origin.kind === "source" ? "source" : "message") &&
        Number.isSafeInteger(span.start) &&
        Number.isSafeInteger(span.end) &&
        span.start >= 0 &&
        span.end > span.start &&
        span.end <= source.length;
      return {
        proposalHandle: `proposal_${start + offset + 1}`,
        ...(validSupport
          ? {
              sourceSupport: {
                origin: span.source,
                content: source,
                start: span.start,
                end: span.end,
              },
            }
          : {}),
        proposal: {
          proposition: staged.proposal.proposition,
          ...(staged.proposal.structuredProposition === undefined
            ? {}
            : {
                structuredProposition: structuredClone(
                  staged.proposal.structuredProposition,
                ),
              }),
          kind: staged.proposal.kind,
          tags: [...(staged.proposal.tags ?? [])],
          scope: [...staged.proposal.scope],
          domains: [...staged.domains],
          entities: [...staged.entities],
          confidence: staged.proposal.confidence ?? 0.5,
        },
      };
    });
    const classifierInput: RelationClassifierBatchInput = {
      ...(associationContext === undefined ? {} : { associationContext }),
      candidates,
      items,
    };
    const serializedBatchInput =
      serializeRelationClassifierBatchInput(classifierInput);
    const rawDecisions = await this.#classifier.classifyBatch(
      structuredClone(classifierInput),
      operation,
    );
    operation.signal?.throwIfAborted();
    if (!Array.isArray(rawDecisions) || rawDecisions.length !== items.length) {
      throw new Error("Invalid live batch relation decision count");
    }

    const candidateHandles = new Set(
      candidates.map((candidate) => candidate.handle),
    );
    const entityHandles = new Set(
      associationContext?.entities.map((entity) => entity.handle) ?? [],
    );
    const proposalHandles = items.map((item) => item.proposalHandle);
    const validated: RelationClassifierBatchDecision[] = rawDecisions.map(
      (raw, index) => {
        const expectedHandle = proposalHandles[index]!;
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          throw new Error(
            `Invalid live batch relation decision for ${expectedHandle}`,
          );
        }
        const value = raw as RelationClassifierBatchDecision;
        if (value.proposalHandle !== expectedHandle) {
          throw new Error(
            `Invalid live batch proposal handle for ${expectedHandle}`,
          );
        }
        if (
          !["new", "restatement", "extend", "supersede", "conflict"].includes(
            value.type,
          )
        ) {
          throw new Error(
            `Invalid live batch relation type for ${expectedHandle}`,
          );
        }
        const allowedTargets = new Set([
          ...candidateHandles,
          ...proposalHandles.slice(0, index),
        ]);
        if (
          value.type === "restatement" ||
          value.type === "extend" ||
          value.type === "supersede"
        ) {
          if (!allowedTargets.has(value.targetHandle)) {
            throw new Error(`Invalid live batch target for ${expectedHandle}`);
          }
        }
        if (value.type === "conflict") {
          if (
            !Array.isArray(value.targetHandles) ||
            value.targetHandles.length === 0
          ) {
            throw new Error(
              `Invalid live batch conflict targets for ${expectedHandle}`,
            );
          }
          if (
            new Set(value.targetHandles).size !== value.targetHandles.length ||
            value.targetHandles.some((handle) => !allowedTargets.has(handle))
          ) {
            throw new Error(
              `Invalid live batch conflict targets for ${expectedHandle}`,
            );
          }
        }
        if (value.associations !== undefined) {
          if (!Array.isArray(value.associations)) {
            throw new Error(
              `Invalid live batch associations for ${expectedHandle}`,
            );
          }
          for (const association of value.associations) {
            const endpoints = [association?.fromHandle, association?.toHandle];
            if (
              endpoints.some(
                (handle) =>
                  typeof handle !== "string" ||
                  (handle !== "proposal" &&
                    !candidateHandles.has(handle) &&
                    !entityHandles.has(handle)),
              )
            ) {
              throw new Error(
                `Invalid live batch association handle for ${expectedHandle}`,
              );
            }
          }
        }
        return structuredClone(value);
      },
    );
    const initialClaimIds = new Map(
      [...initialTargets].map(([handle, claim]) => [handle, claim.id]),
    );
    const proposalClaimIds = new Map<
      string,
      (typeof initialClaims)[number]["id"]
    >();
    const currentHandleForClaim = (claimId: string): string => {
      const currentClaims = this.#context.evidence.listClaims();
      const index = currentClaims.findIndex((claim) => claim.id === claimId);
      if (index < 0)
        throw new Error(`Live batch target is no longer present: ${claimId}`);
      return `candidate_${index + 1}`;
    };
    const resolveTargetHandle = (handle: string): string => {
      const claimId =
        initialClaimIds.get(handle) ?? proposalClaimIds.get(handle);
      if (claimId === undefined) {
        throw new Error(`Unresolved live batch target handle: ${handle}`);
      }
      return currentHandleForClaim(claimId);
    };
    const translateAssociationEndpoint = (handle: string): string => {
      if (handle === "proposal" || entityHandles.has(handle)) return handle;
      const claimId = initialClaimIds.get(handle);
      return claimId === undefined ? handle : currentHandleForClaim(claimId);
    };
    const translateDecision = (
      batchDecision: RelationClassifierBatchDecision,
    ): RelationClassifierDecision => {
      const associations = batchDecision.associations?.map((association) => ({
        ...association,
        fromHandle: translateAssociationEndpoint(association.fromHandle),
        toHandle: translateAssociationEndpoint(association.toHandle),
      }));
      if (batchDecision.type === "new") {
        return {
          type: "new",
          ...(associations === undefined ? {} : { associations }),
        };
      }
      if (batchDecision.type === "conflict") {
        return {
          type: "conflict",
          targetHandles: batchDecision.targetHandles.map(resolveTargetHandle),
          ...(associations === undefined ? {} : { associations }),
        };
      }
      return {
        type: batchDecision.type,
        targetHandle: resolveTargetHandle(batchDecision.targetHandle),
        ...(batchDecision.supportsTarget === undefined
          ? {}
          : { supportsTarget: batchDecision.supportsTarget }),
        ...(associations === undefined ? {} : { associations }),
      };
    };
    const steps: RelationBatchCommitStep[] = [];
    const batchMeasuredUnits = this.#measurer.measure(serializedBatchInput);
    for (let offset = 0; offset < validated.length; offset += 1) {
      const proposalIndex = start + offset;
      const batchDecision = validated[offset]!;
      const beforeIds = new Set(
        this.#context.evidence.listClaims().map((claim) => claim.id),
      );
      try {
        const translated = translateDecision(batchDecision);
        const result = await this.#commitInternal(
          { batch, proposalIndex },
          operation,
          translated,
        );
        const decorated: RelationGatedCommitResult = {
          ...result,
          evidence: {
            ...result.evidence,
            classifierInputSerialized: serializedBatchInput,
            classifierInputMeasuredUnits: batchMeasuredUnits,
            classifierInputMeasurementUnit: this.#measurer.unit,
          },
        };
        steps.push({ proposalIndex, result: decorated });

        const afterClaims = this.#context.evidence.listClaims();
        const created = afterClaims.filter((claim) => !beforeIds.has(claim.id));
        let claimId = created.length === 1 ? created[0]!.id : undefined;
        if (
          claimId === undefined &&
          "targetId" in result.reconciliationDecision
        ) {
          const targetId = result.reconciliationDecision.targetId;
          claimId = afterClaims.find((claim) => claim.id === targetId)?.id;
        }
        if (claimId === undefined) {
          const staged = batch.proposals[proposalIndex]!;
          claimId = afterClaims.find(
            (claim) =>
              claim.label === staged.proposal.proposition &&
              this.#context.lifecycle.get(claim.id)?.lifecycle
                .creationOccurrenceId === occurrenceId,
          )?.id;
        }
        if (claimId !== undefined) {
          proposalClaimIds.set(batchDecision.proposalHandle, claimId);
        }
      } catch (error) {
        steps.push({ proposalIndex, error });
        if (!isDeterministicBatchCommitFailure(error)) break;
      }
    }
    return steps;
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
      reconciliation: {
        relation: "restatement",
        item: null,
        previousItem: null,
        conflictTargetIds: [],
      },
      evidence: {
        associations,
        reinforcement,
        materializedCandidateIds: candidates.map(
          (candidate) => candidate.handle,
        ),
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

  #ingestOnce(
    input: RelationCommitInput,
    at: string,
    claimOrigin: "source" | "message" | "answer",
  ): string {
    // A source was already ingested by `LocalMemoryRuntime.ingestSource`, with
    // the extractor's own speaker, relation and locator.
    if (input.batch.origin.kind === "source") {
      const sourceId = input.batch.origin.utteranceId;
      if (
        !this.#context.evidence.listUtterances().some((u) => u.id === sourceId)
      )
        throw new Error("Source utterance does not belong to this namespace");
      if (!this.#context.lifecycle.get(sourceId))
        this.#context.lifecycle.attach({
          evidenceId: sourceId,
          evidenceKind: "utterance",
          at,
        });
      return sourceId;
    }
    const assistant = claimOrigin === "answer";
    const content = assistant
      ? input.batch.answerMessage
      : input.batch.sourceMessage;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error(
        assistant
          ? "Dialogue batch is missing its final answer"
          : "Dialogue batch is missing its user message",
      );
    }
    const baseLocator = `turn:${input.batch.conversationId}:${input.batch.taskId}`;
    const locator = assistant ? `${baseLocator}:assistant` : baseLocator;
    const speaker = assistant ? "assistant" : "user";
    const artifact = this.#context.evidence
      .listArtifacts()
      .find((a) => a.locator === locator);
    const existing =
      artifact === undefined
        ? undefined
        : this.#context.evidence
            .listUtterances()
            .find(
              (u) =>
                u.artifactId === artifact.id &&
                u.content === content &&
                u.speaker === speaker,
            )?.id;
    if (existing !== undefined) return existing;
    const ingested = ingest(
      {
        content,
        speaker,
        locator,
        assertedAt: at,
        ingestedAt: at,
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
    if (utterance === undefined)
      throw new Error("INGEST did not record an utterance");
    this.#context.lifecycle.attach({
      evidenceId: utterance.id,
      evidenceKind: "utterance",
      at,
      caller: "knowledge-commit",
    });
    return utterance.id;
  }

  #materializeEntities(labels: readonly string[]): readonly Entity[] {
    const byId = new Map<string, Entity>();
    for (const label of labels) {
      const entity = this.#context.entities.ensure(label, "entity");
      byId.set(String(entity.id), entity);
    }
    return [...byId.values()];
  }

  #materializeBatchEntities(
    proposals: RelationCommitInput["batch"]["proposals"],
  ): void {
    for (const staged of proposals) {
      this.#materializeEntities(this.#proposalEntityLabels(staged));
    }
  }

  #previewBatchEntities(
    proposals: RelationCommitInput["batch"]["proposals"],
  ): readonly Entity[] {
    const byId = new Map<string, Entity>();
    for (const staged of proposals) {
      for (const label of this.#proposalEntityLabels(staged)) {
        const trimmed = label.trim();
        const slug = entitySlug(trimmed);
        if (trimmed.length === 0 || slug.length === 0) continue;
        const existing = this.#context.entities.findByIdentity(trimmed);
        const entity = existing ?? {
          id: asEntityId(slug),
          type: "entity",
          labels: [trimmed],
          preferredLabel: trimmed,
        };
        if (!byId.has(String(entity.id))) byId.set(String(entity.id), entity);
      }
    }
    return [...byId.values()];
  }

  #proposalEntityLabels(
    staged: RelationCommitInput["batch"]["proposals"][number],
  ): readonly string[] {
    const owner = propositionOwnerLabel(staged.proposal.structuredProposition);
    return owner === undefined
      ? [...staged.entities]
      : [...staged.entities, owner];
  }

  #ensureSlot(
    structuredProposition: ClaimProposition | undefined,
    proposition: string,
  ): SlotDefinition {
    if (structuredProposition?.kind === "attribute_binding") {
      const entity = this.#context.entities.ensure(
        structuredProposition.entityLabel,
        "entity",
      );
      const ref = {
        kind: "attribute" as const,
        entity: entity.id,
        name: structuredProposition.attribute,
      };
      const existing = this.#context.slots.get(ref);
      if (existing !== undefined) return existing;
      const definition: SlotDefinition = {
        ref,
        cardinality: "single",
        valueType:
          structuredProposition.value === null
            ? "null"
            : typeof structuredProposition.value,
      };
      this.#context.slots.register(definition);
      return definition;
    }

    if (structuredProposition?.kind === "relationship_binding") {
      const subject = this.#context.entities.ensure(
        structuredProposition.subjectLabel,
        "entity",
      );
      this.#context.entities.ensure(structuredProposition.objectLabel, "entity");
      const ref = {
        kind: "relation" as const,
        subject: subject.id,
        name: structuredProposition.relation,
      };
      const existing = this.#context.slots.get(ref);
      if (existing !== undefined) {
        return existing.cardinality === "set"
          ? existing
          : this.#context.slots.widenToSet(ref);
      }
      const definition: SlotDefinition = {
        ref,
        cardinality: "set",
        valueType: "referent",
      };
      this.#context.slots.register(definition);
      return definition;
    }

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
    const label = statementEntityLabel(proposition);
    const entity = this.#context.entities.ensure(label, "statement");
    const ref = {
      kind: "attribute" as const,
      entity: entity.id,
      name: STATEMENT_SLOT,
    };
    const found = this.#context.slots.get(ref);
    if (found !== undefined) {
      return found.cardinality === "set"
        ? found
        : this.#context.slots.widenToSet(ref);
    }
    const definition: SlotDefinition = {
      ref,
      cardinality: "set",
      valueType: "string",
    };
    this.#context.slots.register(definition);
    return definition;
  }

  #classifierCandidates(
    claims: ReturnType<KnowledgeReadContext["evidence"]["listClaims"]>,
    at: string,
  ) {
    // Comparison includes dormant and source-attributed claims; activation is not truth.
    return claims.map((claim, index) => ({
      handle: `candidate_${index + 1}`,
      proposition: claim.label,
      structuredProposition: structuredClone(claim.proposition),
      kind: "fact",
      tags: [],
      scope: ["local"],
      authority: 1,
      confidence: 0.5,
      activationStatus: viewLifecycle(this.#context.lifecycle, claim.id, at)
        .memoryState,
    }));
  }
}

function statementClaim(input: {
  readonly id: string;
  readonly slot: SlotDefinition["ref"];
  readonly proposition: ClaimProposition | undefined;
  readonly fallbackValue: string;
  readonly causedBy: string;
  readonly attributedTo: string;
  readonly acceptanceEligible: boolean;
  readonly status: SlotClaim["status"];
  readonly aboutInterval: import("./types.js").Interval;
  readonly resolveEntity: (label: string) => Entity["id"];
}): SlotClaim {
  const value =
    input.proposition?.kind === "attribute_binding"
      ? input.proposition.value
      : input.proposition?.kind === "relationship_binding"
        ? input.resolveEntity(input.proposition.objectLabel)
        : input.fallbackValue;
  return {
    id: input.id,
    slot: input.slot,
    value,
    label: input.fallbackValue,
    aboutInterval: structuredClone(input.aboutInterval),
    status: input.status,
    attributedTo: input.attributedTo,
    causedBy: input.causedBy,
    kind: "assertion",
    acceptanceEligible: input.acceptanceEligible,
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

function exactUniqueSpan(
  source: string,
  proposition: string,
): { readonly start: number; readonly end: number } | undefined {
  const start = source.indexOf(proposition);
  if (start < 0) return undefined;
  const next = source.indexOf(proposition, start + proposition.length);
  if (next >= 0) return undefined;
  return { start, end: start + proposition.length };
}

function propositionOwnerLabel(
  proposition: ClaimProposition | undefined,
): string | undefined {
  if (proposition === undefined) return undefined;
  if (proposition.kind === "attribute_binding") return proposition.entityLabel;
  if (proposition.kind === "relationship_binding")
    return proposition.subjectLabel;
  if (proposition.kind === "negation")
    return propositionOwnerLabel(proposition.of);
  return undefined;
}
