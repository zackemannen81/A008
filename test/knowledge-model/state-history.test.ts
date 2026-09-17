import assert from "node:assert/strict";
import test from "node:test";
import { asEntityId } from "../../src/memory/knowledge/index.js";
import { reconcile } from "../../src/memory/knowledge/reconcile.js";
import {
  bindingValue,
  KnowledgeState,
} from "../../src/memory/knowledge/state.js";
import type {
  KnowledgeStateSnapshot,
  ReconcileOutcomeKind,
  SlotClaim,
} from "../../src/memory/knowledge/state-types.js";
import { update } from "../../src/memory/knowledge/update.js";
import type {
  AttributeSlotRef,
  Instant,
  SlotDefinition,
} from "../../src/memory/knowledge/types.js";

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-06-01T00:00:00.000Z";
const T2 = "2026-09-01T00:00:00.000Z";
const T3 = "2026-09-15T00:00:00.000Z";
const STUB_POLICY = "accept-policy:stub-v1";

const FORBIDDEN_FIELDS = [
  "canonicalStatus",
  "supersededBy",
  "activationStatus",
  "relevanceScore",
  "activationThreshold",
  "keepAlive",
  "memoryStrength",
  "memory_strength",
] as const;

const RECONCILE_OUTCOMES: readonly ReconcileOutcomeKind[] = [
  "re_assertion",
  "change",
  "correction",
  "conflict",
  "retraction",
  "no_op",
];

function colorSlot(
  entity: string,
  name = "color",
): {
  readonly ref: AttributeSlotRef;
  readonly definition: SlotDefinition;
} {
  const ref: AttributeSlotRef = {
    kind: "attribute",
    entity: asEntityId(entity),
    name,
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
  readonly acceptanceEligible?: boolean;
}): SlotClaim {
  const valueLabel =
    input.value === null || input.value === undefined
      ? "null"
      : String(input.value);
  return {
    id: input.id,
    slot: input.slot,
    value: input.value,
    label:
      input.label ?? `${input.slot.entity}.${input.slot.name} = ${valueLabel}`,
    aboutInterval: {
      from: input.from,
      to: input.to === undefined ? null : input.to,
    },
    status: "asserted",
    attributedTo: input.attributedTo,
    causedBy: input.causedBy,
    kind: input.kind ?? "assertion",
    acceptanceEligible: input.acceptanceEligible ?? true,
    ...(input.retractsClaimId === undefined
      ? {}
      : { retractsClaimId: input.retractsClaimId }),
    ...(input.targetInterval === undefined
      ? {}
      : { targetInterval: input.targetInterval }),
  };
}

function historyView(state: KnowledgeState, slot: AttributeSlotRef) {
  return state.history(slot).map((binding) => ({
    value: bindingValue(binding),
    from: binding.interval.from,
    to: binding.interval.to,
  }));
}

function assertNoForbiddenFields(value: unknown, path: string): void {
  if (typeof value !== "object" || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoForbiddenFields(item, `${path}[${index}]`);
    }
    return;
  }
  for (const key of Object.keys(value)) {
    assert.equal(
      FORBIDDEN_FIELDS.includes(key as (typeof FORBIDDEN_FIELDS)[number]),
      false,
      `${path}.${key} must not exist on the new engine`,
    );
    assertNoForbiddenFields(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
  }
}

function assertSnapshotEqual(
  before: KnowledgeStateSnapshot,
  after: KnowledgeStateSnapshot,
): void {
  assert.deepEqual(after, before);
}

function acceptUpdate(
  state: KnowledgeState,
  proposal: SlotClaim,
  slot: SlotDefinition,
  expected: ReconcileOutcomeKind,
) {
  const before = state.snapshot();
  const decision = reconcile(state, proposal, slot);
  assertSnapshotEqual(before, state.snapshot());
  assert.equal(decision.outcome, expected);
  assert.equal(RECONCILE_OUTCOMES.includes(decision.outcome), true);
  assert.notEqual(decision.outcome, "supersede");
  if (expected === "retraction") {
    const retractedId = proposal.retractsClaimId ?? proposal.id;
    state.setClaimStatus(retractedId, "retracted");
  } else {
    state.setClaimStatus(proposal.id, "accepted");
  }
  const result = update(state, decision, { decidedBy: STUB_POLICY });
  assertNoForbiddenFields(result, "updateResult");
  assertNoForbiddenFields(state.snapshot(), "state");
  return { decision, result };
}

function playS1(state = new KnowledgeState()) {
  const { ref, definition } = colorSlot("brittans_hus");
  const white = colorClaim({
    id: "claim:white",
    slot: ref,
    value: "white",
    from: T0,
    causedBy: "assertion:a-white",
    attributedTo: "observer",
  });
  const red = colorClaim({
    id: "claim:red",
    slot: ref,
    value: "red",
    from: T1,
    causedBy: "event:e-painted-red",
    attributedTo: "Brittan",
    kind: "event_effect",
    label: "brittans_hus.color = red",
  });
  const green = colorClaim({
    id: "claim:green",
    slot: ref,
    value: "green",
    from: T2,
    causedBy: "assertion:a-green",
    attributedTo: "observer",
  });

  state.recordClaim(white);
  acceptUpdate(state, white, definition, "change");

  state.recordEvent({
    id: "event:e-painted-red",
    type: "house_painted",
    label: "Brittan painted the house red",
    eventTime: T1,
    causedBy: "event:e-painted-red",
    who: "Brittan",
    what: "red",
    effects: [{ slot: ref, value: "red" }],
  });
  state.recordClaim(red);
  acceptUpdate(state, red, definition, "change");

  state.recordClaim(green);
  acceptUpdate(state, green, definition, "change");

  return { state, ref, definition, white, red, green };
}

test("S1 — Changing house colour", () => {
  const { state, ref } = playS1();

  assert.equal(state.currentValue(ref), "green");
  assert.equal(state.currentValue(ref), "green");
  assert.equal(state.current(ref).length, 1);
  assert.equal(state.current(ref)[0]?.interval.to, null);

  assert.deepEqual(historyView(state, ref), [
    { value: "white", from: T0, to: T1 },
    { value: "red", from: T1, to: T2 },
    { value: "green", from: T2, to: null },
  ]);

  const painted = state
    .events()
    .find((event) => event.type === "house_painted");
  assert.ok(painted);
  assert.equal(painted.who, "Brittan");
  assert.equal(painted.eventTime, T1);
  assert.equal(painted.what, "red");

  assert.equal(state.history(ref).length, 3);
  assert.equal(state.claims(ref).length, 3);
  assert.equal(
    state
      .transitions(ref)
      .every((transition) => transition.outcome === "change"),
    true,
  );
  assert.equal(
    state
      .snapshot()
      .bindings.some(
        (binding) => "canonicalStatus" in binding || "supersededBy" in binding,
      ),
    false,
  );
  assertNoForbiddenFields(state.snapshot(), "s1");
});

test("S2 — Correction versus change", () => {
  const { state, ref, definition, white } = playS1();
  const beforeHistory = historyView(state, ref);
  assert.deepEqual(beforeHistory[0], { value: "white", from: T0, to: T1 });

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
  state.recordClaim(correction);
  const { decision, result } = acceptUpdate(
    state,
    correction,
    definition,
    "correction",
  );

  assert.equal(decision.outcome, "correction");
  assert.notEqual(decision.outcome, "change");
  assert.equal(result.opened, null);
  assert.equal(result.closed, null);
  assert.equal(result.transition.outcome, "correction");
  assert.equal(result.transition.from, "white");
  assert.equal(result.transition.to, null);

  assert.deepEqual(historyView(state, ref), [
    { value: "red", from: T1, to: T2 },
    { value: "green", from: T2, to: null },
  ]);
  assert.equal(state.currentValue(ref), "green");
  assert.equal(state.history(ref).length, 2);
  assert.equal(
    state.history(ref).some((binding) => bindingValue(binding) === "white"),
    false,
  );

  const original = state.claim(white.id);
  assert.ok(original);
  assert.equal(original.causedBy, "assertion:a-white");
  assert.equal(original.value, "white");
  assert.notEqual(original.status, undefined);

  const records = state.corrections(ref);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.correctedBy, "observer");
  assert.equal(records[0]?.from, "white");
  assert.equal(records[0]?.to, null);
  assert.equal(records[0]?.at, T3);
  assert.deepEqual(records[0]?.amendedInterval, { from: T0, to: T1 });
});

test("S8 — Conflict", () => {
  const state = new KnowledgeState();
  const { ref, definition } = colorSlot("rickards_bil");
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

  state.recordClaim(stefan);
  const first = reconcile(state, stefan, definition);
  assert.equal(first.outcome, "change");
  state.setClaimStatus(stefan.id, "accepted");
  update(state, first, { decidedBy: STUB_POLICY });
  assert.equal(state.currentValue(ref), "blue");

  state.recordClaim(anna);
  const before = state.snapshot();
  const conflict = reconcile(state, anna, definition);
  assertSnapshotEqual(before, state.snapshot());
  assert.equal(conflict.outcome, "conflict");
  assert.notEqual(conflict.outcome, "change");
  assert.equal(conflict.competingClaimIds.includes(stefan.id), true);

  assert.throws(
    () => update(state, conflict, { decidedBy: STUB_POLICY }),
    /does not apply to outcome conflict/,
  );

  state.applyConflict(conflict);

  assert.equal(state.current(ref).length, 0);
  assert.equal(state.currentValue(ref), undefined);
  assert.equal(state.isContested(ref), true);
  assert.equal(state.claim(stefan.id)?.status, "contested");
  assert.equal(state.claim(anna.id)?.status, "contested");
  assert.ok(state.claim(stefan.id));
  assert.ok(state.claim(anna.id));
  assert.equal(state.claims(ref).length, 2);
  assert.equal(
    state.history(ref).some((binding) => bindingValue(binding) === "red"),
    false,
  );
  assert.equal(
    state.history(ref).some((binding) => bindingValue(binding) === "blue"),
    false,
  );

  assert.throws(
    () => update(state, first, { decidedBy: STUB_POLICY }),
    /slot is contested/,
  );
});

test("S10 — Retraction", () => {
  const state = new KnowledgeState();
  const { ref, definition } = colorSlot("brittans_hus");
  const green = colorClaim({
    id: "claim:green-current",
    slot: ref,
    value: "green",
    from: T2,
    causedBy: "assertion:a-green",
    attributedTo: "observer",
  });
  state.recordClaim(green);
  acceptUpdate(state, green, definition, "change");
  assert.equal(state.currentValue(ref), "green");
  assert.equal(state.current(ref)[0]?.interval.to, null);

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
  state.recordClaim(retraction);
  const { decision, result } = acceptUpdate(
    state,
    retraction,
    definition,
    "retraction",
  );

  assert.equal(decision.outcome, "retraction");
  assert.equal(result.opened, null);
  assert.ok(result.closed);
  assert.equal(result.closed.interval.to, T3);
  assert.equal(bindingValue(result.closed), "green");
  assert.equal(result.transition.outcome, "retraction");
  assert.equal(result.transition.to, null);
  assert.equal(result.transition.causedBy, "assertion:a-retract");

  assert.equal(state.claim(green.id)?.status, "retracted");
  assert.equal(state.currentValue(ref), undefined);
  assert.equal(state.current(ref).length, 0);
  assert.deepEqual(historyView(state, ref), [
    { value: "green", from: T2, to: T3 },
  ]);
  assert.equal(
    state
      .claims(ref)
      .some(
        (claim) => claim.status === "accepted" && valuesMatchGreen(claim.value),
      ),
    false,
  );
  assert.equal(state.history(ref).length, 1);
});

test("CHANGE versus CORRECTION must not collapse", () => {
  const { state, ref, definition } = playS1();
  const mistakenChange = colorClaim({
    id: "claim:mistaken-change",
    slot: ref,
    value: null,
    from: T3,
    causedBy: "assertion:a-mistaken",
    attributedTo: "observer",
    kind: "assertion",
    targetInterval: { from: T0, to: T1 },
  });
  state.recordClaim(mistakenChange);
  const asChange = reconcile(state, mistakenChange, definition);
  assert.equal(asChange.outcome, "change");

  const correction = colorClaim({
    id: "claim:real-correction",
    slot: ref,
    value: null,
    from: T3,
    causedBy: "assertion:a-real-correction",
    attributedTo: "observer",
    kind: "correction",
    targetInterval: { from: T0, to: T1 },
  });
  const asCorrection = reconcile(state, correction, definition);
  assert.equal(asCorrection.outcome, "correction");
  assert.notEqual(asChange.outcome, asCorrection.outcome);
});

test("RECONCILE writes nothing", () => {
  const { state, ref, definition } = playS1();
  const restatement = colorClaim({
    id: "claim:restate-green",
    slot: ref,
    value: "green",
    from: T2,
    causedBy: "assertion:a-restate",
    attributedTo: "observer",
  });
  state.recordClaim(restatement);
  const before = state.snapshot();
  const decision = reconcile(state, restatement, definition);
  assert.equal(decision.outcome, "re_assertion");
  assertSnapshotEqual(before, state.snapshot());
  assert.throws(
    () => update(state, decision, { decidedBy: STUB_POLICY }),
    /does not apply to outcome re_assertion/,
  );
});

test("UPDATE writes no lifecycle field", () => {
  const state = new KnowledgeState();
  const { ref, definition } = colorSlot("brittans_hus");
  const white = colorClaim({
    id: "claim:white-lifecycle",
    slot: ref,
    value: "white",
    from: T0,
    causedBy: "assertion:a-white",
    attributedTo: "observer",
  });
  state.recordClaim(white);
  const { result } = acceptUpdate(state, white, definition, "change");
  const opened = result.opened;
  assert.ok(opened);
  assert.equal("activationStatus" in opened, false);
  assert.equal("keepAlive" in opened, false);
  assert.equal("memoryStrength" in opened, false);
  assert.equal("canonicalStatus" in opened, false);
  assert.equal(result.transition.outcome, "change");
  assert.equal(result.closed, null);
  assert.equal(opened.interval.to, null);
});

test("unknown times are not defaulted to now, and overlapping unknown is conflict not recency", () => {
  const state = new KnowledgeState();
  const { ref, definition } = colorSlot("rickards_bil");
  const unknown = { unknown: true } as const;
  const stefan = colorClaim({
    id: "claim:unknown-blue",
    slot: ref,
    value: "blue",
    from: unknown,
    causedBy: "assertion:stefan",
    attributedTo: "Stefan",
  });
  const anna = colorClaim({
    id: "claim:unknown-red",
    slot: ref,
    value: "red",
    from: unknown,
    causedBy: "assertion:anna",
    attributedTo: "Anna",
  });
  state.recordClaim(stefan);
  state.recordClaim(anna);
  const decision = reconcile(state, anna, definition);
  assert.equal(decision.outcome, "conflict");
  assert.equal(decision.at, unknown);
  assert.deepEqual(stefan.aboutInterval.from, { unknown: true });
});

function valuesMatchGreen(value: unknown): boolean {
  return value === "green";
}
