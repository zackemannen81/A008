import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import Database from "better-sqlite3";
import {
  DEFAULT_MEMORY_LIFECYCLE_POLICY,
  parseMemoryLifecyclePolicy,
} from "../../src/core/memory-lifecycle-policy.js";
import {
  EvidenceLifecycleStore,
  evaluateLifecycle,
} from "../../src/memory/knowledge/lifecycle.js";
import {
  createKnowledgeContext,
  readKnowledge,
} from "../../src/memory/knowledge/read.js";
import { RelationIndex } from "../../src/memory/knowledge/expand.js";
import { RuntimePreferencesStore } from "../../src/runtime/runtime-preferences-store.js";
import {
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../../src/memory/knowledge/sqlite-context.js";
import {
  atomicKnowledge,
  captureSnapshot,
} from "../../src/memory/knowledge/knowledge-transaction.js";
import { KnowledgeEngineCommit } from "../../src/memory/knowledge/live-commit.js";
import { inspectKnowledge } from "../../src/memory/knowledge/inspection.js";
import { ingest } from "../../src/memory/knowledge/ingest.js";
import { UNKNOWN_INSTANT } from "../../src/memory/knowledge/clocks.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
  type AnalyzedKnowledgeDraft,
  type StagedKnowledgeBatch,
} from "../../src/orchestration/post-output-knowledge-intake.js";
import type { KnowledgeReadContext } from "../../src/memory/knowledge/read-types.js";
import type {
  RelationClassifierDecision,
  KnowledgeRelationClassifier,
} from "../../src/orchestration/relation-gated-memory-commit.js";
import { parseRuntimeId } from "../../src/identity/runtime-id.js";

const day = (n: number) =>
  new Date(Date.parse("2026-01-01T00:00:00.000Z") + n * 86400000).toISOString();
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const projectId = sqliteKnowledgeTestProjectId();
const conversationId = parseRuntimeId(
  "A008_v1_conversation_40000000-0000-4000-8000-000000000081",
  "conversation",
);
const agentId = parseRuntimeId(
  "A008_v1_agent_40000000-0000-4000-8000-000000000081",
  "agent",
);
const taskId = (n: number) =>
  parseRuntimeId(
    `A008_v1_task_40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    "task",
  );
const proposition = "The fixture valve is blue";
function intake(drafts: readonly AnalyzedKnowledgeDraft[]) {
  return new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return drafts;
      },
    },
    context: { projectId, conversationId, agentId },
    budget: { maximum: 16384, measurer: new Utf8ByteKnowledgeIntakeMeasurer() },
  });
}
async function batch(
  n: number,
  message = proposition,
  support = true,
  severity = "minor",
) {
  return intake([
    {
      proposition,
      kind: "fact",
      severity,
      entities: ["fixture valve"],
      ...(support
        ? { support: { source: "message" as const, quote: message } }
        : {}),
    },
  ]).stage({
    taskId: taskId(n),
    message,
    answer: proposition,
    applicabilityScopes: ["local"],
  });
}
const classifier = (
  type: RelationClassifierDecision["type"],
  supportsTarget = true,
): KnowledgeRelationClassifier => ({
  async classify(input) {
    const target =
      input.candidates.find((c) => c.proposition === proposition)?.handle ??
      "missing";
    return type === "new"
      ? { type }
      : type === "conflict"
        ? { type, targetHandles: [target] }
        : { type, targetHandle: target, supportsTarget };
  },
});
const commit = (
  context: KnowledgeReadContext,
  staged: StagedKnowledgeBatch,
  type: RelationClassifierDecision["type"] = "new",
  support = true,
) =>
  new KnowledgeEngineCommit({
    context,
    classifier: classifier(type, support),
  }).commit({ batch: staged, proposalIndex: 0 });

test("A09: severity is per claim, invalid drafts are reported, model numbers cannot choose policy", async () => {
  const drafts = ["critical", "important", "minor", "invalid", undefined].map(
    (severity, i) => ({
      proposition: `fixture ${i}`,
      kind: "fact",
      ...(severity === undefined ? {} : { severity }),
      strength: 99,
      decayLambda: 0,
      threshold: 0,
    }),
  );
  const staged = await intake(drafts).stage({
    taskId: taskId(1),
    message: "fixture",
    answer: "fixture",
    applicabilityScopes: ["local"],
  });
  assert.deepEqual(
    staged.proposals.map((p) => p.severity),
    ["critical", "important", "minor"],
  );
  assert.equal(staged.skippedProposals.length, 2);
  assert.equal(staged.serialized.includes("decayLambda"), false);
  const context = createKnowledgeContext(() => day(0));
  for (let i = 0; i < 3; i++)
    await new KnowledgeEngineCommit({
      context,
      classifier: classifier("new"),
    }).commit({ batch: staged, proposalIndex: i });
  assert.deepEqual(
    context.lifecycle
      .list()
      .filter((r) => r.evidenceKind === "claim")
      .map((r) => r.lifecycle.strength),
    [1, 0.8, 0.4],
  );
  const raw = context.lifecycle
    .list()
    .find((r) => r.evidenceKind === "utterance")!.lifecycle;
  assert.equal(raw.severity, null);
  assert.equal(raw.strength, 1);
  assert.equal(raw.threshold, 0.5);
  assert.equal(raw.pinned, false);
});

test("explicit post-response reinforcement strengthens the retrieved artifact without duplicating knowledge", async () => {
  const context = createKnowledgeContext(() => day(0));
  const first = await batch(90);
  await new KnowledgeEngineCommit({
    context,
    classifier: classifier("new"),
  }).commit({ batch: first, proposalIndex: 0 });

  const claim = context.evidence
    .listClaims()
    .find((entry) => entry.label === proposition);
  assert.ok(claim);
  const beforeClaims = context.evidence.listClaims().length;
  const before = context.lifecycle.get(claim.id)!.lifecycle.strength;

  const staged = await new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return {
          new_knowledge: [],
          state_updates: [],
          relation_updates: [],
          reinforcements: [{ knowledgeId: "retrieved:fixture-valve" }],
        };
      },
    },
    context: { projectId, conversationId, agentId },
    budget: {
      maximum: 16384,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  }).stage({
    taskId: taskId(91),
    message: "Use the fixture valve fact.",
    answer: "The fixture valve fact was relevant to the result.",
    retrievedContext: [
      {
        id: "retrieved:fixture-valve",
        evidenceId: claim.id,
        proposition,
        kind: "claim",
        tags: ["fixture"],
        scope: ["local"],
        authority: 0.4,
      },
    ],
    applicabilityScopes: ["local"],
  });

  assert.equal(staged.proposals.length, 0);
  assert.equal(staged.reinforcements?.length, 1);

  const writer = new KnowledgeEngineCommit({
    context,
    classifier: classifier("new"),
  });
  const applied = await writer.commitReinforcements(staged);
  assert.equal(applied[0]?.status, "applied");
  assert.equal(context.evidence.listClaims().length, beforeClaims);
  assert.ok(context.lifecycle.get(claim.id)!.lifecycle.strength > before);

  const afterFirst = context.lifecycle.get(claim.id)!.lifecycle.strength;
  const duplicate = await writer.commitReinforcements(staged);
  assert.equal(duplicate[0]?.status, "duplicate_or_creation");
  assert.equal(context.lifecycle.get(claim.id)!.lifecycle.strength, afterFirst);
  assert.equal(context.evidence.listClaims().length, beforeClaims);
});

test("A10-A13: exact horizons, lazy evaluation, decayed reinforcement, cap refresh and no activation floor", () => {
  const store = new EvidenceLifecycleStore(() => day(0));
  for (const severity of ["minor", "important", "critical"] as const)
    store.attach({ evidenceId: severity, evidenceKind: "claim", severity });
  const before = store.snapshot();
  const minor = store.get("minor")!.lifecycle;
  near(evaluateLifecycle(minor, day(14)).strength, 0.2);
  assert.equal(evaluateLifecycle(minor, day(14)).memoryState, "active");
  assert.equal(evaluateLifecycle(minor, day(14.000001)).memoryState, "dormant");
  near(
    evaluateLifecycle(store.get("important")!.lifecycle, day(90)).strength,
    0.4,
  );
  near(
    evaluateLifecycle(store.get("important")!.lifecycle, day(180)).strength,
    0.2,
  );
  near(
    evaluateLifecycle(store.get("critical")!.lifecycle, day(365)).strength,
    0.5,
  );
  assert.deepEqual(store.snapshot(), before);
  const receipt = {
    occurrenceId: "turn:1",
    evidenceId: "minor",
    at: day(28),
    support: { utteranceId: "u", start: 0, end: 5 },
  };
  assert.equal(store.reinforceOccurrence(receipt), true);
  const boosted = store.get("minor")!.lifecycle;
  near(boosted.strength, 0.3);
  assert.equal(boosted.severity, "minor");
  near(
    Math.log(boosted.strength / boosted.threshold) /
      boosted.decayLambda /
      86400,
    8.18947501009619,
  );
  assert.equal(store.reinforceOccurrence(receipt), false);
  store.reinforceOccurrence({
    ...receipt,
    evidenceId: "critical",
    occurrenceId: "cap",
    at: day(1),
  });
  assert.equal(store.get("critical")!.lifecycle.strength, 1);
  assert.equal(store.get("critical")!.lifecycle.strengthUpdatedAt, day(1));
  const policy = parseMemoryLifecyclePolicy({
    ...DEFAULT_MEMORY_LIFECYCLE_POLICY,
    minor: { ...DEFAULT_MEMORY_LIFECYCLE_POLICY.minor, boost: 0.01 },
  });
  store.attach({
    evidenceId: "deep",
    evidenceKind: "claim",
    severity: "minor",
    policy,
  });
  store.reinforceOccurrence({
    ...receipt,
    evidenceId: "deep",
    occurrenceId: "deep",
    at: day(1000),
  });
  assert.equal(store.get("deep")!.lifecycle.state, "dormant");
});

test("A19/A22: invalid policy/time, zero lambda, underflow, backwards clock and immutable creation snapshots", () => {
  const store = new EvidenceLifecycleStore(() => day(0));
  for (const strength of [-1, 2, NaN, Infinity])
    assert.throws(() =>
      store.attach({ evidenceId: "bad", evidenceKind: "claim", strength }),
    );
  for (const at of ["bad", "2026-02-30T00:00:00Z"])
    assert.throws(() =>
      store.attach({ evidenceId: "bad", evidenceKind: "claim", at }),
    );
  for (const threshold of [0, NaN, -1])
    assert.throws(() =>
      parseMemoryLifecyclePolicy({
        ...DEFAULT_MEMORY_LIFECYCLE_POLICY,
        minor: { ...DEFAULT_MEMORY_LIFECYCLE_POLICY.minor, threshold },
      }),
    );
  const fixed = store.attach({
    evidenceId: "fixed",
    evidenceKind: "claim",
    strength: 0,
    decayLambda: 0,
  });
  assert.equal(evaluateLifecycle(fixed.lifecycle, day(9999)).strength, 0);
  assert.equal(
    evaluateLifecycle(fixed.lifecycle, day(0)).thresholdCrossingAt,
    null,
  );
  const base = store.attach({
    evidenceId: "base",
    evidenceKind: "claim",
    severity: "minor",
    at: day(20),
  });
  assert.equal(evaluateLifecycle(base.lifecycle, day(10)).strength, 0.4);
  store.reinforceOccurrence({
    occurrenceId: "backwards",
    evidenceId: "base",
    at: day(10),
    support: { utteranceId: "u", start: 0, end: 1 },
  });
  assert.equal(store.get("base")!.lifecycle.strengthUpdatedAt, day(20));
  near(evaluateLifecycle(store.get("base")!.lifecycle, day(20)).strength, 0.6);
  assert.equal(evaluateLifecycle(base.lifecycle, day(100000)).strength, 0);
  assert.equal(
    store.get("base")!.lifecycle.decayLambda,
    base.lifecycle.decayLambda,
  );
});

for (const durable of [false, true]) {
  test(`A14-A18/A20/A29: semantic actuality, read isolation, rollback, duplicates and cancellation (${durable ? "SQLite" : "memory"})`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "a008-l2-"));
    const filename = join(directory, "fixture.sqlite");
    let time = day(0);
    const handle = durable
      ? createSqliteKnowledgeContext({ filename, projectId, clock: () => time })
      : undefined;
    const context = handle?.context ?? createKnowledgeContext(() => time);
    try {
      await commit(context, await batch(1));
      const target = context.evidence.listClaims()[0]!.id;
      const created = captureSnapshot(context);
      await commit(context, await batch(1));
      assert.deepEqual(
        captureSnapshot(context),
        created,
        "duplicate creation cannot create a fresh baseline",
      );
      time = day(28);
      handle?.reload();
      const before = captureSnapshot(context);
      inspectKnowledge(context, { projectId, durable });
      inspectKnowledge(context, { projectId, durable });
      assert.deepEqual(captureSnapshot(context), before);
      assert.throws(() =>
        atomicKnowledge(context, () => {
          context.lifecycle.reinforceOccurrence({
            occurrenceId: "rolled-back",
            evidenceId: target,
            at: time,
            support: { utteranceId: "u", start: 0, end: 1 },
          });
          throw new Error("injected write failure");
        }),
      );
      assert.deepEqual(captureSnapshot(context), before);
      const recurrence = await batch(2);
      const result = await commit(context, recurrence, "restatement");
      assert.equal(result.evidence.reinforcement, "applied");
      near(context.lifecycle.get(target)!.lifecycle.strength, 0.3);
      const receipt = context.lifecycle.snapshot().receipts!;
      assert.equal(receipt.length, 1);
      assert.equal(receipt[0]!.evidenceId, target);
      await commit(context, recurrence, "restatement");
      assert.equal(context.lifecycle.snapshot().receipts!.length, 1);
      const controller = new AbortController();
      const cancelled = new KnowledgeEngineCommit({
        context,
        classifier: {
          async classify() {
            controller.abort();
            return { type: "new" };
          },
        },
      });
      const beforeCancel = captureSnapshot(context);
      await assert.rejects(
        cancelled.commit(
          { batch: await batch(3), proposalIndex: 0 },
          { signal: controller.signal },
        ),
      );
      assert.deepEqual(captureSnapshot(context), beforeCancel);
      // Reinforcement follows semantic actuality, not evidence attachment.
      // Each distinct turn makes the same knowledge current/relevant again,
      // even when it is a question, quotation, or has no exact support span.
      await commit(
        context,
        await batch(4, "Tell me about the valve", false),
        "restatement",
      );
      await commit(
        context,
        await batch(5, "Is the fixture valve blue?"),
        "restatement",
        false,
      );
      await commit(
        context,
        await batch(6, 'Someone wrote "The fixture valve is blue"'),
        "restatement",
        false,
      );
      assert.equal(context.lifecycle.snapshot().receipts!.length, 4);
      near(context.lifecycle.get(target)!.lifecycle.strength, 0.9);
      const inspected = inspectKnowledge(context, { projectId, durable });
      const detail = JSON.parse(
        inspected.records.find(
          (r) => r.kind === "claim" && r.sourceId === target,
        )!.detail,
      );
      assert.equal(
        detail.lifecycle.strength,
        context.lifecycle.get(target)!.lifecycle.strength,
      );
      assert.equal(detail.lifecycle.evaluatedAt, time);
      if (handle) {
        handle.close();
        time = day(42);
        const reopened = createSqliteKnowledgeContext({
          filename,
          projectId,
          clock: () => time,
        });
        try {
          near(
            evaluateLifecycle(
              reopened.context.lifecycle.get(target)!.lifecycle,
              time,
            ).strength,
            0.45,
          );
          await commit(reopened.context, recurrence, "restatement");
          assert.equal(
            reopened.context.lifecycle.snapshot().receipts!.length,
            4,
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
}

test("A15-A18/A29: two SQLite connections deliver one target boost; source reimport keeps occurrence identity", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-l2-concurrent-"));
  const filename = join(directory, "fixture.sqlite");
  let time = day(0);
  const a = createSqliteKnowledgeContext({
    filename,
    projectId,
    clock: () => time,
  });
  let b: ReturnType<typeof createSqliteKnowledgeContext> | undefined;
  try {
    await commit(a.context, await batch(1));
    const target = a.context.evidence.listClaims()[0]!.id;
    b = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => time,
    });
    time = day(28);
    await Promise.all([
      commit(a.context, await batch(2), "extend"),
      commit(b.context, await batch(2), "extend"),
    ]);
    a.reload();
    near(a.context.lifecycle.get(target)!.lifecycle.strength, 0.3);
    assert.equal(a.context.lifecycle.snapshot().receipts!.length, 1);
    for (let i = 0; i < 2; i++) {
      const source = ingest(
        {
          content: proposition,
          speaker: "fixture-source",
          locator: "source:fixture",
          scope: { verified: true },
        },
        { store: a.context.evidence },
      );
      const staged = await intake([
        {
          proposition,
          kind: "fact",
          severity: "minor",
          support: { source: "source", quote: proposition },
        },
      ]).stage({
        kind: "source",
        taskId: taskId(10 + i),
        locator: "source:fixture",
        content: proposition,
        utteranceId: source.utterances[0]!.id,
        applicabilityScopes: ["local"],
      });
      const exact = new KnowledgeEngineCommit({
        context: a.context,
        classifier: {
          async classify(input) {
            const id = a.context.evidence
              .listClaims()
              .findIndex((c) => c.id === target);
            return {
              type: "restatement",
              targetHandle: input.candidates[id]!.handle,
              supportsTarget: true,
            };
          },
        },
      });
      await exact.commit({ batch: staged, proposalIndex: 0 });
      assert.equal(
        a.context.evidence
          .listUtterances()
          .find((u) => u.id === source.utterances[0]!.id)!.speaker,
        "fixture-source",
      );
    }
    assert.equal(a.context.lifecycle.snapshot().receipts!.length, 2);
  } finally {
    b?.close();
    a.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("A23-A24: atomic multi-namespace legacy upgrade, retry, old executable rejection and backup restoration", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-l2-migrate-"));
  const filename = join(directory, "legacy.sqlite");
  try {
    const seed = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => day(0),
    });
    for (const id of ["one", "two"])
      seed.context.lifecycle.attach({
        evidenceId: id,
        evidenceKind: "claim",
        strength: 0.1,
      });
    seed.close();
    const db = new Database(filename);
    const legacy = {
      state: "dormant",
      strength: 0.1,
      decayRate: 0.1,
      threshold: 0.5,
      pinned: false,
      lastReinforcedAt: UNKNOWN_INSTANT,
    };
    db.prepare(
      "UPDATE A008_knowledge_lifecycle SET payload_json = ? WHERE evidence_id = 'one'",
    ).run(
      JSON.stringify({
        evidenceId: "one",
        evidenceKind: "claim",
        lifecycle: legacy,
      }),
    );
    db.prepare(
      "UPDATE A008_knowledge_lifecycle SET payload_json = ? WHERE evidence_id = 'two'",
    ).run(
      JSON.stringify({
        evidenceId: "two",
        evidenceKind: "claim",
        lifecycle: { ...legacy, threshold: 0, state: "active" },
      }),
    );
    db.prepare(
      "INSERT INTO A008_knowledge_lifecycle SELECT 'other-project', evidence_id, evidence_kind, payload_json FROM A008_knowledge_lifecycle WHERE evidence_id = 'one'",
    ).run();
    db.exec("UPDATE A008_knowledge_schema SET version = 2");
    await db.backup(join(directory, "backup.sqlite"));
    db.exec(
      "CREATE TRIGGER fail_upgrade BEFORE UPDATE ON A008_knowledge_lifecycle WHEN old.evidence_id = 'two' BEGIN SELECT RAISE(ABORT, 'injected migration failure'); END",
    );
    assert.throws(
      () =>
        createSqliteKnowledgeContext({
          filename,
          projectId,
          clock: () => day(100),
        }),
      /injected migration/,
    );
    assert.equal(
      (
        db.prepare("SELECT version FROM A008_knowledge_schema").get() as {
          version: number;
        }
      ).version,
      2,
    );
    assert.equal(
      (
        db
          .prepare(
            "SELECT payload_json FROM A008_knowledge_lifecycle WHERE evidence_id = 'one'",
          )
          .get() as { payload_json: string }
      ).payload_json.includes("strengthUpdatedAt"),
      false,
    );
    db.exec("DROP TRIGGER fail_upgrade");
    db.close();
    const upgraded = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => day(100),
    });
    const old = upgraded.context.lifecycle.get("one")!.lifecycle;
    assert.equal(old.strength, 0.1);
    assert.equal(old.threshold, 0.5);
    assert.equal(old.severity, null);
    assert.equal(old.strengthUpdatedAt, day(100));
    assert.deepEqual(old.lastReinforcedAt, UNKNOWN_INSTANT);
    assert.equal(
      evaluateLifecycle(
        upgraded.context.lifecycle.get("two")!.lifecycle,
        day(9999),
      ).memoryState,
      "active",
    );
    upgraded.close();
    const reopened = createSqliteKnowledgeContext({
      filename,
      projectId,
      clock: () => day(200),
    });
    assert.equal(
      reopened.context.lifecycle.get("one")!.lifecycle.strengthUpdatedAt,
      day(100),
    );
    reopened.close();
    // Execute the previous published store implementation, not a re-created version predicate.
    const baseline = "736463dd2998d71fa004161ed22f374d6108b51f";
    let oldSource = execFileSync(
      "git",
      ["show", `${baseline}:src/memory/knowledge/sqlite-store.ts`],
      { encoding: "utf8" },
    );
    const oldSchema = execFileSync(
      "git",
      ["show", `${baseline}:src/memory/knowledge/sqlite-schema.ts`],
      { encoding: "utf8" },
    );
    writeFileSync(
      join(directory, "old-schema.mjs"),
      ts.transpileModule(oldSchema, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    );
    oldSource = oldSource.replaceAll(
      '"./sqlite-schema.js"',
      '"./old-schema.mjs"',
    );
    let executable = ts.transpileModule(oldSource, {
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
    const oldBinary = (await import(
      pathToFileURL(join(directory, "old-store.mjs")).href
    )) as { SqliteKnowledgeStore: new (options: unknown) => unknown };
    assert.throws(
      () => new oldBinary.SqliteKnowledgeStore({ filename, projectId }),
      /schema version mismatch/,
    );
    const backup = new Database(join(directory, "backup.sqlite"));
    assert.equal(
      (
        backup.prepare("SELECT version FROM A008_knowledge_schema").get() as {
          version: number;
        }
      ).version,
      2,
    );
    assert.equal(
      (
        backup
          .prepare("SELECT COUNT(*) AS n FROM A008_knowledge_lifecycle")
          .get() as { n: number }
      ).n,
      3,
    );
    backup.close();
    const restored = createSqliteKnowledgeContext({
      filename: join(directory, "backup.sqlite"),
      projectId,
      clock: () => day(100),
    });
    assert.deepEqual(restored.context.lifecycle.get("one")!.lifecycle, old);
    restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("A16/A17/A29: relation matrix, unresolved target and namespace separation", async () => {
  for (const relation of ["new", "supersede", "conflict"] as const) {
    const context = createKnowledgeContext(() => day(0));
    await commit(context, await batch(1));
    const target = context.evidence.listClaims()[0]!.id;
    const baseline = context.lifecycle.get(target);
    await commit(context, await batch(2), relation);
    assert.deepEqual(context.lifecycle.get(target), baseline);
    assert.deepEqual(context.lifecycle.snapshot().receipts, []);
  }
  const context = createKnowledgeContext(() => day(0));
  await commit(context, await batch(1));
  const missing = new KnowledgeEngineCommit({
    context,
    classifier: {
      async classify() {
        return {
          type: "extend",
          targetHandle: "not-a-candidate",
          supportsTarget: true,
        };
      },
    },
  });
  const result = await missing.commit({
    batch: await batch(2),
    proposalIndex: 0,
  });
  assert.equal(result.evidence.reinforcement, "unresolved_target");
  assert.equal(context.lifecycle.snapshot().receipts!.length, 0);
  const isolated = createKnowledgeContext(() => day(0));
  await commit(isolated, await batch(1));
  await commit(isolated, await batch(2), "restatement");
  assert.equal(isolated.lifecycle.snapshot().receipts!.length, 1);
  assert.equal(context.lifecycle.snapshot().receipts!.length, 0);
});

test("A21: lazy dormant direct evidence remains available, associative neighbor is omitted, pin stays active", async () => {
  let time = day(0);
  const context = createKnowledgeContext(() => time);
  await commit(context, await batch(1));
  const first = context.evidence.listClaims()[0]!;
  const second = await intake([
    {
      proposition: "Orion fuel contains argon",
      severity: "minor",
      kind: "fact",
      entities: ["Orion"],
    },
  ]).stage({
    taskId: taskId(2),
    message: "Orion fuel contains argon",
    answer: "Recorded",
    applicabilityScopes: ["local"],
  });
  await commit(context, second);
  const neighbor = context.evidence
    .listClaims()
    .find((c) => c.id !== first.id)!;
  (context.relations as RelationIndex).link(first.id, neighbor.id, "related");
  time = day(15);
  const before = captureSnapshot(context);
  const read = readKnowledge(
    {
      message: "What color is the fixture valve?",
      verifiedScope: { verified: true, entities: ["fixture valve"] },
    },
    context,
  );
  assert.ok(
    read.retrieved.some(
      (r) =>
        r.evidenceId === first.id &&
        r.matchKind === "direct" &&
        r.memoryState === "dormant",
    ),
  );
  assert.ok(
    read.expanded.omitted.some((r) => r.reason === "associative_dormant"),
  );
  assert.deepEqual(captureSnapshot(context), before);
  assert.equal(
    JSON.stringify(read.projected.payload).includes("decayLambda"),
    false,
  );
  const pinned = context.lifecycle.attach({
    evidenceId: "pinned",
    evidenceKind: "claim",
    severity: "minor",
    strength: 0,
    pinned: true,
  });
  assert.equal(
    evaluateLifecycle(pinned.lifecycle, day(10000)).memoryState,
    "active",
  );
});

test("A22: advanced runtime policy snapshots survive existing-client saves and affect only later creation", async () => {
  const preferences = new RuntimePreferencesStore(
    { A008_SETTINGS_PATH: ":memory:" },
    180000,
  );
  const initial = preferences.snapshot();
  const changed = parseMemoryLifecyclePolicy({
    ...DEFAULT_MEMORY_LIFECYCLE_POLICY,
    minor: {
      ...DEFAULT_MEMORY_LIFECYCLE_POLICY.minor,
      strength: 0.7,
      halfLifeSeconds: 86400,
    },
  });
  const context = createKnowledgeContext(() => day(0));
  await preferences.run(async () => {
    const committer = new KnowledgeEngineCommit({
      context,
      classifier: classifier("new"),
      policy: preferences.current.memoryLifecycle!,
    });
    preferences.save(
      { ...initial.settings, memoryLifecycle: changed },
      initial.revision,
    );
    await committer.commit({ batch: await batch(1), proposalIndex: 0 });
    assert.equal(preferences.current.memoryLifecycle!.minor.strength, 0.4);
  });
  const baseline = context.lifecycle
    .list()
    .find((r) => r.evidenceKind === "claim")!.lifecycle;
  assert.equal(baseline.strength, 0.4);
  const saved = preferences.snapshot();
  preferences.save(
    { instructions: "fixture instruction", budgets: saved.settings.budgets },
    saved.revision,
  );
  assert.deepEqual(preferences.current.memoryLifecycle, changed);
  await new KnowledgeEngineCommit({
    context,
    classifier: classifier("new"),
    policy: preferences.current.memoryLifecycle!,
  }).commit({ batch: await batch(2), proposalIndex: 0 });
  assert.deepEqual(
    context.lifecycle
      .list()
      .filter((r) => r.evidenceKind === "claim")
      .map((r) => r.lifecycle.strength),
    [0.4, 0.7],
  );
  assert.equal(
    context.lifecycle.list().find((r) => r.evidenceKind === "claim")!.lifecycle
      .decayLambda,
    baseline.decayLambda,
  );
});
