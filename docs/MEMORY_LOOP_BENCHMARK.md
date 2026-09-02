# Committed memory-loop benchmark

Status: Implemented deterministic architecture proof. It is not a live model,
production application owner, or performance guarantee.

## Purpose

`npm run benchmark:memory-loop` proves that the separately implemented read,
chat, post-output semantic, guarded write, index, and next-read boundaries can
form one honest two-turn loop:

```text
question 1
  -> SQLite hybrid read + revision-one projection
  -> streamed chat reasoning + final answer
  -> strict JSON knowledge analysis (message + answer only)
  -> ID-free relation classification: extend candidate_1
  -> guarded canonical/index commit: revision 1 -> 2
question 2
  -> SQLite hybrid read + revision-two projection
  -> streamed chat reasoning + final answer
```

One fake `ChatTransport` instance owns all four calls in exact order:

```text
chat -> knowledge_analysis -> relation_classification -> chat
```

The two chat calls use one `ChatSession`; the two semantic calls use the shared
stateless JSON generator and never become dialogue history. Actual in-memory
SQLite owns canonical state and all retrieval channels. No network, environment,
credential, or external process participates.

## Active baseline and safety claim

The benchmark begins with one current, active, indexed revision-one item. The
post-output proposal extends that exact item. Existing reconciliation preserves
its active state while changing the proposition and revision, so question two
may legitimately project revision two.

This proof intentionally does not create a brand-new item and silently activate
it. `PostOutputKnowledgeIntake` gives an untrusted new draft relevance zero and
a positive activation threshold, so a `new` commit remains dormant. Choosing a
confirmation, evidence, or user-authority signal that can activate new knowledge
is a separate policy task. The report records
`newDraftAutoActivationProven: false`.

## Structural assertions

The compiled benchmark fails unless all of these remain true:

- two memory reads, two chat calls, and two stateless semantic calls occur;
- question one selects the baseline proposition and question two selects the
  extended proposition under the same canonical ID;
- one post-output proposal completes as `extend` with index `updated`;
- canonical state remains current/active and advances from revision one to two;
- audit contains `knowledge_extended`;
- provider-visible prior dialogue is zero messages, then two messages;
- semantic requests contain exactly two messages each and no chat history;
- chat reasoning never enters the second request, chat history, or canon;
- semantic completion reasoning never enters coordinator results or canon;
- runtime/knowledge IDs, relation handles, and semantic operation details never
  enter user-chat provider messages; and
- only original user/final assistant messages commit to dialogue state.

The JSON report includes exact request byte counts and observed elapsed times.
Bytes describe that deterministic run. Timings carry
`timingIsGuarantee: false` and are not latency or throughput claims.

## Run

```powershell
npm run benchmark:memory-loop
```

The normal `npm test` suite also spawns the compiled benchmark and validates its
stable v2 report contract.

See [Memory-aware chat orchestration](MEMORY_AWARE_CHAT_ORCHESTRATION.md),
[Post-output memory coordinator](POST_OUTPUT_MEMORY_COORDINATOR.md), and
[Stateless semantic JSON model calls](SEMANTIC_JSON_MODEL_CALLS.md).
