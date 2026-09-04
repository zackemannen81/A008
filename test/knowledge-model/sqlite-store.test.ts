import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseRuntimeId } from "../../src/identity/runtime-id.js";
import { SqliteMemoryRepository } from "../../src/memory/sqlite-memory-repository.js";
import type { KnowledgeItem } from "../../src/memory/types.js";
import {
  SqliteKnowledgeStore,
  UNKNOWN_INSTANT,
  sqliteKnowledgeTestProjectId,
} from "../../src/memory/knowledge/index.js";

const PROJECT = sqliteKnowledgeTestProjectId();

function isolatedFile(): { readonly directory: string; readonly filename: string } {
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
            slot: { kind: "attribute", entity: "house" as never, name: "color" },
            value: "white",
            label: "white",
            interval: { from: UNKNOWN_INSTANT, to: UNKNOWN_INSTANT },
            causedBy: "migrated:old",
            claimId: "claim-old",
          },
          {
            kind: "attribute",
            slot: { kind: "attribute", entity: "house" as never, name: "color" },
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
    assert.deepEqual(closed?.interval, { from: UNKNOWN_INSTANT, to: UNKNOWN_INSTANT });
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
