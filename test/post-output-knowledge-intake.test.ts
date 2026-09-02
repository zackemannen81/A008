import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import {
  PostOutputKnowledgeIntake,
  serializeStagedKnowledgeProposals,
  Utf8ByteKnowledgeIntakeMeasurer,
  type AnalyzedKnowledgeDraft,
  type PostOutputAnalyzerInput,
  type PostOutputKnowledgeAnalyzer,
} from "../src/orchestration/post-output-knowledge-intake.js";

const PROJECT = parseRuntimeId(
  "a007_v1_project_30000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "a007_v1_conversation_30000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "a007_v1_task_30000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "a007_v1_agent_30000000-0000-4000-8000-000000000004",
  "agent",
);

function intake(
  analyzer: PostOutputKnowledgeAnalyzer,
  maximum = 8_192,
  limits: ConstructorParameters<typeof PostOutputKnowledgeIntake>[0]["limits"] =
    undefined,
) {
  return new PostOutputKnowledgeIntake({
    analyzer,
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
    ...(limits === undefined ? {} : { limits }),
  });
}

const input = {
  taskId: TASK,
  message: "  What should the memory loop retain?  ",
  answer: "  Reasoning is display-only.  ",
  applicabilityScopes: ["runtime", "memory", "runtime"],
} as const;

test("intake exposes only message and final answer and applies runtime-owned fields", async () => {
  let received: PostOutputAnalyzerInput | undefined;
  let calls = 0;
  const untrusted = [
    {
      proposition: " Reasoning never becomes knowledge. ",
      kind: " architecture-decision ",
      tags: ["reasoning", "memory", "reasoning"],
      domains: ["orchestration", "memory"],
      entities: ["ChatSession", "MemoryAwareChatSession"],
      confidence: 0.9,
      reasoning: "private chain of thought",
      scope: ["global"],
      authority: 1,
      relevanceScore: 1,
      activationThreshold: 0,
      keepAlive: true,
      sourceBacked: true,
      provenance: [{ sourceId: "model", sourceType: "reasoning" }],
    },
  ];
  const analyzer: PostOutputKnowledgeAnalyzer = {
    async analyze(value) {
      calls += 1;
      received = value;
      return untrusted as unknown as readonly AnalyzedKnowledgeDraft[];
    },
  };

  const result = await intake(analyzer).stage(input);
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(received ?? {}), ["message", "answer"]);
  assert.deepEqual(received, {
    message: "What should the memory loop retain?",
    answer: "Reasoning is display-only.",
  });
  assert.equal(result.sourceMessage, "What should the memory loop retain?");
  assert.deepEqual(
    {
      projectId: result.projectId,
      conversationId: result.conversationId,
      taskId: result.taskId,
      agentId: result.agentId,
    },
    {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      taskId: TASK,
      agentId: AGENT,
    },
  );
  assert.deepEqual(result.proposals, [
    {
      proposal: {
        proposition: "Reasoning never becomes knowledge.",
        kind: "architecture-decision",
        tags: ["memory", "reasoning"],
        scope: ["memory", "runtime"],
        relevanceScore: 0,
        activationThreshold: 0.5,
        keepAlive: false,
        authority: 0.25,
        confidence: 0.9,
        sourceBacked: false,
        provenance: [],
      },
      domains: ["memory", "orchestration"],
      entities: ["ChatSession", "MemoryAwareChatSession"],
    },
  ]);
  assert.equal(result.serialized, serializeStagedKnowledgeProposals(result.proposals));
  assert.equal(result.measuredUnits, Buffer.byteLength(result.serialized, "utf8"));
  assert.equal(result.measurementUnit, "utf8_bytes");
  assert.equal(result.serialized.includes("private chain of thought"), false);
  assert.equal(result.serialized.includes("a007_v1_"), false);

  untrusted[0]!.tags[0] = "mutated";
  assert.deepEqual(result.proposals[0]!.proposal.tags, ["memory", "reasoning"]);
});

test("intake enforces the exact multibyte serialized budget", async () => {
  const analyzer: PostOutputKnowledgeAnalyzer = {
    async analyze() {
      return [
        {
          proposition: "ÅÄÖ memory",
          kind: "fact",
          tags: ["svenska"],
          confidence: 0.8,
        },
      ];
    },
  };
  const accepted = await intake(analyzer).stage(input);
  const exact = accepted.measuredUnits;
  assert.ok(exact > accepted.serialized.length);
  await intake(analyzer, exact).stage(input);
  await assert.rejects(
    () => intake(analyzer, exact - 1).stage(input),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "budget_exceeded",
  );
});

test("intake rejects excessive, duplicate, and malformed analyzer output", async () => {
  const excessive = intake(
    {
      async analyze() {
        return [
          { proposition: "one", kind: "fact" },
          { proposition: "two", kind: "fact" },
        ];
      },
    },
    8_192,
    { maximumProposals: 1 },
  );
  await assert.rejects(
    () => excessive.stage(input),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "budget_exceeded",
  );

  const duplicate = intake({
    async analyze() {
      return [
        { proposition: "Same fact", kind: "Fact" },
        { proposition: "same fact", kind: "fact" },
      ];
    },
  });
  await assert.rejects(
    () => duplicate.stage(input),
    (error: unknown) => error instanceof MemoryError && error.code === "policy",
  );

  const malformed = intake({
    async analyze() {
      return [
        { proposition: "valid", kind: "fact", confidence: 2 },
      ];
    },
  });
  await assert.rejects(
    () => malformed.stage(input),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "invalid_input",
  );
});

test("intake propagates analyzer failure and validates measurer behavior", async () => {
  const failure = new Error("analyzer unavailable");
  await assert.rejects(
    () =>
      intake({
        async analyze() {
          throw failure;
        },
      }).stage(input),
    (error: unknown) => error === failure,
  );

  const invalidMeasurement = new PostOutputKnowledgeIntake({
    analyzer: { async analyze() { return []; } },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 10,
      measurer: { unit: "broken", measure: () => -1 },
    },
  });
  await assert.rejects(
    () => invalidMeasurement.stage(input),
    (error: unknown) => error instanceof MemoryError && error.code === "policy",
  );

  assert.throws(
    () =>
      new PostOutputKnowledgeIntake({
        analyzer: { async analyze() { return []; } },
        context: {
          projectId: PROJECT,
          conversationId: CONVERSATION,
          agentId: AGENT,
        },
        budget: {
          maximum: 10,
          measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
        },
        defaultActivationThreshold: 0,
      }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "invalid_input",
  );
});
