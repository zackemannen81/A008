import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import {
  EMPTY_LABELS,
  KnowledgeLabelStore,
  normalizeLabel,
} from "../src/memory/knowledge/labels.js";
import { KnowledgeModelError } from "../src/memory/knowledge/errors.js";
import { SqliteKnowledgeStore } from "../src/memory/knowledge/index.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import {
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  TEST_PROJECT_ID,
} from "./helpers.js";

const HORSE = "Zorros häst heter Fresca";
const HORSE_PROPOSITION = "Zorros häst heter Fresca";
import {
  createKnowledgeContext,
  readKnowledge,
} from "../src/memory/knowledge/read.js";
import { KnowledgeMemoryReader } from "../src/memory/knowledge/live-reader.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import { asEntityId } from "../src/memory/knowledge/ids.js";
import { RelationIndex } from "../src/memory/knowledge/expand.js";
import {
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../src/memory/knowledge/sqlite-context.js";
import { KNOWLEDGE_SQLITE_SCHEMA } from "../src/memory/knowledge/sqlite-schema.js";
import type { KnowledgeReadContext } from "../src/memory/knowledge/read-types.js";
import type { MemoryReadRequest } from "../src/memory/retrieval-types.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../src/identity/types.js";

// --- the store -------------------------------------------------------------

test("labels are normalised on both sides of every comparison", () => {
  // `Cognitive Science`, `cognitive science` and `Cognitive  Science` are one
  // subject area written three ways. Unnormalised they are three set members,
  // and a set intersection that misses on a capital letter reads as a topic
  // change rather than as a bug.
  assert.equal(normalizeLabel("  Cognitive   Science "), "cognitive science");

  const store = new KnowledgeLabelStore();
  store.attach({
    recordId: "u1",
    recordKind: "utterance",
    domains: ["Cognitive  Science"],
  });
  assert.deepEqual(store.matching({ domains: ["cognitive science"] }), ["u1"]);
  assert.deepEqual(store.matching({ domains: ["COGNITIVE SCIENCE"] }), ["u1"]);
});

test("attaching twice merges instead of replacing", () => {
  // A claim reinforced by a second utterance keeps what it could already be
  // found by. Replacing would silently narrow it whenever a later extraction
  // phrased the subject differently.
  const store = new KnowledgeLabelStore();
  store.attach({
    recordId: "c1",
    recordKind: "claim",
    tags: ["sömn"],
    domains: ["neurologi"],
  });
  store.attach({
    recordId: "c1",
    recordKind: "claim",
    tags: ["konsolidering"],
  });

  assert.deepEqual(store.labelsFor("c1"), {
    tags: ["sömn", "konsolidering"],
    domains: ["neurologi"],
  });
  assert.deepEqual(store.matching({ tags: ["sömn"] }), ["c1"]);
  assert.deepEqual(store.matching({ domains: ["neurologi"] }), ["c1"]);
});

test("matching is a union across both axes, never an intersection", () => {
  // Tag and domain are alternative routes to the same record. Requiring both
  // would disable the broader signal exactly when it is needed, which is when
  // the message does not name the record's tags.
  const store = new KnowledgeLabelStore();
  store.attach({
    recordId: "a",
    recordKind: "claim",
    tags: ["hippocampus"],
    domains: ["neurologi"],
  });
  store.attach({
    recordId: "b",
    recordKind: "claim",
    tags: ["motor"],
    domains: ["fordonsteknik"],
  });

  assert.deepEqual(store.matching({ tags: ["hippocampus"], domains: [] }), [
    "a",
  ]);
  assert.deepEqual(store.matching({ tags: [], domains: ["fordonsteknik"] }), [
    "b",
  ]);
  assert.deepEqual(
    [...store.matching({ tags: ["motor"], domains: ["neurologi"] })].sort(),
    ["a", "b"],
  );
});

test("an unlabelled record reads as unlabelled, not as an error", () => {
  const store = new KnowledgeLabelStore();
  assert.deepEqual(store.labelsFor("missing"), EMPTY_LABELS);
  assert.equal(store.get("missing"), undefined);
  assert.deepEqual(store.matching({ tags: ["anything"] }), []);
});

test("blank and duplicate labels are dropped, bad ones refused", () => {
  const store = new KnowledgeLabelStore();
  const stored = store.attach({
    recordId: "u1",
    recordKind: "utterance",
    tags: ["  sömn ", "sömn", "SÖMN", "", "   "],
  });
  assert.deepEqual(stored.tags, ["sömn"]);

  assert.throws(
    () => store.attach({ recordId: "", recordKind: "claim" }),
    KnowledgeModelError,
  );
  assert.throws(
    () => store.attach({ recordId: "x", recordKind: "binding" as never }),
    KnowledgeModelError,
  );
  assert.throws(
    () =>
      store.attach({ recordId: "x", recordKind: "claim", tags: [7] as never }),
    KnowledgeModelError,
  );
});

test("the vocabulary is what a classifier can be seeded with", () => {
  // The two provider calls have to share one taxonomy. Observed in the owner's
  // own trace: the retrieval step answered in English and the extraction step
  // in Swedish, and those sets never intersect.
  const store = new KnowledgeLabelStore();
  store.attach({
    recordId: "a",
    recordKind: "claim",
    tags: ["Sömn"],
    domains: ["Neurologi"],
  });
  store.attach({
    recordId: "b",
    recordKind: "claim",
    tags: ["motor"],
    domains: ["neurologi"],
  });
  assert.deepEqual(store.vocabulary(), {
    tags: ["motor", "sömn"],
    domains: ["neurologi"],
  });
});

test("hydrate replaces the whole set and rebuilds the index", () => {
  const store = new KnowledgeLabelStore();
  store.attach({ recordId: "old", recordKind: "claim", domains: ["gone"] });
  store.hydrate([
    { recordId: "new", recordKind: "utterance", tags: ["t"], domains: ["d"] },
  ]);
  assert.deepEqual(store.matching({ domains: ["gone"] }), []);
  assert.deepEqual(store.matching({ domains: ["d"] }), ["new"]);
  assert.equal(store.list().length, 1);
});

// --- the read path ---------------------------------------------------------

function labelledWorld(): KnowledgeReadContext {
  const context = createKnowledgeContext();
  const facts = [
    {
      content:
        "Hippocampus fungerar som en växelstation för nya medvetna minnen",
      // "minneslagring" appears nowhere in the sentence. A tag that is also in
      // the text would be found by the direct lexical channel and prove nothing
      // about the label channel.
      tags: ["hippocampus", "minneslagring"],
      domains: ["neurologi"],
    },
    {
      content: "Porsche 911 GT3 har en sugmotor på 4,0 liter",
      tags: ["motor"],
      domains: ["fordonsteknik"],
    },
  ];
  for (const fact of facts) {
    const result = ingest(
      {
        content: fact.content,
        speaker: "assistant",
        locator: "turn:x",
        scope: { verified: true },
      },
      { store: context.evidence },
    );
    const utterance = result.utterances[0];
    assert.ok(utterance);
    context.labels.attach({
      recordId: utterance.id,
      recordKind: "utterance",
      tags: fact.tags,
      domains: fact.domains,
    });
  }
  return context;
}

function request(message: string): MemoryReadRequest {
  return {
    projectId:
      "A008_v1_project_40000000-0000-4000-8000-000000000001" as ProjectId,
    conversationId:
      "A008_v1_conversation_40000000-0000-4000-8000-000000000002" as ConversationId,
    taskId:
      "A008_v1_task_40000000-0000-4000-8000-000000000004" as RuntimeTaskId,
    agentId: "A008_v1_agent_40000000-0000-4000-8000-000000000003" as AgentId,
    message,
    applicabilityScopes: ["local"],
  };
}

test("a record carries its own labels, not a copy of the query", () => {
  // This is the defect that made every tag gate downstream vacuous: `retrieve()`
  // wrote `tags: [...scope.tags]`, so `filter()` compared the query with itself.
  const context = labelledWorld();
  const result = readKnowledge(
    {
      message: "Berätta om neurologi",
      verifiedScope: {
        verified: true,
        tags: ["a-tag-no-record-has"],
        domains: ["neurologi"],
      },
    },
    context,
  );
  const hippocampus = result.retrieved.find((record) =>
    record.label.includes("Hippocampus"),
  );
  assert.ok(hippocampus, "the neurology record was not retrieved at all");
  assert.deepEqual(hippocampus.tags, ["hippocampus", "minneslagring"]);
  assert.deepEqual(hippocampus.domains, ["neurologi"]);
  assert.ok(!hippocampus.tags.includes("a-tag-no-record-has"));
});

test("a domain match retrieves a record that shares no words with the question", async () => {
  // The whole point. "neurologi" appears in the question; "hippocampus",
  // "växelstation" and "minnen" do not.
  const reader = new KnowledgeMemoryReader({ context: labelledWorld() });
  const result = await reader.read(request("Vad säger neurologi om det här?"));
  const texts = result.projection.projection.items.map(
    (item) => item.proposition,
  );

  assert.ok(
    texts.some((text) => text.includes("Hippocampus")),
    `subject-area retrieval found nothing: ${JSON.stringify(texts)}`,
  );
  assert.ok(
    !texts.some((text) => text.includes("Porsche")),
    "an unrelated domain was returned",
  );
  assert.equal(result.evidence.channelCounts.domain, 1);
  assert.equal(result.evidence.channelCounts.tag, 0);
});

test("a tag match is counted on its own channel", async () => {
  const reader = new KnowledgeMemoryReader({ context: labelledWorld() });
  const result = await reader.read(request("Vad vet du om minneslagring?"));
  assert.equal(result.evidence.channelCounts.tag, 1);
  assert.ok(
    result.projection.projection.items.some((item) =>
      item.proposition.includes("Hippocampus"),
    ),
  );
});

test("a question matching no label returns nothing rather than everything", async () => {
  const reader = new KnowledgeMemoryReader({ context: labelledWorld() });
  const result = await reader.read(request("Vad är huvudstaden i Frankrike?"));
  assert.deepEqual(result.projection.projection.items, []);
});

test("records stored before labels existed are still retrievable", async () => {
  // An upgrade must not look like amnesia. Every record already in a live store
  // has neither tags nor domains, and a gate that treated unlabelled as
  // unmatched would hide all of it.
  const context = createKnowledgeContext();
  ingest(
    {
      content: "Rickard äger repot A008",
      speaker: "user",
      locator: "turn:1",
      scope: { verified: true },
    },
    { store: context.evidence },
  );
  const reader = new KnowledgeMemoryReader({ context });
  const result = await reader.read(request("Vem äger repot A008?"));
  assert.ok(
    result.projection.projection.items.some((item) =>
      item.proposition.includes("Rickard"),
    ),
    "an unlabelled record became unreachable",
  );
});

// --- entity labels ---------------------------------------------------------

test("a proposition's words do not become entity aliases", async () => {
  // `tokenize(proposition)` put every word of four characters or more into
  // `Entity.labels`, so "Zorros häst heter Fresca" made `heter` an alias of the
  // horse and "Vad heter du?" matched it. Lexical search terms are not semantic
  // identity; finding a record by the words in it is what labels are for.
  //
  // Asserted through the real commit path rather than by reading the source,
  // because what matters is the entity that gets written.
  const isolated = isolatedMemoryEnv();
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({
        chat: () => ({ content: "Noterat." }),
        analyze: (input) => {
          const raw = input as { readonly message?: unknown };
          if (raw.message !== HORSE) {
            return [];
          }
          return [
            {
              severity: "important",
              proposition: HORSE_PROPOSITION,
              kind: "fact",
              tags: ["häst"],
              domains: ["ryttarsport"],
              entities: ["Fresca"],
              confidence: 0.99,
            },
          ];
        },
        classify: () => ({ type: "new" }),
      }),
  });
  try {
    const session = runtime.openSession();
    await session.turn(HORSE);

    const store = new SqliteKnowledgeStore({
      filename: isolated.sqlitePath,
      projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
    });
    try {
      const snapshot = store.load();
      // Both records are labelled on purpose. The claim is what a dialogue turn
      // is usually found by, but an ingested source may have no accepted claim
      // at all — its utterance is the record, and unlabelled it would be
      // unreachable by subject area.
      const kinds = snapshot.labels.map((record) => record.recordKind).sort();
      assert.deepEqual(kinds, ["claim", "utterance"]);
      for (const record of snapshot.labels) {
        assert.deepEqual(record.domains, ["ryttarsport"]);
        assert.deepEqual(record.tags, ["häst"]);
      }

      const labels = snapshot.entities.flatMap((entity) => entity.labels);
      assert.ok(labels.length > 0, "no entity was written at all");
      for (const word of ["heter", "zorros", "häst"]) {
        assert.ok(
          !labels.includes(word),
          `"${word}" is an entity alias again: ${JSON.stringify(labels)}`,
        );
      }
    } finally {
      store.close();
    }
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("a label match survives a message that also names an entity", () => {
  // `taskApplies` requires an associative record to mention one of the message's
  // entities. That gate is right for a relation hop and wrong for a subject-area
  // hit, which is by definition a record the message does not name. Two gates in
  // series, each reasonable alone, is how the projection came to discard
  // everything but state.
  //
  // The escape only fires when the message has entities at all, so the message
  // here names one — and the record it retrieves is a different one.
  const context = labelledWorld();
  const result = readKnowledge(
    {
      message: 'Vad vet du om "Porsche" och neurologi?',
      verifiedScope: {
        verified: true,
        tags: [],
        domains: ["neurologi"],
        entities: ["porsche"],
      },
    },
    context,
  );
  assert.ok(
    result.filtered.admitted.some((record) =>
      record.label.includes("Hippocampus"),
    ),
    "a subject-area match was filtered out for not naming the message's entity",
  );
});

test("an unlabelled record reached associatively is not filtered away", () => {
  // Every record already in a live store has no labels. `labelsApply` sees a
  // query that has labels and a record that has none, and must read that as
  // unlabelled rather than as unmatched — otherwise the upgrade looks like
  // amnesia for exactly the records that predate it.
  //
  // The record has to arrive associatively for the gate to be reached at all: a
  // direct match short-circuits it. So this one comes in over a relation hop,
  // which is how a genuine pre-label record reaches a modern query.
  const context = labelledWorld();
  const legacy = ingest(
    {
      content: "Fasaden målades om förra sommaren",
      speaker: "user",
      locator: "turn:legacy",
      scope: { verified: true },
    },
    { store: context.evidence },
  );
  const utterance = legacy.utterances[0];
  assert.ok(utterance);
  context.entities.register({
    id: asEntityId("brittans_hus"),
    type: "house",
    labels: ["brittans_hus", "huset"],
  });
  (context.relations as RelationIndex).link(
    "brittans_hus",
    utterance.id,
    "about",
  );
  assert.deepEqual(context.labels.labelsFor(utterance.id), EMPTY_LABELS);

  const result = readKnowledge(
    {
      message: "Berätta om huset",
      verifiedScope: {
        verified: true,
        tags: ["sömn"],
        domains: ["neurologi"],
        entities: ["huset"],
      },
    },
    context,
  );

  const reached = result.expanded.records.find(
    (record) => record.label === "Fasaden målades om förra sommaren",
  );
  assert.ok(reached, "the relation hop did not reach the unlabelled record");
  assert.equal(reached.matchKind, "associative");
  assert.deepEqual(reached.tags, []);
  assert.deepEqual(reached.domains, []);

  // Asserted on the reason, not on admission. `taskApplies` is a separate and
  // older gate that drops an expanded record whose text names none of the
  // message's entities, and it drops this one. That is pre-existing behaviour
  // and is not what this case is about; what matters here is that the label
  // gate did not also reject it for having no labels.
  const missed = result.filtered.omitted.filter(
    (entry) =>
      entry.reason === "label_miss" &&
      entry.record.label === "Fasaden målades om förra sommaren",
  );
  assert.deepEqual(
    missed,
    [],
    "an unlabelled record was rejected as a label miss because the query had labels",
  );
});

test("a very short label does not match every message containing it", () => {
  // The message is matched against the store's vocabulary by containment, and a
  // one- or two-character label would appear inside half the words in a
  // sentence. That is the `heter` failure in another costume.
  const context = createKnowledgeContext();
  const stored = ingest(
    {
      content: "Kubernetes kör containrar",
      speaker: "assistant",
      locator: "turn:1",
      scope: { verified: true },
    },
    { store: context.evidence },
  );
  const utterance = stored.utterances[0];
  assert.ok(utterance);
  context.labels.attach({
    recordId: utterance.id,
    recordKind: "utterance",
    domains: ["k8"],
  });

  const reader = new KnowledgeMemoryReader({ context });
  return reader
    .read(request("Vad kostar en k8-kompatibel switch?"))
    .then((result) => {
      assert.deepEqual(
        result.projection.projection.items,
        [],
        "a two-character label matched a substring",
      );
    });
});

// --- persistence -----------------------------------------------------------

test("labels survive a SQLite round trip", () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-labels-"));
  const filename = join(directory, "knowledge.sqlite");
  try {
    const first = createSqliteKnowledgeContext({
      filename,
      projectId: sqliteKnowledgeTestProjectId(),
    });
    const result = ingest(
      {
        content: "Sömn flyttar minnen till permanent lagring",
        speaker: "assistant",
        locator: "turn:1",
        scope: { verified: true },
      },
      { store: first.context.evidence },
    );
    const utterance = result.utterances[0];
    assert.ok(utterance);
    first.context.labels.attach({
      recordId: utterance.id,
      recordKind: "utterance",
      tags: ["sömn"],
      domains: ["neurologi"],
    });
    first.close();

    const second = createSqliteKnowledgeContext({
      filename,
      projectId: sqliteKnowledgeTestProjectId(),
    });
    try {
      assert.deepEqual(second.context.labels.labelsFor(utterance.id), {
        tags: ["sömn"],
        domains: ["neurologi"],
      });
      assert.deepEqual(
        second.context.labels.matching({ domains: ["neurologi"] }),
        [utterance.id],
      );
    } finally {
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a version 1 database opens and is migrated, not refused", () => {
  // Schema 2 adds tables and changes nothing else. `INSERT OR IGNORE` leaves an
  // existing file stamped 1, so without a migration the version check would
  // refuse to open a store that is in fact perfectly readable — turning an
  // additive change into a lost memory file.
  const directory = mkdtempSync(join(tmpdir(), "a008-migrate-"));
  const filename = join(directory, "knowledge.sqlite");
  try {
    const raw = new Database(filename);
    raw.exec(KNOWLEDGE_SQLITE_SCHEMA);
    raw
      .prepare(
        "UPDATE A008_knowledge_schema SET version = 1 WHERE singleton = 1",
      )
      .run();
    raw.exec("DROP TABLE A008_knowledge_labels");
    raw.exec("DROP TABLE A008_knowledge_label_index");
    raw.close();

    const handle = createSqliteKnowledgeContext({
      filename,
      projectId: sqliteKnowledgeTestProjectId(),
    });
    try {
      assert.equal(handle.store.schemaVersion, 5);
      assert.deepEqual(handle.context.labels.list(), []);
      handle.context.labels.attach({
        recordId: "u1",
        recordKind: "utterance",
        domains: ["neurologi"],
      });
      assert.deepEqual(
        handle.context.labels.matching({ domains: ["neurologi"] }),
        ["u1"],
      );
    } finally {
      handle.close();
    }

    const check = new Database(filename, { readonly: true });
    try {
      const row = check
        .prepare(
          "SELECT version FROM A008_knowledge_schema WHERE singleton = 1",
        )
        .get() as { readonly version: number };
      assert.equal(row.version, 5);
    } finally {
      check.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// --- statement slots are a set (A008-0062) ---------------------------------

test("many unstructured statements about one entity coexist without entity-first slot ownership", async () => {
  // Three facts name the same extracted entity. A008-0122 makes `entities[]`
  // referential only: array position cannot choose state ownership. Because
  // these proposals have no structured proposition, each gets a statement-
  // specific fallback slot while deterministic claim→Zorro references preserve
  // the shared graph anchor. No false conflict is introduced.
  const facts = [
    "Zorros häst heter Fresca",
    "Zorro bor i Kalifornien",
    "Zorro bär alltid svart mask",
  ];
  const isolated = isolatedMemoryEnv();
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({
        chat: () => ({ content: "Noterat." }),
        analyze: (input) => {
          const raw = input as { readonly message?: unknown };
          if (
            typeof raw.message !== "string" ||
            !raw.message.includes("Fresca")
          ) {
            return [];
          }
          return facts.map((proposition) => ({
            severity: "important",
            proposition,
            kind: "fact",
            tags: ["zorro"],
            domains: ["fiktion"],
            // One shared graph referent on every proposal; it must not become slot ownership.
            entities: ["Zorro"],
            confidence: 0.9,
          }));
        },
        classify: () => ({ type: "new" }),
      }),
  });
  try {
    const session = runtime.openSession();
    const turn = await session.turn(`${facts.join(". ")}.`);

    assert.equal(turn.postOutput.status, "completed");
    assert.equal(turn.memoryDiagnostic, undefined);
    assert.equal(turn.postOutput.records?.length, facts.length);

    const store = new SqliteKnowledgeStore({
      filename: isolated.sqlitePath,
      projectId: parseRuntimeId(TEST_PROJECT_ID, "project"),
    });
    try {
      const snapshot = store.load();
      assert.deepEqual(snapshot.state.contestedSlotKeys, []);
      const open = snapshot.state.bindings.filter(
        (binding) => binding.interval.to === null,
      );
      assert.equal(open.length, facts.length, "a statement was lost");
      const slots = new Set(
        open.map((binding) =>
          binding.slot.kind === "attribute"
            ? `${binding.slot.entity}.${binding.slot.name}`
            : "relation",
        ),
      );
      assert.equal(
        slots.size,
        facts.length,
        "unstructured facts were conflated onto one owner slot",
      );
      assert.ok(
        [...slots].every((name) =>
          /^statement_[0-9a-f]{12}\.statement$/u.test(name),
        ),
        `unexpected fallback slots: ${[...slots].join(", ")}`,
      );
      const references = snapshot.entityReferences ?? [];
      assert.equal(references.length, facts.length);
      assert.deepEqual(
        new Set(references.map((reference) => String(reference.entityId))),
        new Set(["zorro"]),
      );
      const statementSlots = snapshot.slots.filter(
        (slot) =>
          slot.ref.kind === "attribute" && slot.ref.name === "statement",
      );
      assert.equal(statementSlots.length, facts.length);
      assert.ok(statementSlots.every((slot) => slot.cardinality === "set"));
      assert.equal(
        snapshot.slots.filter((slot) => slot.cardinality === "single").length,
        0,
        "a slot was left single-valued",
      );
    } finally {
      store.close();
    }
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("a statement slot registered as single is widened, not left to conflict", () => {
  // A slot definition is durable, so every store that already exists carries
  // the old cardinality. Leaving it would keep producing false conflicts
  // forever in exactly the stores that have the problem.
  const context = createKnowledgeContext();
  const ref = {
    kind: "attribute" as const,
    entity: asEntityId("zorro"),
    name: "statement",
  };
  context.slots.register({ ref, cardinality: "single", valueType: "string" });

  const widened = context.slots.widenToSet(ref);
  assert.equal(widened.cardinality, "set");
  assert.equal(context.slots.get(ref)?.cardinality, "set");

  // Idempotent, and it refuses a slot it does not know rather than inventing one.
  assert.equal(context.slots.widenToSet(ref).cardinality, "set");
  assert.throws(
    () =>
      context.slots.widenToSet({
        kind: "attribute",
        entity: asEntityId("nobody"),
        name: "statement",
      }),
    KnowledgeModelError,
  );
});
