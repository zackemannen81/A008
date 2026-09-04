import assert from "node:assert/strict";
import test from "node:test";

import { Utf8ByteContextMeasurer } from "../src/memory/serialization.js";
import {
  DEFAULT_PROJECTION_BUDGET_BYTES,
  SURFACE_AUTHORITY,
  projectionItems,
} from "../src/memory/knowledge/projection-items.js";
import { KnowledgeMemoryReader } from "../src/memory/knowledge/live-reader.js";
import { createKnowledgeContext } from "../src/memory/knowledge/read.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import { update } from "../src/memory/knowledge/update.js";
import { asEntityId } from "../src/memory/knowledge/ids.js";
import type { ProjectionPayload } from "../src/memory/knowledge/evidence-types.js";
import type { KnowledgeReadContext } from "../src/memory/knowledge/read-types.js";
import type { SlotRef } from "../src/memory/knowledge/types.js";
import type { MemoryReadRequest } from "../src/memory/retrieval-types.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../src/identity/types.js";

const MEASURER = new Utf8ByteContextMeasurer();
const TASK = "A008_v1_task_20000000-0000-4000-8000-000000000004";
const NOW = { unknown: true } as const;
const OPEN = { from: NOW, to: null } as const;

function payload(overrides: Partial<ProjectionPayload> = {}): ProjectionPayload {
  return {
    scope: { tags: ["local"], entities: [], slots: [] },
    state: [],
    history: [],
    events: [],
    utterances: [],
    claims: [],
    artifacts: [],
    provenance: [],
    ...overrides,
  };
}

function stateEntry(slot: string, value: string) {
  return { slot, value, interval: OPEN };
}

function utterance(content: string) {
  return {
    speaker: "user",
    act: "assertion" as const,
    contentKind: "dialogue_assertion" as const,
    content,
    assertedAt: NOW,
  };
}

function claim(label: string) {
  return {
    label,
    proposition: {
      kind: "attribute_binding" as const,
      entityLabel: label,
      attribute: "statement",
      value: label,
    },
    certainty: "certain" as const,
    attributedTo: "user",
    status: "asserted" as const,
    aboutInterval: OPEN,
  };
}

function propositions(items: readonly { proposition: string }[]): string[] {
  return items.map((item) => item.proposition);
}

// --- the regression this module exists for ---------------------------------

test("a state hit does not suppress claims, utterances or anything else", () => {
  // The exact shape of the live failure. A question about the agent's own name
  // retrieved both a state binding about a horse and the utterance naming the
  // agent, and the projection returned only the horse — because the previous
  // implementation returned as soon as `state` had one entry.
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      state: [stateEntry("heter", "Zorros häst heter Fresca")],
      utterances: [utterance("Du heter / kallas för Agent008")],
      claims: [claim("Rickard äger repot A008")],
    }),
  });

  assert.deepEqual(propositions(result.items), [
    "Zorros häst heter Fresca",
    "Rickard äger repot A008",
    "Du heter / kallas för Agent008",
  ]);
  assert.deepEqual(result.omitted, []);
});

test("every surface in the payload reaches the projection", () => {
  // Four of the seven were unreachable: the old implementation read state,
  // claims and utterances and never looked at the rest at all.
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      state: [stateEntry("colour", "the house is white")],
      claims: [claim("Brittan says the house is white")],
      events: [{ type: "paint", label: "the house was painted", eventTime: NOW }],
      history: [stateEntry("colour", "the house was red")],
      utterances: [utterance("someone painted the house")],
      artifacts: [
        { locator: "source:abc/report.pdf", contentKind: "dialogue_assertion" },
      ],
      provenance: [
        {
          relation: "appears_in",
          from: { kind: "utterance", label: "the house is white" },
          to: { kind: "artifact", label: "source:abc/report.pdf" },
        },
      ],
    }),
  });

  assert.deepEqual(
    result.items.map((item) => item.kind),
    ["state", "claim", "event", "history", "utterance", "artifact", "provenance"],
  );
  assert.equal(
    result.items.length,
    Object.keys(SURFACE_AUTHORITY).length,
    "one surface is not represented",
  );
});

test("provenance carries the relation, not just the two ends", () => {
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      provenance: [
        {
          relation: "derived_from",
          from: { kind: "claim", label: "the image shows a cat" },
          to: { kind: "artifact", label: "source:def/cat.png" },
        },
      ],
    }),
  });
  assert.deepEqual(propositions(result.items), [
    "the image shows a cat --derived_from--> source:def/cat.png",
  ]);
});

// --- ranking, deduplication, budget ----------------------------------------

test("items are ranked by authority, highest first", () => {
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      provenance: [
        {
          relation: "appears_in",
          from: { kind: "utterance", label: "p" },
          to: { kind: "artifact", label: "q" },
        },
      ],
      utterances: [utterance("an utterance")],
      state: [stateEntry("slot", "current truth")],
      claims: [claim("a claim")],
    }),
  });

  const authorities = result.items.map((item) => item.authority);
  assert.deepEqual(authorities, [...authorities].sort((a, b) => b - a));
  assert.equal(result.items[0]?.proposition, "current truth");
});

test("equal authority keeps a stable, reproducible order", () => {
  // Two reads of the same store must project the same order, or a bad answer
  // cannot be reproduced from the same inputs.
  const input = payload({
    utterances: [utterance("first"), utterance("second"), utterance("third")],
  });
  const once = projectionItems({ taskId: TASK, measurer: MEASURER, payload: input });
  const twice = projectionItems({ taskId: TASK, measurer: MEASURER, payload: input });
  assert.deepEqual(propositions(once.items), ["first", "second", "third"]);
  assert.deepEqual(propositions(once.items), propositions(twice.items));
});

test("the same words on several surfaces are sent once, by the strongest", () => {
  const shared = "Zorros häst heter Fresca";
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      state: [stateEntry("heter", shared)],
      claims: [claim(shared)],
      utterances: [utterance(shared)],
    }),
  });

  assert.deepEqual(propositions(result.items), [shared]);
  assert.equal(result.items[0]?.kind, "state");
  assert.deepEqual(
    result.deduplicated.map((item) => item.kind).sort(),
    ["claim", "utterance"],
  );
});

test("deduplication ignores case and surrounding space", () => {
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({
      state: [stateEntry("slot", "  The House Is White  ")],
      utterances: [utterance("the house is white")],
    }),
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.deduplicated.length, 1);
});

test("the budget cuts the lowest-ranked items and names them", () => {
  const long = (label: string) => `${label} ${"x".repeat(400)}`;
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    maximumBytes: 1_200,
    payload: payload({
      state: [stateEntry("a", long("state"))],
      claims: [claim(long("claim"))],
      utterances: [utterance(long("utterance"))],
    }),
  });

  assert.ok(result.items.length >= 1, "everything was cut");
  assert.ok(result.omitted.length >= 1, "nothing was cut, so nothing is proved");
  assert.equal(
    result.items.length + result.omitted.length,
    3,
    "an item was neither kept nor reported",
  );
  // The cut comes off the bottom of the ranking, never off the top.
  assert.equal(result.items[0]?.kind, "state");
  assert.ok(
    result.omitted.every(
      (dropped) => dropped.authority <= (result.items.at(-1)?.authority ?? 0),
    ),
  );
});

test("one item bigger than the whole budget is still sent", () => {
  // An empty projection is not a smaller answer, it is no memory at all.
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    maximumBytes: 16,
    payload: payload({ state: [stateEntry("a", "y".repeat(500))] }),
  });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.omitted, []);
});

test("the default budget is generous enough for an ordinary turn", () => {
  const many = Array.from({ length: 40 }, (_, index) =>
    utterance(`remembered fact number ${index}`),
  );
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({ utterances: many }),
  });
  assert.equal(result.items.length, 40);
  assert.equal(DEFAULT_PROJECTION_BUDGET_BYTES, 32_768);
});

test("an empty payload projects nothing rather than throwing", () => {
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload(),
  });
  assert.deepEqual(result.items, []);
});

test("blank propositions are dropped instead of sent as empty context", () => {
  const result = projectionItems({
    taskId: TASK,
    measurer: MEASURER,
    payload: payload({ utterances: [utterance("   "), utterance("real")] }),
  });
  assert.deepEqual(propositions(result.items), ["real"]);
});

// --- through the reader, against a real store ------------------------------

const NAME_SLOT: SlotRef = {
  kind: "attribute",
  entity: asEntityId("zorros_hast"),
  name: "statement",
};

function worldWithBothFacts(): KnowledgeReadContext {
  const context = createKnowledgeContext();
  // These labels are not invented for the test. They are exactly what
  // `live-commit.ts` writes today: `uniqueLabels([label, proposition,
  // ...entities, ...tokenize(proposition)])`, and `tokenize` keeps every word
  // of four characters or more. So the word "heter" becomes an alias of the
  // horse, and "Vad heter du?" matches it.
  //
  // That is a separate defect with its own task. It is reproduced here on
  // purpose, because it is what puts a state hit and an unrelated utterance in
  // the same read — and that collision is the one this projection has to
  // survive. Cleaning the labels here would leave the gate armed with a case
  // that cannot fire.
  context.entities.register({
    id: asEntityId("zorros_hast"),
    type: "fact",
    labels: ["Zorros häst heter Fresca", "zorros", "häst", "heter", "fresca"],
  });
  context.slots.register({
    ref: NAME_SLOT,
    cardinality: "single",
    valueType: "string",
  });
  update(
    context.state,
    {
      outcome: "change",
      slot: NAME_SLOT,
      cardinality: "single",
      proposal: {
        id: "claim-fresca",
        slot: NAME_SLOT,
        value: "Zorros häst heter Fresca",
        label: "Zorros häst heter Fresca",
        aboutInterval: OPEN,
        status: "asserted",
        attributedTo: "user",
        causedBy: "test",
        kind: "assertion",
        acceptanceEligible: true,
      },
      from: null,
      to: "Zorros häst heter Fresca",
      at: NOW,
      competingClaimIds: [],
      targetInterval: null,
      reason: "test",
    },
    { decidedBy: "test" },
  );
  ingest(
    {
      content: "Du heter / kallas för Agent008",
      speaker: "user",
      locator: "turn:1",
      scope: { verified: true },
    },
    { store: context.evidence },
  );
  return context;
}

function request(message: string): MemoryReadRequest {
  return {
    projectId: "A008_v1_project_20000000-0000-4000-8000-000000000001" as ProjectId,
    conversationId:
      "A008_v1_conversation_20000000-0000-4000-8000-000000000002" as ConversationId,
    taskId: TASK as RuntimeTaskId,
    agentId: "A008_v1_agent_20000000-0000-4000-8000-000000000003" as AgentId,
    message,
    applicabilityScopes: ["local"],
  };
}

test("the reader returns both facts the store found, not the first surface", async () => {
  const reader = new KnowledgeMemoryReader({ context: worldWithBothFacts() });
  const result = await reader.read(request("Vad heter / kallas du för?"));

  const kinds = new Set(result.projection.projection.items.map((item) => item.kind));
  const texts = result.projection.projection.items.map((item) => item.proposition);

  assert.ok(
    texts.some((text) => text.includes("Agent008")),
    `the utterance never reached the projection: ${JSON.stringify(texts)}`,
  );
  assert.ok(
    texts.includes("Zorros häst heter Fresca"),
    "the state binding that used to win alone is now missing entirely",
  );
  assert.deepEqual(
    [...kinds].sort(),
    ["state", "utterance"],
    "two surfaces matched and both must survive",
  );
  assert.equal(
    result.evidence.selectedKnowledgeIds.length,
    result.projection.projection.items.length,
  );
});

test("a budget that bites is reported, not silently applied", async () => {
  const roomy = new KnowledgeMemoryReader({ context: worldWithBothFacts() });
  const cramped = new KnowledgeMemoryReader({
    context: worldWithBothFacts(),
    maximumProjectionBytes: 1,
  });
  const full = await roomy.read(request("Vad heter / kallas du för?"));
  const cut = await cramped.read(request("Vad heter / kallas du för?"));

  assert.ok(
    full.projection.projection.items.length > 1,
    "the roomy read found too little for this test to mean anything",
  );
  assert.equal(cut.projection.projection.items.length, 1);
  assert.equal(
    cut.evidence.projectionMaximum,
    full.projection.projection.items.length,
    "projectionMaximum should say how many items were eligible, not how many fit",
  );
  assert.ok(
    cut.evidence.omittedKnowledgeIds.length >
      full.evidence.omittedKnowledgeIds.length,
    "the budget dropped items without reporting them",
  );
});
