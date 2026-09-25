import { parseRuntimeId } from "../identity/runtime-id.js";
import { MemoryError } from "../memory/errors.js";
import { KnowledgeModelError } from "../memory/knowledge/errors.js";
import type { RetrievalDocument } from "../memory/retrieval-types.js";
import type {
  KnowledgeItem,
  ReconciliationDecision,
  ReconciliationResult,
} from "../memory/types.js";
import {
  serializeStagedKnowledgeProposals,
  type StagePostOutputKnowledgeInput,
  type StagedBatchOrigin,
  type StagedKnowledgeBatch,
  type StagedKnowledgeProposal,
  type StagedKnowledgeReinforcement,
} from "./post-output-knowledge-intake.js";
import type {
  PendingRelationIndexRepair,
  RelationClassifierDecision,
  RelationGatedCommitResult,
  RelationCommitInput,
  UpdatedRelationIndex,
} from "./relation-gated-memory-commit.js";
import type { SemanticOperationContext } from "./semantic-operation.js";

export interface PostOutputKnowledgeStager {
  stage(
    input: StagePostOutputKnowledgeInput,
    context?: SemanticOperationContext,
  ): Promise<StagedKnowledgeBatch>;
}

export interface RelationBatchCommitInput {
  readonly batch: StagedKnowledgeBatch;
  readonly startProposalIndex: number;
}

export type RelationBatchCommitStep =
  | {
      readonly proposalIndex: number;
      readonly result: RelationGatedCommitResult;
    }
  | { readonly proposalIndex: number; readonly error: unknown };

export interface PostOutputMemoryReinforcementRecord {
  readonly knowledgeId: string;
  readonly evidenceId: string;
  readonly semanticAddress?: string;
  readonly status: "applied" | "duplicate_or_creation" | "unresolved_target";
}

export interface StagedProposalCommitter {
  commit(
    input: RelationCommitInput,
    context?: SemanticOperationContext,
  ): Promise<RelationGatedCommitResult>;
  commitBatch?(
    input: RelationBatchCommitInput,
    context?: SemanticOperationContext,
  ): Promise<readonly RelationBatchCommitStep[]>;
  commitReinforcements?(
    batch: StagedKnowledgeBatch,
    context?: SemanticOperationContext,
  ): Promise<readonly PostOutputMemoryReinforcementRecord[]>;
  repairIndex(
    pending: PendingRelationIndexRepair,
  ): Promise<UpdatedRelationIndex>;
}

export interface PostOutputMemoryCoordinatorOptions {
  readonly stager: PostOutputKnowledgeStager;
  readonly committer: StagedProposalCommitter;
}

export interface PostOutputMemoryCommitRecord {
  readonly proposalIndex: number;
  readonly result: RelationGatedCommitResult;
}

export interface PostOutputMemoryCommitCheckpoint {
  readonly batch: StagedKnowledgeBatch;
  readonly nextProposalIndex: number;
  readonly records: readonly PostOutputMemoryCommitRecord[];
}

export interface PostOutputMemoryIndexRepairCheckpoint extends PostOutputMemoryCommitCheckpoint {
  readonly pendingProposalIndex: number;
  readonly pending: PendingRelationIndexRepair;
}

/**
 * A proposal this repository refused, with the reason and nothing else.
 *
 * Carries A008's own validation text, never analyzer content, for the same
 * reason `skippedProposals` does at staging: the text is displayed and must not
 * become a channel for untrusted output.
 */
export interface SkippedPostOutputProposal {
  readonly proposalIndex: number;
  readonly reason: string;
}

export interface CompletedPostOutputMemoryResult {
  readonly status: "completed";
  readonly batch: StagedKnowledgeBatch;
  readonly records: readonly PostOutputMemoryCommitRecord[];
  readonly reinforcements: readonly PostOutputMemoryReinforcementRecord[];
  /**
   * Proposals refused deterministically and stepped over. Empty on a clean
   * commit. A batch that skipped everything still reports `completed`, because
   * the batch did complete — what failed is named here rather than hidden in a
   * status that also means "the provider died".
   */
  readonly skippedProposals: readonly SkippedPostOutputProposal[];
}

export interface StagingFailedPostOutputMemoryResult {
  readonly status: "staging_failed";
  readonly error: unknown;
}

export interface CommitFailedPostOutputMemoryResult {
  readonly status: "commit_failed";
  readonly failedProposalIndex: number;
  readonly checkpoint: PostOutputMemoryCommitCheckpoint;
  readonly error: unknown;
}

export interface IndexRepairRequiredPostOutputMemoryResult {
  readonly status: "index_repair_required";
  readonly checkpoint: PostOutputMemoryIndexRepairCheckpoint;
  readonly error: unknown;
}

export type PostOutputMemoryResult =
  | CompletedPostOutputMemoryResult
  | StagingFailedPostOutputMemoryResult
  | CommitFailedPostOutputMemoryResult
  | IndexRepairRequiredPostOutputMemoryResult;

/**
 * Refusals that will refuse again, listed by code rather than by class.
 *
 * The class is too coarse and a test caught it: `stale_state` is a `MemoryError`
 * and is the most retryable failure there is — the index revision moved under
 * the commit, and the whole point of the checkpoint is to pick it back up.
 * Skipping it would discard a proposal that was about to succeed.
 *
 * These four are properties of the proposal or of the stored state, and a
 * second attempt meets exactly the same answer:
 *
 * - `invalid_input` and `invalid_proposal` — the value is not writable.
 * - `policy` — a rule refused it.
 * - `illegal_state` — the write is not legal against what is stored, which is
 *   the contested-slot case.
 */
const DETERMINISTIC_COMMIT_CODES: ReadonlySet<string> = new Set([
  "invalid_input",
  "invalid_proposal",
  "policy",
  "illegal_state",
]);

/**
 * Whether retrying this proposal could ever produce a different outcome.
 *
 * The default leans towards stopping, on purpose. Skipping a proposal loses it;
 * stopping keeps it recoverable behind a checkpoint. An unrecognised failure is
 * more safely assumed recoverable than assumed dead.
 */
function isDeterministicCommitFailure(error: unknown): boolean {
  if (error instanceof KnowledgeModelError || error instanceof MemoryError) {
    return DETERMINISTIC_COMMIT_CODES.has(error.code);
  }
  return false;
}

/** This repository's own message, never analyzer or provider content. */
function describeCommitRefusal(error: unknown): string {
  if (error instanceof KnowledgeModelError || error instanceof MemoryError) {
    return error.message;
  }
  return "commit refused";
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

function nonNegativeSafeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a non-negative safe integer`,
    );
  }
  return value;
}

function copyDocument(document: RetrievalDocument): RetrievalDocument {
  return {
    knowledgeId: document.knowledgeId,
    ...(document.entities === undefined
      ? {}
      : { entities: [...document.entities] }),
    ...(document.domains === undefined
      ? {}
      : { domains: [...document.domains] }),
    ...(document.embedding === undefined
      ? {}
      : { embedding: [...document.embedding] }),
    ...(document.embeddingModel === undefined
      ? {}
      : { embeddingModel: document.embeddingModel }),
  };
}

function copyItem(item: KnowledgeItem | null): KnowledgeItem | null {
  if (item === null) {
    return null;
  }
  return {
    ...item,
    tags: [...item.tags],
    scope: [...item.scope],
    provenance: item.provenance.map((entry) => ({ ...entry })),
  };
}

function copyClassifierDecision(
  decision: RelationClassifierDecision,
): RelationClassifierDecision {
  if (decision.type === "new") {
    return { type: "new" };
  }
  if (decision.type === "conflict") {
    return { type: "conflict", targetHandles: [...decision.targetHandles] };
  }
  return {
    type: decision.type,
    targetHandle: decision.targetHandle,
    ...(decision.supportsTarget === undefined
      ? {}
      : { supportsTarget: decision.supportsTarget }),
  };
}

function copyReconciliationDecision(
  decision: ReconciliationDecision,
): ReconciliationDecision {
  if (decision.type === "new") {
    return { type: "new" };
  }
  if (decision.type === "conflict") {
    return { type: "conflict", targetIds: [...decision.targetIds] };
  }
  return { type: decision.type, targetId: decision.targetId };
}

function copyReconciliation(
  reconciliation: ReconciliationResult,
): ReconciliationResult {
  return {
    relation: reconciliation.relation,
    item: copyItem(reconciliation.item),
    previousItem: copyItem(reconciliation.previousItem),
    conflictTargetIds: [...reconciliation.conflictTargetIds],
  };
}

function copyCommitResult(
  result: RelationGatedCommitResult,
): RelationGatedCommitResult {
  const index =
    result.index.status === "not_required"
      ? { status: "not_required" as const }
      : result.index.status === "updated"
        ? {
            status: "updated" as const,
            document: copyDocument(result.index.document),
          }
        : {
            status: "pending_repair" as const,
            document: copyDocument(result.index.document),
            error: result.index.error,
          };
  return {
    classifierDecision: copyClassifierDecision(result.classifierDecision),
    reconciliationDecision: copyReconciliationDecision(
      result.reconciliationDecision,
    ),
    reconciliation: copyReconciliation(result.reconciliation),
    evidence: {
      ...(result.evidence.reinforcement === undefined
        ? {}
        : { reinforcement: result.evidence.reinforcement }),
      materializedCandidateIds: [...result.evidence.materializedCandidateIds],
      classifierCandidateIds: [...result.evidence.classifierCandidateIds],
      classifierInputSerialized: result.evidence.classifierInputSerialized,
      classifierInputMeasuredUnits:
        result.evidence.classifierInputMeasuredUnits,
      classifierInputMeasurementUnit:
        result.evidence.classifierInputMeasurementUnit,
    },
    index,
  };
}

function copyStagedProposal(
  staged: StagedKnowledgeProposal,
): StagedKnowledgeProposal {
  return {
    ...(staged.severity === undefined ? {} : { severity: staged.severity }),
    ...(staged.support === undefined ? {} : { support: { ...staged.support } }),
    proposal: {
      ...staged.proposal,
      tags: [...(staged.proposal.tags ?? [])],
      scope: [...staged.proposal.scope],
      provenance: (staged.proposal.provenance ?? []).map((entry) => ({
        ...entry,
      })),
    },
    domains: [...staged.domains],
    entities: [...staged.entities],
  };
}

function copyStagedReinforcement(
  staged: StagedKnowledgeReinforcement,
): StagedKnowledgeReinforcement {
  return {
    knowledgeId: nonEmpty(staged.knowledgeId, "staged reinforcement knowledgeId"),
    evidenceId: nonEmpty(staged.evidenceId, "staged reinforcement evidenceId"),
    ...(staged.semanticAddress === undefined
      ? {}
      : {
          semanticAddress: nonEmpty(
            staged.semanticAddress,
            "staged reinforcement semanticAddress",
          ),
        }),
  };
}

function validatedBatch(batch: StagedKnowledgeBatch): StagedKnowledgeBatch {
  if (typeof batch !== "object" || batch === null || Array.isArray(batch)) {
    throw new MemoryError("invalid_input", "staged batch must be an object");
  }
  const projectId = parseRuntimeId(batch.projectId, "project");
  const conversationId = parseRuntimeId(batch.conversationId, "conversation");
  const taskId = parseRuntimeId(batch.taskId, "task");
  const agentId = parseRuntimeId(batch.agentId, "agent");
  if (!Array.isArray(batch.proposals)) {
    throw new MemoryError("invalid_input", "staged proposals must be an array");
  }
  if (
    batch.reinforcements !== undefined &&
    !Array.isArray(batch.reinforcements)
  ) {
    throw new MemoryError(
      "invalid_input",
      "staged reinforcements must be an array",
    );
  }
  let proposals: StagedKnowledgeProposal[];
  let reinforcements: StagedKnowledgeReinforcement[];
  let expectedSerialized: string;
  try {
    proposals = batch.proposals.map(copyStagedProposal);
    reinforcements = (batch.reinforcements ?? []).map(
      copyStagedReinforcement,
    );
    expectedSerialized = serializeStagedKnowledgeProposals(
      proposals,
      reinforcements,
    );
  } catch (error) {
    throw new MemoryError("invalid_input", "staged proposals are malformed", {
      cause: error,
    });
  }
  if (batch.serialized !== expectedSerialized) {
    throw new MemoryError(
      "invalid_input",
      "staged batch serialization does not match its proposals",
    );
  }
  const measuredUnits = nonNegativeSafeInteger(
    batch.measuredUnits,
    "staged measuredUnits",
  );
  const measurementUnit = nonEmpty(
    batch.measurementUnit,
    "staged measurementUnit",
  );
  const sourceMessage = nonEmpty(batch.sourceMessage, "staged sourceMessage");
  // Revalidated rather than trusted: the origin decides whether the commit path
  // may treat this batch as something the user said.
  const origin: StagedBatchOrigin =
    batch.origin?.kind === "source"
      ? {
          kind: "source",
          utteranceId: nonEmpty(batch.origin.utteranceId, "staged utteranceId"),
        }
      : { kind: "dialogue" };
  return {
    projectId,
    conversationId,
    taskId,
    agentId,
    origin,
    skippedProposals: Array.isArray(batch.skippedProposals)
      ? batch.skippedProposals.map((reason, index) =>
          nonEmpty(reason, `skipped proposal reason ${index + 1}`),
        )
      : [],
    sourceMessage,
    ...(origin.kind === "dialogue" &&
    typeof batch.answerMessage === "string" &&
    batch.answerMessage.trim().length > 0
      ? { answerMessage: nonEmpty(batch.answerMessage, "staged answerMessage") }
      : {}),
    proposals,
    reinforcements,
    serialized: expectedSerialized,
    measuredUnits,
    measurementUnit,
  };
}

function copyRecord(
  record: PostOutputMemoryCommitRecord,
): PostOutputMemoryCommitRecord {
  return {
    proposalIndex: record.proposalIndex,
    result: copyCommitResult(record.result),
  };
}

function validatedRecords(
  records: readonly PostOutputMemoryCommitRecord[],
  batch: StagedKnowledgeBatch,
  nextProposalIndex: number,
): PostOutputMemoryCommitRecord[] {
  if (!Array.isArray(records)) {
    throw new MemoryError(
      "invalid_input",
      "checkpoint records must be an array",
    );
  }
  if (records.length !== nextProposalIndex) {
    throw new MemoryError(
      "invalid_input",
      "checkpoint records must be contiguous through nextProposalIndex",
    );
  }
  return records.map((record, index) => {
    if (
      typeof record !== "object" ||
      record === null ||
      record.proposalIndex !== index ||
      index >= batch.proposals.length
    ) {
      throw new MemoryError(
        "invalid_input",
        "checkpoint record indexes must be contiguous and in range",
      );
    }
    return copyRecord(record);
  });
}

function validatedCommitCheckpoint(
  checkpoint: PostOutputMemoryCommitCheckpoint,
): PostOutputMemoryCommitCheckpoint {
  if (
    typeof checkpoint !== "object" ||
    checkpoint === null ||
    Array.isArray(checkpoint)
  ) {
    throw new MemoryError("invalid_input", "checkpoint must be an object");
  }
  const batch = validatedBatch(checkpoint.batch);
  const nextProposalIndex = nonNegativeSafeInteger(
    checkpoint.nextProposalIndex,
    "checkpoint nextProposalIndex",
  );
  if (nextProposalIndex >= batch.proposals.length) {
    throw new MemoryError(
      "invalid_input",
      "commit checkpoint must identify an unprocessed proposal",
    );
  }
  const records = validatedRecords(
    checkpoint.records,
    batch,
    nextProposalIndex,
  );
  if (
    records.some((record) => record.result.index.status === "pending_repair")
  ) {
    throw new MemoryError(
      "invalid_input",
      "commit checkpoint cannot contain pending index repair",
    );
  }
  return { batch, nextProposalIndex, records };
}

function sameDocument(
  left: RetrievalDocument,
  right: RetrievalDocument,
): boolean {
  return (
    JSON.stringify(copyDocument(left)) === JSON.stringify(copyDocument(right))
  );
}

function validatedIndexCheckpoint(
  checkpoint: PostOutputMemoryIndexRepairCheckpoint,
): PostOutputMemoryIndexRepairCheckpoint {
  if (
    typeof checkpoint !== "object" ||
    checkpoint === null ||
    Array.isArray(checkpoint)
  ) {
    throw new MemoryError("invalid_input", "checkpoint must be an object");
  }
  const batch = validatedBatch(checkpoint.batch);
  const nextProposalIndex = nonNegativeSafeInteger(
    checkpoint.nextProposalIndex,
    "checkpoint nextProposalIndex",
  );
  if (nextProposalIndex < 1 || nextProposalIndex > batch.proposals.length) {
    throw new MemoryError(
      "invalid_input",
      "index checkpoint nextProposalIndex is out of range",
    );
  }
  const records = validatedRecords(
    checkpoint.records,
    batch,
    nextProposalIndex,
  );
  const pendingProposalIndex = nonNegativeSafeInteger(
    checkpoint.pendingProposalIndex,
    "checkpoint pendingProposalIndex",
  );
  if (pendingProposalIndex !== nextProposalIndex - 1) {
    throw new MemoryError(
      "invalid_input",
      "pending proposal must be the most recent completed record",
    );
  }
  const last = records.at(-1);
  if (
    checkpoint.pending?.status !== "pending_repair" ||
    last?.result.index.status !== "pending_repair" ||
    !sameDocument(checkpoint.pending.document, last.result.index.document)
  ) {
    throw new MemoryError(
      "invalid_input",
      "index checkpoint pending document does not match its commit record",
    );
  }
  if (
    records
      .slice(0, -1)
      .some((record) => record.result.index.status === "pending_repair")
  ) {
    throw new MemoryError(
      "invalid_input",
      "only the latest checkpoint record may require index repair",
    );
  }
  return {
    batch,
    nextProposalIndex,
    records,
    pendingProposalIndex,
    pending: {
      status: "pending_repair",
      document: copyDocument(checkpoint.pending.document),
      error: checkpoint.pending.error,
    },
  };
}

function stagingInput(
  input: StagePostOutputKnowledgeInput,
): StagePostOutputKnowledgeInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MemoryError(
      "invalid_input",
      "post-output input must be an object",
    );
  }
  if (!Array.isArray(input.applicabilityScopes)) {
    throw new MemoryError(
      "invalid_input",
      "applicabilityScopes must be an array",
    );
  }
  const scopes = input.applicabilityScopes.map((scope, index) =>
    nonEmpty(scope, `applicability scope ${index + 1}`),
  );
  const taskId = parseRuntimeId(input.taskId, "task");
  if (input.kind === "source") {
    return {
      kind: "source",
      taskId,
      locator: nonEmpty(input.locator, "locator"),
      content: nonEmpty(input.content, "content"),
      utteranceId: nonEmpty(input.utteranceId, "utteranceId"),
      applicabilityScopes: scopes,
    };
  }
  return {
    taskId,
    message: nonEmpty(input.message, "message"),
    answer: nonEmpty(input.answer, "answer"),
    ...(input.retrievedContext === undefined
      ? {}
      : { retrievedContext: structuredClone(input.retrievedContext) }),
    applicabilityScopes: scopes,
  };
}

export class PostOutputMemoryCoordinator {
  readonly #stager: PostOutputKnowledgeStager;
  readonly #committer: StagedProposalCommitter;
  #active = false;

  constructor(options: PostOutputMemoryCoordinatorOptions) {
    this.#stager = options.stager;
    this.#committer = options.committer;
  }

  async process(
    input: StagePostOutputKnowledgeInput,
    context: SemanticOperationContext = {},
  ): Promise<PostOutputMemoryResult> {
    this.#begin();
    try {
      const sanitized = stagingInput(input);
      let batch: StagedKnowledgeBatch;
      try {
        batch = validatedBatch(
          await this.#stager.stage(
            sanitized,
            context.signal === undefined ? {} : { signal: context.signal },
          ),
        );
      } catch (error) {
        return { status: "staging_failed", error };
      }
      return await this.#continue(batch, 0, [], context);
    } finally {
      this.#active = false;
    }
  }

  async resume(
    checkpoint: PostOutputMemoryCommitCheckpoint,
    context: SemanticOperationContext = {},
  ): Promise<PostOutputMemoryResult> {
    this.#begin();
    try {
      const validated = validatedCommitCheckpoint(checkpoint);
      return await this.#continue(
        validated.batch,
        validated.nextProposalIndex,
        validated.records,
        context,
      );
    } finally {
      this.#active = false;
    }
  }

  async repairAndResume(
    checkpoint: PostOutputMemoryIndexRepairCheckpoint,
    context: SemanticOperationContext = {},
  ): Promise<PostOutputMemoryResult> {
    this.#begin();
    try {
      const validated = validatedIndexCheckpoint(checkpoint);
      let updated: UpdatedRelationIndex;
      try {
        updated = await this.#committer.repairIndex(validated.pending);
      } catch (error) {
        return {
          status: "index_repair_required",
          checkpoint: validatedIndexCheckpoint(validated),
          error,
        };
      }
      if (updated.status !== "updated") {
        throw new MemoryError(
          "illegal_state",
          "relation committer returned an invalid repair result",
        );
      }
      const records = validated.records.map((record) => copyRecord(record));
      const pendingRecord = records[validated.pendingProposalIndex]!;
      records[validated.pendingProposalIndex] = {
        proposalIndex: pendingRecord.proposalIndex,
        result: {
          ...pendingRecord.result,
          index: {
            status: "updated",
            document: copyDocument(updated.document),
          },
        },
      };
      return await this.#continue(
        validated.batch,
        validated.nextProposalIndex,
        records,
        context,
      );
    } finally {
      this.#active = false;
    }
  }

  async #continue(
    batch: StagedKnowledgeBatch,
    startIndex: number,
    priorRecords: readonly PostOutputMemoryCommitRecord[],
    context: SemanticOperationContext,
  ): Promise<PostOutputMemoryResult> {
    const records = priorRecords.map(copyRecord);
    const skipped: SkippedPostOutputProposal[] = [];
    let reinforcementRecords: readonly PostOutputMemoryReinforcementRecord[] = [];
    if ((batch.reinforcements ?? []).length > 0) {
      if (this.#committer.commitReinforcements === undefined) {
        return {
          status: "commit_failed",
          failedProposalIndex: startIndex,
          checkpoint: {
            batch: validatedBatch(batch),
            nextProposalIndex: startIndex,
            records: records.map(copyRecord),
          },
          error: new MemoryError(
            "illegal_state",
            "relation committer does not implement explicit reinforcement",
          ),
        };
      }
      try {
        reinforcementRecords = (
          await this.#committer.commitReinforcements(
            validatedBatch(batch),
            context.signal === undefined ? {} : { signal: context.signal },
          )
        ).map((entry) => ({
          knowledgeId: entry.knowledgeId,
          evidenceId: entry.evidenceId,
          ...(entry.semanticAddress === undefined
            ? {}
            : { semanticAddress: entry.semanticAddress }),
          status: entry.status,
        }));
      } catch (error) {
        return {
          status: "commit_failed",
          failedProposalIndex: startIndex,
          checkpoint: {
            batch: validatedBatch(batch),
            nextProposalIndex: startIndex,
            records: records.map(copyRecord),
          },
          error,
        };
      }
    }
    if (
      this.#committer.commitBatch !== undefined &&
      startIndex < batch.proposals.length
    ) {
      let steps: readonly RelationBatchCommitStep[];
      try {
        steps = await this.#committer.commitBatch(
          { batch: validatedBatch(batch), startProposalIndex: startIndex },
          context.signal === undefined ? {} : { signal: context.signal },
        );
      } catch (error) {
        return {
          status: "commit_failed",
          failedProposalIndex: startIndex,
          checkpoint: {
            batch: validatedBatch(batch),
            nextProposalIndex: startIndex,
            records: records.map(copyRecord),
          },
          error,
        };
      }
      let expectedIndex = startIndex;
      for (const step of steps) {
        if (step.proposalIndex !== expectedIndex) {
          throw new MemoryError(
            "illegal_state",
            "batch committer returned non-contiguous proposal indexes",
          );
        }
        if ("error" in step) {
          if (!isDeterministicCommitFailure(step.error)) {
            return {
              status: "commit_failed",
              failedProposalIndex: step.proposalIndex,
              checkpoint: {
                batch: validatedBatch(batch),
                nextProposalIndex: step.proposalIndex,
                records: records.map(copyRecord),
              },
              error: step.error,
            };
          }
          skipped.push({
            proposalIndex: step.proposalIndex,
            reason: describeCommitRefusal(step.error),
          });
          expectedIndex += 1;
          continue;
        }
        const record = {
          proposalIndex: step.proposalIndex,
          result: copyCommitResult(step.result),
        } satisfies PostOutputMemoryCommitRecord;
        records.push(record);
        expectedIndex += 1;
        if (record.result.index.status === "pending_repair") {
          const pending = record.result.index;
          return {
            status: "index_repair_required",
            checkpoint: {
              batch: validatedBatch(batch),
              nextProposalIndex: step.proposalIndex + 1,
              records: records.map(copyRecord),
              pendingProposalIndex: step.proposalIndex,
              pending: {
                status: "pending_repair",
                document: copyDocument(pending.document),
                error: pending.error,
              },
            },
            error: pending.error,
          };
        }
      }
      if (expectedIndex !== batch.proposals.length) {
        throw new MemoryError(
          "illegal_state",
          "batch committer ended before every proposal was processed",
        );
      }
      return {
        status: "completed",
        batch: validatedBatch(batch),
        records: records.map(copyRecord),
        reinforcements: reinforcementRecords.map((entry) => ({ ...entry })),
        skippedProposals: [...skipped],
      };
    }
    for (
      let proposalIndex = startIndex;
      proposalIndex < batch.proposals.length;
      proposalIndex += 1
    ) {
      let result: RelationGatedCommitResult;
      try {
        result = await this.#committer.commit(
          {
            batch: validatedBatch(batch),
            proposalIndex,
          },
          context.signal === undefined ? {} : { signal: context.signal },
        );
      } catch (error) {
        // Two kinds of failure needing opposite responses, and until A008-0062
        // both got the second one.
        //
        // A deterministic refusal — a contested slot, a policy violation, an
        // invalid value — will fail identically on every retry. Stopping on it
        // discarded every proposal after it *and* rolled back the ones already
        // committed, and the checkpoint it left could never make progress. One
        // bad proposal in a batch of twenty-seven lost all twenty-seven, and
        // did it again on the next turn.
        //
        // A transient failure — the provider, a cancelled turn — may well
        // succeed on a retry, and stopping with a resumable checkpoint is
        // exactly right for it. That path is unchanged.
        if (!isDeterministicCommitFailure(error)) {
          return {
            status: "commit_failed",
            failedProposalIndex: proposalIndex,
            checkpoint: {
              batch: validatedBatch(batch),
              nextProposalIndex: proposalIndex,
              records: records.map(copyRecord),
            },
            error,
          };
        }
        skipped.push({
          proposalIndex,
          reason: describeCommitRefusal(error),
        });
        continue;
      }
      const record = {
        proposalIndex,
        result: copyCommitResult(result),
      } satisfies PostOutputMemoryCommitRecord;
      records.push(record);
      if (record.result.index.status === "pending_repair") {
        const pending = record.result.index;
        return {
          status: "index_repair_required",
          checkpoint: {
            batch: validatedBatch(batch),
            nextProposalIndex: proposalIndex + 1,
            records: records.map(copyRecord),
            pendingProposalIndex: proposalIndex,
            pending: {
              status: "pending_repair",
              document: copyDocument(pending.document),
              error: pending.error,
            },
          },
          error: pending.error,
        };
      }
      if (
        record.result.index.status !== "updated" &&
        record.result.index.status !== "not_required"
      ) {
        throw new MemoryError(
          "illegal_state",
          "relation committer returned an unknown index state",
        );
      }
    }
    return {
      status: "completed",
      batch: validatedBatch(batch),
      records: records.map(copyRecord),
      reinforcements: reinforcementRecords.map((entry) => ({ ...entry })),
      skippedProposals: [...skipped],
    };
  }

  #begin(): void {
    if (this.#active) {
      throw new MemoryError(
        "illegal_state",
        "post-output memory coordinator already has an active operation",
      );
    }
    this.#active = true;
  }
}
