import assert from "node:assert/strict";
import test from "node:test";
import {
  contextItemsForModel,
  knowledgeText,
  serializeContextProjection,
  Utf8ByteContextMeasurer,
} from "../src/memory/serialization.js";
import { projectionItems } from "../src/memory/knowledge/projection-items.js";
import { KnowledgeMemoryReader } from "../src/memory/knowledge/live-reader.js";
import { createKnowledgeContext } from "../src/memory/knowledge/read.js";
import { update } from "../src/memory/knowledge/update.js";
import { asEntityId } from "../src/memory/knowledge/ids.js";
import { DeterministicMemoryPromptComposer } from "../src/orchestration/memory-prompt-composer.js";
import { ModelBackedPostOutputKnowledgeAnalyzer } from "../src/orchestration/semantic-json-model.js";
import type { ProjectionPayload } from "../src/memory/knowledge/evidence-types.js";
import type {
  RetrievedRecord,
  SemanticScope,
} from "../src/memory/knowledge/read-types.js";
import type { ContextKnowledgeItem } from "../src/memory/types.js";
import type { MemoryReadRequest } from "../src/memory/retrieval-types.js";

const measurer = new Utf8ByteContextMeasurer();
const taskId = "A008_v1_task_20000000-0000-4000-8000-000000000004";
const open = { from: "2026-09-20T00:00:00.000Z", to: null } as const;
function payload(values: Partial<ProjectionPayload> = {}): ProjectionPayload {
  return {
    scope: { tags: [], entities: [], slots: [] },
    state: [],
    history: [],
    events: [],
    claims: [],
    utterances: [],
    artifacts: [],
    provenance: [],
    ...values,
  };
}
function scope(
  intents: SemanticScope["intents"] = ["current_state"],
): SemanticScope {
  return {
    tags: [],
    domains: [],
    entities: [],
    slots: [],
    intents,
    temporalHints: {
      currentOnly: true,
      mentionsPast: intents.includes("history"),
      mentionsFuture: false,
    },
  };
}
function state(slot: string, value: unknown) {
  return { slot, value, interval: open };
}
function claim(label: string) {
  return {
    label,
    proposition: {
      kind: "predicate" as const,
      name: "assertion",
      arguments: [label],
    },
    certainty: "certain" as const,
    attributedTo: "user",
    status: "asserted" as const,
    aboutInterval: open,
  };
}
function record(
  id: string,
  surface: RetrievedRecord["surface"],
  extra: Partial<RetrievedRecord> = {},
): RetrievedRecord {
  return {
    id,
    surface,
    label: id,
    matchKind: "direct",
    retrievalScore: 1,
    required: false,
    reasons: [],
    tags: [],
    domains: [],
    ...extra,
  };
}
function project(
  source: ProjectionPayload,
  options: Partial<Parameters<typeof projectionItems>[0]> = {},
) {
  return projectionItems({ taskId, payload: source, measurer, ...options });
}

test("model envelope sends only ID/address and one string; metadata stays internal", () => {
  const result = project(
    payload({ state: [state("task.status", "Complete")] }),
    {
      records: [
        record("state:task", "state", {
          evidenceId: "claim-original",
          slotLabel: "task.status",
          tags: ["private-tag"],
          domains: ["internal-domain"],
        }),
      ],
    },
  );
  assert.equal(result.items[0]?.evidenceId, "claim-original");
  assert.deepEqual(result.items[0]?.tags, ["private-tag"]);
  assert.deepEqual(contextItemsForModel(result.items), [
    {
      id: "state:task",
      semanticAddress: "task.status",
      currentState: "Complete",
    },
  ]);
  const serialized = serializeContextProjection({
    taskId,
    items: result.items,
  });
  for (const forbidden of [
    "evidenceId",
    "proposition",
    "authority",
    "kind",
    "tags",
    "domains",
    "scope",
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, forbidden);
  }
});

test("different semantic addresses retain equal values", () => {
  const result = project(
    payload({
      state: [
        state("task_a.status", "Complete"),
        state("task_b.status", "Complete"),
      ],
    }),
  );
  assert.equal(result.items.length, 2);
  assert.deepEqual(
    result.items.map((item) => item.semanticAddress),
    ["task_a.status", "task_b.status"],
  );
});

test("current state beats a competing claim only at its own address", () => {
  const result = project(
    payload({
      state: [state("task.status", "Complete")],
      claims: [claim("Task is ready"), claim("Other task is ready")],
    }),
    {
      records: [
        record("s", "state", { slotLabel: "task.status" }),
        record("c", "claim", { slotLabel: "task.status" }),
        record("other", "claim", { slotLabel: "other.status" }),
      ],
    },
  );
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["s", "other"],
  );
  assert.deepEqual(
    result.deduplicated.map((item) => item.id),
    ["c"],
  );
});

test("latest applicable claim replaces older claim without turning into state", () => {
  const earlier = {
    ...claim("Earlier assertion"),
    aboutInterval: { ...open, from: "2026-09-19T00:00:00.000Z" },
  };
  const result = project(
    payload({ claims: [earlier, claim("Latest assertion")] }),
    {
      records: [
        record("old", "claim", { slotLabel: "item.status" }),
        record("new", "claim", { slotLabel: "item.status" }),
      ],
    },
  );
  assert.deepEqual(contextItemsForModel(result.items), [
    { id: "new", semanticAddress: "item.status", claim: "Latest assertion" },
  ]);
});

test("null/false/zero and empty containers remain actual state content", () => {
  for (const [value, expected] of [
    [null, "null"],
    [false, "false"],
    [0, "0"],
    [[], "[]"],
    [{}, "{}"],
  ] as const) {
    assert.deepEqual(
      contextItemsForModel(
        project(payload({ state: [state("value", value)] })).items,
      ),
      [{ id: "state:0", semanticAddress: "value", currentState: expected }],
    );
  }
  assert.equal(
    knowledgeText({
      condition: "if enabled",
      reportedValue: "Complete",
      reportedBy: "assistant",
    }),
    '{"condition":"if enabled","reportedValue":"Complete","reportedBy":"assistant"}',
  );
});

test("history is absent by default and matched to the requested address when needed", () => {
  const source = payload({
    state: [state("task.status", "Complete")],
    history: [
      {
        slot: "task.status",
        value: "Ready",
        interval: { from: "2026-09-19", to: "2026-09-20" },
      },
      {
        slot: "other.status",
        value: "Unrelated",
        interval: { from: "2026-09-18", to: "2026-09-20" },
      },
    ],
  });
  assert.equal(
    contextItemsForModel(project(source).items)[0]?.history,
    undefined,
  );
  const historical = project(source, {
    scope: scope(["current_state", "history"]),
  });
  assert.deepEqual(
    historical.items.find((item) => item.semanticAddress === "task.status")
      ?.history,
    ["2026-09-19 — 2026-09-20: Ready"],
  );
});

test("closed history without HEAD uses the latest qualified assertion", () => {
  const result = project(
    payload({
      history: [
        {
          slot: "task.status",
          value: "Ready",
          interval: { from: "2026-09-18", to: "2026-09-19" },
        },
        {
          slot: "task.status",
          value: "Complete",
          interval: { from: "2026-09-19", to: "2026-09-20" },
        },
      ],
    }),
    { scope: scope(["history"]) },
  );
  const item = contextItemsForModel(result.items)[0]!;
  assert.equal(result.items.length, 1);
  assert.equal("currentState" in item, false);
  assert.ok("claim" in item);
  assert.match(item.claim, /^Historical:.*Complete/u);
  assert.ok(item.history?.some((entry) => entry.includes("Ready")));
});

test("prior fallback claims are optional history and competing claims keep their qualifications", () => {
  const source = payload({
    claims: [
      {
        ...claim("Earlier assertion"),
        aboutInterval: { ...open, from: "2026-09-19" },
      },
      claim("Latest assertion"),
    ],
  });
  const records = [
    record("old", "claim", {
      slotLabel: "item.status",
      status: "contested",
      attributedTo: "Alice",
    }),
    record("new", "claim", {
      slotLabel: "item.status",
      status: "contested",
      attributedTo: "Bob",
    }),
  ];
  const item = project(source, { records, scope: scope(["history"]) })
    .items[0]!;
  assert.equal(item.proposition, "Latest assertion");
  assert.ok(item.history?.some((entry) => entry.includes("Earlier assertion")));
  assert.ok(item.provenance?.includes("Competing claim: Earlier assertion"));
  assert.ok(item.provenance?.includes("Attributed to: Alice"));
  assert.ok(item.provenance?.includes("Attributed to: Bob"));
});

test("past/future/rejected claims cannot masquerade as current fallback claims", () => {
  const context = createKnowledgeContext(() => "2026-09-27T00:00:00.000Z");
  const result = project(
    payload({
      claims: [
        {
          ...claim("Past"),
          aboutInterval: { from: "2020-01-01", to: "2020-02-01" },
        },
        { ...claim("Future"), aboutInterval: { from: "2027-01-01", to: null } },
        claim("Rejected"),
        claim("Current assertion"),
      ],
    }),
    {
      context,
      records: [
        record("past", "claim"),
        record("future", "claim"),
        record("rejected", "claim", { status: "rejected" }),
        record("current", "claim"),
      ],
    },
  );
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["current"],
  );
});

test("provenance is conditional and contains attribution and source relation", () => {
  const source = payload({
    claims: [claim("The report says Complete")],
    provenance: [
      {
        relation: "derived_from",
        from: { kind: "claim", label: "The report says Complete" },
        to: { kind: "artifact", label: "source:report.md" },
      },
    ],
  });
  const records = [
    record("claim-report", "claim", { attributedTo: "report author" }),
  ];
  assert.equal(project(source, { records }).items[0]?.provenance, undefined);
  assert.deepEqual(
    project(source, { records, scope: scope(["attribution"]) }).items[0]
      ?.provenance,
    [
      "Attributed to: report author",
      "The report says Complete --derived_from--> source:report.md",
    ],
  );
});

test("optional provenance describes a conversation source without runtime control IDs", () => {
  const result = project(
    payload({
      claims: [claim("Known fact")],
      provenance: [
        {
          relation: "derived_from",
          from: { kind: "claim", label: "Known fact" },
          to: {
            kind: "artifact",
            label: "turn:A008_v1_conversation_fixture:A008_v1_task_fixture",
          },
        },
      ],
    }),
    { scope: scope(["attribution"]) },
  );
  assert.deepEqual(result.items[0]?.provenance, [
    "Known fact --derived_from--> conversation turn",
  ]);
  assert.equal(
    JSON.stringify(contextItemsForModel(result.items)).includes("A008_v1_"),
    false,
  );
});

test("specific model tags exclude unrelated broad-domain facts without hiding exact reads", () => {
  const source = payload({
    state: [
      state("model.registration", "registry.ts"),
      state("old_task.status", "Complete"),
    ],
  });
  const records = [
    record("model", "state", {
      tags: ["model-registration"],
      domains: ["development"],
      matchKind: "associative",
      reasons: ["label_tag_match", "label_domain_match"],
      required: true,
    }),
    record("old", "state", {
      tags: ["sidebar"],
      domains: ["development"],
      matchKind: "associative",
      reasons: ["label_domain_match"],
      required: true,
    }),
  ];
  const options = {
    records,
    focusTags: ["model-registration"],
    message: "Add a model",
  };
  assert.deepEqual(
    project(source, options).items.map((item) => item.id),
    ["model"],
  );
  assert.deepEqual(
    project(source, options).omitted.map((item) => item.id),
    ["old"],
  );
  assert.equal(
    project(source, {
      ...options,
      message: "Add model; inspect old_task.status",
    }).items.length,
    2,
  );
  assert.equal(
    project(source, { records }).items.length,
    2,
    "domain-only discovery remains possible without a narrower match",
  );
});

test("budget measures minimal output and does not send an oversized first item", () => {
  const source = payload({
    state: [state("large", "x".repeat(1000)), state("small", "ok")],
  });
  const result = project(source, { maximumBytes: 250 });
  assert.deepEqual(
    result.items.map((item) => item.semanticAddress),
    ["small"],
  );
  assert.equal(result.omitted.length, 1);
  assert.ok(
    measurer.measure(
      serializeContextProjection({ taskId, items: result.items }),
    ) <= 250,
  );
});

test("worker and extractor get identical minimal context, internal identity survives", async () => {
  const items: ContextKnowledgeItem[] = [
    {
      id: "state:known",
      evidenceId: "claim-internal",
      semanticAddress: "task.status",
      currentState: "Complete",
      proposition: "Complete",
      kind: "state",
      tags: ["internal"],
      domains: ["internal"],
      scope: [],
      authority: 1,
      history: ["Yesterday: Ready"],
      provenance: ["Source: task.md"],
    },
  ];
  const serialized = serializeContextProjection({ taskId, items });
  const worker = new DeterministicMemoryPromptComposer().compose(
    {
      projection: { taskId, items },
      serialized,
      measuredUnits: measurer.measure(serialized),
      measurementUnit: measurer.unit,
    },
    "Question",
  );
  let extractor = "";
  const analyzer = new ModelBackedPostOutputKnowledgeAnalyzer({
    async generate(input) {
      extractor = input.serializedInput;
      return {
        new_knowledge: [],
        state_updates: [],
        relation_updates: [],
        reinforcements: [{ knowledgeId: "state:known" }],
      };
    },
  });
  await analyzer.analyze({
    kind: "dialogue",
    retrievedContext: { items },
    userMessage: "Question",
    responseText: "Complete",
  });
  assert.deepEqual(
    JSON.parse(extractor).retrievedContext,
    JSON.parse(worker.userEnvelope).retrievedContext,
  );
  assert.equal(extractor.includes("claim-internal"), false);
  assert.equal(items[0]?.evidenceId, "claim-internal");
});

test("real read keeps HEAD, optional history and source; never reinforces just by reading", async () => {
  const context = createKnowledgeContext(() => "2026-09-27T00:00:00.000Z");
  const entity = asEntityId("widget");
  const slot = { kind: "attribute" as const, entity, name: "color" };
  context.entities.register({ id: entity, type: "thing", labels: ["Widget"] });
  context.slots.register({
    ref: slot,
    cardinality: "single",
    valueType: "string",
  });
  for (const [id, value, at] of [
    ["red", "red", "2026-09-20T00:00:00.000Z"],
    ["blue", "blue", "2026-09-21T00:00:00.000Z"],
  ] as const) {
    update(
      context.state,
      {
        outcome: "change",
        slot,
        cardinality: "single",
        proposal: {
          id,
          slot,
          value,
          label: `Widget is ${value}`,
          aboutInterval: { from: at, to: null },
          status: "asserted",
          attributedTo: "user",
          causedBy: "fixture",
          kind: "assertion",
          acceptanceEligible: true,
        },
        from: id === "red" ? null : "red",
        to: value,
        at,
        competingClaimIds: [],
        targetInterval: null,
        reason: "fixture",
      },
      { decidedBy: "fixture" },
    );
  }
  const reader = new KnowledgeMemoryReader({ context });
  const request = (message: string) =>
    ({
      projectId: "A008_v1_project_20000000-0000-4000-8000-000000000001",
      conversationId:
        "A008_v1_conversation_20000000-0000-4000-8000-000000000002",
      taskId,
      agentId: "A008_v1_agent_20000000-0000-4000-8000-000000000003",
      message,
      applicabilityScopes: [],
    }) as unknown as MemoryReadRequest;
  const before = context.lifecycle.snapshot();
  const current = await reader.read(request("What color is Widget now?"));
  assert.deepEqual(
    contextItemsForModel(current.projection.projection.items).map((item) =>
      "currentState" in item ? item.currentState : item.claim,
    ),
    ["blue"],
  );
  const historical = await reader.read(
    request("What color did Widget have before?"),
  );
  assert.ok(
    historical.projection.projection.items.some(
      (item) =>
        item.currentState === "blue" &&
        item.history?.some((entry) => entry.includes("red")),
    ),
  );
  assert.deepEqual(context.lifecycle.snapshot(), before);
});
