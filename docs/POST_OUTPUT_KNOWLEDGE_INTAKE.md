# Post-output knowledge intake

Status: Implemented provider-neutral staging boundary. An exported model-backed
analyzer can use the shared stateless semantic JSON owner, and the separate
relation gate can consume one staged proposal. No live/background invocation is
connected. The exported coordinator can stage once and process the resulting
proposals sequentially.

## Output channels

| Provider output | Immediate use | Committed chat | Retrieval/history | Knowledge intake |
| --- | --- | --- | --- | --- |
| reasoning delta / `completion.reasoning` | CLI stderr or ACP thought event | never | never | never |
| content delta / `completion.message.content` | user-visible answer | assistant message | bounded as dialogue | final-answer input |
| usage / finish reason | operational result | never | never | never |

`ChatMessage` has only role and content. `ChatSession` commits the normalized
original user message and `completion.message`; reasoning remains separate
completion metadata. The memory-aware reader therefore sees only prior user and
assistant messages, never the reasoning stream.

An ACP host can keep its own thought-event log for display. That external log is
not A008 conversation or memory state and is not accepted back as semantic
history.

## Staged flow

```text
original message + final answer
             |
             v
  exact semantic analyzer input
       { message, answer }
             |
             v
 untrusted semantic draft array
             |
             v
 validate + normalize + hard limits
             |
             v
 context-bound staged batch
             |
             v
       STOP — staging performs no write

Separate implemented boundary, called explicitly:
  RelationGatedMemoryCommit(batch, proposalIndex)
    -> bounded materialized current candidates
    -> ID-free five-way relation decision
    -> guarded SemanticMemory.reconcile
    -> updated / not_required / pending_repair
```

## Analyzer contract

The analyzer port receives a fresh object with exactly this shape:

```ts
interface PostOutputAnalyzerInput {
  readonly message: string;
  readonly answer: string;
}
```

It does not receive `ChatCompletion`. Reasoning cannot be selected accidentally
from that object because it is not present. History, identity, prior memory,
retrieval plans/evidence, usage, and finish reason are also absent.

`ModelBackedPostOutputKnowledgeAnalyzer` is the concrete adapter. It serializes
exactly `{ message, answer }` beneath the `knowledge_analysis` operation and
uses an injected `SemanticJsonGenerator`. The shared transport call remains
stateless; parsed output is still untrusted and all validation below remains in
this intake service.

The output is semantic-only:

```ts
interface AnalyzedKnowledgeDraft {
  readonly proposition: string;
  readonly kind: string;
  readonly tags?: readonly string[];
  readonly domains?: readonly string[];
  readonly entities?: readonly string[];
  readonly confidence?: number;
}
```

Extra runtime properties on an untrusted JavaScript result are ignored during
explicit materialization. In particular, an analyzer cannot supply scope,
authority, relevance, threshold, keep-alive, source-backed status, provenance,
IDs, lifecycle, or relation decisions.

## Runtime-owned staging

The service validates project, conversation, and agent context at construction
and validates one runtime task per call. Those identities are attached to the
returned application batch but never cross the analyzer boundary or enter its
serialized semantic payload.

Every staged `KnowledgeProposal` receives:

- normalized caller-verified applicability scopes;
- relevance score `0`;
- positive configured activation threshold, default `0.5`;
- `keepAlive: false`;
- configured authority, default `0.25`;
- analyzer confidence, default `0.5`;
- `sourceBacked: false`; and
- empty provenance.

This is a conservative staging shape, not an assertion that the proposal is
true. Staging performs no `SemanticMemory.reconcile` call and cannot mutate a
repository or retrieval index.

## Limits and serialization

Default structural limits are eight proposals, sixteen tags, eight domains,
and sixteen entities per proposal. Callers may choose smaller positive limits.
Empty strings, non-string labels, invalid confidence, duplicate semantic
propositions, excessive arrays, and malformed results fail closed.

The exact staged semantic payload has fixed JSON key order. The injected budget
measurer evaluates that exact string; `Utf8ByteKnowledgeIntakeMeasurer` is the
local reference. Over-budget output is rejected as a whole rather than silently
truncated into a different proposition.

## Local benchmark

Run:

```powershell
npm run benchmark:memory-loop
```

The command builds a deterministic proof using an actual in-memory SQLite
repository, `HybridMemoryReader`, `MemoryAwareChatSession`, and a fake streaming
provider. It performs two turns and asserts:

- two memory reads and two provider calls;
- the same relevant canonical knowledge selected on both turns;
- zero then two prior provider-visible dialogue messages;
- separate reasoning and content deltas;
- four committed dialogue messages;
- no prior reasoning in the second request or committed history; and
- no runtime or knowledge control ID in provider-visible messages.

The report includes observed elapsed milliseconds and request bytes. Bytes are
exact for that run; timings are explicitly not a performance guarantee. It is
not a live-provider, model-quality, tokenizer, throughput, or latency benchmark.

## Failure and security boundary

Analyzer failure, cancellation, and invalid or over-budget output reject
staging. Since the service has no write port, failure cannot partially change
memory. The user-
visible chat completion is an independently owned earlier result; a future
application integration must report post-output failure without pretending the
already-streamed answer rolled back.

No implementation in this boundary reads environment variables, credentials,
files, databases, or networks. The benchmark creates only an in-memory SQLite
database and uses a deterministic fake provider.

See [Stateless semantic JSON model calls](SEMANTIC_JSON_MODEL_CALLS.md) for the
implemented transport-backed analyzer, strict response, reasoning-exclusion,
budget, and cancellation contract.

The staged batch is the input contract for
[Relation-gated memory commit](RELATION_GATED_MEMORY_COMMIT.md). That separate
service revalidates the batch and processes one proposal per call. This does not
make staging itself a write, and no live A008 surface currently joins the two
services automatically. `PostOutputMemoryCoordinator` is the implemented manual
application join and preserves explicit partial outcomes; see
[Post-output memory coordinator](POST_OUTPUT_MEMORY_COORDINATOR.md).
