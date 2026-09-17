import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createSqliteKnowledgeContext } from "../../src/memory/knowledge/sqlite-context.js";
import {
  atomicKnowledge,
  captureSnapshot,
} from "../../src/memory/knowledge/knowledge-transaction.js";
import { RelationIndex } from "../../src/memory/knowledge/expand.js";
import { evaluateAssociation } from "../../src/memory/knowledge/association-lifecycle.js";
import { evaluateLifecycle } from "../../src/memory/knowledge/lifecycle.js";
import { parseRuntimeId } from "../../src/identity/runtime-id.js";
import { SqliteMemoryRepository } from "../../src/memory/sqlite-memory-repository.js";
import type { KnowledgeItem } from "../../src/memory/types.js";
import {
  SqliteKnowledgeStore,
  UNKNOWN_INSTANT,
  sqliteKnowledgeTestProjectId,
} from "../../src/memory/knowledge/index.js";

const PROJECT = sqliteKnowledgeTestProjectId();

test("a second connection committing just after our transaction cannot be hidden by the local revision refresh", () => {
  const isolated = isolatedFile();
  const database = new Database(isolated.filename);
  const first = createSqliteKnowledgeContext({
    filename: isolated.filename,
    projectId: PROJECT,
    database,
  });
  const second = createSqliteKnowledgeContext({
    filename: isolated.filename,
    projectId: PROJECT,
  });
  try {
    const atomic = first.store.atomic.bind(first.store);
    let interleave = true;
    first.store.atomic = (operation) => {
      const result = atomic(operation);
      if (!database.inTransaction && interleave) {
        interleave = false;
        second.context.entities.register({
          id: "other" as never,
          type: "fixture",
          labels: ["other"],
        });
      }
      return result;
    };
    first.context.entities.register({
      id: "first" as never,
      type: "fixture",
      labels: ["first"],
    });
    assert.throws(() => first.persist(), /Knowledge changed/);
    first.context.entities.register({
      id: "last" as never,
      type: "fixture",
      labels: ["last"],
    });
    assert.deepEqual(
      first.context.entities
        .list()
        .map((e) => e.id)
        .sort(),
      ["first", "last", "other"],
    );
    assert.deepEqual(
      first.store
        .load()
        .entities.map((e) => e.id)
        .sort(),
      ["first", "last", "other"],
    );
  } finally {
    first.close();
    second.close();
    database.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("incremental persistence rolls back baseline, receipt and audit on SQL failure, then retries once", () => {
  const database = new Database(":memory:");
  const handle = createSqliteKnowledgeContext({
    filename: ":memory:",
    projectId: PROJECT,
    database,
  });
  try {
    handle.context.lifecycle.attach({
      evidenceId: "target",
      evidenceKind: "claim",
      severity: "minor",
      at: "2026-01-01T00:00:00.000Z",
    });
    const before = handle.store.load();
    database.exec(`CREATE TEMP TRIGGER fail_audit BEFORE INSERT ON A008_knowledge_lifecycle_transitions
      WHEN NEW.evidence_id = 'target' BEGIN SELECT RAISE(ABORT, 'injected audit failure'); END;`);
    const receipt = {
      occurrenceId: "retry",
      evidenceId: "target",
      at: "2026-01-02T00:00:00.000Z",
      support: { utteranceId: "source", start: 0, end: 1 },
    };
    assert.throws(
      () => handle.context.lifecycle.reinforceOccurrence(receipt),
      /injected audit failure/,
    );
    assert.deepEqual(handle.store.load(), before);
    assert.deepEqual(captureSnapshot(handle.context), before);
    database.exec("DROP TRIGGER fail_audit");
    assert.equal(handle.context.lifecycle.reinforceOccurrence(receipt), true);
    assert.equal(handle.context.lifecycle.reinforceOccurrence(receipt), false);
    assert.equal(handle.store.load().lifecycle.receipts?.length, 1);
    assert.equal(handle.store.load().lifecycle.transitions.length, 2);
  } finally {
    handle.close();
    database.close();
  }
});

test("incremental indexes and deletions match bulk storage, preserve another namespace and survive reopen", () => {
  const isolated = isolatedFile();
  const database = new Database(isolated.filename);
  const reference = new Database(":memory:");
  const store = new SqliteKnowledgeStore({
    filename: isolated.filename,
    projectId: PROJECT,
    database,
  });
  const bulk = new SqliteKnowledgeStore({
    filename: ":memory:",
    projectId: PROJECT,
    database: reference,
  });
  const other = new SqliteKnowledgeStore({
    filename: isolated.filename,
    projectId: parseRuntimeId(
      "A008_v1_project_40000000-0000-4000-8000-000000000101",
      "project",
    ),
    database,
  });
  try {
    const empty = store.load();
    const slot = {
      kind: "attribute" as const,
      entity: "house" as never,
      name: "color",
    };
    const binding = {
      kind: "attribute" as const,
      slot,
      value: "blue",
      label: "blue",
      interval: { from: UNKNOWN_INSTANT, to: null },
      causedBy: "fixture",
      claimId: "claim",
    };
    const before = {
      ...empty,
      entities: [
        { id: "house" as never, type: "house", labels: ["oldname", "alias"] },
        { id: "keep" as never, type: "house", labels: ["untouched"] },
      ],
      slots: [
        { ref: slot, cardinality: "single" as const, valueType: "color" },
      ],
      state: {
        ...empty.state,
        bindings: [
          binding,
          {
            ...binding,
            interval: { from: "2026-01-01T00:00:00.000Z", to: null },
          },
        ],
      },
      labels: [
        {
          recordId: "claim",
          recordKind: "claim" as const,
          tags: ["oldtag"],
          domains: ["house"],
        },
      ],
      relations: [{ from: "house", to: "keep", relation: "near" }],
    };
    store.replaceNamespace(before);
    other.replaceNamespace(before);
    const untouchedFts = database
      .prepare(
        "SELECT rowid FROM A008_knowledge_fts WHERE namespace = ? AND record_id = 'keep'",
      )
      .get(PROJECT);
    const after = {
      ...before,
      entities: [
        { ...before.entities[0]!, labels: ["newname"] },
        before.entities[1]!,
      ],
      slots: [{ ...before.slots[0]!, cardinality: "set" as const }],
      state: {
        ...before.state,
        bindings: [
          {
            ...binding,
            label: "green",
            value: "green",
            interval: { from: UNKNOWN_INSTANT, to: "2026-02-01T00:00:00.000Z" },
          },
          before.state.bindings[1]!,
        ],
      },
      labels: [{ ...before.labels[0]!, tags: ["newtag"], domains: [] }],
      relations: [],
    };
    const tables = (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'A008_knowledge_%'",
        )
        .all() as { name: string }[]
    )
      .map((r) => r.name)
      .filter(
        (name) =>
          !name.startsWith("A008_knowledge_fts_") &&
          !["A008_knowledge_schema", "A008_knowledge_migration"].includes(name),
      );
    const assertEquivalent = () => {
      for (const table of tables) {
        const rows = (db: Database.Database) =>
          db
            .prepare(`SELECT * FROM ${table} WHERE namespace = ?`)
            .all(PROJECT)
            .map((row) => JSON.stringify(row))
            .sort();
        assert.deepEqual(rows(database), rows(reference), table);
      }
    };
    store.updateNamespace(before, after);
    bulk.replaceNamespace(after);
    assertEquivalent();
    assert.deepEqual(
      database
        .prepare(
          "SELECT rowid FROM A008_knowledge_fts WHERE namespace = ? AND record_id = 'keep'",
        )
        .get(PROJECT),
      untouchedFts,
    );
    const matches = (text: string) =>
      database
        .prepare(
          "SELECT record_id FROM A008_knowledge_fts WHERE namespace = ? AND A008_knowledge_fts MATCH ?",
        )
        .all(PROJECT, text);
    assert.equal(matches("oldname").length, 0);
    assert.equal(matches("newname").length, 1);
    assert.equal(matches("green").length, 1);
    assert.equal(matches("blue").length, 1);
    assert.deepEqual(
      other.load().entities,
      [...before.entities].sort((a, b) =>
        String(a.id).localeCompare(String(b.id)),
      ),
    );
    // Hydration/removal may remove any family, including all historical FTS entries.
    store.updateNamespace(after, empty);
    bulk.replaceNamespace(empty);
    assertEquivalent();
    assert.equal(other.load().entities.length, 2);
    store.updateNamespace(empty, after);
    const reopened = new SqliteKnowledgeStore({
      filename: isolated.filename,
      projectId: PROJECT,
    });
    try {
      assert.deepEqual(reopened.load(), store.load());
    } finally {
      reopened.close();
    }
  } finally {
    store.close();
    bulk.close();
    other.close();
    database.close();
    reference.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

for (const size of [100, 1000]) {
  test(`incremental persistence: one reinforcement leaves ${size} unrelated records untouched`, () => {
    const database = new Database(":memory:");
    const handle = createSqliteKnowledgeContext({
      filename: ":memory:",
      projectId: PROJECT,
      database,
    });
    const changes = () =>
      (database.prepare("SELECT total_changes() AS n").get() as { n: number })
        .n;
    try {
      atomicKnowledge(handle.context, () => {
        for (let i = 0; i < size; i++) {
          handle.context.entities.register({
            id: `entity-${i}` as never,
            type: "fixture",
            labels: [`entity ${i}`],
          });
          handle.context.lifecycle.attach({
            evidenceId: `claim-${i}`,
            evidenceKind: "claim",
            severity: "minor",
            at: "2026-01-01T00:00:00.000Z",
          });
        }
      });
      const before = changes();
      handle.context.lifecycle.reinforceOccurrence({
        occurrenceId: "fixture-turn",
        evidenceId: "claim-0",
        at: "2026-01-02T00:00:00.000Z",
        support: { utteranceId: "fixture-source", start: 0, end: 1 },
      });
      // Baseline update + receipt + audit + next transition counter. No FTS writes.
      assert.equal(changes() - before, 4);
      const persisted = handle.store.load();
      const expected = captureSnapshot(handle.context).lifecycle;
      assert.deepEqual(persisted.lifecycle, {
        ...expected,
        records: [...expected.records].sort((a, b) =>
          a.evidenceId.localeCompare(b.evidenceId, "en"),
        ),
      });
      const after = changes();
      handle.persist();
      assert.equal(changes(), after, "no-op persistence must not write");
      handle.context.lifecycle.reinforceOccurrence({
        occurrenceId: "fixture-turn",
        evidenceId: "claim-0",
        at: "2026-01-02T00:00:00.000Z",
        support: { utteranceId: "fixture-source", start: 0, end: 1 },
      });
      assert.equal(changes(), after, "duplicate receipt must not write");
      const relations = handle.context.relations as RelationIndex;
      const edge = {
        from: "claim-0",
        to: "claim-1",
        relation: "supports",
        scope: ["local"],
      };
      const occurrence = {
        occurrenceId: "edge-create",
        at: "2026-01-01T00:00:00.000Z",
        support: { utteranceId: "fixture-source", start: 0, end: 1 },
      };
      relations.establishAssociation(edge, occurrence);
      const beforeEdge = changes();
      const evidence = handle.context.lifecycle.snapshot();
      relations.establishAssociation(edge, {
        ...occurrence,
        occurrenceId: "edge-boost",
        at: "2026-01-02T00:00:00.000Z",
      });
      assert.equal(
        changes() - beforeEdge,
        3,
        "only edge baseline, receipt and audit change",
      );
      assert.deepEqual(handle.context.lifecycle.snapshot(), evidence);
      const beforeRead = changes();
      assert.equal(
        evaluateAssociation(
          relations.associationSnapshot().records[0]!,
          "2030-01-01T00:00:00.000Z",
        ).memoryState,
        "dormant",
      );
      assert.equal(
        evaluateLifecycle(
          handle.context.lifecycle.get("claim-0")!.lifecycle,
          "2030-01-01T00:00:00.000Z",
        ).memoryState,
        "dormant",
      );
      assert.equal(
        changes(),
        beforeRead,
        "lazy decay evaluation must not write",
      );
    } finally {
      handle.close();
      database.close();
    }
  });
}

function isolatedFile(): {
  readonly directory: string;
  readonly filename: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "A008-knowledge-store-"));
  return { directory, filename: join(directory, "memory.sqlite") };
}

test("knowledge SQLite stores unknown interval boundaries as unknown, never now", () => {
  const isolated = isolatedFile();
  const store = new SqliteKnowledgeStore({
    filename: isolated.filename,
    projectId: PROJECT,
  });
  try {
    store.replaceNamespace({
      entities: [
        {
          id: "house" as never,
          type: "house",
          labels: ["house"],
        },
      ],
      slots: [
        {
          ref: { kind: "attribute", entity: "house" as never, name: "color" },
          cardinality: "single",
          valueType: "color",
        },
      ],
      state: {
        bindings: [
          {
            kind: "attribute",
            slot: {
              kind: "attribute",
              entity: "house" as never,
              name: "color",
            },
            value: "white",
            label: "white",
            interval: { from: UNKNOWN_INSTANT, to: UNKNOWN_INSTANT },
            causedBy: "migrated:old",
            claimId: "claim-old",
          },
          {
            kind: "attribute",
            slot: {
              kind: "attribute",
              entity: "house" as never,
              name: "color",
            },
            value: "green",
            label: "green",
            interval: { from: UNKNOWN_INSTANT, to: null },
            causedBy: "migrated:new",
            claimId: "claim-new",
          },
        ],
        claims: [],
        transitions: [],
        events: [],
        corrections: [],
        contestedSlotKeys: [],
      },
      stateNextTransition: 0,
      artifacts: [],
      utterances: [],
      claims: [],
      provenance: [],
      labels: [],
      lifecycle: { records: [], transitions: [] },
      lifecycleNextTransition: 0,
      relations: [],
    });
    const loaded = store.load();
    const closed = loaded.state.bindings.find(
      (binding) => binding.kind === "attribute" && binding.value === "white",
    );
    const open = loaded.state.bindings.find(
      (binding) => binding.kind === "attribute" && binding.value === "green",
    );
    assert.deepEqual(closed?.interval, {
      from: UNKNOWN_INSTANT,
      to: UNKNOWN_INSTANT,
    });
    assert.deepEqual(open?.interval, { from: UNKNOWN_INSTANT, to: null });
    assert.equal(
      JSON.stringify(loaded).includes(new Date().toISOString().slice(0, 10)),
      false,
    );
  } finally {
    store.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("v0 supersede chains migrate into intervals with unknown boundaries", async () => {
  const isolated = isolatedFile();
  const projectId = parseRuntimeId(PROJECT, "project");
  const v0 = new SqliteMemoryRepository({
    filename: isolated.filename,
    projectId,
  });
  const oldest: KnowledgeItem = {
    id: "k-white",
    proposition: "the house is white",
    kind: "fact",
    tags: ["house"],
    scope: ["local"],
    canonicalStatus: "superseded",
    supersededBy: "k-green",
    activationStatus: "dormant",
    relevanceScore: 0.2,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.4,
    confidence: 0.5,
    sourceBacked: false,
    provenance: [],
    revision: 1,
  };
  const current: KnowledgeItem = {
    ...oldest,
    id: "k-green",
    proposition: "the house is green",
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "active",
    relevanceScore: 0.8,
    revision: 2,
  };
  try {
    await v0.transact((transaction) => {
      transaction.insert(oldest);
      transaction.insert(current);
    });
  } finally {
    v0.close();
  }

  const store = new SqliteKnowledgeStore({
    filename: isolated.filename,
    projectId,
  });
  try {
    const result = store.migrateV0SupersedeChains();
    assert.equal(result.skipped, false);
    assert.equal(result.chainsMigrated, 1);
    const snapshot = store.load();
    assert.equal(snapshot.state.bindings.length, 2);
    const closed = snapshot.state.bindings.find(
      (binding) =>
        binding.kind === "attribute" && binding.value === "the house is white",
    );
    const open = snapshot.state.bindings.find(
      (binding) =>
        binding.kind === "attribute" && binding.value === "the house is green",
    );
    assert.deepEqual(closed?.interval.from, UNKNOWN_INSTANT);
    assert.deepEqual(closed?.interval.to, UNKNOWN_INSTANT);
    assert.deepEqual(open?.interval.from, UNKNOWN_INSTANT);
    assert.equal(open?.interval.to, null);
    assert.equal(
      snapshot.state.bindings.some(
        (binding) =>
          "canonicalStatus" in binding ||
          "activationStatus" in binding ||
          "supersededBy" in binding,
      ),
      false,
    );
    const again = store.migrateV0SupersedeChains();
    assert.equal(again.skipped, true);
  } finally {
    store.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
