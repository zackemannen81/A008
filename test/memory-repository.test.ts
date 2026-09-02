import assert from "node:assert/strict";
import test from "node:test";
import { MemoryError } from "../src/memory/errors.js";
import { InMemoryMemoryRepository } from "../src/memory/in-memory-repository.js";
import type { KnowledgeItem } from "../src/memory/types.js";

function item(
  id: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    proposition: `proposition ${id}`,
    kind: "decision",
    tags: ["memory"],
    scope: ["core"],
    canonicalStatus: "current",
    supersededBy: null,
    activationStatus: "active",
    relevanceScore: 0.8,
    activationThreshold: 0.5,
    keepAlive: false,
    authority: 0.8,
    confidence: 0.9,
    sourceBacked: true,
    provenance: [{ sourceId: `source-${id}`, sourceType: "test" }],
    revision: 1,
    ...overrides,
  };
}

test("repository rejects duplicate initial IDs", () => {
  assert.throws(
    () => new InMemoryMemoryRepository([item("k1"), item("k1")]),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "duplicate_id",
  );
});

test("repository rolls back canonical and audit state when commit validation fails", async () => {
  const repository = new InMemoryMemoryRepository([item("k1")]);

  await assert.rejects(
    () =>
      repository.transact((transaction) => {
        const existing = transaction.get("k1")!;
        transaction.replace({
          ...existing,
          canonicalStatus: "superseded",
          supersededBy: "missing-successor",
          activationStatus: "dormant",
          revision: 2,
        });
        transaction.appendAudit({
          type: "knowledge_superseded",
          knowledgeIds: ["k1", "missing-successor"],
          taskId: null,
          selectedKnowledgeIds: [],
          excludedCount: 0,
        });
      }),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "illegal_state",
  );

  const stored = await repository.read((view) => view.get("k1"));
  assert.deepEqual(stored, item("k1"));
  assert.deepEqual(await repository.readAudit(), []);
});

test("repository rejects supersede cycles", () => {
  assert.throws(
    () =>
      new InMemoryMemoryRepository([
        item("k1", {
          canonicalStatus: "superseded",
          supersededBy: "k2",
          activationStatus: "dormant",
        }),
        item("k2", {
          canonicalStatus: "superseded",
          supersededBy: "k1",
          activationStatus: "dormant",
        }),
      ]),
    (error: unknown) =>
      error instanceof MemoryError && error.code === "illegal_state",
  );
});

test("repository serializes concurrent transactions without lost updates", async () => {
  const repository = new InMemoryMemoryRepository([item("k1")]);

  await Promise.all([
    repository.transact(async (transaction) => {
      const existing = transaction.get("k1")!;
      await Promise.resolve();
      transaction.replace({
        ...existing,
        relevanceScore: existing.relevanceScore + 0.05,
        revision: existing.revision + 1,
      });
    }),
    repository.transact((transaction) => {
      const existing = transaction.get("k1")!;
      transaction.replace({
        ...existing,
        relevanceScore: existing.relevanceScore + 0.05,
        revision: existing.revision + 1,
      });
    }),
  ]);

  const stored = await repository.read((view) => view.get("k1"));
  assert.ok(Math.abs((stored?.relevanceScore ?? 0) - 0.9) < 1e-12);
  assert.equal(stored?.revision, 3);
});

test("read views return defensive copies", async () => {
  const repository = new InMemoryMemoryRepository([item("k1")]);
  const read = await repository.read((view) => view.get("k1"));
  assert.ok(read);
  (read.tags as string[]).push("mutated-outside");

  const stored = await repository.read((view) => view.get("k1"));
  assert.deepEqual(stored?.tags, ["memory"]);
});
