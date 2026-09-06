import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import test from "node:test";
import { A008AcpAgent } from "../src/acp/A008-acp-agent.js";
import {
  createSpawnedAcpBridge,
  type AcpBridge,
} from "../src/gui-host/acp-bridge.js";
import { startGuiHost } from "../src/gui-host/server.js";
import {
  asEntityId,
  createKnowledgeContext,
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../src/memory/knowledge/index.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import {
  inspectKnowledge,
  parseMemoryInspectionQuery,
} from "../src/memory/knowledge/inspection.js";
import { RelationIndex } from "../src/memory/knowledge/expand.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import { isolatedMemoryEnv, memoryAwareFakeTransport } from "./helpers.js";

const identity = { projectId: "inspection-test-project", durable: false };

test("inventory includes dormant evidence, labels and actual provenance without mutating SQLite", () => {
  const handle = createSqliteKnowledgeContext({
    filename: ":memory:",
    projectId: sqliteKnowledgeTestProjectId(),
  });
  try {
    const stored = ingest(
      {
        content: "An image description.",
        speaker: "model",
        relation: "derived_from",
        locator: "test:image",
        scope: { verified: true, tags: [] },
      },
      { store: handle.context.evidence },
    );
    const utterance = stored.utterances[0]!;
    handle.context.labels.attach({
      recordId: utterance.id,
      recordKind: "utterance",
      tags: ["Image"],
      domains: ["Computer Vision"],
    });
    handle.context.lifecycle.attach({
      evidenceId: utterance.id,
      evidenceKind: "utterance",
      strength: 0.1,
      threshold: 0.5,
    });
    const before = handle.store.load();
    const result = inspectKnowledge(handle.context, identity);
    assert.deepEqual(handle.store.load(), before);
    assert.equal(result.summary.counts.utterance, 1);
    assert.equal(result.summary.counts.artifact, 1);
    assert.equal(result.summary.dormant, 1);
    assert.deepEqual(result.summary.domains, [
      { name: "computer vision", count: 1 },
    ]);
    assert.ok(
      result.graph.edges.some((edge) => edge.relation === "derived_from"),
    );
    assert.equal(
      result.graph.edges.some((edge) => edge.relation === "appears_in"),
      false,
      "an image description did not appear in the image",
    );
    const filtered = inspectKnowledge(handle.context, identity, {
      domain: "  COMPUTER   VISION ",
      status: "dormant",
      kind: "utterance",
      query: "description",
    });
    assert.equal(filtered.matched, 1);
    assert.equal(filtered.records[0]?.sourceId, utterance.id);
    assert.equal(
      inspectKnowledge(handle.context, identity, { query: "does-not-exist" })
        .matched,
      0,
    );
    (result.records[0]!.tags as string[]).push("tampered");
    assert.deepEqual(
      handle.store.load(),
      before,
      "returned values must not reference canonical containers",
    );
  } finally {
    handle.close();
  }
});

test("state and history have stable distinct identities and no evidence activation", () => {
  const context = createKnowledgeContext();
  const entity = asEntityId("inspection-entity");
  context.entities.register({ id: entity, type: "project", labels: ["Atlas"] });
  const slot = { kind: "attribute" as const, entity, name: "status" };
  context.slots.register({
    ref: slot,
    cardinality: "single",
    valueType: "text",
  });
  const base = {
    kind: "attribute" as const,
    slot,
    label: "Atlas status",
    causedBy: "test",
    claimId: "claim-status",
  };
  context.state.hydrate(
    {
      bindings: [
        {
          ...base,
          value: "planned",
          interval: { from: { unknown: true }, to: "2026-01-01" },
        },
        { ...base, value: "ready", interval: { from: "2026-01-01", to: null } },
      ],
      claims: [],
      events: [],
      transitions: [],
      corrections: [],
      contestedSlotKeys: [],
    },
    0,
  );
  const result = inspectKnowledge(context, identity);
  assert.equal(result.summary.counts.state, 1);
  assert.equal(result.summary.counts.history, 1);
  const current = result.records.find((record) => record.kind === "state")!;
  const history = result.records.find((record) => record.kind === "history")!;
  assert.notEqual(current.id, history.id);
  assert.equal(current.activation, "untracked");
  assert.match(history.detail, /"unknown": true/u);
  assert.equal(
    result.graph.edges.filter((edge) => edge.from === `entity:${entity}`)
      .length,
    2,
  );
});

test("pagination and graph caps preserve stable pages and only known endpoints", () => {
  const context = createKnowledgeContext();
  for (let i = 0; i < 120; i += 1) {
    const id = asEntityId(`inspection-${i}`);
    context.entities.register({
      id,
      type: "test",
      labels: [`Entity ${String(i).padStart(3, "0")}`],
    });
    if (i > 0)
      (context.relations as RelationIndex).link(
        `inspection-${i - 1}`,
        id,
        "stored_link",
      );
  }
  const a = inspectKnowledge(context, identity, { limit: 25 });
  const b = inspectKnowledge(context, identity, { limit: 25, offset: 25 });
  assert.equal(a.matched, 120);
  assert.equal(a.records.length, 25);
  assert.equal(b.records.length, 25);
  assert.equal(
    a.records.some((record) => b.records.some((next) => next.id === record.id)),
    false,
  );
  assert.equal(a.graph.nodes.length, 80);
  assert.equal(a.graph.totalNodes, 120);
  assert.equal(a.graph.totalEdges, 119);
  const ids = new Set(a.graph.nodes.map((node) => node.id));
  assert.ok(
    a.graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)),
  );
  assert.deepEqual(a, inspectKnowledge(context, identity, { limit: 25 }));
});

test("inspection refuses malformed and unbounded input before reading", async () => {
  for (const value of [
    null,
    [],
    { limit: 0 },
    { limit: 101 },
    { limit: "4" },
    { offset: -1 },
    { offset: 1.2 },
    { offset: 1_000_001 },
    { query: "x".repeat(301) },
    { kind: "made-up" },
    { projectId: "other-project" },
  ])
    assert.throws(() => parseMemoryInspectionQuery(value), /./u);
  let calls = 0;
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("no session needed");
    },
    inspectMemory: () => {
      calls += 1;
      return inspectKnowledge(createKnowledgeContext(), identity);
    },
  });
  await assert.rejects(agent.inspectMemory({ limit: 500 }));
  assert.equal(calls, 0);
  await agent.inspectMemory({});
  assert.equal(calls, 1);
  const older = new A008AcpAgent({
    createSession: () => {
      throw new Error("unused");
    },
  });
  await assert.rejects(older.inspectMemory({}));
});

test("search reaches text beyond the display cap and reports truncation honestly", () => {
  const context = createKnowledgeContext();
  ingest(
    {
      content: `${"x".repeat(17_000)} end-of-document-marker`,
      speaker: "fixture",
      scope: { verified: true, tags: [] },
    },
    { store: context.evidence },
  );
  const result = inspectKnowledge(context, identity, {
    kind: "utterance",
    query: "end-of-document-marker",
  });
  assert.equal(result.matched, 1);
  assert.equal(result.records[0]?.truncated, true);
  assert.equal(result.records[0]?.detail.length, 16_000);
  assert.equal(
    result.records[0]?.detail.includes("end-of-document-marker"),
    false,
  );
});

test("runtime inspection does not invoke transport and refuses a closed runtime", () => {
  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: () => {
      throw new Error("inspection must not call a model");
    },
  });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const stored = runtime.writeSharedMemory({
      content: "Inspection fixture.",
    });
    const result = runtime.inspectMemory({ kind: "utterance" });
    assert.equal(result.records[0]?.sourceId, stored.id);
    assert.equal(result.durable, true);
    assert.equal(transport.requests.length, 0);
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
  assert.throws(() => runtime.inspectMemory(), /closed/u);
});

test("real HTTP to ACP inspection sees the actual store without a chat or provider endpoint", async () => {
  const isolated = isolatedMemoryEnv({
    NVIDIA_API_KEY: "inspection-secret-sentinel",
    NVIDIA_CHAT_COMPLETIONS_URL: "http://127.0.0.1:1/never-call",
  });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () =>
      memoryAwareFakeTransport({
        chat: () => {
          throw new Error("unused");
        },
      }),
  });
  runtime.writeSharedMemory({
    content: "Inspection test record inspection-secret-sentinel",
  });
  runtime.close();
  const host = await startGuiHost({
    env: isolated.env,
    port: 0,
    host: "127.0.0.1",
    cwd: process.cwd(),
    createAcpBridge: () =>
      createSpawnedAcpBridge({ env: isolated.env, cwd: process.cwd() }),
  });
  const url = `http://127.0.0.1:${host.port}/v1/memory`;
  try {
    const response = await fetch(`${url}?kind=utterance`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const raw = await response.text();
    assert.equal(raw.includes("inspection-secret-sentinel"), false);
    const body = JSON.parse(raw);
    assert.equal(body.protocol, "A008_MEMORY_INSPECT_V1");
    assert.equal(body.matched, 1);
    assert.match(body.records[0].label, /Inspection test record/u);
    assert.equal(
      (await fetch(url, { headers: { origin: "https://untrusted.example" } }))
        .status,
      403,
    );
    assert.equal((await fetch(`${url}?limit=101`)).status, 400);
    assert.equal((await fetch(`${url}?limit=1&limit=2`)).status, 400);
    assert.equal((await fetch(`${url}?offset=`)).status, 400);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
  } finally {
    await host.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("an older bridge reports memory as unavailable rather than an empty store", async () => {
  const bridge = { async close() {} } as AcpBridge;
  const host = await startGuiHost({
    port: 0,
    env: {},
    createAcpBridge: () => bridge,
  });
  try {
    const result = await fetch(`http://127.0.0.1:${host.port}/v1/memory`);
    assert.equal(result.status, 503);
  } finally {
    await host.close();
  }
});
