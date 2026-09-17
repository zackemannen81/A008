// A008-0101: synthetic local SQLite only. Build first with npm run build.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import Database from "better-sqlite3";
import {
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../dist/src/memory/knowledge/sqlite-context.js";
import { atomicKnowledge } from "../dist/src/memory/knowledge/knowledge-transaction.js";

const directory = mkdtempSync(join(tmpdir(), "a008-persistence-benchmark-"));
const samples = 20;
const warmup = 3;
const results = [];
try {
  for (const size of [100, 1000, 10000]) {
    for (const mode of ["bulk", "incremental"]) {
      const filename = join(directory, `${size}-${mode}.sqlite`);
      const database = new Database(filename);
      const handle = createSqliteKnowledgeContext({
        filename,
        projectId: sqliteKnowledgeTestProjectId(),
        database,
      });
      try {
        atomicKnowledge(handle.context, () => {
          for (let i = 0; i < size; i++) {
            handle.context.entities.register({
              id: `entity-${i}`,
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
        // Compare both serialization strategies through the same transaction and
        // snapshot capture path. Bulk is a reference, not the old executable.
        if (mode === "bulk")
          handle.store.updateNamespace = (_before, after) =>
            handle.store.replaceNamespace(after);
        const changes = () =>
          database.prepare("SELECT total_changes() AS n").get().n;
        const elapsed = [];
        const mutations = [];
        for (let i = 0; i < samples + warmup; i++) {
          const before = changes();
          const start = performance.now();
          handle.context.lifecycle.reinforceOccurrence({
            occurrenceId: `turn-${i}`,
            evidenceId: "claim-0",
            at: new Date(
              Date.parse("2026-01-02T00:00:00.000Z") + i * 60000,
            ).toISOString(),
            support: { utteranceId: "fixture-source", start: 0, end: 1 },
          });
          const duration = performance.now() - start;
          const count = changes() - before;
          if (mode === "incremental") assert.equal(count, 4);
          if (i >= warmup) {
            elapsed.push(duration);
            mutations.push(count);
          }
        }
        elapsed.sort((a, b) => a - b);
        const percentile = (p) =>
          Number(elapsed[Math.ceil(p * samples) - 1].toFixed(2));
        results.push({
          size,
          mode,
          samples,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
          mutationsMin: Math.min(...mutations),
          mutationsMax: Math.max(...mutations),
          journal: database.pragma("journal_mode", { simple: true }),
          synchronous: database.pragma("synchronous", { simple: true }),
          sqlite: database.prepare("SELECT sqlite_version() AS v").get().v,
        });
      } finally {
        handle.close();
        database.close();
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        warmup,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
