import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import { KnowledgeModelError } from "../src/memory/knowledge/errors.js";
import type { KnowledgeItem } from "../src/memory/types.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type StagedKnowledgeBatch,
} from "../src/orchestration/post-output-knowledge-intake.js";
import {
  PostOutputMemoryCoordinator,
  type PostOutputMemoryCommitCheckpoint,
  type PostOutputMemoryIndexRepairCheckpoint,
  type StagedProposalCommitter,
} from "../src/orchestration/post-output-memory-coordinator.js";
import type {
  RelationGatedCommitResult,
  RelationIndexResult,
} from "../src/orchestration/relation-gated-memory-commit.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_70000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_70000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_70000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_70000000-0000-4000-8000-000000000004",
  "agent",
);

async function batchWith(count: number): Promise<StagedKnowledgeBatch> {
  return new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return Array.from({ length: count }, (_, index) => ({
          severity: "important",
          proposition: `Knowledge proposal ${index + 1}`,
          kind: "architecture-decision",
          tags: ["memory", `proposal-${index + 1}`],
          domains: ["orchestration"],
          entities: [`entity-${index + 1}`],
          confidence: 0.9,
        }));
      },
    },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 20_000,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  }).stage({
    taskId: TASK,
    message: "Original message",
    answer: "Final answer",
    applicabilityScopes: ["runtime"],
  });
}

function item(id: string, proposition: string): KnowledgeItem {
  return {
    id,
    proposition,
    kind: "architecture-decision",
    tags: ["memory"],
    scope: ["runtime"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "dormant",
    relevanceScore: 0,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.25,
    confidence: 0.9,
    sourceBacked: false,
    provenance: [],
    revision: 1,
  };
}

function commitResult(
  proposalIndex: number,
  index: RelationIndexResult = {
    status: "updated",
    document: { knowledgeId: `knowledge-${proposalIndex}` },
  },
): RelationGatedCommitResult {
  const conflict = index.status === "not_required";
  return {
    classifierDecision: conflict
      ? { type: "conflict", targetHandles: ["candidate_1"] }
      : { type: "new" },
    reconciliationDecision: conflict
      ? { type: "conflict", targetIds: ["existing"] }
      : { type: "new" },
    reconciliation: conflict
      ? {
          relation: "conflict",
          item: null,
          previousItem: null,
          conflictTargetIds: ["existing"],
        }
      : {
          relation: "new",
          item: item(
            `knowledge-${proposalIndex}`,
            `Knowledge proposal ${proposalIndex + 1}`,
          ),
          previousItem: null,
          conflictTargetIds: [],
        },
    evidence: {
      materializedCandidateIds: conflict ? ["existing"] : [],
      classifierCandidateIds: conflict ? ["existing"] : [],
      classifierInputSerialized: `classifier-${proposalIndex}`,
      classifierInputMeasuredUnits: 10,
      classifierInputMeasurementUnit: "utf8_bytes",
    },
    index,
  };
}

test("fresh processing stages once, strips extras, orders commits, and copies containers", async () => {
  const sourceBatch = await batchWith(3);
  let stagingCalls = 0;
  let stagingKeys: string[] = [];
  const commitCalls: number[] = [];
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage(input) {
        stagingCalls += 1;
        stagingKeys = Object.keys(input).sort();
        return sourceBatch;
      },
    },
    committer: {
      async commit(input) {
        commitCalls.push(input.proposalIndex);
        return commitResult(
          input.proposalIndex,
          input.proposalIndex === 1
            ? { status: "not_required" }
            : {
                status: "updated",
                document: {
                  knowledgeId: `knowledge-${input.proposalIndex}`,
                },
              },
        );
      },
      async repairIndex() {
        throw new Error("repair is not expected");
      },
    },
  });

  const result = await coordinator.process({
    taskId: TASK,
    message: "  Original message  ",
    answer: "  Final answer  ",
    applicabilityScopes: ["runtime"],
    reasoning: "display only",
    projectId: "must not cross",
  } as never);

  assert.equal(result.status, "completed");
  assert.equal(stagingCalls, 1);
  assert.deepEqual(stagingKeys, [
    "answer",
    "applicabilityScopes",
    "message",
    "taskId",
  ]);
  assert.deepEqual(commitCalls, [0, 1, 2]);
  if (result.status !== "completed") {
    throw new Error("expected completed result");
  }
  assert.deepEqual(
    result.records.map((record) => record.proposalIndex),
    [0, 1, 2],
  );
  assert.equal(JSON.stringify(result).includes("display only"), false);
  (result.batch.proposals[0]!.proposal.tags as string[]).push("mutation");
  (result.records as Array<unknown>).pop();
  assert.equal(
    sourceBatch.proposals[0]!.proposal.tags?.includes("mutation"),
    false,
  );
  assert.equal(sourceBatch.proposals.length, 3);
});

test("zero proposals complete without a relation call", async () => {
  let commitCalls = 0;
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        return batchWith(0);
      },
    },
    committer: {
      async commit() {
        commitCalls += 1;
        throw new Error("must not commit");
      },
      async repairIndex() {
        throw new Error("must not repair");
      },
    },
  });
  const result = await coordinator.process({
    taskId: TASK,
    message: "Message",
    answer: "Answer",
    applicabilityScopes: ["runtime"],
  });
  assert.equal(result.status, "completed");
  assert.equal(commitCalls, 0);
  if (result.status === "completed") {
    assert.deepEqual(result.records, []);
  }
});

test("staging failure is explicit and makes zero commit calls", async () => {
  const failure = new Error("analyzer unavailable");
  let commitCalls = 0;
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        throw failure;
      },
    },
    committer: {
      async commit() {
        commitCalls += 1;
        return commitResult(0);
      },
      async repairIndex() {
        throw new Error("must not repair");
      },
    },
  });
  const result = await coordinator.process({
    taskId: TASK,
    message: "Message",
    answer: "Answer",
    applicabilityScopes: [],
  });
  assert.deepEqual(result, { status: "staging_failed", error: failure });
  assert.equal(commitCalls, 0);
});

test("commit failure checkpoints the exact index and resume never restages or repeats", async () => {
  const batch = await batchWith(3);
  let stagingCalls = 0;
  const commitCalls: number[] = [];
  let failedOnce = false;
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        stagingCalls += 1;
        return batch;
      },
    },
    committer: {
      async commit(input) {
        commitCalls.push(input.proposalIndex);
        if (input.proposalIndex === 1 && !failedOnce) {
          failedOnce = true;
          throw new Error("transient commit failure");
        }
        return commitResult(input.proposalIndex);
      },
      async repairIndex() {
        throw new Error("must not repair");
      },
    },
  });
  const first = await coordinator.process({
    taskId: TASK,
    message: "Message",
    answer: "Answer",
    applicabilityScopes: ["runtime"],
  });
  assert.equal(first.status, "commit_failed");
  if (first.status !== "commit_failed") {
    throw new Error("expected commit failure");
  }
  assert.equal(first.failedProposalIndex, 1);
  assert.equal(first.checkpoint.nextProposalIndex, 1);
  assert.deepEqual(
    first.checkpoint.records.map((record) => record.proposalIndex),
    [0],
  );

  const resumed = await coordinator.resume(first.checkpoint);
  assert.equal(resumed.status, "completed");
  assert.equal(stagingCalls, 1);
  assert.deepEqual(commitCalls, [0, 1, 1, 2]);
  if (resumed.status === "completed") {
    assert.deepEqual(
      resumed.records.map((record) => record.proposalIndex),
      [0, 1, 2],
    );
  }
});

test("pending index repair blocks later commits and repair resumes without reconcile", async () => {
  const batch = await batchWith(2);
  const commitCalls: number[] = [];
  let repairCalls = 0;
  const pendingError = new Error("index unavailable");
  const committer: StagedProposalCommitter = {
    async commit(input) {
      commitCalls.push(input.proposalIndex);
      if (input.proposalIndex === 0) {
        return commitResult(0, {
          status: "pending_repair",
          document: {
            knowledgeId: "knowledge-0",
            entities: ["entity-1"],
            domains: ["orchestration"],
          },
          error: pendingError,
        });
      }
      return commitResult(input.proposalIndex);
    },
    async repairIndex(pending) {
      repairCalls += 1;
      if (repairCalls === 1) {
        throw new Error("still unavailable");
      }
      return {
        status: "updated",
        document: pending.document,
      };
    },
  };
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        return batch;
      },
    },
    committer,
  });
  const first = await coordinator.process({
    taskId: TASK,
    message: "Message",
    answer: "Answer",
    applicabilityScopes: ["runtime"],
  });
  assert.equal(first.status, "index_repair_required");
  assert.deepEqual(commitCalls, [0]);
  if (first.status !== "index_repair_required") {
    throw new Error("expected repair checkpoint");
  }

  const failedRepair = await coordinator.repairAndResume(first.checkpoint);
  assert.equal(failedRepair.status, "index_repair_required");
  assert.deepEqual(commitCalls, [0]);
  if (failedRepair.status !== "index_repair_required") {
    throw new Error("expected repair retry result");
  }
  const completed = await coordinator.repairAndResume(failedRepair.checkpoint);
  assert.equal(completed.status, "completed");
  assert.equal(repairCalls, 2);
  assert.deepEqual(commitCalls, [0, 1]);
  if (completed.status === "completed") {
    assert.equal(completed.records[0]?.result.index.status, "updated");
    assert.equal(completed.records[1]?.proposalIndex, 1);
  }
});

test("malformed retry checkpoints fail before commit or repair", async () => {
  const batch = await batchWith(2);
  let commitCalls = 0;
  let repairCalls = 0;
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        return batch;
      },
    },
    committer: {
      async commit() {
        commitCalls += 1;
        return commitResult(0);
      },
      async repairIndex() {
        repairCalls += 1;
        return {
          status: "updated",
          document: { knowledgeId: "knowledge-0" },
        };
      },
    },
  });
  const invalidCommit = {
    batch: { ...batch, serialized: "forged" },
    nextProposalIndex: 0,
    records: [],
  } as PostOutputMemoryCommitCheckpoint;
  await assert.rejects(
    () => coordinator.resume(invalidCommit),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "invalid_input",
  );

  const pending = commitResult(0, {
    status: "pending_repair",
    document: { knowledgeId: "knowledge-0" },
    error: new Error("pending"),
  });
  const invalidRepair = {
    batch,
    nextProposalIndex: 1,
    records: [{ proposalIndex: 0, result: pending }],
    pendingProposalIndex: 0,
    pending: {
      status: "pending_repair",
      document: { knowledgeId: "different" },
      error: new Error("pending"),
    },
  } as PostOutputMemoryIndexRepairCheckpoint;
  await assert.rejects(
    () => coordinator.repairAndResume(invalidRepair),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "invalid_input",
  );
  assert.equal(commitCalls, 0);
  assert.equal(repairCalls, 0);
});

test("overlapping coordinator operations reject before a second child call", async () => {
  const batch = await batchWith(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let stagingCalls = 0;
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        stagingCalls += 1;
        await gate;
        return batch;
      },
    },
    committer: {
      async commit() {
        throw new Error("must not commit");
      },
      async repairIndex() {
        throw new Error("must not repair");
      },
    },
  });
  const first = coordinator.process({
    taskId: TASK,
    message: "Message",
    answer: "Answer",
    applicabilityScopes: [],
  });
  await assert.rejects(
    () =>
      coordinator.process({
        taskId: TASK,
        message: "Second",
        answer: "Answer",
        applicabilityScopes: [],
      }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "illegal_state",
  );
  release();
  assert.equal((await first).status, "completed");
  assert.equal(stagingCalls, 1);
});

test("coordinator forwards one abort signal and preserves staging versus commit checkpoints", async () => {
  const sourceBatch = await batchWith(1);
  const controller = new AbortController();
  let stageSignal: AbortSignal | undefined;
  let commitSignal: AbortSignal | undefined;
  let commitCalls = 0;
  const stagingCancelled = new PostOutputMemoryCoordinator({
    stager: {
      async stage(_input, context) {
        stageSignal = context?.signal;
        throw new ChatError("cancelled", "staging cancelled");
      },
    },
    committer: {
      async commit() {
        commitCalls += 1;
        return commitResult(0);
      },
      async repairIndex() {
        throw new Error("repair is not expected");
      },
    },
  });
  const staged = await stagingCancelled.process(
    {
      taskId: TASK,
      message: "Original message",
      answer: "Final answer",
      applicabilityScopes: ["runtime"],
    },
    { signal: controller.signal },
  );
  assert.equal(staged.status, "staging_failed");
  assert.equal(stageSignal, controller.signal);
  assert.equal(commitCalls, 0);

  const commitCancelled = new PostOutputMemoryCoordinator({
    stager: {
      async stage(_input, context) {
        stageSignal = context?.signal;
        return sourceBatch;
      },
    },
    committer: {
      async commit(_input, context) {
        commitCalls += 1;
        commitSignal = context?.signal;
        throw new ChatError("cancelled", "classification cancelled");
      },
      async repairIndex() {
        throw new Error("repair is not expected");
      },
    },
  });
  const committed = await commitCancelled.process(
    {
      taskId: TASK,
      message: "Original message",
      answer: "Final answer",
      applicabilityScopes: ["runtime"],
    },
    { signal: controller.signal },
  );
  assert.equal(committed.status, "commit_failed");
  assert.equal(stageSignal, controller.signal);
  assert.equal(commitSignal, controller.signal);
  assert.equal(commitCalls, 1);
  if (committed.status !== "commit_failed") {
    throw new Error("expected commit failure");
  }
  assert.equal(committed.failedProposalIndex, 0);
  assert.equal(committed.checkpoint.nextProposalIndex, 0);
  assert.deepEqual(committed.checkpoint.records, []);
});

test("a deterministic refusal skips its proposal and the batch still completes", async () => {
  // Until A008-0062 the loop returned on the first refusal. Proposal 1 failing
  // meant proposals 2 and 3 were never attempted and proposal 0 was rolled back
  // with them — and the checkpoint it left could never make progress, because a
  // deterministic refusal refuses again on every retry. One bad proposal in a
  // batch of twenty-seven lost all twenty-seven, on that turn and every turn
  // after it.
  const sourceBatch = await batchWith(4);
  const attempted: number[] = [];
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        return sourceBatch;
      },
    },
    committer: {
      async commit(input) {
        attempted.push(input.proposalIndex);
        if (input.proposalIndex === 1) {
          throw new KnowledgeModelError(
            "invalid_input",
            "UPDATE fails when the slot is contested",
          );
        }
        return commitResult(input.proposalIndex, { status: "not_required" });
      },
      async repairIndex() {
        throw new Error("repair is not expected");
      },
    } satisfies StagedProposalCommitter,
  });

  const result = await coordinator.process({
    taskId: TASK,
    message: "Original message",
    answer: "Final answer",
    applicabilityScopes: ["runtime"],
  } as never);
  assert.equal(result.status, "completed");
  assert.ok(result.status === "completed");

  // Every proposal was tried, and the three that could commit did.
  assert.deepEqual(attempted, [0, 1, 2, 3]);
  assert.deepEqual(
    result.records.map((record) => record.proposalIndex),
    [0, 2, 3],
  );

  // The loss is named, not silent, and carries this repository's own text.
  assert.deepEqual(result.skippedProposals, [
    { proposalIndex: 1, reason: "UPDATE fails when the slot is contested" },
  ]);
});

test("a retryable failure still stops with a resumable checkpoint", async () => {
  // The opposite half. `stale_state` is a MemoryError like the refusals above,
  // and classifying by class rather than by code would have skipped it — losing
  // a proposal that was about to succeed. The checkpoint exists for exactly
  // this case.
  const sourceBatch = await batchWith(3);
  const attempted: number[] = [];
  const coordinator = new PostOutputMemoryCoordinator({
    stager: {
      async stage() {
        return sourceBatch;
      },
    },
    committer: {
      async commit(input) {
        attempted.push(input.proposalIndex);
        if (input.proposalIndex === 1) {
          throw new MemoryError("stale_state", "revision changed");
        }
        return commitResult(input.proposalIndex, { status: "not_required" });
      },
      async repairIndex() {
        throw new Error("repair is not expected");
      },
    } satisfies StagedProposalCommitter,
  });

  const result = await coordinator.process({
    taskId: TASK,
    message: "Original message",
    answer: "Final answer",
    applicabilityScopes: ["runtime"],
  } as never);
  assert.equal(result.status, "commit_failed");
  assert.ok(result.status === "commit_failed");
  assert.equal(result.failedProposalIndex, 1);
  assert.equal(result.checkpoint.nextProposalIndex, 1);
  // It stopped rather than stepping over, so proposal 2 was never tried.
  assert.deepEqual(attempted, [0, 1]);
});
