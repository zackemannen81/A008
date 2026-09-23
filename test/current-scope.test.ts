import assert from "node:assert/strict";
import test from "node:test";

import {
  ConversationScopes,
  DEFAULT_MAXIMUM_SCOPE_DOMAINS,
  advanceScope,
} from "../src/memory/knowledge/current-scope.js";
import { KnowledgeMemoryReader } from "../src/memory/knowledge/live-reader.js";
import { createKnowledgeContext } from "../src/memory/knowledge/read.js";
import { ingest } from "../src/memory/knowledge/ingest.js";
import type { KnowledgeReadContext } from "../src/memory/knowledge/read-types.js";
import type { RetrievalScopeClassifier } from "../src/orchestration/semantic-json-model.js";
import type { MemoryReadRequest } from "../src/memory/retrieval-types.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../src/identity/types.js";

// --- the rule --------------------------------------------------------------

test("an empty scope starts as the whole candidate set", () => {
  const update = advanceScope([], {
    domains: ["Psychology"],
    relatedDomains: ["Neuroscience", "Cognitive Science"],
  });
  assert.equal(update.outcome, "started");
  assert.deepEqual(update.scope, [
    "psychology",
    "neuroscience",
    "cognitive science",
  ]);
});

test("an overlapping classification widens rather than replaces", () => {
  const update = advanceScope(["psychology", "neuroscience"], {
    domains: ["neuroscience", "sleep science"],
    relatedDomains: ["cognitive science"],
  });
  assert.equal(update.outcome, "widened");
  assert.deepEqual([...update.scope].sort(), [
    "cognitive science",
    "neuroscience",
    "psychology",
    "sleep science",
  ]);
});

test("a related domain overlapping is enough to hold the discussion", () => {
  // The owner is explicit that the primary domain does not have to match.
  // Learning Science is not in scope, Cognitive Science is, so this is the same
  // discussion and the scope widens to include Learning Science.
  const update = advanceScope(["neuroscience", "cognitive science"], {
    domains: ["learning science"],
    relatedDomains: ["cognitive science", "education"],
  });
  assert.equal(update.outcome, "widened");
  assert.ok(update.scope.includes("neuroscience"), "the scope was replaced");
  assert.ok(update.scope.includes("learning science"));
  assert.ok(update.scope.includes("education"));
});

test("an empty intersection is a topic change and replaces the scope", () => {
  const update = advanceScope(
    ["psychology", "neuroscience", "cognitive science", "sleep science"],
    {
      domains: ["automotive engineering", "mechanical engineering"],
      relatedDomains: ["motorsport"],
    },
  );
  assert.equal(update.outcome, "replaced");
  assert.deepEqual(update.scope, [
    "automotive engineering",
    "mechanical engineering",
    "motorsport",
  ]);
  assert.ok(!update.scope.includes("neuroscience"));
});

test("a classification adding nothing new leaves the scope unchanged", () => {
  const update = advanceScope(["neuroscience", "psychology"], {
    domains: ["neuroscience"],
    relatedDomains: ["psychology"],
  });
  assert.equal(update.outcome, "unchanged");
  assert.deepEqual([...update.scope].sort(), ["neuroscience", "psychology"]);
});

test("a message the classifier could place nowhere changes nothing", () => {
  // Silence is not a new topic. Treating an empty classification as an empty
  // intersection would reset the discussion on every unclassifiable message.
  const update = advanceScope(["neuroscience"], {
    domains: [],
    relatedDomains: [],
  });
  assert.equal(update.outcome, "unchanged");
  assert.deepEqual(update.scope, ["neuroscience"]);
});

test("membership is normalised on both sides", () => {
  // `Cognitive Science` and `cognitive  science` are one subject area written
  // twice. Unnormalised they never intersect, and a missed intersection does
  // not read as a bug — it reads as a change of subject, silently discarding
  // the accumulated scope.
  const update = advanceScope(["cognitive science"], {
    domains: ["  Cognitive   Science  "],
    relatedDomains: ["NEUROSCIENCE"],
  });
  assert.equal(update.outcome, "widened");
  assert.deepEqual([...update.scope].sort(), [
    "cognitive science",
    "neuroscience",
  ]);
});

test("order is stable, so an identical read scopes identically", () => {
  const once = advanceScope(["a", "b"], {
    domains: ["c"],
    relatedDomains: ["a"],
  });
  const twice = advanceScope(["a", "b"], {
    domains: ["c"],
    relatedDomains: ["a"],
  });
  assert.deepEqual(once.scope, twice.scope);
});

// --- the ceiling -----------------------------------------------------------

test("gradual drift is bounded, and what it drops is reported", () => {
  // Not in the owner's specification and added deliberately. The reset fires
  // only on an empty intersection, so a discussion that moves one step at a
  // time overlaps at every consecutive pair and never resets — after forty
  // turns the scope matches essentially the whole store. That is a silent
  // degradation, which is the failure mode worth refusing.
  let scope: readonly string[] = [];
  let evicted: readonly string[] = [];
  for (let step = 0; step < 8; step += 1) {
    const update = advanceScope(
      scope,
      { domains: [`domain-${step}`], relatedDomains: [`domain-${step + 1}`] },
      { maximumDomains: 4 },
    );
    scope = update.scope;
    evicted = [...evicted, ...update.evicted];
  }
  assert.equal(scope.length, 4);
  assert.ok(evicted.length > 0, "nothing was evicted, so nothing is proved");
  // The most recent domains survive; the ones the discussion left behind go.
  assert.ok(scope.includes("domain-8"));
  assert.ok(evicted.includes("domain-0"));
});

test("a domain named again survives eviction ahead of one that was not", () => {
  // Recency means reinforcement: the domains a discussion keeps returning to
  // are the ones worth keeping when the ceiling bites.
  const first = advanceScope([], {
    domains: ["keep", "drop-a"],
    relatedDomains: ["drop-b"],
  });
  const second = advanceScope(
    first.scope,
    { domains: ["keep"], relatedDomains: ["new-one"] },
    { maximumDomains: 2 },
  );
  assert.deepEqual(second.scope, ["keep", "new-one"]);
  assert.deepEqual(second.evicted, ["drop-a", "drop-b"]);
});

test("a ceiling below one is refused rather than emptying the scope", () => {
  assert.throws(
    () =>
      advanceScope(
        [],
        { domains: ["a"], relatedDomains: [] },
        { maximumDomains: 0 },
      ),
    RangeError,
  );
  assert.equal(DEFAULT_MAXIMUM_SCOPE_DOMAINS, 32);
});

test("scopes are per conversation and do not leak between them", () => {
  const scopes = new ConversationScopes();
  scopes.advance("conversation-a", {
    domains: ["neuroscience"],
    relatedDomains: [],
  });
  scopes.advance("conversation-b", {
    domains: ["automotive engineering"],
    relatedDomains: [],
  });
  assert.deepEqual(scopes.current("conversation-a"), ["neuroscience"]);
  assert.deepEqual(scopes.current("conversation-b"), [
    "automotive engineering",
  ]);

  scopes.forget("conversation-a");
  assert.deepEqual(scopes.current("conversation-a"), []);
  assert.deepEqual(scopes.current("conversation-b"), [
    "automotive engineering",
  ]);
});

test("one conversation's scope cannot widen another's", () => {
  // Checking that the stored scopes differ is not enough: a reader that
  // *consults* every conversation would still write them back separately and
  // look correct. The leak only shows when the other conversation's scope
  // changes this one's outcome, so B here shares a domain with A and must
  // inherit nothing else from it.
  const scopes = new ConversationScopes();
  scopes.advance("a", {
    domains: ["neuroscience"],
    relatedDomains: ["psychology", "cognitive science"],
  });
  const b = scopes.advance("b", {
    domains: ["neuroscience"],
    relatedDomains: ["sleep science"],
  });

  assert.equal(b.outcome, "started");
  assert.deepEqual([...b.scope].sort(), ["neuroscience", "sleep science"]);
  assert.ok(
    !b.scope.includes("psychology"),
    "conversation b inherited conversation a's scope",
  );
});

// --- through the reader ----------------------------------------------------

const CONVERSATION =
  "A008_v1_conversation_70000000-0000-4000-8000-000000000002" as ConversationId;

function storeWith(
  facts: readonly {
    readonly content: string;
    readonly tags: readonly string[];
    readonly domains: readonly string[];
  }[],
): KnowledgeReadContext {
  const context = createKnowledgeContext();
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
      "A008_v1_project_70000000-0000-4000-8000-000000000001" as ProjectId,
    conversationId: CONVERSATION,
    taskId:
      "A008_v1_task_70000000-0000-4000-8000-000000000004" as RuntimeTaskId,
    agentId: "A008_v1_agent_70000000-0000-4000-8000-000000000003" as AgentId,
    message,
    applicabilityScopes: ["local"],
  };
}

test("retrieval is read-only and does not reinforce merely admitted evidence", async () => {
  const context = storeWith([
    {
      content: "Hippocampus fungerar som en växelstation för minnen",
      tags: ["hippocampus"],
      domains: ["neuroscience"],
    },
  ]);
  const utterance = context.evidence.listUtterances()[0]!;
  context.lifecycle.attach({
    evidenceId: utterance.id,
    evidenceKind: "utterance",
    strength: 0.4,
    decayLambda: 0,
  });
  const reader = new KnowledgeMemoryReader({ context });
  const first = request("Vad gör hippocampus med minnen?");

  const selected = await reader.read(first);
  assert.ok(selected.projection.projection.items.length > 0);
  assert.equal(context.lifecycle.get(utterance.id)!.lifecycle.strength, 0.4);
  assert.equal(context.lifecycle.snapshot().receipts!.length, 0);

  await reader.read(first);
  await reader.read({
    ...first,
    taskId:
      "A008_v1_task_70000000-0000-4000-8000-000000000005" as RuntimeTaskId,
  });
  assert.equal(
    context.lifecycle.get(utterance.id)!.lifecycle.strength,
    0.4,
    "retrieval alone is never a semantic recurrence",
  );
  assert.equal(context.lifecycle.snapshot().receipts!.length, 0);
});

function scripted(
  script: ReadonlyMap<
    string,
    {
      readonly domains: readonly string[];
      readonly relatedDomains: readonly string[];
    }
  >,
): RetrievalScopeClassifier {
  return {
    async classify(input) {
      return script.get(input.message) ?? { domains: [], relatedDomains: [] };
    },
  };
}

test("the owner's worked sequence: widen, carry, then reset on a new topic", async () => {
  const context = storeWith([
    {
      content:
        "Hippocampus fungerar som en växelstation för nya medvetna minnen",
      tags: ["hippocampus"],
      domains: ["neuroscience"],
    },
    {
      content: "Porsche 911 GT3 har en sugmotor på 4,0 liter",
      tags: ["motor"],
      domains: ["automotive engineering"],
    },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: scripted(
      new Map([
        [
          "Hur fungerar människans minne?",
          {
            domains: ["psychology"],
            relatedDomains: ["neuroscience", "cognitive science"],
          },
        ],
        [
          "Och vad händer när vi sover efter att vi lärt oss något?",
          { domains: ["sleep science"], relatedDomains: ["cognitive science"] },
        ],
        [
          "Vilken motor sitter i en Porsche 911 GT3?",
          {
            domains: ["automotive engineering"],
            relatedDomains: ["motorsport"],
          },
        ],
      ]),
    ),
  });

  const found = async (message: string): Promise<readonly string[]> => {
    const result = await reader.read(request(message));
    return result.projection.projection.items.map((item) => item.proposition);
  };

  // The question names no domain at all. It comes back as neuroscience, which
  // is what the classifier is for.
  const first = await found("Hur fungerar människans minne?");
  assert.ok(
    first.some((text) => text.includes("Hippocampus")),
    `a domain the message never names found nothing: ${JSON.stringify(first)}`,
  );

  // The payoff. This turn classifies as sleep science and cognitive science —
  // neither of which is on the stored record. It comes back anyway, because
  // neuroscience is still in the accumulated scope from the turn before.
  const carried = await found(
    "Och vad händer när vi sover efter att vi lärt oss något?",
  );
  assert.ok(
    carried.some((text) => text.includes("Hippocampus")),
    `the discussion scope did not carry: ${JSON.stringify(carried)}`,
  );

  // Empty intersection: a real change of subject, and the neuroscience scope
  // goes with it.
  const changed = await found("Vilken motor sitter i en Porsche 911 GT3?");
  assert.deepEqual(changed, ["Porsche 911 GT3 har en sugmotor på 4,0 liter"]);
});

test("this turn's own domains query even when the ceiling evicts them", async () => {
  // The accumulated scope subsumes this turn's classification in every ordinary
  // case, which is why the query carries both: the one case it does not is a
  // classification larger than the ceiling, where part of the turn's own
  // candidate is evicted on arrival. What the message was just classified as
  // must still be searched for.
  const context = storeWith([
    { content: "Ett faktum om ämne 0", tags: [], domains: ["domain-0"] },
    // Stored under a *related* domain, so the primary and the related list are
    // each proved to reach the query on their own.
    { content: "Ett faktum om ämne 1", tags: [], domains: ["domain-1"] },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopes: new ConversationScopes({ maximumDomains: 2 }),
    scopeClassifier: {
      async classify() {
        return {
          domains: ["domain-0"],
          relatedDomains: ["domain-1", "domain-2", "domain-3"],
        };
      },
    },
  });

  const result = await reader.read(request("Vad vet du?"));
  const found = result.projection.projection.items.map(
    (item) => item.proposition,
  );
  assert.ok(
    found.some((text) => text.includes("ämne 0")),
    `a primary domain was evicted before it was queried: ${JSON.stringify(found)}`,
  );
  assert.ok(
    found.some((text) => text.includes("ämne 1")),
    `a related domain was evicted before it was queried: ${JSON.stringify(found)}`,
  );
});

test("the classifier is offered the vocabulary the store actually holds", async () => {
  // The two provider calls have to share one taxonomy. Observed in the owner's
  // trace: retrieval answered in English and extraction in Swedish, and those
  // sets never intersect however they are normalised. Offering the stored
  // labels is what makes the model reuse them.
  const context = storeWith([
    { content: "Något om minnet", tags: ["minne"], domains: ["neurologi"] },
  ]);
  let offered:
    | {
        readonly knownDomains: readonly string[];
        readonly knownTags: readonly string[];
      }
    | undefined;
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: {
      async classify(input) {
        offered = {
          knownDomains: input.knownDomains,
          knownTags: input.knownTags,
        };
        return { domains: [], relatedDomains: [] };
      },
    },
  });

  await reader.read(request("Berätta något"));
  assert.deepEqual(offered?.knownDomains, ["neurologi"]);
  assert.deepEqual(offered?.knownTags, ["minne"]);
});

test("semantic necessity skips a greeting instead of matching an old greeting utterance", async () => {
  const context = storeWith([
    {
      content: "Hej, kan du bygga en bitmap font och textscroller?",
      tags: ["local"],
      domains: [],
    },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: {
      async classify() {
        return {
          retrieve: false,
          domains: [],
          relatedDomains: [],
          tags: [],
          relatedTags: [],
        };
      },
    },
  });

  const result = await reader.read(request("hej"));
  assert.equal(result.evidence.semanticRetrieval, "skipped");
  assert.equal(result.evidence.uniqueCandidateCount, 0);
  assert.deepEqual(result.projection.projection.items, []);
});

test("longer lexical questions require more than one generic shared word", async () => {
  const context = storeWith([
    {
      content: "The demo uses a tracker module for music",
      tags: [],
      domains: [],
    },
    {
      content: "The demo includes neon text and neon glow",
      tags: [],
      domains: [],
    },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: {
      async classify() {
        return {
          retrieve: true,
          domains: [],
          relatedDomains: [],
          tags: [],
          relatedTags: [],
        };
      },
    },
  });

  const result = await reader.read(
    request("does the demo have any neon text?"),
  );
  assert.equal(result.evidence.semanticRetrieval, "used");
  assert.deepEqual(
    result.projection.projection.items.map((item) => item.proposition),
    ["The demo includes neon text and neon glow"],
  );
});

test("a classifier failure narrows the read instead of failing the turn", async () => {
  // Scope classification improves what can be found; it is not a precondition
  // for answering. Turning a provider hiccup into a dead conversation would be
  // a worse bug than the narrower retrieval it avoids.
  const context = storeWith([
    {
      content: "Hippocampus fungerar som en växelstation",
      tags: ["hippocampus"],
      domains: ["neuroscience"],
    },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: {
      async classify() {
        throw new Error("provider exploded");
      },
    },
  });

  const result = await reader.read(request("Vad vet du om hippocampus?"));
  assert.equal(result.evidence.semanticRetrieval, "degraded");
  // The lexical half still works, so the tag match survives the failure.
  assert.ok(
    result.projection.projection.items.some((item) =>
      item.proposition.includes("Hippocampus"),
    ),
  );
});

test("an untrusted classifier draft cannot reach the store as anything but strings", async () => {
  // The draft is model output. A non-array, a nested object, a number in a list
  // — all dropped rather than allowed into a query.
  const context = storeWith([
    { content: "Något om minnet", tags: ["minne"], domains: ["neuroscience"] },
  ]);
  const reader = new KnowledgeMemoryReader({
    context,
    scopeClassifier: {
      async classify() {
        return {
          domains: "neuroscience" as never,
          relatedDomains: [1, { nested: true }, "neuroscience"] as never,
          tags: null as never,
          relatedTags: ["minne"],
        };
      },
    },
  });

  const result = await reader.read(request("Berätta något"));
  // The one usable string in the malformed arrays still worked; nothing threw.
  assert.ok(
    result.projection.projection.items.some((item) =>
      item.proposition.includes("minnet"),
    ),
  );
});

test("without a classifier the reader still works, on the lexical half alone", async () => {
  const context = storeWith([
    {
      content: "Hippocampus fungerar som en växelstation",
      tags: ["hippocampus"],
      domains: ["neuroscience"],
    },
  ]);
  const reader = new KnowledgeMemoryReader({ context });

  const named = await reader.read(request("Vad säger neuroscience om detta?"));
  assert.equal(named.evidence.semanticRetrieval, "not_configured");
  assert.ok(
    named.projection.projection.items.some((item) =>
      item.proposition.includes("Hippocampus"),
    ),
    "the lexical fallback stopped working",
  );

  // And the limit of that fallback, stated as a test: the label axes cannot
  // reach a domain the message does not contain. Some other channel may still
  // find the record on a shared word — that is what the direct lexical match is
  // for — but neither the tag nor the domain channel fires, and that gap is
  // exactly what the classifier fills.
  assert.equal(
    named.evidence.channelCounts.domain,
    1,
    "the named domain matched",
  );

  const unnamed = await reader.read(request("Hur fungerar människans minne?"));
  assert.equal(unnamed.evidence.channelCounts.domain, 0);
  assert.equal(unnamed.evidence.channelCounts.tag, 0);
});
