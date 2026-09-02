import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("compiled memory-loop benchmark proves read-answer-commit-reread", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["dist/src/benchmark/memory-loop.js"],
    { cwd: process.cwd(), windowsHide: true },
  );
  assert.equal(stderr, "");
  const report = JSON.parse(stdout) as {
    benchmark: string;
    mode: string;
    turns: number;
    memoryReads: number;
    providerCalls: number;
    chatProviderCalls: number;
    semanticProviderCalls: number;
    providerCallOrder: string[];
    selectedKnowledgeIds: string[][];
    projectedPropositions: string[][];
    priorDialogueCounts: number[];
    commitStatus: string;
    commitRelations: string[];
    indexStates: string[];
    canonicalRevisionBefore: number;
    canonicalRevisionAfter: number;
    canonicalActivationAfter: string;
    auditTypes: string[];
    semanticRequestMessageCounts: number[];
    streamedDeltas: { reasoning: number; content: number };
    committedDialogueMessages: number;
    secondRequestContainsPriorReasoning: boolean;
    semanticResultsContainProviderReasoning: boolean;
    providerMessagesContainControlIds: boolean;
    newDraftAutoActivationProven: boolean;
    timingIsGuarantee: boolean;
  };
  assert.equal(report.benchmark, "a007_committed_memory_loop_v2");
  assert.equal(report.mode, "fake_shared_transport_actual_sqlite");
  assert.equal(report.turns, 2);
  assert.equal(report.memoryReads, 2);
  assert.equal(report.providerCalls, 4);
  assert.equal(report.chatProviderCalls, 2);
  assert.equal(report.semanticProviderCalls, 2);
  assert.deepEqual(report.providerCallOrder, [
    "chat",
    "knowledge_analysis",
    "relation_classification",
    "chat",
  ]);
  assert.deepEqual(report.selectedKnowledgeIds, [
    ["benchmark_reasoning_boundary"],
    ["benchmark_reasoning_boundary"],
  ]);
  assert.deepEqual(report.projectedPropositions, [
    [
      "Provider reasoning is display-only and excluded from conversation history.",
    ],
    [
      "Provider reasoning is display-only and excluded from conversation history, semantic knowledge, and future prompts.",
    ],
  ]);
  assert.deepEqual(report.priorDialogueCounts, [0, 2]);
  assert.equal(report.commitStatus, "completed");
  assert.deepEqual(report.commitRelations, ["extend"]);
  assert.deepEqual(report.indexStates, ["updated"]);
  assert.equal(report.canonicalRevisionBefore, 1);
  assert.equal(report.canonicalRevisionAfter, 2);
  assert.equal(report.canonicalActivationAfter, "active");
  assert.ok(report.auditTypes.includes("knowledge_extended"));
  assert.deepEqual(report.semanticRequestMessageCounts, [2, 2]);
  assert.deepEqual(report.streamedDeltas, { reasoning: 2, content: 2 });
  assert.equal(report.committedDialogueMessages, 4);
  assert.equal(report.secondRequestContainsPriorReasoning, false);
  assert.equal(report.semanticResultsContainProviderReasoning, false);
  assert.equal(report.providerMessagesContainControlIds, false);
  assert.equal(report.newDraftAutoActivationProven, false);
  assert.equal(report.timingIsGuarantee, false);
});
