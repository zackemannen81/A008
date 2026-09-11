import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { MemoryError } from "../src/memory/errors.js";
import {
  PostOutputKnowledgeIntake,
  resolveAnalyzerSupport,
  serializeStagedKnowledgeProposals,
  Utf8ByteKnowledgeIntakeMeasurer,
  type AnalyzedKnowledgeDraft,
  type PostOutputAnalyzerInput,
  type PostOutputKnowledgeAnalyzer,
} from "../src/orchestration/post-output-knowledge-intake.js";
import { parseProposalConfidence } from "../src/orchestration/post-output-knowledge-intake.js";
import { describeMemoryOutcome } from "../src/runtime/local-memory-runtime.js";
import { ChatTransportSemanticJsonGenerator, ModelBackedPostOutputKnowledgeAnalyzer, POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION } from "../src/orchestration/semantic-json-model.js";
import { Utf8ByteChatMessageMeasurer } from "../src/core/chat-invocation.js";

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

test("documented extractor examples are valid JSON batches with exact original-source support", async () => {
  const encoded = /<examples>(.*?)<\/examples>/u.exec(POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION)?.[1];
  assert.ok(encoded);
  const examples = JSON.parse(encoded) as readonly {
    input: { message: string; answer: string } | { kind: "source"; locator: string; content: string };
    output: readonly AnalyzedKnowledgeDraft[];
  }[];
  assert.equal(examples.length, 3);
  assert.deepEqual(examples.map(e => e.output.length), [0, 1, 1]);
  let calls = 0;
  for (const example of examples) {
    const analyzer = new ModelBackedPostOutputKnowledgeAnalyzer(new ChatTransportSemanticJsonGenerator({
      model: "fixture/extractor", budget: { maximum: 16384, measurer: new Utf8ByteChatMessageMeasurer() },
      transport: { async complete() {
        calls += 1;
        return { message: { role: "assistant", content: JSON.stringify(example.output) }, reasoning: "private example reasoning" };
      } },
    }));
    const stager = intake(analyzer);
    const result = await stager.stage("content" in example.input ? {
      ...example.input, taskId: TASK, utteranceId: "fixture-source-utterance", applicabilityScopes: ["fixtures"],
    } : { ...example.input, taskId: TASK, applicabilityScopes: ["fixtures"] });
    assert.equal(result.proposals.length, example.output.length);
    assert.deepEqual(result.skippedProposals, []);
    for (const proposal of result.proposals) {
      assert.equal(proposal.severity, "minor");
      assert.ok(proposal.support);
      const source = "content" in example.input ? example.input.content : example.input.message;
      assert.equal(source.slice(proposal.support.start, proposal.support.end), proposal.proposal.proposition);
      assert.equal(proposal.support.source, "content" in example.input ? "source" : "message");
    }
    assert.equal(JSON.stringify(result).includes("private example reasoning"), false);
  }
  assert.equal(calls, 3);
  // These exercise the wire contract and runtime admission, not live model judgement.
});

test("intake exposes only message and final answer and applies runtime-owned fields", async () => {
  let received: PostOutputAnalyzerInput | undefined;
  let calls = 0;
  const untrusted = [
    {
      severity: "important",
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
    { severity: "important" as const,
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
        { severity: "important",
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

test("a batch-level defect still fails closed", async () => {
  // More items than the ceiling says the response as a whole cannot be trusted,
  // not that one item was malformed. That still rejects everything.
  const excessive = intake(
    {
      async analyze() {
        return [
          { severity: "important", proposition: "one", kind: "fact" },
          { severity: "important", proposition: "two", kind: "fact" },
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
});

test("one bad item is skipped and reported, not allowed to discard the batch", async () => {
  // Observed live: a completeness-oriented extraction of tens of items came
  // back with an empty proposition at index 5, and the whole batch was lost.
  const staged = await intake({
    async analyze() {
      return [
        { severity: "important", proposition: "first durable claim", kind: "fact" },
        { severity: "important", proposition: "", kind: "fact" },
        { severity: "important", proposition: "second durable claim", kind: "fact" },
        { severity: "important", proposition: "third durable claim", kind: "fact", confidence: 2 },
        { severity: "important", proposition: "fourth durable claim", kind: "fact" },
        // A near-duplicate: the instruction asks for recursive splitting, so
        // the model will not always dedupe perfectly.
        { severity: "important", proposition: "First durable claim", kind: "Fact" },
        "not an object",
      ] as never;
    },
  }).stage(input);

  assert.deepEqual(
    staged.proposals.map((entry) => entry.proposal.proposition),
    ["first durable claim", "second durable claim", "fourth durable claim"],
  );

  // The loss must be visible, never silent.
  assert.equal(staged.skippedProposals.length, 4);
  assert.match(staged.skippedProposals[0] ?? "", /proposition/u);
  assert.match(staged.skippedProposals[1] ?? "", /confidence/u);
  assert.match(staged.skippedProposals[2] ?? "", /duplicates/u);
  assert.match(staged.skippedProposals[3] ?? "", /must be an object/u);
});

test("a clean extraction reports nothing skipped", async () => {
  const staged = await intake({
    async analyze() {
      return [{ severity: "important", proposition: "a durable claim", kind: "fact" }];
    },
  }).stage(input);

  assert.deepEqual(staged.skippedProposals, []);
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
        return Array.from({ length: REAL_WORLD_PROPOSALS }, (_value, index) => ({ severity: "important",
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
            return Array.from({ length: OVER_CEILING }, (_value, index) => ({ severity: "important",
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
      return [{ severity: "important", proposition: "The invoice total is 4500 SEK", kind: "fact" }];
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
      return [{ severity: "important", proposition: "The invoice total is 4500 SEK", kind: "fact" }];
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
      return [{ severity: "important", proposition: "Reasoning is display-only", kind: "fact" }];
    },
  }).stage(input);

  assert.deepEqual(staged.origin, { kind: "dialogue" });
  assert.equal(staged.sourceMessage, input.message.trim());
});

test("a completed batch reports skipped proposals through the diagnostic", async () => {
  const staged = await intake({
    async analyze() {
      return [
        { severity: "important", proposition: "a durable claim", kind: "fact" },
        { severity: "important", proposition: "", kind: "fact" },
      ] as never;
    },
  }).stage(input);

  // Skipping is not a failure, so the batch completes — but the loss must reach
  // the operator, which is the `memory>` line the CLI and ACP print.
  const diagnostic = describeMemoryOutcome({
    status: "completed",
    batch: staged,
    records: [],
    skippedProposals: [],
  });
  assert.ok(diagnostic);
  assert.match(diagnostic, /skipped 1 malformed proposal/u);
  assert.match(diagnostic, /proposition/u);

  assert.equal(
    describeMemoryOutcome({
      status: "completed",
      batch: { ...staged, skippedProposals: [] },
      records: [],
      skippedProposals: [],
    }),
    undefined,
    "a clean batch stays silent",
  );
});

test("exact support quotes become runtime UTF-16 spans", async () => {
  const message = "Hello. The sample box is blue.";
  const quote = "The sample box is blue.";
  const staged = await intake({
    async analyze() {
      return [{
        severity: "important",
        proposition: quote,
        kind: "fact",
        support: { source: "message", quote },
      }];
    },
  }).stage({
    taskId: TASK,
    message,
    answer: "Noted.",
    applicabilityScopes: ["runtime"],
  });
  assert.deepEqual(staged.skippedProposals, []);
  assert.deepEqual(staged.proposals[0]?.support, {
    source: "message",
    start: message.indexOf(quote),
    end: message.indexOf(quote) + quote.length,
  });
  assert.equal(message.slice(staged.proposals[0]!.support!.start, staged.proposals[0]!.support!.end), quote);
});

test("model-supplied offsets cannot reinforce; missing quotes stay exact-match only", async () => {
  const message = "I use TypeScript.";
  const staged = await intake({
    async analyze() {
      return [
        {
          severity: "important",
          proposition: "I use TypeScript.",
          kind: "fact",
          support: { source: "message", start: 0, end: message.length },
        },
        {
          severity: "important",
          proposition: "A second claim",
          kind: "fact",
          support: { source: "message", quote: "I use typescript." },
        },
      ] as never;
    },
  }).stage({
    taskId: TASK,
    message,
    answer: "Ok.",
    applicabilityScopes: ["runtime"],
  });
  assert.equal(staged.proposals.length, 2);
  assert.equal(staged.proposals[0]?.support, undefined);
  assert.equal(staged.proposals[1]?.support, undefined);
  assert.equal(staged.skippedProposals.length, 2);
  assert.match(staged.skippedProposals[0] ?? "", /quote not found/u);
  assert.match(staged.skippedProposals[1] ?? "", /quote not found/u);
});

test("ambiguous quotes refuse reinforcement unless occurrence is unique", () => {
  const source = "alpha beta alpha";
  const quote = "alpha";
  assert.deepEqual(resolveAnalyzerSupport({ source: "message", quote }, "message", source), {
    ok: false,
    reason: "quote is ambiguous",
  });
  assert.deepEqual(
    resolveAnalyzerSupport({ source: "message", quote, occurrence: 2 }, "message", source),
    { ok: true, span: { source: "message", start: 11, end: 16 } },
  );
  assert.equal(resolveAnalyzerSupport(undefined, "message", source), undefined);
});

test("the confidence a model actually writes is read, not discarded", () => {
  // The analyzer instruction names `confidence` without saying it must be a
  // number, and a model asked for confidence writes "high". The parser demanded
  // a finite number and threw, and A008-0050's per-item resilience then skipped
  // the proposal — so a whole extraction could be dropped over metadata about a
  // proposition A008 had already read correctly.
  assert.equal(parseProposalConfidence(0.9, "c"), 0.9);
  assert.equal(parseProposalConfidence("high", "c"), 0.85);
  assert.equal(parseProposalConfidence("HIGH", "c"), 0.85);
  assert.equal(parseProposalConfidence("  Very High  ", "c"), 0.95);
  assert.equal(parseProposalConfidence("very_high", "c"), 0.95);
  assert.equal(parseProposalConfidence("certain", "c"), 1);
  assert.equal(parseProposalConfidence("low", "c"), 0.3);
  // Quoting a number is a formatting slip, not a different claim.
  assert.equal(parseProposalConfidence("0.75", "c"), 0.75);
  assert.equal(parseProposalConfidence(".5", "c"), 0.5);
});

test("confidence outside the scale or vocabulary is still refused by name", () => {
  // Leniency has to stop somewhere, or an unreadable value becomes a guess.
  for (const bad of [1.5, -0.1, Number.NaN, "quite sure", "", "yes", null, {}]) {
    assert.throws(
      () => parseProposalConfidence(bad, "proposal 3 confidence"),
      (error: unknown) =>
        error instanceof MemoryError &&
        error.message.startsWith("proposal 3 confidence must be"),
      `accepted ${JSON.stringify(bad)}`,
    );
  }
});

test("a word-confidence proposal is staged instead of skipped", async () => {
  const staged = await intake({
    async analyze() {
      return [
        { severity: "important",
          proposition: "Sömn är avgörande för minneskonsolidering",
          kind: "condition",
          tags: ["sömn"],
          domains: ["neurologi"],
          entities: ["sömn"],
          confidence: "high",
        },
      ];
    },
  }).stage({
    taskId: TASK,
    message: "hur fungerar människans minne?",
    answer: "Sömn är avgörande för minneskonsolidering.",
    applicabilityScopes: ["runtime"],
  });

  assert.equal(staged.proposals.length, 1);
  assert.deepEqual(staged.skippedProposals, []);
  assert.equal(staged.proposals[0]?.proposal.confidence, 0.85);
});
