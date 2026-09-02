import assert from "node:assert/strict";
import test from "node:test";
import { accept } from "../../src/memory/knowledge/accept.js";
import { recordClaimsFromUtterance } from "../../src/memory/knowledge/evidence.js";
import {
  USER_ASSERTION_POLICY_ID,
  type ClaimDraft,
} from "../../src/memory/knowledge/evidence-types.js";
import { ingest } from "../../src/memory/knowledge/ingest.js";
import {
  asEntityId,
  createKnowledgeContext,
  decay,
  define,
  interpret,
  readKnowledge,
  reactivate,
  reinforce,
  scoreRetrieved,
  weaken,
  type KnowledgeReadContext,
  type ReadResult,
} from "../../src/memory/knowledge/index.js";
import { RelationIndex } from "../../src/memory/knowledge/expand.js";
import { reconcile } from "../../src/memory/knowledge/reconcile.js";

import type {
  ReconcileOutcomeKind,
  SlotClaim,
} from "../../src/memory/knowledge/state-types.js";
import { update } from "../../src/memory/knowledge/update.js";
import type {
  AttributeSlotRef,
  Instant,
  KnowledgeIdFactory,
  SlotDefinition,
} from "../../src/memory/knowledge/types.js";

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-06-01T00:00:00.000Z";
const T2 = "2026-09-01T00:00:00.000Z";
const T3 = "2026-09-15T00:00:00.000Z";
const STUB_POLICY = "accept-policy:stub-v1";
const S3_CONTENT = "int main() { ... }";

const FORBIDDEN_FIELDS = [
  "canonicalStatus",
  "supersededBy",
  "activationStatus",
  "relevanceScore",
  "keepAlive",
] as const;

function sequentialIds(): KnowledgeIdFactory {
  let sequence = 0;
  return () => String(++sequence).padStart(4, "0");
}

function verifiedScope(
  extra: {
    readonly tags?: readonly string[];
    readonly entities?: readonly string[];
  } = {},
) {
  return {
    verified: true as const,
    ...(extra.tags === undefined ? {} : { tags: extra.tags }),
    ...(extra.entities === undefined ? {} : { entities: extra.entities }),
  };
}

function colorSlot(entity: string): {
  readonly ref: AttributeSlotRef;
  readonly definition: SlotDefinition;
} {
  const ref: AttributeSlotRef = {
    kind: "attribute",
    entity: asEntityId(entity),
    name: "color",
  };
  return {
    ref,
    definition: {
      ref,
      cardinality: "single",
      valueType: "color",
    },
  };
}

function colorClaim(input: {
  readonly id: string;
  readonly slot: AttributeSlotRef;
  readonly value: unknown;
  readonly from: Instant;
  readonly to?: Instant | null;
  readonly causedBy: string;
  readonly attributedTo: string;
  readonly kind?: SlotClaim["kind"];
  readonly label?: string;
  readonly retractsClaimId?: string;
  readonly targetInterval?: SlotClaim["targetInterval"];
}): SlotClaim {
  const valueLabel =
    input.value === null || input.value === undefined
      ? "null"
      : String(input.value);
  return {
    id: input.id,
    slot: input.slot,
    value: input.value,
    label: input.label ?? `${input.slot.entity}.${input.slot.name} = ${valueLabel}`,
    aboutInterval: {
      from: input.from,
      to: input.to === undefined ? null : input.to,
    },
    status: "asserted",
    attributedTo: input.attributedTo,
    causedBy: input.causedBy,
    kind: input.kind ?? "assertion",
    acceptanceEligible: true,
    ...(input.retractsClaimId === undefined
      ? {}
      : { retractsClaimId: input.retractsClaimId }),
    ...(input.targetInterval === undefined
      ? {}
      : { targetInterval: input.targetInterval }),
  };
}

function acceptUpdate(
  world: KnowledgeReadContext,
  proposal: SlotClaim,
  slot: SlotDefinition,
  expected: ReconcileOutcomeKind,
) {
  const before = world.state.snapshot();
  const decision = reconcile(world.state, proposal, slot);
  assert.deepEqual(world.state.snapshot(), before);
  assert.equal(decision.outcome, expected);
  if (expected === "retraction") {
    world.state.setClaimStatus(proposal.retractsClaimId ?? proposal.id, "retracted");
  } else if (expected !== "conflict") {
    world.state.setClaimStatus(proposal.id, "accepted");
  }
  if (expected === "conflict") {
    world.state.applyConflict(decision);
    return { decision };
  }
  const result = update(world.state, decision, { decidedBy: STUB_POLICY });
  assert.equal("memoryStrength" in result.transition, false);
  assert.equal("activationStatus" in (result.opened ?? {}), false);
  return { decision, result };
}

function ask(
  world: KnowledgeReadContext,
  message: string,
  extra: {
    readonly tags?: readonly string[];
    readonly entities?: readonly string[];
    readonly temporalHints?: {
      readonly currentOnly: boolean;
      readonly mentionsPast: boolean;
      readonly mentionsFuture: boolean;
    };
    readonly taskTags?: readonly string[];
  } = {},
): ReadResult {
  const stateBefore = world.state.snapshot();
  const lifeBefore = world.lifecycle.snapshot();
  const result = readKnowledge(
    {
      message,
      verifiedScope: verifiedScope({
        ...(extra.tags === undefined ? {} : { tags: extra.tags }),
        ...(extra.entities === undefined ? {} : { entities: extra.entities }),
      }),
      ...(extra.temporalHints === undefined
        ? {}
        : { temporalHints: extra.temporalHints }),
      ...(extra.taskTags === undefined ? {} : { taskTags: extra.taskTags }),
    },
    world,
  );
  assert.deepEqual(world.state.snapshot(), stateBefore, "read path must not write state");
  assert.deepEqual(
    world.lifecycle.snapshot(),
    lifeBefore,
    "PROJECT and the read path must not write lifecycle",
  );
  assertNoForbidden(result.projected.payload, "payload");
  return result;
}

function currentValues(result: ReadResult): unknown[] {
  return result.projected.payload.state.map((entry) => entry.value);
}

function historyValues(result: ReadResult): unknown[] {
  return result.projected.payload.history.map((entry) => entry.value);
}

function assertNoForbidden(value: unknown, path: string): void {
  if (typeof value !== "object" || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoForbidden(item, `${path}[${index}]`);
    }
    return;
  }
  for (const key of Object.keys(value)) {
    assert.equal(
      FORBIDDEN_FIELDS.includes(key as (typeof FORBIDDEN_FIELDS)[number]),
      false,
      `${path}.${key} must not exist`,
    );
    assertNoForbidden((value as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

function registerHouse(world: KnowledgeReadContext) {
  const { ref, definition } = colorSlot("brittans_hus");
  world.entities.register({
    id: asEntityId("brittans_hus"),
    type: "house",
    labels: ["brittans_hus", "Brittans hus", "huset", "Brittan", "house"],
  });
  world.slots.register(definition);
  return { ref, definition };
}

function attachEvidence(
  world: KnowledgeReadContext,
  evidenceId: string,
  kind: "utterance" | "event" | "claim",
  at: Instant,
  strength = 1,
): void {
  world.lifecycle.attach({
    evidenceId,
    evidenceKind: kind,
    strength,
    at,
    caller: "test:attach",
  });
}

function playS1(includePaint = false) {
  const world = createKnowledgeContext();
  const { ref, definition } = registerHouse(world);
  const ids = sequentialIds();
  const relations = world.relations as RelationIndex;

  const whiteIngest = ingest(
    {
      content: "Brittans hus är vitt",
      speaker: "observer",
      locator: "assertion:white",
      assertedAt: T0,
      ingestedAt: T0,
      scope: verifiedScope(),
    },
    { store: world.evidence, idFactory: ids },
  );
  const whiteUtterance = whiteIngest.utterances[0];
  assert.ok(whiteUtterance);
  attachEvidence(world, whiteUtterance.id, "utterance", T0);
  relations.link("brittans_hus", whiteUtterance.id, "about");
  relations.link("Brittan", whiteUtterance.id, "about");

  const white = colorClaim({
    id: "claim:white",
    slot: ref,
    value: "white",
    from: T0,
    causedBy: "assertion:a-white",
    attributedTo: "observer",
  });
  world.state.recordClaim(white);
  acceptUpdate(world, white, definition, "change");
  attachEvidence(world, white.id, "claim", T0);

  world.state.recordEvent({
    id: "event:e-painted-red",
    type: "house_painted",
    label: "Brittan painted the house red",
    eventTime: T1,
    causedBy: "event:e-painted-red",
    who: "Brittan",
    what: "red",
    effects: [{ slot: ref, value: "red" }],
  });
  attachEvidence(world, "event:e-painted-red", "event", T1);
  relations.link("brittans_hus", "event:e-painted-red", "participant");
  relations.link("Brittan", "event:e-painted-red", "participant");

  const red = colorClaim({
    id: "claim:red",
    slot: ref,
    value: "red",
    from: T1,
    causedBy: "event:e-painted-red",
    attributedTo: "Brittan",
    kind: "event_effect",
  });
  world.state.recordClaim(red);
  acceptUpdate(world, red, definition, "change");
  attachEvidence(world, red.id, "claim", T1);

  const greenIngest = ingest(
    {
      content: "Nu är huset grönt",
      speaker: "observer",
      locator: "assertion:green",
      assertedAt: T2,
      ingestedAt: T2,
      scope: verifiedScope(),
    },
    { store: world.evidence, idFactory: ids },
  );
  const greenUtterance = greenIngest.utterances[0];
  assert.ok(greenUtterance);
  attachEvidence(world, greenUtterance.id, "utterance", T2);

  const green = colorClaim({
    id: "claim:green",
    slot: ref,
    value: "green",
    from: T2,
    causedBy: "assertion:a-green",
    attributedTo: "observer",
  });
  world.state.recordClaim(green);
  acceptUpdate(world, green, definition, "change");
  attachEvidence(world, green.id, "claim", T2);

  if (includePaint) {
    const paint = ingest(
      {
        content: "Brittan bought paint at Bauhaus",
        speaker: "observer",
        locator: "assertion:paint",
        assertedAt: T1,
        ingestedAt: T1,
        scope: verifiedScope(),
      },
      { store: world.evidence, idFactory: ids },
    );
    const paintUtterance = paint.utterances[0];
    assert.ok(paintUtterance);
    attachEvidence(world, paintUtterance.id, "utterance", T1, 0.1);
    relations.link("brittans_hus", paintUtterance.id, "about");
    relations.link("Brittan", paintUtterance.id, "about");
  }

  return { world, ref, definition, white, red, green };
}

function playS3(
  world = createKnowledgeContext(),
  idFactory: KnowledgeIdFactory = sequentialIds(),
) {
  const proposal = interpret(
    {
      contentKind: "source_code",
      locator: "main.cpp",
      content: S3_CONTENT,
      ingestedAt: T0,
    },
    {
      entities: world.entities,
      slots: world.slots,
      idFactory,
    },
  );
  for (const entity of proposal.entities) {
    world.entities.register({
      id: entity.id,
      type: entity.type,
      labels: [...entity.labels],
    });
  }
  for (const slot of proposal.slots) {
    world.slots.register(slot.definition);
  }
  const artifact = proposal.artifacts[0];
  assert.ok(artifact);
  world.evidence.addArtifact({
    id: artifact.id,
    contentKind: artifact.contentKind,
    locator: artifact.locator,
    ingestedAt: artifact.ingestedAt,
  });

  let n = 0;
  for (const binding of proposal.bindings) {
    n += 1;
    if (binding.kind === "relationship") {
      const definition = world.slots.get({
        kind: "relation",
        subject: binding.slot.subject,
        name: binding.slot.name,
      });
      assert.ok(definition);
      const claim: SlotClaim = {
        id: `claim:s3-rel-${String(n)}`,
        slot: {
          kind: "relation",
          subject: binding.slot.subject,
          name: binding.slot.name,
        },
        value: binding.object,
        label: binding.label,
        aboutInterval: { from: T0, to: null },
        status: "asserted",
        attributedTo: "source",
        causedBy: "interpret:s3",
        kind: "assertion",
        acceptanceEligible: true,
      };
      world.state.recordClaim(claim);
      acceptUpdate(world, claim, definition, "change");
      continue;
    }
    const definition = world.slots.get(binding.slot);
    assert.ok(definition);
    const claim: SlotClaim = {
      id: `claim:s3-attr-${String(n)}`,
      slot: binding.slot,
      value: binding.value,
      label: binding.label,
      aboutInterval: { from: T0, to: null },
      status: "asserted",
      attributedTo: "source",
      causedBy: "interpret:s3",
      kind: "assertion",
      acceptanceEligible: true,
    };
    world.state.recordClaim(claim);
    acceptUpdate(world, claim, definition, "change");
  }
  return { world, proposal };
}

function dormantAll(world: KnowledgeReadContext, at: Instant): void {
  for (const record of world.lifecycle.list()) {
    const amount = Math.max(0, record.lifecycle.strength - 0.1);
    weaken(world.lifecycle, {
      evidenceIds: [record.evidenceId],
      caller: "test:s6",
      reason: "force supporting evidence dormant",
      at,
      amount,
    });
  }
}

test("S1 — Changing house colour", () => {
  const { world, ref } = playS1();
  assert.equal(world.state.currentValue(ref), "green");

  const current = ask(world, "Vilken färg har Brittans hus?");
  assert.equal(current.scope.intents.includes("current_state"), true);
  assert.equal(current.scope.intents.includes("history"), false);
  assert.deepEqual(currentValues(current), ["green"]);
  assert.equal(current.projected.payload.history.length, 0);
  assert.equal(
    current.projected.payload.state.every((entry) => entry.interval.to === null),
    true,
  );

  const again = ask(world, "Vilken färg har Brittans hus?");
  assert.deepEqual(currentValues(again), ["green"]);

  const history = ask(world, "Vilka färger har huset haft?");
  assert.equal(history.scope.intents.includes("history"), true);
  assert.deepEqual(historyValues(history), ["white", "red", "green"]);
  assert.equal(
    history.projected.payload.history.every((entry) => entry.interval !== undefined),
    true,
  );
  assert.deepEqual(
    history.projected.payload.history.map((entry) => entry.interval),
    [
      { from: T0, to: T1 },
      { from: T1, to: T2 },
      { from: T2, to: null },
    ],
  );

  const event = ask(world, "Vem målade huset rött?");
  assert.equal(event.scope.intents.includes("event"), true);
  assert.equal(event.projected.payload.events.length, 1);
  assert.equal(event.projected.payload.events[0]?.type, "house_painted");
  assert.match(event.projected.payload.events[0]?.label ?? "", /Brittan/);
  assert.equal(
    event.projected.diagnostics.records.find((record) => record.surface === "event")
      ?.who,
    "Brittan",
  );

  assert.equal(world.state.history(ref).length, 3);
  assert.equal(world.state.claims(ref).length, 3);
  assert.equal(
    world.state.snapshot().bindings.some(
      (binding) => "canonicalStatus" in binding || "supersededBy" in binding,
    ),
    false,
  );
});

test("S2 — Correction versus change", () => {
  const { world, ref, definition, white } = playS1();
  const correction = colorClaim({
    id: "claim:never-white",
    slot: ref,
    value: null,
    from: T3,
    causedBy: "assertion:a-correction",
    attributedTo: "observer",
    kind: "correction",
    label: "the house was never white",
    targetInterval: { from: T0, to: T1 },
  });
  world.state.recordClaim(correction);
  const { decision } = acceptUpdate(world, correction, definition, "correction");
  assert.equal(decision.outcome, "correction");
  assert.notEqual(decision.outcome, "change");

  const history = ask(world, "Vilka färger har huset haft?");
  assert.deepEqual(historyValues(history), ["red", "green"]);
  assert.equal(
    history.projected.payload.history.some((entry) => entry.value === "white"),
    false,
  );
  assert.deepEqual(currentValues(ask(world, "Vilken färg har Brittans hus?")), [
    "green",
  ]);

  const original = world.state.claim(white.id);
  assert.ok(original);
  assert.equal(original.causedBy, "assertion:a-white");
  assert.equal(world.state.corrections(ref).length, 1);
  assert.equal(world.state.corrections(ref)[0]?.correctedBy, "observer");
});

test("S3 — Source code", () => {
  const { world, proposal } = playS3();
  assert.equal(proposal.entities.length, 1);
  assert.equal(proposal.bindings.length, 2);

  const where = ask(world, "Where is main defined?");
  assert.equal(
    where.projected.payload.state.some(
      (entry) =>
        String(entry.slot).includes("main.cpp") ||
        String(entry.slot).includes("contains"),
    ),
    true,
  );

  const returns = ask(world, "What does main return?");
  assert.equal(
    returns.projected.payload.state.some((entry) => entry.value === "int"),
    true,
  );
  assert.equal(proposal.events.length, 0);
  assert.equal("who" in (proposal.entities[0] ?? {}), false);
  assert.equal("why" in (proposal.artifacts[0] ?? {}), false);
});

test("S4 — Attributed prediction", () => {
  const world = createKnowledgeContext();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "It will probably rain tomorrow.",
      speaker: "Kanal 4 presenter",
      locator: "broadcast:2026-09-01",
      assertedAt: "2026-09-01T18:00:00.000Z",
      scope: verifiedScope(),
    },
    { store: world.evidence, idFactory: ids },
  );
  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  attachEvidence(world, utterance.id, "utterance", T2);
  const rain: ClaimDraft = {
    label: "rain(tomorrow)",
    proposition: {
      kind: "predicate",
      name: "rain",
      arguments: ["tomorrow"],
    },
    certainty: "probable",
    aboutInterval: {
      from: "2026-09-03T00:00:00.000Z",
      to: "2026-09-04T00:00:00.000Z",
    },
  };
  const claims = recordClaimsFromUtterance(world.evidence, utterance.id, [rain], {
    idFactory: ids,
  });
  const claim = claims[0];
  assert.ok(claim);
  attachEvidence(world, claim.id, "claim", T2);
  accept(
    {
      claimId: claim.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "third_party" },
    },
    world.evidence,
  );

  const said = ask(world, "Vad sa presentatören?");
  assert.equal(said.scope.intents.includes("attribution"), true);
  assert.equal(said.projected.payload.utterances.length, 1);
  assert.equal(said.projected.payload.utterances[0]?.speaker, "Kanal 4 presenter");
  assert.equal(said.projected.payload.utterances[0]?.act, "prediction");

  const weather = ask(world, "Regnar det imorgon?");
  assert.equal(weather.projected.payload.state.length, 0);
  assert.equal(
    weather.projected.payload.claims.some(
      (item) =>
        item.label === "rain(tomorrow)" &&
        item.status === "asserted" &&
        item.certainty === "probable" &&
        item.attributedTo === "Kanal 4 presenter",
    ),
    true,
  );
});

test("S5 — Recitation", () => {
  const world = createKnowledgeContext();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Fader vår som är i himmelen",
      speaker: "speaker",
      scope: verifiedScope(),
    },
    { store: world.evidence, idFactory: ids },
  );
  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  assert.equal(utterance.act, "recitation");
  assert.equal(utterance.contentKind, "prayer");
  attachEvidence(world, utterance.id, "utterance", T2);
  const heaven: ClaimDraft = {
    label: "speaker's father lives in heaven",
    proposition: {
      kind: "attribute_binding",
      entityLabel: "speaker_father",
      attribute: "location",
      value: "heaven",
    },
    certainty: "certain",
    aboutInterval: { from: T2, to: null },
  };
  const claims = recordClaimsFromUtterance(
    world.evidence,
    utterance.id,
    [heaven],
    { idFactory: ids },
  );
  assert.equal(claims.length, 0);

  const result = ask(world, "Vad sa speaker?");
  assert.equal(result.projected.payload.claims.length, 0);
  assert.equal(result.projected.payload.state.length, 0);
  assert.equal(result.projected.payload.utterances[0]?.act, "recitation");
  assert.equal(
    result.projected.payload.utterances[0]?.content,
    "Fader vår som är i himmelen",
  );
});

test("S6 — Dormant direct hit", () => {
  const { world } = playS1();
  dormantAll(world, T3);
  assert.equal(
    world.lifecycle.list().every((record) => record.lifecycle.state === "dormant"),
    true,
  );

  const result = ask(world, "Vilken färg har Brittans hus?");
  assert.deepEqual(currentValues(result), ["green"]);
  assert.equal(
    result.retrieved.some(
      (record) => record.surface === "state" && record.matchKind === "direct",
    ),
    true,
  );

  const candidates = result.projected.diagnostics.reactivationCandidates;
  if (candidates.length > 0) {
    reactivate(world.lifecycle, {
      evidenceIds: candidates,
      caller: "test:s6",
      reason: "direct match after the answer was produced",
      at: T3,
    });
  }
  assert.deepEqual(currentValues(ask(world, "Vilken färg har Brittans hus?")), [
    "green",
  ]);
});

test("S7 — Associative recall respects dormancy", () => {
  const { world } = playS1(true);
  const result = ask(world, "Berätta något om Brittan", {
    tags: ["house", "color", "brittan"],
    entities: ["Brittan"],
  });
  assert.equal(result.scope.intents.includes("associative"), true);
  assert.deepEqual(currentValues(result), ["green"]);
  assert.equal(
    result.projected.payload.utterances.some((item) =>
      item.content.includes("Bauhaus"),
    ),
    false,
  );
  assert.equal(
    result.filtered.omitted.some(
      (item) =>
        item.reason === "associative_dormant" &&
        item.record.label.includes("Bauhaus"),
    ),
    true,
  );
});

test("S8 — Conflict", () => {
  const world = createKnowledgeContext();
  const { ref, definition } = colorSlot("rickards_bil");
  world.entities.register({
    id: asEntityId("rickards_bil"),
    type: "car",
    labels: ["rickards_bil", "Rickards bil", "Rickard"],
  });
  world.slots.register(definition);
  const stefan = colorClaim({
    id: "claim:stefan-blue",
    slot: ref,
    value: "blue",
    from: T0,
    causedBy: "assertion:stefan",
    attributedTo: "Stefan",
  });
  const anna = colorClaim({
    id: "claim:anna-red",
    slot: ref,
    value: "red",
    from: T0,
    causedBy: "assertion:anna",
    attributedTo: "Anna",
  });
  world.state.recordClaim(stefan);
  acceptUpdate(world, stefan, definition, "change");
  world.state.recordClaim(anna);
  acceptUpdate(world, anna, definition, "conflict");

  const result = ask(world, "Vilken färg har Rickards bil?");
  assert.equal(world.state.currentValue(ref), undefined);
  assert.equal(result.projected.payload.state.length, 0);
  const contested = result.projected.payload.claims.filter(
    (claim) => claim.status === "contested",
  );
  assert.equal(contested.length, 2);
  assert.equal(
    contested.some((claim) => claim.attributedTo === "Stefan"),
    true,
  );
  assert.equal(
    contested.some((claim) => claim.attributedTo === "Anna"),
    true,
  );
});

test("S9 — Attribution without acceptance", () => {
  const world = createKnowledgeContext();
  world.entities.register({
    id: asEntityId("rickard"),
    type: "person",
    labels: ["Rickard"],
  });
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Rickard owns a blue car.",
      speaker: "Stefan",
      assertedAt: T0,
      scope: verifiedScope(),
    },
    { store: world.evidence, idFactory: ids },
  );
  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  attachEvidence(world, utterance.id, "utterance", T0);
  const drafts: readonly ClaimDraft[] = [
    {
      label: "rickard --owns--> car",
      proposition: {
        kind: "relationship_binding",
        subjectLabel: "Rickard",
        relation: "owns",
        objectLabel: "car",
      },
      certainty: "certain",
      aboutInterval: { from: T0, to: null },
    },
    {
      label: "rickards_bil.color = blue",
      proposition: {
        kind: "attribute_binding",
        entityLabel: "rickards_bil",
        attribute: "color",
        value: "blue",
      },
      certainty: "certain",
      aboutInterval: { from: T0, to: null },
    },
  ];
  const claims = recordClaimsFromUtterance(world.evidence, utterance.id, drafts, {
    idFactory: ids,
  });
  assert.equal(claims.length, 2);
  for (const claim of claims) {
    attachEvidence(world, claim.id, "claim", T0);
    const decision = accept(
      {
        claimId: claim.id,
        policy: { id: USER_ASSERTION_POLICY_ID },
        authority: { verified: true, speakerRole: "third_party" },
      },
      world.evidence,
    );
    assert.equal(decision.decision, "not_accepted");
    assert.equal(world.evidence.requireClaim(claim.id).status, "asserted");
  }

  const who = ask(world, "Vem sa att Rickard har en bil?");
  assert.equal(who.projected.payload.utterances[0]?.speaker, "Stefan");

  const owns = ask(world, "Äger Rickard en bil?");
  assert.equal(owns.projected.payload.state.length, 0);
  assert.equal(
    owns.projected.payload.claims.every((claim) => claim.status === "asserted"),
    true,
  );
  assert.equal(
    owns.projected.payload.claims.some((claim) => claim.attributedTo === "Stefan"),
    true,
  );
});

test("S10 — Retraction", () => {
  const { world, ref, definition, green } = playS1();
  const retraction = colorClaim({
    id: "claim:retract-green",
    slot: ref,
    value: "green",
    from: T3,
    causedBy: "assertion:a-retract",
    attributedTo: "observer",
    kind: "retraction",
    retractsClaimId: green.id,
  });
  world.state.recordClaim(retraction);
  acceptUpdate(world, retraction, definition, "retraction");

  const current = ask(world, "Vilken färg har Brittans hus?");
  assert.equal(current.projected.payload.state.length, 0);
  const history = ask(world, "Vilka färger har huset haft?");
  assert.equal(
    history.projected.payload.history.some(
      (entry) =>
        entry.value === "green" &&
        entry.interval.from === T2 &&
        entry.interval.to === T3,
    ),
    true,
  );
  assert.equal(world.state.claim(green.id)?.status, "retracted");
  assert.equal(world.state.currentValue(ref), undefined);
});

test("decay sweep does not change any direct-question answer", () => {
  const { world } = playS1();
  let extra = 5000;
  playS3(world, () => String((extra += 1)));

  const questions = [
    "Vilken färg har Brittans hus?",
    "What does main return?",
    "Where is main defined?",
  ];
  const before = questions.map((question) => currentValues(ask(world, question)));
  const stateBefore = world.state.snapshot();

  decay(world.lifecycle, {
    caller: "test:decay-sweep",
    reason: "scheduled evidence decay",
    at: T3,
    elapsed: 20,
  });
  assert.deepEqual(world.state.snapshot(), stateBefore);
  assert.equal(
    world.lifecycle.list().every((record) => record.lifecycle.state === "dormant"),
    true,
  );

  const after = questions.map((question) => currentValues(ask(world, question)));
  assert.deepEqual(after, before);
  assert.deepEqual(before[0], ["green"]);
  assert.equal(
    before[1]?.some((value) => value === "int"),
    true,
  );
});

test("PROJECT writes nothing and strength is not a direct-match score term", () => {
  assert.equal(
    scoreRetrieved({
      matchKind: "direct",
      exactSlot: true,
      exactEntity: true,
      lexical: true,
      strength: 1,
    }),
    scoreRetrieved({
      matchKind: "direct",
      exactSlot: true,
      exactEntity: true,
      lexical: true,
      strength: 0.1,
    }),
  );
  assert.notEqual(
    scoreRetrieved({
      matchKind: "associative",
      exactSlot: false,
      exactEntity: true,
      lexical: true,
      strength: 1,
    }),
    scoreRetrieved({
      matchKind: "associative",
      exactSlot: false,
      exactEntity: true,
      lexical: true,
      strength: 0.1,
    }),
  );

  const { world } = playS1();
  const lifeBefore = world.lifecycle.snapshot();
  const stateBefore = world.state.snapshot();
  ask(world, "Vilken färg har Brittans hus?");
  assert.deepEqual(world.lifecycle.snapshot(), lifeBefore);
  assert.deepEqual(world.state.snapshot(), stateBefore);
});

test("DEFINE consumes mentionsPast so closed intervals are reachable", () => {
  const { world } = playS1();
  const withoutHint = define(
    {
      message: "What color is the house?",
      verifiedScope: verifiedScope({ entities: ["Brittans hus"] }),
    },
    world,
  );
  assert.equal(withoutHint.intents.includes("history"), false);

  const withHint = define(
    {
      message: "What color is the house?",
      verifiedScope: verifiedScope({ entities: ["Brittans hus"] }),
      temporalHints: {
        currentOnly: false,
        mentionsPast: true,
        mentionsFuture: false,
      },
    },
    world,
  );
  assert.equal(withHint.intents.includes("history"), true);
  assert.equal(withHint.temporalHints.mentionsPast, true);

  const history = ask(world, "What color is the house?", {
    temporalHints: {
      currentOnly: false,
      mentionsPast: true,
      mentionsFuture: false,
    },
  });
  assert.deepEqual(historyValues(history), ["white", "red", "green"]);
});

test("tags do not gate a direct slot match", () => {
  const { world } = playS1();
  const result = ask(world, "Vilken färg har Brittans hus?", {
    tags: ["coding"],
    taskTags: ["coding"],
  });
  assert.deepEqual(currentValues(result), ["green"]);
});

test("closed intervals are unreachable without history intent", () => {
  const { world } = playS1();
  const current = ask(world, "Vilken färg har Brittans hus?");
  assert.equal(current.projected.payload.history.length, 0);
  assert.equal(
    current.retrieved.some(
      (record) =>
        record.surface === "history" && record.interval?.to !== null,
    ),
    false,
  );
  assert.equal(
    currentValues(current).includes("white") || currentValues(current).includes("red"),
    false,
  );
});

test("DECAY / WEAKEN / REINFORCE / REACTIVATE write evidence lifecycle only", () => {
  const { world, ref } = playS1();
  const stateBefore = world.state.snapshot();
  const claim = world.lifecycle.list().find((record) => record.evidenceKind === "claim");
  assert.ok(claim);

  weaken(world.lifecycle, {
    evidenceIds: [claim.evidenceId],
    caller: "test:lifecycle",
    reason: "explicit weaken",
    at: T3,
    amount: 0.2,
  });
  decay(world.lifecycle, {
    evidenceIds: [claim.evidenceId],
    caller: "test:lifecycle",
    reason: "explicit decay",
    at: T3,
    elapsed: 1,
  });
  reactivate(world.lifecycle, {
    evidenceIds: [claim.evidenceId],
    caller: "test:lifecycle",
    reason: "explicit reactivate",
    at: T3,
  });
  const reinforced = world.lifecycle.list().find(
    (record) => record.evidenceId === claim.evidenceId,
  );
  assert.ok(reinforced);
  assert.equal(reinforced.lifecycle.state, "active");

  reinforce(world.lifecycle, {
    evidenceIds: [claim.evidenceId],
    caller: "test:lifecycle",
    reason: "explicit reinforce",
    at: T3,
  });
  assert.deepEqual(world.state.snapshot(), stateBefore);
  assert.equal(world.state.currentValue(ref), "green");
  assert.equal(
    world.lifecycle
      .transitions()
      .some((transition) => transition.kind === "decayed"),
    true,
  );
  assert.equal(
    world.lifecycle
      .transitions()
      .every((transition) => transition.caller.length > 0),
    true,
  );
});
