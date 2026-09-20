import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import Database from "better-sqlite3";
import {
  DEFAULT_MEMORY_LIFECYCLE_POLICY as defaults,
  parseMemoryLifecyclePolicy,
} from "../../src/core/memory-lifecycle-policy.js";
import {
  AssociationLifecycle,
  associationKey,
  evaluateAssociation,
  type AssociationIdentity,
} from "../../src/memory/knowledge/association-lifecycle.js";
import { RelationIndex, expand } from "../../src/memory/knowledge/expand.js";
import {
  createKnowledgeContext,
  readKnowledge,
} from "../../src/memory/knowledge/read.js";
import {
  atomicKnowledge,
  captureSnapshot,
} from "../../src/memory/knowledge/knowledge-transaction.js";
import { KnowledgeEngineCommit } from "../../src/memory/knowledge/live-commit.js";
import { inspectKnowledge } from "../../src/memory/knowledge/inspection.js";
import {
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../../src/memory/knowledge/sqlite-context.js";
import { RuntimePreferencesStore } from "../../src/runtime/runtime-preferences-store.js";
import { ingest } from "../../src/memory/knowledge/ingest.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type StagedKnowledgeBatch,
} from "../../src/orchestration/post-output-knowledge-intake.js";
import {
  serializeRelationClassifierInput,
  type RelationClassifierInput,
  type RelationClassifierDecision,
  type SemanticAssociationDecision,
} from "../../src/orchestration/relation-gated-memory-commit.js";
import { ModelBackedKnowledgeRelationClassifier } from "../../src/orchestration/semantic-json-model.js";
import type {
  KnowledgeReadContext,
  RetrievedRecord,
  SemanticScope,
} from "../../src/memory/knowledge/read-types.js";
import { parseRuntimeId } from "../../src/identity/runtime-id.js";

const day = (n: number) =>
  new Date(Date.parse("2026-01-01T00:00:00.000Z") + n * 86400000).toISOString();
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const projectId = sqliteKnowledgeTestProjectId();
const conversationId = parseRuntimeId(
  "A008_v1_conversation_40000000-0000-4000-8000-000000000082",
  "conversation",
);
const agentId = parseRuntimeId(
  "A008_v1_agent_40000000-0000-4000-8000-000000000082",
  "agent",
);
const taskId = (n: number) =>
  parseRuntimeId(
    `A008_v1_task_40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    "task",
  );
const left = "The fixture valve is blue";
const right = "The fixture reservoir is round";
const edgeAssertion = "The valve routes coolant to the reservoir";
const occurrence = (id: string, n = 0) => ({
  occurrenceId: id,
  at: day(n),
  support: { utteranceId: "source", start: 0, end: 5 },
});
const edge: AssociationIdentity = {
  from: "a",
  to: "b",
  relation: "routes_to",
  scope: ["local"],
};
const relations = (context: KnowledgeReadContext) =>
  context.relations as RelationIndex;
async function batch(
  n: number,
  message = left,
  proposition = left,
  claimSupport = true,
  scopes = ["local"],
) {
  const intake = new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return [
          {
            proposition,
            kind: "fact",
            severity: "important",
            entities: [proposition === right ? "reservoir" : "valve"],
            ...(claimSupport
              ? { support: { source: "message" as const, quote: message } }
              : {}),
          },
        ];
      },
    },
    context: { projectId, conversationId, agentId },
    budget: { maximum: 16384, measurer: new Utf8ByteKnowledgeIntakeMeasurer() },
  });
  return intake.stage({
    taskId: taskId(n),
    message,
    answer: "Fixture final answer",
    applicabilityScopes: scopes,
  });
}
async function commit(
  context: KnowledgeReadContext,
  staged: StagedKnowledgeBatch,
  decide: (
    input: RelationClassifierInput,
  ) => RelationClassifierDecision | Promise<RelationClassifierDecision>,
  signal?: AbortSignal,
) {
  return new KnowledgeEngineCommit({
    context,
    classifier: { classify: async (input) => decide(input) },
  }).commit({ batch: staged, proposalIndex: 0 }, signal ? { signal } : {});
}
async function seed(context: KnowledgeReadContext) {
  await commit(context, await batch(1), () => ({ type: "new" }));
  await commit(context, await batch(2, right, right), () => ({ type: "new" }));
  return {
    from: context.evidence.listClaims().find((c) => c.label === left)!.id,
    to: context.evidence.listClaims().find((c) => c.label === right)!.id,
    relation: "routes_to",
    scope: ["local"],
  };
}
function decision(
  input: RelationClassifierInput,
  claimSupport = false,
  edgeSupport = true,
): RelationClassifierDecision {
  const fromHandle = input.candidates.find(
    (c) => c.proposition === left,
  )!.handle;
  const toHandle = input.candidates.find(
    (c) => c.proposition === right,
  )!.handle;
  const source = input.associationContext!.source;
  return {
    type: "restatement",
    targetHandle: fromHandle,
    supportsTarget: claimSupport,
    associations: [
      {
        fromHandle,
        toHandle,
        relation: "routes_to",
        supportsRelation: edgeSupport,
        support: {
          source: source.origin,
          start: source.content.indexOf(edgeAssertion),
          end: source.content.length,
        },
      },
    ],
  };
}

test("A25/A29: independent directed scoped identity, decay-before-boost, equality, cap, backwards clock and corrupt metadata", () => {
  const owner = new AssociationLifecycle();
  assert.equal(owner.establish(edge, occurrence("create")), "created");
  const first = owner.snapshot().records[0]!;
  near(first.lifecycle.strength, 0.4);
  near(evaluateAssociation(first, day(45)).strength, 0.2);
  assert.equal(evaluateAssociation(first, day(45)).memoryState, "active");
  assert.equal(
    evaluateAssociation(first, day(45.000001)).memoryState,
    "dormant",
  );
  assert.equal(evaluateAssociation(first, day(-1)).strength, 0.4);
  assert.equal(evaluateAssociation(first, day(100000)).strength, 0);
  for (const other of [
    { ...edge, from: "b", to: "a" },
    { ...edge, relation: "supplies" },
    { ...edge, scope: ["remote"] },
    { ...edge, to: "distractor" },
  ])
    owner.establish(other, occurrence("create"));
  const others = owner.snapshot().records.slice(1);
  assert.equal(
    owner.establish(
      { ...edge, scope: ["local", "local"] },
      occurrence("again", 90),
    ),
    "reinforced",
  );
  near(owner.snapshot().records[0]!.lifecycle.strength, 0.3);
  assert.deepEqual(owner.snapshot().records.slice(1), others);
  assert.equal(owner.establish(edge, occurrence("again", 100)), "duplicate");
  owner.establish(edge, occurrence("backward", 80));
  assert.equal(
    owner.snapshot().records[0]!.lifecycle.strengthUpdatedAt,
    day(90),
  );
  near(owner.snapshot().records[0]!.lifecycle.strength, 0.5);
  for (let i = 0; i < 5; i++) owner.establish(edge, occurrence(`cap${i}`, 90));
  owner.establish(edge, occurrence("cap-refresh", 91));
  assert.equal(owner.snapshot().records[0]!.lifecycle.strength, 1);
  assert.equal(
    owner.snapshot().records[0]!.lifecycle.strengthUpdatedAt,
    day(91),
  );
  const tiny = new AssociationLifecycle();
  tiny.establish(
    edge,
    occurrence("c"),
    parseMemoryLifecyclePolicy({
      ...defaults,
      association: { ...defaults.association, boost: 0.01 },
    }),
  );
  tiny.establish(edge, occurrence("r", 10000));
  assert.equal(
    evaluateAssociation(tiny.snapshot().records[0]!, day(10000)).memoryState,
    "dormant",
  );
  const snapshot = owner.snapshot();
  const roundTrip = new AssociationLifecycle();
  roundTrip.hydrate(snapshot);
  assert.deepEqual(roundTrip.snapshot(), snapshot);
  for (const broken of [
    { ...snapshot, receipts: [] },
    { ...snapshot, transitions: [] },
    {
      ...snapshot,
      records: snapshot.records.map((r, i) => (i ? r : { ...r, key: "wrong" })),
    },
    {
      ...snapshot,
      records: snapshot.records.map((r, i) =>
        i
          ? r
          : { ...r, lifecycle: { ...r.lifecycle, policyVersion: "future" } },
      ),
    },
  ])
    assert.throws(() => roundTrip.hydrate(broken as typeof snapshot));
  assert.deepEqual(
    roundTrip.snapshot(),
    snapshot,
    "invalid hydrate must not partially replace state",
  );
  for (const n of [NaN, Infinity, -1, 2])
    assert.throws(() =>
      parseMemoryLifecyclePolicy({
        ...defaults,
        association: { ...defaults.association, strength: n },
      }),
    );
  assert.throws(() =>
    owner.establish(edge, { ...occurrence("bad"), at: "unknown" }),
  );
  assert.throws(() =>
    owner.establish(edge, {
      ...occurrence("bad"),
      support: { utteranceId: "", start: 0, end: 0 },
    }),
  );
});

test("A26/A27: one-hop edge dormancy, direct/alternate routes, scope and endpoint dormancy are independent", async () => {
  let time = day(0);
  const context = createKnowledgeContext(() => time);
  const link = await seed(context);
  const index = relations(context);
  index.link(link.from, link.to, link.relation); // A legacy unscoped link starts untracked.
  assert.equal(index.neighbors(link.from)[0]!.association, undefined);
  index.establishAssociation({ ...link, scope: [] }, occurrence("create"));
  const scope: SemanticScope = {
    tags: [],
    domains: [],
    entities: [],
    slots: [],
    intents: ["associative"],
    temporalHints: {
      currentOnly: false,
      mentionsPast: false,
      mentionsFuture: false,
    },
  };
  const record = (id: string): RetrievedRecord => ({
    id: `claim:${id}`,
    evidenceId: id,
    surface: "claim",
    matchKind: "direct",
    retrievalScore: 1,
    reasons: [],
    tags: [],
    domains: [],
    required: false,
    label: "seed",
  });
  const run = (seeds = [record(link.from)], ctx = context) =>
    expand(seeds, scope, ctx, { message: "fixture" });
  time = day(45);
  assert.ok(run().records.some((r) => r.evidenceId === link.to));
  time = day(46);
  assert.ok(run().omitted.some((r) => r.reason === "association_dormant"));
  assert.equal(
    run([record(link.from), record(link.to)]).omitted.length,
    0,
    "direct hit survives",
  );
  index.establishAssociation(
    { from: "alternate", to: link.to, relation: "feeds", scope: ["lab"] },
    occurrence("alt", 20),
  );
  const seeds = [record(link.from), record("alternate")];
  assert.ok(
    run(seeds, { ...context, applicabilityScopes: ["lab"] }).records.some(
      (r) => r.evidenceId === link.to,
    ),
  );
  assert.equal(
    run(seeds, { ...context, applicabilityScopes: ["lab"] }).omitted.length,
    0,
  );
  assert.ok(
    !run(seeds).records.some((r) => r.evidenceId === link.to),
    "a scoped edge cannot volunteer without applicable runtime scope",
  );
  index.establishAssociation(
    { ...link, scope: ["other"] },
    occurrence("scoped", 20),
  );
  const graph = inspectKnowledge(context, { projectId, durable: false }).graph;
  assert.equal(
    graph.edges.filter(
      (e) =>
        e.from === `claim:${link.from}` &&
        e.to === `claim:${link.to}` &&
        e.relation === link.relation,
    ).length,
    1,
  );
  const beforeRead = captureSnapshot(context);
  for (let i = 0; i < 3; i++) {
    run();
    const inspection = inspectKnowledge(context, { projectId, durable: false });
    const detail = JSON.parse(
      inspection.records.find(
        (r) => r.sourceId === link.from && r.kind === "claim",
      )!.detail,
    );
    assert.equal(detail.associations[0].lifecycle.strength, 0.4);
    assert.equal(detail.associations[0].evaluated.memoryState, "dormant");
    readKnowledge(
      { message: left, verifiedScope: { verified: true, entities: ["valve"] } },
      context,
    );
  }
  assert.deepEqual(captureSnapshot(context), beforeRead);
  time = day(181);
  index.establishAssociation({ ...link, scope: [] }, occurrence("renew", 181));
  assert.equal(
    evaluateAssociation(index.neighbors(link.from)[0]!.association!, time)
      .memoryState,
    "active",
  );
  assert.ok(
    run().omitted.some((r) => r.reason === "associative_dormant"),
    "active edge cannot revive endpoint evidence",
  );
  assert.equal(index.associationSnapshot().receipts.length, 4);
});

for (const durable of [false, true])
  test(`A25/A28/A29: source proof and claim/edge receipts are independent (${durable ? "SQLite" : "memory"})`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "a008-l3-proof-"));
    let time = day(0);
    const handle = durable
      ? createSqliteKnowledgeContext({
          filename: join(directory, "fixture.sqlite"),
          projectId,
          clock: () => time,
        })
      : undefined;
    const context = handle?.context ?? createKnowledgeContext(() => time);
    try {
      const link = await seed(context);
      const endpoints = context.lifecycle.snapshot();
      const state = context.state.snapshot();
      const staged = await batch(3, edgeAssertion, left, false);
      const edgeOnly = await commit(context, staged, (input) => {
        const serialized = serializeRelationClassifierInput(input);
        assert.ok(serialized.includes(edgeAssertion));
        assert.ok(!serialized.includes("Fixture final answer"));
        return decision(input);
      });
      assert.deepEqual(edgeOnly.evidence.associations, ["created"]);
      const afterEdgeOnly = context.lifecycle
        .list()
        .filter((r) => r.evidenceKind === "claim");
      assert.equal(
        afterEdgeOnly.find((r) => r.evidenceId === link.from)!.lifecycle.strength,
        1,
        "semantic restatement reinforces the actual claim even when claim support is not attached",
      );
      assert.deepEqual(
        afterEdgeOnly.find((r) => r.evidenceId === link.to),
        endpoints.records.find((r) => r.evidenceId === link.to),
      );
      assert.deepEqual(context.state.snapshot(), state);
      const created = relations(context).associationSnapshot();
      assert.equal(created.records[0]!.key, associationKey(link));
      assert.equal(created.receipts.length, 1);
      assert.equal(context.lifecycle.snapshot().receipts!.length, 1);
      await commit(context, staged, (input) => decision(input));
      assert.deepEqual(relations(context).associationSnapshot(), created);
      time = day(90);
      await commit(context, await batch(4), (input) => ({
        ...decision(
          {
            ...input,
            associationContext: {
              ...input.associationContext!,
              source: { origin: "message", content: edgeAssertion },
            },
          },
          true,
        ),
        associations: [],
      }));
      assert.deepEqual(
        relations(context).associationSnapshot(),
        created,
        "claim-only evidence cannot renew edge",
      );
      const message = `${left}. ${edgeAssertion}`;
      const both = await batch(5, message);
      await commit(context, both, (input) => decision(input, true));
      near(
        relations(context).associationSnapshot().records[0]!.lifecycle.strength,
        0.3,
      );
      const edgeReceipt = relations(context)
        .associationSnapshot()
        .receipts.find((r) => r.occurrenceId.endsWith(taskId(5)))!;
      const claimReceipt = context.lifecycle
        .snapshot()
        .receipts!.find((r) => r.occurrenceId === edgeReceipt.occurrenceId)!;
      assert.ok(claimReceipt.support);
      assert.equal(
        edgeReceipt.support.utteranceId,
        claimReceipt.support.utteranceId,
      );
      assert.notEqual(edgeReceipt.support.start, claimReceipt.support.start);
      assert.equal(context.lifecycle.get(link.to)!.lifecycle.strength, 0.8);
      handle?.reload(); // Compare in the persisted canonical inventory order before rollback/reopen.
      const beforeRetry = captureSnapshot(context);
      await commit(context, both, (input) => decision(input, true));
      assert.deepEqual(captureSnapshot(context), beforeRetry);
      const signal = new AbortController();
      await assert.rejects(() =>
        commit(
          context,
          both,
          (input) => {
            signal.abort();
            return decision(input, true);
          },
          signal.signal,
        ),
      );
      assert.deepEqual(captureSnapshot(context), beforeRetry);
      assert.throws(() =>
        atomicKnowledge(context, () => {
          relations(context).establishAssociation(
            link,
            occurrence("rollback", 91),
          );
          context.lifecycle.reinforceOccurrence({
            ...occurrence("rollback", 91),
            evidenceId: link.from,
          });
          throw new Error("injected rollback");
        }),
      );
      assert.deepEqual(captureSnapshot(context), beforeRetry);
      if (handle) {
        handle.close();
        const reopened = createSqliteKnowledgeContext({
          filename: join(directory, "fixture.sqlite"),
          projectId,
          clock: () => day(100),
        });
        try {
          assert.deepEqual(
            relations(reopened.context).associationSnapshot(),
            relations(context).associationSnapshot(),
          );
          await commit(reopened.context, both, (input) =>
            decision(input, true),
          );
          assert.deepEqual(
            relations(reopened.context).associationSnapshot(),
            relations(context).associationSnapshot(),
          );
        } finally {
          reopened.close();
        }
      }
    } finally {
      handle?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("A25/A28: unresolved/stale endpoints, unproven or answer-only spans skip; actual new proposal and entity handles resolve", async () => {
  const context = createKnowledgeContext(() => day(0));
  await seed(context);
  const mutations: ((edge: SemanticAssociationDecision) => unknown)[] = [
    (e) => ({ ...e, fromHandle: "candidate_1_suffix" }),
    (e) => ({ ...e, supportsRelation: false }),
    (e) => ({ ...e, support: { source: "source", start: 0, end: 1 } }),
    (e) => ({ ...e, support: { source: "message", start: -1, end: 2 } }),
    (e) => ({ ...e, support: { source: "message", start: 0, end: 99999 } }),
    (e) => ({ ...e, support: { source: "message", start: 0, end: 0 } }),
    (e) => ({ ...e, relation: "" }),
  ];
  for (let i = 0; i < mutations.length; i++) {
    const result = await commit(
      context,
      await batch(30 + i, edgeAssertion),
      (input) => {
        const d = decision(input);
        return {
          ...d,
          associations: [mutations[i]!(d.associations![0]!)],
        } as RelationClassifierDecision;
      },
    );
    assert.ok(result.evidence.associations![0]!.startsWith("skipped_"));
  }
  assert.equal(relations(context).associationSnapshot().records.length, 0);
  const result = await commit(
    context,
    await batch(
      50,
      "The valve powers a fixture sensor",
      "A fixture sensor is powered",
      false,
    ),
    (input) => ({
      type: "new",
      associations: [
        {
          fromHandle: input.associationContext!.entities.find((e) =>
            e.labels.includes("valve"),
          )!.handle,
          toHandle: "proposal",
          relation: "powers",
          supportsRelation: true,
          support: {
            source: "message",
            start: 0,
            end: input.associationContext!.source.content.length,
          },
        },
      ],
    }),
  );
  assert.deepEqual(result.evidence.associations, ["created"]);
  const stored = relations(context).associationSnapshot().records[0]!;
  assert.ok(context.entities.list().some((e) => e.id === stored.from));
  assert.ok(
    context.evidence
      .listClaims()
      .some(
        (c) => c.id === stored.to && c.label === "A fixture sensor is powered",
      ),
  );
  const before = relations(context).associationSnapshot();
  const stale = await commit(
    context,
    await batch(51, edgeAssertion),
    (input) => {
      const d = decision(input);
      const snapshot = captureSnapshot(context);
      context.evidence.hydrate({
        ...snapshot,
        claims: snapshot.claims.map((c) =>
          c.label === right
            ? { ...c, label: "changed while comparison was running" }
            : c,
        ),
      });
      return d;
    },
  );
  assert.deepEqual(stale.evidence.associations, ["skipped_unresolved_edge"]);
  assert.deepEqual(relations(context).associationSnapshot(), before);
});

test("A28/A29: imported source recurrence retains provenance and deduplicates content/locator across imports", async () => {
  const context = createKnowledgeContext(() => day(0));
  await seed(context);
  for (let i = 0; i < 2; i++) {
    const source = ingest(
      {
        content: edgeAssertion,
        speaker: "fixture document",
        locator: "source:routes",
        scope: { verified: true },
      },
      { store: context.evidence },
    );
    const intake = new PostOutputKnowledgeIntake({
      analyzer: {
        async analyze() {
          return [{ proposition: left, kind: "fact", severity: "important" }];
        },
      },
      context: { projectId, conversationId, agentId },
      budget: {
        maximum: 16384,
        measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
      },
    });
    const staged = await intake.stage({
      kind: "source",
      taskId: taskId(60 + i),
      locator: "source:routes",
      content: edgeAssertion,
      utteranceId: source.utterances[0]!.id,
      applicabilityScopes: ["local"],
    });
    await commit(context, staged, (input) => decision(input));
  }
  const snapshot = relations(context).associationSnapshot();
  assert.equal(snapshot.receipts.length, 1);
  assert.equal(snapshot.transitions.length, 1);
  const utterance = context.evidence
    .listUtterances()
    .find((u) => u.id === snapshot.receipts[0]!.support.utteranceId)!;
  assert.equal(utterance.speaker, "fixture document");
  assert.equal(
    context.evidence.listArtifacts().find((a) => a.id === utterance.artifactId)!
      .locator,
    "source:routes",
  );
  assert.equal(
    context.lifecycle.snapshot().receipts!.length,
    1,
    "reimported source makes the claim actual once; duplicate source occurrence is idempotent",
  );
});

test("A25/A29/A30: existing semantic call creates a proposal edge once, ignores model policy and preserves read projection boundaries", async () => {
  const context = createKnowledgeContext(() => day(0));
  await seed(context);
  let calls = 0;
  const classifier = new ModelBackedKnowledgeRelationClassifier({
    async generate(request) {
      calls++;
      assert.equal(request.operation, "relation_classification");
      const input = JSON.parse(
        request.serializedInput,
      ) as RelationClassifierInput;
      assert.ok(input.associationContext);
      assert.ok(!request.serializedInput.includes("A008_knowledge_"));
      return {
        type: "new",
        associations: [
          {
            fromHandle: input.associationContext.entities.find((e) =>
              e.labels.includes("valve"),
            )!.handle,
            toHandle: "proposal",
            relation: "powers",
            supportsRelation: true,
            support: {
              source: "message",
              start: 0,
              end: input.associationContext.source.content.length,
            },
            strength: 99,
            threshold: 0,
            scope: ["invented"],
          },
        ],
      };
    },
  });
  const staged = await batch(
    65,
    "The valve powers a fixture sensor",
    "The valve powers a fixture sensor",
    false,
  );
  const writer = new KnowledgeEngineCommit({ context, classifier });
  const first = await writer.commit({ batch: staged, proposalIndex: 0 });
  assert.equal(calls, 1);
  assert.deepEqual(first.evidence.associations, ["created"]);
  const snapshot = captureSnapshot(context);
  const retry = await writer.commit({ batch: staged, proposalIndex: 0 });
  assert.equal(calls, 2);
  assert.equal(retry.evidence.reinforcement, "duplicate_creation");
  assert.deepEqual(retry.evidence.associations, ["duplicate"]);
  assert.deepEqual(captureSnapshot(context), snapshot);
  const stored = relations(context).associationSnapshot().records[0]!;
  assert.equal(stored.lifecycle.strength, 0.4);
  assert.equal(stored.lifecycle.threshold, 0.2);
  assert.deepEqual(stored.scope, ["local"]);
  const read = readKnowledge(
    {
      message: "valve",
      verifiedScope: { verified: true, entities: ["valve"] },
      applicabilityScopes: ["local"],
    },
    context,
  );
  assert.ok(read.expanded.records.some((r) => r.evidenceId === stored.to));
  assert.ok(
    !JSON.stringify(read.projected.payload).includes("association-exponential"),
  );
  assert.ok(!JSON.stringify(read.projected.payload).includes("decayLambda"));
  assert.deepEqual(captureSnapshot(context), snapshot);
});

test("A29: two connections, namespace isolation and receipt insertion failure roll back the entire live commit", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-l3-atomic-"));
  const filename = join(directory, "fixture.sqlite");
  const a = createSqliteKnowledgeContext({
    filename,
    projectId,
    clock: () => day(0),
  });
  let b: ReturnType<typeof createSqliteKnowledgeContext> | undefined;
  let other: ReturnType<typeof createSqliteKnowledgeContext> | undefined;
  const db = new Database(filename);
  try {
    await seed(a.context);
    const baseline = captureSnapshot(a.context);
    b = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => day(0),
    });
    const staged = await batch(70, edgeAssertion);
    await Promise.all([
      commit(a.context, staged, (input) => decision(input, true)),
      commit(b.context, staged, (input) => decision(input, true)),
    ]);
    a.reload();
    assert.equal(relations(a.context).associationSnapshot().receipts.length, 1);
    assert.equal(a.context.lifecycle.snapshot().receipts!.length, 1);
    other = createSqliteKnowledgeContext({
      filename,
      projectId: parseRuntimeId(
        "A008_v1_project_40000000-0000-4000-8000-000000000082",
        "project",
      ),
      clock: () => day(0),
    });
    other.store.replaceNamespace(baseline);
    other.reload();
    await commit(other.context, staged, (input) => decision(input, true));
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM A008_knowledge_association_receipts",
          )
          .get() as { n: number }
      ).n,
      2,
    );
    const before = captureSnapshot(a.context);
    db.exec(
      "CREATE TRIGGER fail_edge_receipt BEFORE INSERT ON A008_knowledge_association_receipts BEGIN SELECT RAISE(ABORT, 'injected edge receipt failure'); END",
    );
    const retry = await batch(71, edgeAssertion);
    await assert.rejects(
      () => commit(a.context, retry, (input) => decision(input, true)),
      /injected edge receipt failure/,
    );
    assert.deepEqual(captureSnapshot(a.context), before);
    db.exec("DROP TRIGGER fail_edge_receipt");
    await commit(a.context, retry, (input) => decision(input, true));
    assert.equal(relations(a.context).associationSnapshot().receipts.length, 2);
  } finally {
    db.close();
    a.close();
    b?.close();
    other?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("P2/A29: operation policy snapshots, old client saves and settings v3 preserve independent edge defaults", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-l3-policy-"));
  const path = join(directory, "settings.json");
  try {
    const preferences = new RuntimePreferencesStore(
      { A008_SETTINGS_PATH: path },
      180000,
    );
    const initial = preferences.snapshot();
    const { association: omitted, ...oldPolicy } = defaults;
    writeFileSync(
      path,
      JSON.stringify({
        version: 3,
        settings: { ...initial.settings, memoryLifecycle: oldPolicy },
      }),
    );
    assert.deepEqual(
      preferences.current.memoryLifecycle!.association,
      defaults.association,
    );
    const changed = parseMemoryLifecyclePolicy({
      ...defaults,
      association: {
        ...defaults.association,
        strength: 0.7,
        halfLifeSeconds: 86400,
      },
    });
    const index = new RelationIndex();
    await preferences.run(async () => {
      const snapshot = preferences.current.memoryLifecycle!;
      preferences.save(
        { ...initial.settings, memoryLifecycle: changed },
        preferences.snapshot().revision,
      );
      index.establishAssociation(edge, occurrence("one"), snapshot);
    });
    const original = index.associationSnapshot().records[0]!;
    assert.equal(original.lifecycle.strength, 0.4);
    const saved = preferences.snapshot();
    preferences.save(
      { ...saved.settings, memoryLifecycle: oldPolicy },
      saved.revision,
    );
    assert.deepEqual(
      preferences.current.memoryLifecycle!.association,
      changed.association,
    );
    index.establishAssociation(
      { ...edge, to: "later" },
      occurrence("two"),
      preferences.current.memoryLifecycle!,
    );
    assert.equal(
      index.associationSnapshot().records[1]!.lifecycle.strength,
      0.7,
    );
    index.establishAssociation(
      edge,
      occurrence("renew", 45),
      preferences.current.memoryLifecycle!,
    );
    near(index.associationSnapshot().records[0]!.lifecycle.strength, 0.4);
    assert.equal(
      index.associationSnapshot().records[0]!.lifecycle.decayLambda,
      original.lifecycle.decayLambda,
    );
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("P4/A29: real L2 store fixture upgrades transactionally, preserves namespaces/legacy links and restores from backup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-l3-migration-"));
  const filename = join(directory, "l2.sqlite");
  const backupPath = join(directory, "backup.sqlite");
  try {
    // Execute the published L2 storage implementation to create and later reject the fixture.
    const baseline = "d867226";
    let source = execFileSync(
      "git",
      ["show", `${baseline}:src/memory/knowledge/sqlite-store.ts`],
      { encoding: "utf8" },
    );
    const schema = execFileSync(
      "git",
      ["show", `${baseline}:src/memory/knowledge/sqlite-schema.ts`],
      { encoding: "utf8" },
    );
    writeFileSync(
      join(directory, "old-schema.mjs"),
      ts.transpileModule(schema, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    );
    source = source.replaceAll('"./sqlite-schema.js"', '"./old-schema.mjs"');
    let executable = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    executable = executable.replace(
      /from "(\.{1,2}\/[^\"]+)"/g,
      (whole, specifier: string) =>
        specifier === "./old-schema.mjs"
          ? whole
          : `from "${pathToFileURL(resolve("dist/src/memory/knowledge", specifier)).href}"`,
    );
    executable = executable.replace(
      'from "better-sqlite3"',
      `from "${pathToFileURL(resolve("node_modules/better-sqlite3/lib/index.js")).href}"`,
    );
    writeFileSync(join(directory, "old-store.mjs"), executable);
    type Store = {
      replaceNamespace(snapshot: unknown): void;
      load(): Record<string, unknown>;
      close(): void;
    };
    const oldBinary = (await import(
      pathToFileURL(join(directory, "old-store.mjs")).href
    )) as { SqliteKnowledgeStore: new (options: unknown) => Store };
    const context = createKnowledgeContext(() => day(0));
    const link = await seed(context);
    relations(context).link(link.from, link.to, link.relation);
    context.lifecycle.reinforceOccurrence({
      ...occurrence("old-support", 1),
      evidenceId: link.from,
    });
    const old = new oldBinary.SqliteKnowledgeStore({ filename, projectId });
    old.replaceNamespace(captureSnapshot(context));
    const expected = old.load();
    old.close();
    const secondId = parseRuntimeId(
      "A008_v1_project_40000000-0000-4000-8000-000000000083",
      "project",
    );
    const secondOld = new oldBinary.SqliteKnowledgeStore({
      filename,
      projectId: secondId,
    });
    secondOld.replaceNamespace(captureSnapshot(context));
    secondOld.close();
    const db = new Database(filename);
    await db.backup(backupPath);
    assert.equal(
      (
        db.prepare("SELECT version FROM A008_knowledge_schema").get() as {
          version: number;
        }
      ).version,
      3,
    );
    db.exec(
      "CREATE TRIGGER fail_l3_upgrade BEFORE UPDATE ON A008_knowledge_schema BEGIN SELECT RAISE(ABORT, 'injected L3 migration failure'); END",
    );
    assert.throws(
      () =>
        createSqliteKnowledgeContext({
          filename,
          projectId,
          clock: () => day(100),
        }),
      /injected L3 migration failure/,
    );
    assert.equal(
      (
        db.prepare("SELECT version FROM A008_knowledge_schema").get() as {
          version: number;
        }
      ).version,
      3,
    );
    assert.equal(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'A008_knowledge_association_lifecycle'",
        )
        .get(),
      undefined,
      "DDL rolls back with the version change",
    );
    db.exec("DROP TRIGGER fail_l3_upgrade");
    db.close();
    const upgraded = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => day(100),
    });
    try {
      const { associations, ...preserved } = upgraded.store.load();
      assert.deepEqual(preserved, expected);
      assert.deepEqual(associations, {
        records: [],
        receipts: [],
        transitions: [],
      });
      assert.equal(
        relations(upgraded.context).neighbors(link.from)[0]!.association,
        undefined,
      );
      const before = captureSnapshot(upgraded.context);
      inspectKnowledge(upgraded.context, { projectId, durable: true });
      assert.deepEqual(captureSnapshot(upgraded.context), before);
      relations(upgraded.context).establishAssociation(
        { ...link, scope: [] },
        occurrence("new-proof", 100),
      );
      assert.equal(relations(upgraded.context).neighbors(link.from).length, 1);
      assert.equal(
        relations(upgraded.context).neighbors(link.from)[0]!.association!
          .lifecycle.strength,
        0.4,
        "later proof initializes, not boosts, legacy link",
      );
      assert.throws(
        () => new oldBinary.SqliteKnowledgeStore({ filename, projectId }),
        /schema version mismatch/,
      );
    } finally {
      upgraded.close();
    }
    const second = createSqliteKnowledgeContext({
      filename,
      projectId: secondId,
      clock: () => day(200),
    });
    try {
      const { associations, ...preserved } = second.store.load();
      assert.deepEqual(preserved, expected);
      assert.equal(associations!.records.length, 0);
    } finally {
      second.close();
    }
    const restored = createSqliteKnowledgeContext({
      filename: backupPath,
      projectId,
      clock: () => day(200),
    });
    try {
      const { associations, ...preserved } = restored.store.load();
      assert.deepEqual(preserved, expected);
      assert.equal(associations!.records.length, 0);
    } finally {
      restored.close();
    }
    const corrupt = new Database(filename);
    corrupt
      .prepare(
        "UPDATE A008_knowledge_association_lifecycle SET payload_json = json_set(payload_json, '$.lifecycle.policyVersion', 'unknown') WHERE namespace = ?",
      )
      .run(projectId);
    assert.throws(
      () => createSqliteKnowledgeContext({ filename, projectId }),
      /Invalid association lifecycle/,
    );
    corrupt.exec("UPDATE A008_knowledge_schema SET version = 999");
    assert.throws(
      () => createSqliteKnowledgeContext({ filename, projectId }),
      /schema version mismatch/,
    );
    assert.equal(
      (
        corrupt.prepare("SELECT version FROM A008_knowledge_schema").get() as {
          version: number;
        }
      ).version,
      999,
    );
    corrupt.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
