import assert from "node:assert/strict";
import test from "node:test";
import { accept } from "../../src/memory/knowledge/accept.js";
import {
  EvidenceStore,
  allowsWorldClaims,
  recordClaimsFromUtterance,
} from "../../src/memory/knowledge/evidence.js";
import {
  USER_ASSERTION_POLICY_ID,
  type ClaimDraft,
} from "../../src/memory/knowledge/evidence-types.js";
import { ingest } from "../../src/memory/knowledge/ingest.js";
import {
  composeProjectionPayload,
  payloadFromEvidence,
} from "../../src/memory/knowledge/payload.js";
import {
  KnowledgeModelError,
  UNKNOWN_INSTANT,
} from "../../src/memory/knowledge/index.js";
import type { KnowledgeIdFactory } from "../../src/memory/knowledge/index.js";

const TOMORROW: ClaimDraft["aboutInterval"] = {
  from: "2026-09-03T00:00:00.000Z",
  to: "2026-09-04T00:00:00.000Z",
};

const CURRENT: ClaimDraft["aboutInterval"] = {
  from: UNKNOWN_INSTANT,
  to: null,
};

const RAIN_DRAFT: ClaimDraft = {
  label: "rain(tomorrow)",
  proposition: {
    kind: "predicate",
    name: "rain",
    arguments: ["tomorrow"],
  },
  certainty: "probable",
  aboutInterval: TOMORROW,
};

const OWNS_DRAFT: ClaimDraft = {
  label: "rickard --owns--> car",
  proposition: {
    kind: "relationship_binding",
    subjectLabel: "Rickard",
    relation: "owns",
    objectLabel: "car",
  },
  certainty: "certain",
  aboutInterval: CURRENT,
};

const COLOR_DRAFT: ClaimDraft = {
  label: "rickards_bil.color = blue",
  proposition: {
    kind: "attribute_binding",
    entityLabel: "rickards_bil",
    attribute: "color",
    value: "blue",
  },
  certainty: "certain",
  aboutInterval: CURRENT,
};

const HEAVEN_DRAFT: ClaimDraft = {
  label: "speaker's father lives in heaven",
  proposition: {
    kind: "attribute_binding",
    entityLabel: "speaker_father",
    attribute: "location",
    value: "heaven",
  },
  certainty: "certain",
  aboutInterval: CURRENT,
};

function sequentialIds(): KnowledgeIdFactory {
  let sequence = 0;
  return () => String(++sequence).padStart(4, "0");
}

function verifiedScope(): { readonly verified: true } {
  return { verified: true };
}

function collectKeys(
  value: unknown,
  keys: Set<string> = new Set(),
): Set<string> {
  if (typeof value !== "object" || value === null) {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test("S4 — attributed prediction records an utterance and an asserted claim, not current weather state", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "It will probably rain tomorrow.",
      speaker: "Kanal 4 presenter",
      locator: "broadcast:2026-09-01",
      assertedAt: "2026-09-01T18:00:00.000Z",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );

  assert.equal(ingested.utterances.length, 1);
  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  assert.equal(utterance.speaker, "Kanal 4 presenter");
  assert.equal(utterance.act, "prediction");
  assert.equal(utterance.contentKind, "forecast");
  assert.equal(utterance.content, "It will probably rain tomorrow.");
  assert.equal(store.listClaims().length, 0);

  const claims = recordClaimsFromUtterance(store, utterance.id, [RAIN_DRAFT], {
    idFactory: ids,
  });
  assert.equal(claims.length, 1);
  const claim = claims[0];
  assert.ok(claim);
  assert.equal(claim.label, "rain(tomorrow)");
  assert.equal(claim.certainty, "probable");
  assert.equal(claim.attributedTo, "Kanal 4 presenter");
  assert.equal(claim.status, "asserted");
  assert.equal(claim.aboutInterval.to === null, false);

  const decision = accept(
    {
      claimId: claim.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "third_party" },
      confidence: 0.99,
    },
    store,
  );
  assert.equal(decision.decision, "not_accepted");
  assert.equal(decision.claim.status, "asserted");
  assert.equal("keepAlive" in decision.claim, false);
  assert.equal("strength" in decision.claim, false);

  const composed = payloadFromEvidence(store);
  assert.deepEqual(Object.keys(composed.payload), [
    "scope",
    "state",
    "history",
    "events",
    "utterances",
    "claims",
    "artifacts",
    "provenance",
  ]);
  assert.equal(composed.payload.state.length, 0);
  assert.equal(composed.payload.history.length, 0);
  assert.equal(composed.payload.utterances.length, 1);
  assert.equal(composed.payload.utterances[0]?.speaker, "Kanal 4 presenter");
  assert.equal(composed.payload.utterances[0]?.act, "prediction");
  assert.equal(composed.payload.claims.length, 1);
  assert.equal(composed.payload.claims[0]?.status, "asserted");
  assert.equal(composed.payload.claims[0]?.certainty, "probable");
  assert.equal(composed.payload.claims[0]?.attributedTo, "Kanal 4 presenter");
  assert.equal(composed.payload.claims[0]?.label, "rain(tomorrow)");

  const keys = collectKeys(composed.payload);
  for (const forbidden of [
    "id",
    "keepAlive",
    "strength",
    "memoryStrength",
    "retrievalScore",
    "revision",
    "canonicalStatus",
  ]) {
    assert.equal(
      keys.has(forbidden),
      false,
      `payload must not contain ${forbidden}`,
    );
  }
});

test("S5 — recitation of Fader vår is a prayer utterance and produces no world claim", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Fader vår som är i himmelen",
      speaker: "worshipper",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );

  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  assert.equal(utterance.act, "recitation");
  assert.equal(utterance.contentKind, "prayer");
  assert.equal(utterance.content, "Fader vår som är i himmelen");
  assert.equal(allowsWorldClaims(utterance.act), false);

  const claims = recordClaimsFromUtterance(
    store,
    utterance.id,
    [HEAVEN_DRAFT],
    {
      idFactory: ids,
    },
  );
  assert.equal(claims.length, 0);
  assert.equal(store.listClaims().length, 0);

  const composed = payloadFromEvidence(store);
  assert.equal(composed.payload.claims.length, 0);
  assert.equal(composed.payload.state.length, 0);
  assert.equal(composed.payload.utterances[0]?.act, "recitation");
  assert.equal(composed.payload.utterances[0]?.contentKind, "prayer");
});

test("S9 — attribution without acceptance keeps Stefan's claims asserted", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Rickard owns a blue car.",
      speaker: "Stefan",
      act: "assertion",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  const utterance = ingested.utterances[0];
  assert.ok(utterance);
  assert.equal(utterance.speaker, "Stefan");
  assert.equal(utterance.act, "assertion");
  assert.equal(store.listClaims().length, 0);

  const claims = recordClaimsFromUtterance(
    store,
    utterance.id,
    [OWNS_DRAFT, COLOR_DRAFT],
    { idFactory: ids },
  );
  assert.equal(claims.length, 2);
  assert.equal(
    claims.every((claim) => claim.status === "asserted"),
    true,
  );
  assert.equal(claims[0]?.attributedTo, "Stefan");
  assert.equal(claims[1]?.attributedTo, "Stefan");

  const owns = claims[0];
  assert.ok(owns);
  const decision = accept(
    {
      claimId: owns.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "third_party" },
      confidence: 0.99,
      sourceMessage: "Rickard owns a blue car.",
    },
    store,
  );
  assert.equal(decision.decision, "not_accepted");
  assert.equal(store.requireClaim(owns.id).status, "asserted");
  assert.equal(store.requireClaim(claims[1]!.id).status, "asserted");
  assert.equal("keepAlive" in decision.claim, false);
  assert.equal("strength" in decision.claim, false);

  const composed = payloadFromEvidence(store);
  assert.equal(composed.payload.state.length, 0);
  assert.equal(composed.payload.claims.length, 2);
  assert.equal(
    composed.payload.claims.every((claim) => claim.status === "asserted"),
    true,
  );
  assert.equal(
    composed.payload.claims.every((claim) => claim.attributedTo === "Stefan"),
    true,
  );
  assert.equal(composed.payload.utterances[0]?.speaker, "Stefan");
});

test("quotation and hypothetical never produce world claims", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const quoted = ingest(
    {
      content: '"Rickard owns a blue car."',
      speaker: "Anna",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  assert.equal(quoted.utterances[0]?.act, "quotation");
  assert.equal(
    recordClaimsFromUtterance(store, quoted.utterances[0]!.id, [OWNS_DRAFT], {
      idFactory: ids,
    }).length,
    0,
  );

  const hypothetical = ingest(
    {
      content: "Suppose Rickard owns a blue car.",
      speaker: "Anna",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  assert.equal(hypothetical.utterances[0]?.act, "hypothetical");
  assert.equal(
    recordClaimsFromUtterance(
      store,
      hypothetical.utterances[0]!.id,
      [OWNS_DRAFT],
      { idFactory: ids },
    ).length,
    0,
  );
  assert.equal(store.listClaims().length, 0);
});

test("question never produces a world claim", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Does Rickard own a blue car?",
      speaker: "user",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  assert.equal(ingested.utterances[0]?.act, "question");
  assert.equal(
    recordClaimsFromUtterance(store, ingested.utterances[0]!.id, [OWNS_DRAFT], {
      idFactory: ids,
    }).length,
    0,
  );
});

test("prediction never opens a current-state binding", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "It will probably rain tomorrow.",
      speaker: "Kanal 4 presenter",
      act: "prediction",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  assert.throws(
    () =>
      recordClaimsFromUtterance(
        store,
        ingested.utterances[0]!.id,
        [{ ...RAIN_DRAFT, aboutInterval: CURRENT }],
        { idFactory: ids },
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      error.code === "invalid_input" &&
      /prediction never opens a current-state binding/.test(error.message),
  );
  assert.equal(store.listClaims().length, 0);
});

test("ACCEPT is the only writer of Claim.status and user-assertion-v1 does not write keepAlive or strength", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Rickard owns a blue car.",
      speaker: "user",
      act: "assertion",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  const [claim] = recordClaimsFromUtterance(
    store,
    ingested.utterances[0]!.id,
    [OWNS_DRAFT],
    { idFactory: ids },
  );
  assert.ok(claim);
  assert.equal(claim.status, "asserted");

  const before = store.requireClaim(claim.id);
  assert.equal(before.status, "asserted");
  assert.equal(before.acceptance, undefined);

  const accepted = accept(
    {
      claimId: claim.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "user" },
      sourceMessage: "Rickard owns a blue car.",
      confidence: 0.05,
    },
    store,
  );
  assert.equal(accepted.decision, "accepted");
  assert.equal(accepted.claim.status, "accepted");
  assert.equal(accepted.policyId, USER_ASSERTION_POLICY_ID);
  assert.equal("keepAlive" in accepted.claim, false);
  assert.equal("strength" in accepted.claim, false);
  assert.equal("memoryStrength" in accepted.claim, false);
  assert.equal(store.requireClaim(claim.id).status, "accepted");

  const composed = payloadFromEvidence(store);
  assert.equal(composed.payload.claims[0]?.status, "accepted");
  assert.equal(composed.payload.state.length, 0);
});

test("analyzer confidence cannot accept a third-party claim", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Rickard owns a blue car.",
      speaker: "Stefan",
      act: "assertion",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  const [claim] = recordClaimsFromUtterance(
    store,
    ingested.utterances[0]!.id,
    [OWNS_DRAFT],
    { idFactory: ids },
  );
  assert.ok(claim);
  const decision = accept(
    {
      claimId: claim.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "third_party" },
      confidence: 1,
    },
    store,
  );
  assert.equal(decision.decision, "not_accepted");
  assert.equal(decision.claim.status, "asserted");
});

test("INGEST fails when scope is unverified and writes nothing", () => {
  const store = new EvidenceStore();
  assert.throws(
    () =>
      ingest(
        {
          content: "Rickard owns a blue car.",
          speaker: "Stefan",
          scope: { verified: false },
        },
        { store, idFactory: sequentialIds() },
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      error.code === "invalid_input" &&
      /verified runtime scope/.test(error.message),
  );
  assert.equal(store.listArtifacts().length, 0);
  assert.equal(store.listUtterances().length, 0);
});

test("ACCEPT fails when the policy is not identified or authority is unverified", () => {
  const store = new EvidenceStore();
  const ids = sequentialIds();
  const ingested = ingest(
    {
      content: "Rickard owns a blue car.",
      speaker: "user",
      act: "assertion",
      scope: verifiedScope(),
    },
    { store, idFactory: ids },
  );
  const [claim] = recordClaimsFromUtterance(
    store,
    ingested.utterances[0]!.id,
    [OWNS_DRAFT],
    { idFactory: ids },
  );
  assert.ok(claim);

  assert.throws(
    () =>
      accept(
        {
          claimId: claim.id,
          policy: { id: "" },
          authority: { verified: true, speakerRole: "user" },
        },
        store,
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      /identified policy/.test((error as KnowledgeModelError).message),
  );
  assert.throws(
    () =>
      accept(
        {
          claimId: claim.id,
          policy: { id: "not-a-policy" },
          authority: { verified: true, speakerRole: "user" },
        },
        store,
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      /not identified/.test((error as KnowledgeModelError).message),
  );
  assert.throws(
    () =>
      accept(
        {
          claimId: claim.id,
          policy: { id: USER_ASSERTION_POLICY_ID },
          authority: { verified: false, speakerRole: "user" },
        },
        store,
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      /verified authority/.test((error as KnowledgeModelError).message),
  );
  assert.equal(store.requireClaim(claim.id).status, "asserted");
});

test("INGEST and PROJECT fail closed when the exact serialized budget is exceeded", () => {
  const store = new EvidenceStore();
  assert.throws(
    () =>
      ingest(
        {
          content: "It will probably rain tomorrow.",
          speaker: "Kanal 4 presenter",
          scope: verifiedScope(),
          budget: { maximumUtf8Bytes: 8 },
        },
        { store, idFactory: sequentialIds() },
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      /budget exceeded/.test((error as KnowledgeModelError).message),
  );
  assert.equal(store.listUtterances().length, 0);

  assert.throws(
    () =>
      composeProjectionPayload({
        utterances: [
          {
            speaker: "Kanal 4 presenter",
            act: "prediction",
            contentKind: "forecast",
            content: "It will probably rain tomorrow.",
            assertedAt: "2026-09-01T18:00:00.000Z",
          },
        ],
        budget: { maximumUtf8Bytes: 8 },
      }),
    (error: unknown) =>
      error instanceof KnowledgeModelError &&
      /does not fit the exact serialized budget/.test(
        (error as KnowledgeModelError).message,
      ),
  );
});

test("sectioned payload is not a flat list of sentences and history carries an interval", () => {
  const composed = composeProjectionPayload({
    scope: { tags: ["weather"], entities: [], slots: [] },
    history: [
      {
        slot: "house.color",
        value: "white",
        interval: {
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-06-01T00:00:00.000Z",
        },
      },
    ],
    claims: [
      {
        label: "rain(tomorrow)",
        proposition: RAIN_DRAFT.proposition,
        certainty: "probable",
        attributedTo: "Kanal 4 presenter",
        status: "asserted",
        aboutInterval: TOMORROW,
      },
    ],
  });
  assert.equal(Array.isArray(composed.payload), false);
  assert.equal(
    composed.payload.history[0]?.interval.to,
    "2026-06-01T00:00:00.000Z",
  );
  assert.equal(composed.payload.claims[0]?.attributedTo, "Kanal 4 presenter");
  assert.equal(composed.payload.claims[0]?.status, "asserted");
  assert.equal(composed.payload.state.length, 0);
});

test("INGEST provenance defaults to appears_in for the dialogue path", () => {
  const store = new EvidenceStore();
  const ingested = ingest(
    {
      content: "The invoice total is 4500 SEK.",
      speaker: "user",
      locator: "turn:task-1",
      scope: verifiedScope(),
    },
    { store, idFactory: sequentialIds() },
  );

  const provenance = store.listProvenance();
  assert.equal(provenance.length, 1);
  assert.equal(provenance[0]?.relation, "appears_in");
  assert.equal(provenance[0]?.toId, ingested.artifact.id);
});

test("INGEST records a caller-named derived_from relation", () => {
  const store = new EvidenceStore();
  // A vision model's account of an uploaded image. The text never appeared in
  // the file, so recording it as appears_in would be a false provenance claim.
  const ingested = ingest(
    {
      content: "The image shows an invoice totalling 4500 SEK.",
      speaker: "vision-model",
      locator: "file:uploads/receipt.jpg",
      relation: "derived_from",
      scope: verifiedScope(),
    },
    { store, idFactory: sequentialIds() },
  );

  const provenance = store.listProvenance();
  assert.equal(provenance.length, 1);
  assert.equal(provenance[0]?.relation, "derived_from");
  assert.equal(provenance[0]?.toLabel, "file:uploads/receipt.jpg");
  assert.equal(ingested.utterances[0]?.speaker, "vision-model");
});

test("INGEST rejects an unknown relation and writes nothing", () => {
  const store = new EvidenceStore();

  assert.throws(
    () =>
      ingest(
        {
          content: "anything",
          speaker: "user",
          relation: "invented_by" as never,
          scope: verifiedScope(),
        },
        { store, idFactory: sequentialIds() },
      ),
    (error: unknown) =>
      error instanceof KnowledgeModelError && error.code === "invalid_input",
  );

  // Validation runs before addArtifact, so a rejected call leaves no partial
  // write behind.
  assert.equal(store.listArtifacts().length, 0);
  assert.equal(store.listUtterances().length, 0);
  assert.equal(store.listProvenance().length, 0);
});
