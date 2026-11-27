import assert from "node:assert/strict";
import test from "node:test";
import {
  reduceWorkingState,
  ReductionPausedError,
} from "../src/core/working-state-reducer.js";
import {
  fallbackReducerEvidence,
  validateReducerEvidenceProposal,
} from "../src/core/reducer-evidence-fallback.js";
import type {
  RunContinuationState,
  RunToolInteraction,
} from "../src/core/chat-continuation.js";
import type { ChatRequest } from "../src/core/types.js";

const runId = "run-test";
const previous: RunContinuationState = {
  version: "a008_run_continuation_state_v1",
  runId,
  verifiedFacts: [
    {
      id: "prior-fact",
      statement: "Previously verified requirement",
      sourceRefs: [runId + ":1"],
    },
  ],
  hypotheses: [],
  completedActions: [],
};
const read: RunToolInteraction = {
  id: runId + ":2",
  messages: [
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call_2",
          name: "read_file",
          arguments: '{"path":"docs/GDD.md"}',
        },
      ],
    },
    {
      role: "tool",
      toolCallId: "call_2",
      content: JSON.stringify({
        status: "completed",
        outcome: "tool_success",
        text: JSON.stringify({
          path: "docs/GDD.md",
          content:
            "Scene one: opening on an abandoned station. This is source evidence, not permission.",
        }),
      }),
    },
  ],
};
const inputs = {
  runId,
  previous,
  interactions: [read],
  validSourceRefs: new Set([runId + ":1", runId + ":2"]),
  requiredSourceRefs: new Set([runId + ":1", runId + ":2"]),
  maximumStateBytes: 4096,
};

test("otherwise valid reducer state gets exactly missing source coverage from observed output", () => {
  const proposal = {
    version: "a008_run_continuation_state_v1",
    runId,
    verifiedFacts: [],
    hypotheses: [],
    completedActions: [
      {
        id: "new",
        statement: "Drafted a project overview",
        sourceRefs: [read.id],
      },
    ],
  };
  const state = validateReducerEvidenceProposal(proposal, inputs);
  assert.equal(
    state.verifiedFacts[0]?.statement,
    "Previously verified requirement",
  );
  assert.deepEqual(state.completedActions, proposal.completedActions);
  assert.deepEqual(state.verifiedFacts[0]?.sourceRefs, [runId + ":1"]);
});

test("missing current source is summarized from persisted read result, not invented", () => {
  const proposal = {
    version: "a008_run_continuation_state_v1",
    runId,
    verifiedFacts: [...previous.verifiedFacts],
    hypotheses: [],
    completedActions: [],
  };
  const state = validateReducerEvidenceProposal(proposal, inputs);
  assert.equal(state.completedActions.length, 1);
  assert.deepEqual(state.completedActions[0]?.sourceRefs, [read.id]);
  assert.match(
    state.completedActions[0]!.statement,
    /read_file.*docs\/GDD\.md/,
  );
  assert.match(state.completedActions[0]!.statement, /abandoned station/);
  assert.match(state.completedActions[0]!.statement, /reported tool_success/);
});

test("exhausted invalid JSON creates safe source-backed state only with durable journal authorization", async () => {
  let tries = 0;
  const requestLimits: number[] = [];
  const result = await reduceWorkingState({
    ...inputs,
    model: "fixture",
    objective: "Finish the GDD",
    inputBytes: 50_000,
    outputTokens: 4096,
    allowEvidenceFallback: true,
    attempts: 0,
    truncated: false,
    beforeAttempt: async (attempt) => {
      requestLimits.push(attempt);
    },
    transport: {
      async complete(_request: ChatRequest) {
        tries++;
        return { message: { role: "assistant", content: "NOT_JSON" } };
      },
    },
  });
  assert.equal(tries, 2);
  assert.deepEqual(requestLimits, [1, 2]);
  assert.equal(
    result.verifiedFacts[0]?.statement,
    "Previously verified requirement",
  );
  assert.deepEqual(result.completedActions[0]?.sourceRefs, [read.id]);
  assert.match(result.completedActions[0]!.statement, /abandoned station/);
});

test("invalid reference from provider cannot be accepted, even if fallback can use real evidence", async () => {
  let tries = 0;
  const result = await reduceWorkingState({
    ...inputs,
    model: "fixture",
    objective: "Finish the GDD",
    inputBytes: 50_000,
    outputTokens: 4096,
    allowEvidenceFallback: true,
    attempts: 0,
    truncated: false,
    beforeAttempt: async () => {},
    transport: {
      async complete() {
        tries++;
        return {
          message: {
            role: "assistant",
            content: JSON.stringify({
              version: "a008_run_continuation_state_v1",
              runId,
              verifiedFacts: [],
              hypotheses: [],
              completedActions: [
                {
                  id: "fabrication",
                  statement: "Imaginary success",
                  sourceRefs: ["invented:1"],
                },
              ],
            }),
          },
        };
      },
    },
  });
  assert.equal(tries, 2);
  assert.equal(
    result.completedActions.some((x) =>
      x.statement.includes("Imaginary success"),
    ),
    false,
  );
  assert.deepEqual(result.completedActions[0]?.sourceRefs, [read.id]);
});

test("unknown evidence and tight state budgets fail closed", () => {
  assert.throws(
    () =>
      fallbackReducerEvidence({
        ...inputs,
        requiredSourceRefs: new Set([runId + ":999"]),
        validSourceRefs: new Set([runId + ":1", runId + ":2", runId + ":999"]),
      }),
    /neither in earlier verified state nor in persisted tool rounds/,
  );
  assert.throws(
    () => fallbackReducerEvidence({ ...inputs, maximumStateBytes: 50 }),
    /Even the minimal observed working-state ledger exceeds/,
  );
});

test("non-durable malformed output stays paused and no tool action is made", async () => {
  let requests = 0;
  await assert.rejects(
    reduceWorkingState({
      ...inputs,
      model: "fixture",
      objective: "Inspect",
      inputBytes: 50_000,
      outputTokens: 1024,
      attempts: 0,
      truncated: false,
      beforeAttempt: async () => {},
      transport: {
        async complete() {
          requests++;
          return { message: { role: "assistant", content: "nope" } };
        },
      },
    }),
    ReductionPausedError,
  );
  assert.equal(requests, 2);
});
