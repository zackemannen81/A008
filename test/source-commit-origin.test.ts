import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import {
  KnowledgeEngineCommit,
  createSqliteKnowledgeContext,
  sqliteKnowledgeTestProjectId,
} from "../src/memory/knowledge/index.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import type { StagedKnowledgeBatch } from "../src/orchestration/post-output-knowledge-intake.js";
import type { KnowledgeRelationClassifier } from "../src/orchestration/relation-gated-memory-commit.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_40000000-0000-4000-8000-000000000049",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_40000000-0000-4000-8000-000000000050",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_40000000-0000-4000-8000-000000000051",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_40000000-0000-4000-8000-000000000052",
  "agent",
);

/** The document text. The extracted proposition is literally inside it. */
const DOCUMENT =
  "The invoice total is 4500 SEK. The invoice was approved by finance.";
const PROPOSITION = "The invoice total is 4500 SEK";
const LOCATOR = "source:deadbeef/invoice.txt";

const alwaysNew: KnowledgeRelationClassifier = {
  async classify() {
    return { type: "new" };
  },
};

function batch(
  origin: StagedKnowledgeBatch["origin"],
  sourceMessage: string,
): StagedKnowledgeBatch {
  const proposals = [
    { severity: "important" as const,
      proposal: {
        id: "prop-1",
        proposition: PROPOSITION,
        kind: "fact",
        scope: ["runtime"],
        tags: [],
        provenance: [],
      },
      domains: ["finance"],
      entities: ["invoice"],
    },
  ] as unknown as StagedKnowledgeBatch["proposals"];

  return {
    projectId: PROJECT,
    conversationId: CONVERSATION,
    taskId: TASK,
    agentId: AGENT,
    origin,
    skippedProposals: [],
    sourceMessage,
    proposals,
    serialized: JSON.stringify(proposals),
    measuredUnits: 1,
    measurementUnit: "utf8-bytes",
  };
}

async function withContext(
  run: (handle: ReturnType<typeof createSqliteKnowledgeContext>) => Promise<void>,
): Promise<void> {
  const handle = createSqliteKnowledgeContext({
    filename: ":memory:",
    projectId: sqliteKnowledgeTestProjectId(),
  });
  try {
    await run(handle);
  } finally {
    handle.close();
  }
}

test("a source claim is not accepted as a user assertion", async () => {
  await withContext(async (handle) => {
    // Stand in for what LocalMemoryRuntime.ingestSource already did: the
    // document is ingested once, with the extractor's own provenance.
    const ingested = ingest(
      {
        content: DOCUMENT,
        speaker: "user",
        locator: LOCATOR,
        relation: "appears_in",
        scope: { verified: true },
      },
      { store: handle.context.evidence },
    );
    const utteranceId = ingested.utterances[0]?.id;
    assert.ok(utteranceId);
    const utterancesAfterIngest = handle.context.evidence.listUtterances().length;

    await new KnowledgeEngineCommit({
      context: handle.context,
      classifier: alwaysNew,
    }).commit({
      batch: batch({ kind: "source", utteranceId }, LOCATOR),
      proposalIndex: 0,
    });

    const claims = handle.context.evidence.listClaims();
    assert.ok(claims.length > 0, "a claim was recorded");
    for (const claim of claims) {
      // Uploading a document is not asserting its contents. If this ever reads
      // "accepted", an entire uploaded file has been committed as though the
      // user had stated every claim in it.
      assert.notEqual(
        claim.status,
        "accepted",
        "a source claim must stay asserted, not be accepted",
      );
    }

    assert.equal(
      handle.context.evidence.listUtterances().length,
      utterancesAfterIngest,
      "a source batch must reuse its utterance, not ingest the document again",
    );
  });
});

test("a dialogue claim still reaches the user-assertion policy", async () => {
  await withContext(async (handle) => {
    const before = handle.context.evidence.listUtterances().length;

    await new KnowledgeEngineCommit({
      context: handle.context,
      classifier: alwaysNew,
      // The user said it, and the message contains the proposition, so the
      // policy applies exactly as it did before this change.
    }).commit({
      batch: batch({ kind: "dialogue" }, DOCUMENT),
      proposalIndex: 0,
    });

    assert.ok(
      handle.context.evidence.listUtterances().length > before,
      "a dialogue batch ingests the user's turn",
    );
    assert.equal(
      handle.context.evidence.listClaims().some((claim) => claim.status === "accepted"),
      true,
      "the dialogue path still accepts",
    );
  });
});

test("the commit path refuses source acceptance even if staging got it wrong", async () => {
  await withContext(async (handle) => {
    const ingested = ingest(
      {
        content: DOCUMENT,
        speaker: "user",
        locator: LOCATOR,
        relation: "appears_in",
        scope: { verified: true },
      },
      { store: handle.context.evidence },
    );
    const utteranceId = ingested.utterances[0]?.id;
    assert.ok(utteranceId);

    // Defence in depth. Staging puts the *locator* in sourceMessage precisely so
    // no proposition is ever contained in it. This batch simulates that first
    // layer failing: sourceMessage is the whole document, so
    // isExplicitUserAssertion would return true for the proposition it holds.
    // The commit path must still refuse to accept, because the origin says this
    // was not something the user said.
    assert.equal(DOCUMENT.includes(PROPOSITION), true, "the trap is armed");

    await new KnowledgeEngineCommit({
      context: handle.context,
      classifier: alwaysNew,
    }).commit({
      batch: batch({ kind: "source", utteranceId }, DOCUMENT),
      proposalIndex: 0,
    });

    for (const claim of handle.context.evidence.listClaims()) {
      assert.notEqual(
        claim.status,
        "accepted",
        "origin, not sourceMessage, is what decides acceptance for a source",
      );
    }
  });
});

test("a classifier conflict is applied even when cardinality allows both", async () => {
  // A008-0062 made `<entity>.statement` a set, so `reconcile` no longer calls a
  // second distinct value a conflict — it opens another member. The classifier
  // still can, and when it does its judgement is the one that counts.
  //
  // Before this was handled, `applyConflict` was handed the `change` decision
  // `reconcile` had returned and threw "applyConflict requires a conflict
  // decision", turning a genuine contradiction into a crash.
  await withContext(async (handle) => {
    const message = "Zorros häst heter Fresca. Zorros häst heter Tornado.";
    const proposals = [
      { proposition: "Zorros häst heter Fresca" },
      { proposition: "Zorros häst heter Tornado" },
    ].map((entry, index) => ({ severity: "important" as const,
      proposal: {
        id: `prop-${index + 1}`,
        proposition: entry.proposition,
        kind: "fact",
        scope: ["runtime"],
        tags: [],
        provenance: [],
      },
      domains: ["fiktion"],
      entities: ["Zorro"],
    })) as unknown as StagedKnowledgeBatch["proposals"];

    const contradicting: KnowledgeRelationClassifier = {
      async classify(input) {
        return input.proposal.proposition.includes("Tornado")
          ? { type: "conflict", targetHandles: input.candidates.map((c) => c.handle) }
          : { type: "new" };
      },
    };

    const committer = new KnowledgeEngineCommit({
      context: handle.context,
      classifier: contradicting,
    });
    const staged: StagedKnowledgeBatch = {
      ...batch({ kind: "dialogue" }, message),
      proposals,
      serialized: JSON.stringify(proposals),
    };

    await committer.commit({ batch: staged, proposalIndex: 0 });
    await committer.commit({ batch: staged, proposalIndex: 1 });

    const snapshot = handle.context.state.snapshot();
    assert.deepEqual(
      snapshot.contestedSlotKeys,
      ["attribute:zorro:statement"],
      "a classifier conflict did not contest the slot",
    );
    const contested = snapshot.claims.filter(
      (claim) => claim.status === "contested",
    );
    assert.ok(
      contested.length >= 2,
      `both accounts must be retained as contested, got ${contested.length}`,
    );
  });
});

test("a statement slot is registered as a set on the very first commit", async () => {
  // Asserted after exactly one proposal, before any second one could have
  // widened it. `#ensureSlot` repairs a legacy single-valued slot as well, and
  // that repair covers for a wrong registration so completely that the
  // registration itself would otherwise go unchecked — which is how redundant
  // code turns into code nobody notices is wrong.
  await withContext(async (handle) => {
    await new KnowledgeEngineCommit({
      context: handle.context,
      classifier: alwaysNew,
    }).commit({
      batch: batch({ kind: "dialogue" }, DOCUMENT),
      proposalIndex: 0,
    });

    const statement = handle.context.slots
      .list()
      .filter((slot) => slot.ref.kind === "attribute" && slot.ref.name === "statement");
    assert.equal(statement.length, 1);
    assert.equal(
      statement[0]?.cardinality,
      "set",
      "an entity has many statements; single cardinality made two of them a conflict",
    );
  });
});
