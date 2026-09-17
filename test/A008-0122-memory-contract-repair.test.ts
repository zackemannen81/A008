import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { RelationIndex } from "../src/memory/knowledge/expand.js";
import { inspectKnowledge } from "../src/memory/knowledge/inspection.js";
import { KnowledgeEngineCommit } from "../src/memory/knowledge/live-commit.js";
import { createKnowledgeContext } from "../src/memory/knowledge/read.js";
import {
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../src/memory/knowledge/sqlite-context.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type AnalyzedKnowledgeDraft,
  type StagedKnowledgeBatch,
} from "../src/orchestration/post-output-knowledge-intake.js";
import type {
  RelationClassifierBatchInput,
  RelationClassifierInput,
  RelationClassifierDecision,
} from "../src/orchestration/relation-gated-memory-commit.js";
import { KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION } from "../src/prompt-contracts/KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION.js";
import { KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION } from "../src/prompt-contracts/KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION.js";

const PROJECT = sqliteKnowledgeTestProjectId();
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_12200000-0000-4000-8000-000000000001",
  "conversation",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_12200000-0000-4000-8000-000000000002",
  "agent",
);
const taskId = (n: number) =>
  parseRuntimeId(
    `A008_v1_task_12200000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    "task",
  );

async function stage(
  n: number,
  message: string,
  answer: string,
  drafts: readonly AnalyzedKnowledgeDraft[],
): Promise<StagedKnowledgeBatch> {
  const intake = new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return structuredClone(drafts);
      },
    },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 1_048_576,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  });
  return intake.stage({
    taskId: taskId(n),
    message,
    answer,
    applicabilityScopes: ["local"],
  });
}

async function commitOne(
  context: ReturnType<typeof createKnowledgeContext>,
  batch: StagedKnowledgeBatch,
  decide: (input: RelationClassifierInput) => RelationClassifierDecision,
) {
  const writer = new KnowledgeEngineCommit({
    context,
    classifier: { classify: async (input) => decide(input) },
  });
  return writer.commit({ batch, proposalIndex: 0 });
}

test("0122 identity keeps co-mentioned referents distinct and normalizes lexical identity", () => {
  const context = createKnowledgeContext();
  const lower = context.entities.ensure("react");
  const upper = context.entities.ensure("React");
  const pkg = context.entities.ensure("gui/package.json");
  const lock = context.entities.ensure("gui/package-lock.json");

  assert.equal(lower.id, upper.id);
  assert.equal(context.entities.get(lower.id)?.preferredLabel, "React");
  assert.notEqual(pkg.id, lock.id);
  assert.notEqual(pkg.id, lower.id);
  assert.deepEqual(context.entities.get(pkg.id)?.labels, ["gui/package.json"]);
  assert.deepEqual(context.entities.get(lock.id)?.labels, [
    "gui/package-lock.json",
  ]);
});

test("0122 structural claim-entity membership is persisted separately from L3 associations", async () => {
  const context = createKnowledgeContext();
  const message =
    "gui/package.json and gui/package-lock.json both reference React.";
  const batch = await stage(1, message, "Acknowledged.", [
    {
      severity: "important",
      proposition: message,
      kind: "fact",
      entities: ["gui/package-lock.json", "gui/package.json", "React"],
      domains: ["software"],
      support: { source: "message", quote: message },
    },
  ]);

  await commitOne(context, batch, () => ({ type: "new" }));
  const claim = context.evidence.listClaims()[0]!;
  const refs = context.entityReferences.forClaim(claim.id);
  const react = context.entities.findByIdentity("React")!;
  const pkg = context.entities.findByIdentity("gui/package.json")!;
  const lock = context.entities.findByIdentity("gui/package-lock.json")!;

  assert.deepEqual(
    new Set(refs.map((reference) => reference.entityId)),
    new Set([react.id, pkg.id, lock.id]),
  );
  assert.equal(
    (context.relations as RelationIndex).associationSnapshot().records.length,
    0,
  );

  const snapshot = inspectKnowledge(context, {
    projectId: String(PROJECT),
    durable: false,
  });
  const reactNode = snapshot.records.find(
    (record) => record.kind === "entity" && record.sourceId === react.id,
  )!;
  assert.deepEqual(reactNode.storedDomains, []);
  assert.deepEqual(reactNode.effectiveDomains, ["software"]);
  assert.equal(reactNode.primaryEffectiveDomain, "software");
  assert.ok(
    snapshot.graph.edges.some(
      (edge) =>
        edge.from === `claim:${claim.id}` &&
        edge.to === `entity:${react.id}` &&
        edge.relation === "entity_ref",
    ),
  );
});

test("0122 current-batch entities are legal semantic-association endpoints", async () => {
  const context = createKnowledgeContext();
  const message = "gui/package.json requires React.";
  const structured = {
    kind: "relationship_binding" as const,
    subjectLabel: "gui/package.json",
    relation: "requires",
    objectLabel: "React",
  };
  const batch = await stage(2, message, "Acknowledged.", [
    {
      severity: "important",
      proposition: message,
      kind: "relationship",
      structuredProposition: structured,
      entities: ["gui/package.json", "React"],
      domains: ["software"],
      support: { source: "message", quote: message },
    },
  ]);

  assert.equal(context.entities.list().length, 0);
  let seen: RelationClassifierBatchInput | undefined;
  const writer = new KnowledgeEngineCommit({
    context,
    classifier: {
      classify: async () => ({ type: "new" }),
      classifyBatch: async (input) => {
        seen = structuredClone(input);
        const pkgHandle = input.associationContext!.entities.find((entity) =>
          entity.labels.includes("gui/package.json"),
        )!.handle;
        const reactHandle = input.associationContext!.entities.find((entity) =>
          entity.labels.includes("React"),
        )!.handle;
        return [
          {
            proposalHandle: input.items[0]!.proposalHandle,
            type: "new" as const,
            associations: [
              {
                fromHandle: pkgHandle,
                toHandle: reactHandle,
                relation: "requires",
                supportsRelation: true,
                support: {
                  source: "message" as const,
                  start: 0,
                  end: message.length,
                },
              },
            ],
          },
        ];
      },
    },
  });

  const steps = await writer.commitBatch({ batch, startProposalIndex: 0 });
  assert.equal(steps.length, 1);
  assert.ok("result" in steps[0]!);
  assert.ok(
    seen?.associationContext?.entities.some((entity) =>
      entity.labels.includes("React"),
    ),
  );
  assert.deepEqual(seen?.items[0]?.proposal.structuredProposition, structured);

  const pkg = context.entities.findByIdentity("gui/package.json")!;
  const react = context.entities.findByIdentity("React")!;
  const associations = (
    context.relations as RelationIndex
  ).associationSnapshot().records;
  assert.ok(
    associations.some(
      (record) =>
        record.from === pkg.id &&
        record.to === react.id &&
        record.relation === "requires",
    ),
  );
});

test("0122 structured proposition owns the slot and reaches relation comparison", async () => {
  const context = createKnowledgeContext();
  const firstMessage = "React version is 19.";
  const firstStructured = {
    kind: "attribute_binding" as const,
    entityLabel: "React",
    attribute: "version",
    value: "19",
  };
  const first = await stage(3, firstMessage, "Acknowledged.", [
    {
      severity: "important",
      proposition: firstMessage,
      kind: "property",
      structuredProposition: firstStructured,
      entities: ["gui/package.json", "React"],
      support: { source: "message", quote: firstMessage },
    },
  ]);
  await commitOne(context, first, () => ({ type: "new" }));

  const react = context.entities.findByIdentity("React")!;
  const open = context.state
    .snapshot()
    .bindings.find(
      (binding) =>
        binding.interval.to === null && binding.label === firstMessage,
    )!;
  assert.equal(open.slot.kind, "attribute");
  if (open.slot.kind === "attribute") assert.equal(open.slot.entity, react.id);

  const secondMessage = "React version is 20.";
  const secondStructured = { ...firstStructured, value: "20" };
  const second = await stage(4, secondMessage, "Acknowledged.", [
    {
      severity: "important",
      proposition: secondMessage,
      kind: "property",
      structuredProposition: secondStructured,
      entities: ["gui/package.json", "React"],
      support: { source: "message", quote: secondMessage },
    },
  ]);
  let seen: RelationClassifierInput | undefined;
  await commitOne(context, second, (input) => {
    seen = structuredClone(input);
    return { type: "new" };
  });

  assert.deepEqual(seen?.proposal.structuredProposition, secondStructured);
  assert.deepEqual(
    seen?.candidates.find((candidate) => candidate.proposition === firstMessage)
      ?.structuredProposition,
    firstStructured,
  );
});

test("0122 answer-only discoveries use assistant provenance and never user acceptance", async () => {
  const context = createKnowledgeContext();
  const message = "Can you inspect the GUI dependencies?";
  const answer = "The GUI requires React.";
  const batch = await stage(5, message, answer, [
    {
      severity: "important",
      proposition: answer,
      kind: "fact",
      entities: ["React"],
      domains: ["software"],
      support: { source: "message", quote: answer },
    },
  ]);

  assert.equal(batch.proposals[0]!.support, undefined);
  await commitOne(context, batch, () => ({ type: "new" }));

  const claim = context.evidence.listClaims()[0]!;
  const utterance = context.evidence
    .listUtterances()
    .find((entry) => entry.id === claim.derivedFrom.id)!;
  const slotClaim = context.state.claim(claim.id)!;
  assert.equal(claim.attributedTo, "assistant");
  assert.equal(claim.status, "asserted");
  assert.equal(claim.acceptance, undefined);
  assert.equal(utterance.speaker, "assistant");
  assert.equal(utterance.content, answer);
  assert.equal(slotClaim.attributedTo, "assistant");
  assert.equal(slotClaim.acceptanceEligible, false);
  assert.ok(
    context.evidence
      .listProvenance()
      .some(
        (record) =>
          record.relation === "derived_from" &&
          record.fromId === claim.id &&
          record.toId === utterance.id,
      ),
  );
});

test("0122 structural references survive SQLite reload", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-0122-"));
  const filename = join(directory, "memory.sqlite");
  const first = createSqliteKnowledgeContext({ filename, projectId: PROJECT });
  try {
    const message = "React is listed by gui/package.json.";
    const batch = await stage(6, message, "Acknowledged.", [
      {
        severity: "important",
        proposition: message,
        kind: "fact",
        entities: ["React", "gui/package.json"],
        domains: ["software"],
        support: { source: "message", quote: message },
      },
    ]);
    await new KnowledgeEngineCommit({
      context: first.context,
      classifier: { classify: async () => ({ type: "new" }) },
    }).commit({ batch, proposalIndex: 0 });
  } finally {
    first.close();
  }

  const reopened = createSqliteKnowledgeContext({
    filename,
    projectId: PROJECT,
  });
  try {
    assert.equal(reopened.context.entityReferences.list().length, 2);
    const react = reopened.context.entities.findByIdentity("React")!;
    const claim = reopened.context.evidence.listClaims()[0]!;
    assert.ok(
      reopened.context.entityReferences
        .forClaim(claim.id)
        .some((reference) => reference.entityId === react.id),
    );
    const snapshot = inspectKnowledge(reopened.context, {
      projectId: String(PROJECT),
      durable: true,
    });
    assert.ok(
      snapshot.graph.edges.some(
        (edge) =>
          edge.from === `claim:${claim.id}` &&
          edge.to === `entity:${react.id}` &&
          edge.relation === "entity_ref",
      ),
    );
  } finally {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("0122 single and batch relation prompts share the same explicit semantics", () => {
  for (const instruction of [
    KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION,
    KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION,
  ]) {
    assert.match(instruction, /restatement means the same semantic assertion/u);
    assert.match(instruction, /supersede means the proposal replaces/u);
    assert.match(
      instruction,
      /structural claim-entity membership are not semantic associations/u,
    );
    assert.match(instruction, /structuredProposition/u);
  }
  assert.doesNotMatch(
    KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION,
    /same shape and evidence rules as the single relation classifier/u,
  );
});
