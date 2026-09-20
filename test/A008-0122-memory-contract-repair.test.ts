import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { RelationIndex } from "../src/memory/knowledge/expand.js";
import { inspectKnowledge } from "../src/memory/knowledge/inspection.js";
import { KnowledgeEngineCommit } from "../src/memory/knowledge/live-commit.js";
import {
  createKnowledgeContext,
  readKnowledge,
} from "../src/memory/knowledge/read.js";
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
  if (open.slot.kind === "attribute") {
    assert.equal(open.slot.entity, react.id);
    assert.equal(open.slot.name, "version");
  }
  assert.equal(open.kind, "attribute");
  if (open.kind === "attribute") assert.equal(open.value, "19");

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

test("0143 live semantic state behaves like HEAD: later valid value owns current state", async () => {
  const T0 = "2026-09-20T04:00:00.000Z";
  const T1 = "2026-09-20T05:00:00.000Z";
  let time = T0;
  const context = createKnowledgeContext(() => time);

  const firstMessage = "My preferred name is Bertil.";
  const first = await stage(40, firstMessage, "Acknowledged.", [
    {
      severity: "important",
      proposition: firstMessage,
      kind: "preference",
      structuredProposition: {
        kind: "attribute_binding",
        entityLabel: "Rickard",
        attribute: "preferred_name",
        value: "Bertil",
      },
      entities: ["Rickard"],
      tags: ["identity"],
      support: { source: "message", quote: firstMessage },
    },
  ]);
  await commitOne(context, first, () => ({ type: "new" }));
  const firstEvidenceClaim = context.evidence
    .listClaims()
    .find((claim) => claim.label === firstMessage)!;
  assert.equal(context.state.claim(firstEvidenceClaim.id)?.status, "accepted");

  const entity = context.entities.findByIdentity("Rickard")!;
  const slot = context.slots.list().find(
    (definition) =>
      definition.ref.kind === "attribute" &&
      definition.ref.entity === entity.id &&
      definition.ref.name === "preferred_name",
  )!;
  assert.equal(slot.ref.kind, "attribute");
  assert.equal(context.state.current(slot.ref).length, 1);
  assert.equal(context.state.currentValue(slot.ref), "Bertil");

  time = T1;
  const secondMessage = "My preferred name is Rickard.";
  const second = await stage(41, secondMessage, "Acknowledged.", [
    {
      severity: "important",
      proposition: secondMessage,
      kind: "preference",
      structuredProposition: {
        kind: "attribute_binding",
        entityLabel: "Rickard",
        attribute: "preferred_name",
        value: "Rickard",
      },
      entities: ["Rickard"],
      support: { source: "message", quote: secondMessage },
    },
  ]);
  await commitOne(context, second, () => ({ type: "new" }));
  const secondEvidenceClaim = context.evidence
    .listClaims()
    .find((claim) => claim.label === secondMessage)!;
  assert.equal(context.state.claim(secondEvidenceClaim.id)?.status, "accepted");
  assert.deepEqual(context.state.claim(firstEvidenceClaim.id)?.aboutInterval, {
    from: T0,
    to: T1,
  });

  assert.equal(context.state.current(slot.ref).length, 1);
  assert.equal(context.state.currentValue(slot.ref), "Rickard");
  const history = context.state.history(slot.ref);
  assert.equal(history.length, 2);
  assert.equal(history[0]!.kind, "attribute");
  assert.equal(history[1]!.kind, "attribute");
  if (history[0]!.kind === "attribute") {
    assert.equal(history[0]!.value, "Bertil");
    assert.deepEqual(history[0]!.interval, { from: T0, to: T1 });
  }
  if (history[1]!.kind === "attribute") {
    assert.equal(history[1]!.value, "Rickard");
    assert.deepEqual(history[1]!.interval, { from: T1, to: null });
  }
  assert.equal(
    context.state
      .snapshot()
      .bindings.filter(
        (binding) =>
          binding.slot.kind === "attribute" &&
          binding.slot.entity === entity.id &&
          binding.slot.name === "preferred_name" &&
          binding.interval.to === null,
      ).length,
    1,
  );

  const currentRead = readKnowledge(
    {
      message: "What is the current preferred name?",
      verifiedScope: { verified: true, tags: ["identity"] },
      temporalHints: {
        currentOnly: true,
        mentionsPast: false,
        mentionsFuture: false,
      },
    },
    context,
  );
  assert.deepEqual(
    currentRead.projected.payload.state.map((entry) => entry.value),
    ["Rickard"],
    "an old evidence claim may discover the address, but HEAD owns the answer",
  );
  assert.equal(
    currentRead.projected.payload.claims.some(
      (claim) => claim.label === firstMessage,
    ),
    false,
    "superseded claim text must not compete with current state",
  );
  assert.equal(
    currentRead.projected.payload.utterances.some(
      (utterance) => utterance.content === firstMessage,
    ),
    false,
    "the utterance behind superseded state must not compete with HEAD",
  );
  assert.ok(
    currentRead.filtered.omitted.some(
      (item) => item.reason === "current_state_owned_by_binding",
    ),
  );

  const attributionRead = readKnowledge(
    {
      message: "What did Rickard say about preferred name?",
      verifiedScope: { verified: true, entities: ["Rickard"] },
    },
    context,
  );
  assert.ok(
    attributionRead.projected.payload.claims.some(
      (claim) => claim.label === firstMessage,
    ),
    "explicit attribution still has access to historical evidence claims",
  );
});

test("0143 task status advances atomically from Draft to In Progress", async () => {
  const T0 = "2026-09-20T08:00:00.000Z";
  const T1 = "2026-09-20T08:30:00.000Z";
  let time = T0;
  const context = createKnowledgeContext(() => time);

  const commitStatus = async (turn: number, value: string) => {
    const message = `A008-0142 status is ${value}.`;
    await commitOne(
      context,
      await stage(turn, message, "Acknowledged.", [
        {
          severity: "important",
          proposition: message,
          kind: "state",
          structuredProposition: {
            kind: "attribute_binding",
            entityLabel: "A008-0142",
            attribute: "status",
            value,
          },
          entities: ["A008-0142"],
          support: { source: "message", quote: message },
        },
      ]),
      () => ({ type: "new" }),
    );
  };

  await commitStatus(45, "Draft");
  time = T1;
  await commitStatus(46, "In Progress");

  const entity = context.entities.findByIdentity("A008-0142")!;
  const slot = context.slots.list().find(
    (definition) =>
      definition.ref.kind === "attribute" &&
      definition.ref.entity === entity.id &&
      definition.ref.name === "status",
  )!;
  assert.equal(context.state.currentValue(slot.ref), "In Progress");
  assert.equal(context.state.current(slot.ref).length, 1);
  const history = context.state.history(slot.ref);
  assert.equal(history.length, 2);
  assert.equal(history[0]!.kind, "attribute");
  assert.equal(history[1]!.kind, "attribute");
  if (history[0]!.kind === "attribute") {
    assert.equal(history[0]!.value, "Draft");
    assert.deepEqual(history[0]!.interval, { from: T0, to: T1 });
  }
  if (history[1]!.kind === "attribute") {
    assert.equal(history[1]!.value, "In Progress");
    assert.deepEqual(history[1]!.interval, { from: T1, to: null });
  }
});

test("0143 closed past interval is history and does not replace HEAD", async () => {
  const NOW = "2026-09-20T06:00:00.000Z";
  const PAST_FROM = "2026-09-18T00:00:00.000Z";
  const PAST_TO = "2026-09-19T00:00:00.000Z";
  let time = NOW;
  const context = createKnowledgeContext(() => time);

  const currentMessage = "Anders scarf is home.";
  await commitOne(
    context,
    await stage(42, currentMessage, "Acknowledged.", [
      {
        severity: "important",
        proposition: currentMessage,
        kind: "state",
        structuredProposition: {
          kind: "attribute_binding",
          entityLabel: "Anders scarf",
          attribute: "status",
          value: "home",
        },
        entities: ["Anders scarf"],
        support: { source: "message", quote: currentMessage },
      },
    ]),
    () => ({ type: "new" }),
  );

  time = "2026-09-20T07:00:00.000Z";
  const pastMessage =
    "From 2026-09-18 to 2026-09-19, Anders scarf was missing.";
  const past = await stage(43, pastMessage, "Acknowledged.", [
    {
      severity: "important",
      proposition: pastMessage,
      kind: "state",
      structuredProposition: {
        kind: "attribute_binding",
        entityLabel: "Anders scarf",
        attribute: "status",
        value: "missing",
      },
      aboutInterval: { from: PAST_FROM, to: PAST_TO },
      entities: ["Anders scarf"],
      support: { source: "message", quote: pastMessage },
    },
  ]);
  assert.deepEqual(past.proposals[0]!.aboutInterval, {
    from: PAST_FROM,
    to: PAST_TO,
  });
  await commitOne(context, past, () => ({ type: "new" }));

  const entity = context.entities.findByIdentity("Anders scarf")!;
  const slot = context.slots.list().find(
    (definition) =>
      definition.ref.kind === "attribute" &&
      definition.ref.entity === entity.id &&
      definition.ref.name === "status",
  )!;
  assert.equal(context.state.currentValue(slot.ref), "home");
  assert.equal(context.state.current(slot.ref).length, 1);
  const bindings = context.state.history(slot.ref);
  assert.equal(bindings.length, 2);
  assert.equal(bindings[0]!.kind, "attribute");
  if (bindings[0]!.kind === "attribute") {
    assert.equal(bindings[0]!.value, "missing");
    assert.deepEqual(bindings[0]!.interval, {
      from: PAST_FROM,
      to: PAST_TO,
    });
  }
  assert.equal(bindings[1]!.kind, "attribute");
  if (bindings[1]!.kind === "attribute") {
    assert.equal(bindings[1]!.value, "home");
    assert.deepEqual(bindings[1]!.interval, { from: NOW, to: null });
  }
});

test("0143 future event remains evidence and never becomes current state", async () => {
  const context = createKnowledgeContext(
    () => "2026-09-20T06:00:00.000Z",
  );
  const message = "On 2026-10-20 Brittan will go fishing.";
  const batch = await stage(44, message, "Acknowledged.", [
    {
      severity: "important",
      proposition: message,
      kind: "event",
      structuredProposition: {
        kind: "event_occurrence",
        type: "fishing",
        participants: ["Brittan"],
      },
      aboutInterval: {
        from: "2026-10-20T00:00:00.000Z",
        to: "2026-10-21T00:00:00.000Z",
      },
      entities: ["Brittan"],
      support: { source: "message", quote: message },
    },
  ]);
  await commitOne(context, batch, () => ({ type: "new" }));

  const claim = context.evidence.listClaims().find((item) => item.label === message)!;
  assert.equal(claim.proposition.kind, "event_occurrence");
  assert.deepEqual(claim.aboutInterval, {
    from: "2026-10-20T00:00:00.000Z",
    to: "2026-10-21T00:00:00.000Z",
  });
  assert.equal(context.state.snapshot().bindings.length, 0);
  assert.equal(context.state.claim(claim.id), undefined);
});

test("0144 resolved assistant-derived observation can own HEAD while remaining asserted", async () => {
  const context = createKnowledgeContext(() => "2026-09-20T10:00:00.000Z");
  const message = "Inspect the current task status.";
  const answer = "ND-0001 status is In Progress.";
  const batch = await stage(47, message, answer, [
    {
      severity: "important",
      proposition: answer,
      kind: "state",
      structuredProposition: {
        kind: "attribute_binding",
        entityLabel: "ND-0001",
        attribute: "status",
        value: "In Progress",
      },
      entities: ["ND-0001"],
      domains: ["repository-state"],
    },
  ]);

  await commitOne(context, batch, () => ({ type: "new" }));

  const claim = context.evidence
    .listClaims()
    .find((item) => item.label === answer);
  assert.ok(claim);
  assert.equal(claim.status, "asserted");
  assert.equal(claim.attributedTo, "assistant");
  assert.equal(claim.acceptance, undefined);

  const entity = context.entities.findByIdentity("ND-0001");
  assert.ok(entity);
  const slot = context.slots.list().find(
    (item) =>
      item.ref.kind === "attribute" &&
      item.ref.entity === entity.id &&
      item.ref.name === "status",
  );
  assert.ok(slot);
  assert.equal(context.state.currentValue(slot.ref), "In Progress");
  assert.equal(context.state.current(slot.ref).length, 1);
  assert.equal(context.state.current(slot.ref)[0]?.claimId, claim.id);
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
  assert.equal(claim.attributedTo, "assistant");
  assert.equal(claim.status, "asserted");
  assert.equal(claim.acceptance, undefined);
  assert.equal(utterance.speaker, "assistant");
  assert.equal(utterance.content, answer);
  assert.equal(
    context.state.claim(claim.id),
    undefined,
    "unstructured answer evidence must not invent current state",
  );
  assert.equal(
    context.state.snapshot().bindings.some((binding) => binding.claimId === claim.id),
    false,
  );
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
    assert.match(instruction, /restatement means semantic equivalence/u);
    assert.match(instruction, /not a restatement merely because most words/u);
    assert.match(instruction, /explicit correction.*supersede/iu);
    assert.match(instruction, /source type.*does not decide/iu);
    assert.match(instruction, /do not output attraction/iu);
    assert.match(
      instruction,
      /structural claim-entity membership are not semantic associations/u,
    );
    assert.match(instruction, /structuredProposition/u);
    assert.doesNotMatch(instruction, /set supportsTarget true only/iu);
  }
  assert.doesNotMatch(
    KNOWLEDGE_RELATION_BATCH_CLASSIFIER_INSTRUCTION,
    /same shape and evidence rules as the single relation classifier/u,
  );
});
