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
  "A008_v1_project_30000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_30000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_30000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_30000000-0000-4000-8000-000000000004",
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
  // The guard is that nothing beyond the variant's own fields reaches the
  // analyzer — no reasoning, no control state, no identity.
  assert.deepEqual(Object.keys(received ?? {}), ["kind", "message", "answer"]);
  assert.equal(received?.kind, "dialogue");
  assert.deepEqual(received, {
    kind: "dialogue",
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
  assert.equal(result.serialized.includes("A008_v1_"), false);

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

test("the default staging ceiling holds a real extraction, not eight proposals", async () => {
  // Owner testing across several models: an ordinary factual text yielded 49
  // proposals. At the previous ceiling of 8, more than half of a normal
  // extraction was discarded as budget_exceeded before anything was committed.
  const REAL_WORLD_PROPOSALS = 49;
  const staged = await intake(
    {
      async analyze() {
        return Array.from({ length: REAL_WORLD_PROPOSALS }, (_value, index) => ({
          proposition: `Distinct durable claim number ${String(index)}`,
          kind: "fact",
        }));
      },
    },
    // A budget wide enough that only the proposal ceiling can reject here.
    1_048_576,
  ).stage(input);

  assert.equal(staged.proposals.length, REAL_WORLD_PROPOSALS);
});

test("the default staging ceiling is still a ceiling", async () => {
  // It bounds provider calls per answer: the coordinator commits proposals
  // sequentially with one classifier call each, so this number is a cost dial
  // as much as a correctness one.
  const OVER_CEILING = 129;
  await assert.rejects(
    () =>
      intake(
        {
          async analyze() {
            return Array.from({ length: OVER_CEILING }, (_value, index) => ({
              proposition: `Claim number ${String(index)}`,
              kind: "fact",
            }));
          },
        },
        1_048_576,
      ).stage(input),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "budget_exceeded",
  );
});

test("a source variant reaches the analyzer as a source, not as a turn", async () => {
  let received: PostOutputAnalyzerInput | undefined;
  const staged = await intake({
    async analyze(value) {
      received = value;
      return [{ proposition: "The invoice total is 4500 SEK", kind: "fact" }];
    },
  }).stage({
    kind: "source",
    taskId: TASK,
    locator: "source:deadbeef/invoice.txt",
    content: "The invoice total is 4500 SEK. Approved by finance.",
    utteranceId: "A008_knowledge_utterance_1",
    applicabilityScopes: ["runtime"],
  });

  // A document is neither a message nor an answer. The serialized payload is
  // what the model reads as untrusted data, so naming it wrongly frames it
  // wrongly.
  assert.deepEqual(Object.keys(received ?? {}), ["kind", "locator", "content"]);
  assert.equal(received?.kind, "source");

  assert.deepEqual(staged.origin, {
    kind: "source",
    utteranceId: "A008_knowledge_utterance_1",
  });
});

test("a source batch carries its locator as sourceMessage, never its content", async () => {
  // This is a safety property, not a naming preference. `isExplicitUserAssertion`
  // activates a proposal when the source message *contains* the proposition, and
  // a document contains every proposition extracted from it. Putting the content
  // here would auto-accept an entire uploaded document as user assertions.
  const content = "The invoice total is 4500 SEK. Approved by finance.";
  const staged = await intake({
    async analyze() {
      return [{ proposition: "The invoice total is 4500 SEK", kind: "fact" }];
    },
  }).stage({
    kind: "source",
    taskId: TASK,
    locator: "source:deadbeef/invoice.txt",
    content,
    utteranceId: "A008_knowledge_utterance_1",
    applicabilityScopes: ["runtime"],
  });

  assert.equal(staged.sourceMessage, "source:deadbeef/invoice.txt");
  assert.equal(staged.sourceMessage.includes(content), false);
  for (const entry of staged.proposals) {
    assert.equal(
      staged.sourceMessage.includes(entry.proposal.proposition),
      false,
      "no staged proposition may be contained in a source batch's sourceMessage",
    );
  }
});

test("a dialogue batch still declares its origin", async () => {
  const staged = await intake({
    async analyze() {
      return [{ proposition: "Reasoning is display-only", kind: "fact" }];
    },
  }).stage(input);

  assert.deepEqual(staged.origin, { kind: "dialogue" });
  assert.equal(staged.sourceMessage, input.message.trim());
});
