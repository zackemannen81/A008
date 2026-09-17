import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { accept } from "../src/memory/knowledge/accept.js";
import { UNKNOWN_INSTANT } from "../src/memory/knowledge/clocks.js";
import {
  EvidenceStore,
  recordClaimsFromUtterance,
} from "../src/memory/knowledge/evidence.js";
import { USER_ASSERTION_POLICY_ID } from "../src/memory/knowledge/evidence-types.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import { inspectKnowledge } from "../src/memory/knowledge/inspection.js";
import { createKnowledgeContext } from "../src/memory/knowledge/index.js";
import {
  certaintyFromConfidence,
  selectUtteranceDomains,
  statementEntityLabel,
} from "../src/memory/knowledge/write-policy.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../src/orchestration/post-output-knowledge-intake.js";
import { isExplicitUserAssertion } from "../src/runtime/user-assertion-gate.js";

const PROJECT = parseRuntimeId(
  "A008_v1_project_96000000-0000-4000-8000-000000000001",
  "project",
);
const CONVERSATION = parseRuntimeId(
  "A008_v1_conversation_96000000-0000-4000-8000-000000000002",
  "conversation",
);
const TASK = parseRuntimeId(
  "A008_v1_task_96000000-0000-4000-8000-000000000003",
  "task",
);
const AGENT = parseRuntimeId(
  "A008_v1_agent_96000000-0000-4000-8000-000000000004",
  "agent",
);

function idFactory() {
  let next = 0;
  return () => String(++next);
}

test("mixed request/assertion utterances are evaluated on the supporting span", () => {
  const message = "Kan du skapa README? Dokumenten ligger i C:\\docs.";
  const assertion = "Dokumenten ligger i C:\\docs.";
  const assertionStart = message.indexOf(assertion);
  const request = "Kan du skapa README";

  assert.equal(isExplicitUserAssertion(message, assertion), false);
  assert.equal(
    isExplicitUserAssertion(message, assertion, {
      start: assertionStart,
      end: assertionStart + assertion.length,
    }),
    true,
  );
  assert.equal(
    isExplicitUserAssertion(message, request, {
      start: 0,
      end: request.length,
    }),
    false,
  );
});

test("user-assertion acceptance rejects request evidence but accepts an assertion span", () => {
  const store = new EvidenceStore();
  const nextId = idFactory();
  const message = "Kan du skapa README? Dokumenten ligger i C:\\docs.";
  const assertion = "Dokumenten ligger i C:\\docs.";
  const assertionStart = message.indexOf(assertion);
  const utterance = ingest(
    {
      content: message,
      speaker: "user",
      act: "assertion",
      scope: { verified: true },
    },
    { store, idFactory: nextId },
  ).utterances[0]!;

  const claims = recordClaimsFromUtterance(
    store,
    utterance.id,
    [
      {
        label: assertion,
        proposition: {
          kind: "attribute_binding",
          entityLabel: "documents",
          attribute: "location",
          value: "C:\\docs",
        },
        certainty: "certain",
        aboutInterval: { from: UNKNOWN_INSTANT, to: null },
      },
      {
        label: "Kan du skapa README",
        proposition: {
          kind: "predicate",
          name: "create_readme",
          arguments: [],
        },
        certainty: "possible",
        aboutInterval: { from: UNKNOWN_INSTANT, to: null },
      },
    ],
    { idFactory: nextId },
  );

  const accepted = accept(
    {
      claimId: claims[0]!.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "user" },
      sourceMessage: message,
      sourceSpan: {
        start: assertionStart,
        end: assertionStart + assertion.length,
      },
    },
    store,
  );
  const refused = accept(
    {
      claimId: claims[1]!.id,
      policy: { id: USER_ASSERTION_POLICY_ID },
      authority: { verified: true, speakerRole: "user" },
      sourceMessage: message,
      sourceSpan: { start: 0, end: "Kan du skapa README".length },
    },
    store,
  );

  assert.equal(accepted.decision, "accepted");
  assert.equal(refused.decision, "not_accepted");
});

test("write-side domain cap does not erase proposal domains", async () => {
  const domains = ["one", "two", "three", "four", "five"];
  const stager = new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return domains.map((domain, index) => ({
          severity: "minor" as const,
          proposition: `Durable claim ${index + 1}`,
          kind: "fact",
          domains: [domain],
        }));
      },
    },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 1_048_576,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  });

  const batch = await stager.stage({
    taskId: TASK,
    message: "This turn contains several unrelated durable claims.",
    answer: "Acknowledged.",
    applicabilityScopes: ["local"],
  });

  assert.deepEqual(
    batch.proposals.map((entry) => entry.domains),
    domains.map((domain) => [domain]),
  );
  assert.deepEqual(
    selectUtteranceDomains(batch.proposals),
    domains.slice(0, 4),
  );
});

test("structured propositions survive staging without free-text reparsing", async () => {
  const structured = {
    kind: "relationship_binding" as const,
    subjectLabel: "A008-0096",
    relation: "implemented_on",
    objectLabel: "a008/A008-0096",
  };
  const stager = new PostOutputKnowledgeIntake({
    analyzer: {
      async analyze() {
        return [
          {
            severity: "important" as const,
            proposition: "A008-0096 was implemented on branch a008/A008-0096.",
            kind: "relationship",
            structuredProposition: structured,
            entities: ["A008-0096", "a008/A008-0096"],
          },
        ];
      },
    },
    context: {
      projectId: PROJECT,
      conversationId: CONVERSATION,
      agentId: AGENT,
    },
    budget: {
      maximum: 1_048_576,
      measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
    },
  });

  const batch = await stager.stage({
    taskId: TASK,
    message: "A008-0096 was implemented on branch a008/A008-0096.",
    answer: "Noted.",
    applicabilityScopes: ["local"],
  });

  assert.deepEqual(
    batch.proposals[0]!.proposal.structuredProposition,
    structured,
  );
  assert.match(batch.serialized, /structuredProposition/u);
});

test("certainty follows confidence and statement fallback never uses proposition text as identity", () => {
  assert.equal(certaintyFromConfidence(0.95), "certain");
  assert.equal(certaintyFromConfidence(0.8), "probable");
  assert.equal(certaintyFromConfidence(0.5), "possible");
  assert.equal(certaintyFromConfidence(0.2), "unlikely");

  const proposition = "The upgraded file includes generated background music.";
  const label = statementEntityLabel(proposition);
  assert.match(label, /^statement_[0-9a-f]{12}$/u);
  assert.equal(label.includes(proposition), false);
});

test("inspection keeps provenance nodes but suppresses the duplicate direct claim-to-utterance edge", () => {
  const context = createKnowledgeContext();
  const nextId = idFactory();
  const utterance = ingest(
    {
      content: "A008-0096 is ready for review.",
      speaker: "user",
      act: "assertion",
      scope: { verified: true },
    },
    { store: context.evidence, idFactory: nextId },
  ).utterances[0]!;
  const claim = recordClaimsFromUtterance(
    context.evidence,
    utterance.id,
    [
      {
        label: "A008-0096 is ready for review.",
        proposition: {
          kind: "predicate",
          name: "ready_for_review",
          arguments: ["A008-0096"],
        },
        certainty: "certain",
        aboutInterval: { from: UNKNOWN_INSTANT, to: null },
      },
    ],
    { idFactory: nextId },
  )[0]!;

  const inspected = inspectKnowledge(context, {
    projectId: "A008-0096-inspection",
    durable: false,
  });
  const claimNode = `claim:${claim.id}`;
  const utteranceNode = `utterance:${utterance.id}`;

  assert.equal(
    inspected.graph.edges.filter(
      (edge) =>
        edge.from === claimNode &&
        edge.to === utteranceNode &&
        edge.relation === "derived_from",
    ).length,
    0,
  );
  assert.equal(inspected.summary.counts.provenance, 2);
  assert.ok(
    inspected.graph.edges.some(
      (edge) => edge.relation === "from" && edge.to === claimNode,
    ),
  );
  assert.ok(
    inspected.graph.edges.some(
      (edge) => edge.relation === "to" && edge.to === utteranceNode,
    ),
  );
});
