# Stateless semantic JSON model calls

Status: Implemented provider-neutral call and adapter boundary, composed by
the shared local runtime used by supported clients.

## Purpose

The post-output memory pipeline has two model-shaped ports:

1. analyze original message plus final answer into untrusted knowledge drafts;
2. classify one staged proposal against bounded current candidates.

`ChatTransportSemanticJsonGenerator` lets both ports use the same injected
provider transport while remaining stateless. It deliberately does not use
`ChatSession`, so semantic prompts and responses cannot become dialogue history.

## Call shape

```text
fixed semantic system instruction
                 +
stable user JSON { operation, input }
                 |
                 v
exact serialized-message budget
                 |
                 v
one ChatTransport.complete call
  stream=false + optional AbortSignal
                 |
                 v
strict assistant JSON content only
                 |
       .---------+----------.
       |                    |
knowledge drafts       relation decision
       |                    |
existing intake       existing relation gate
validation             handle validation
```

Each call has exactly two messages: one `system`, then one `user`. It includes
no committed history and supplies no delta callback. The user message is stable
JSON:

```json
{"operation":"knowledge_analysis","input":{"message":"...","answer":"..."}}
```

or:

```json
{"operation":"relation_classification","input":{"proposal":{},"candidates":[]}}
```

The relation payload is the existing exact serialization. Candidate references
are invocation-local handles such as `candidate_1`; durable/runtime IDs,
revisions, scores, provenance, reasoning, audit, and history remain excluded.

## L2 extraction and support

The same analysis call now requires `severity` (`critical`, `important`, `minor`)
on every new claim draft. Optional `support` identifies a UTF-16 start/exclusive
end span in the original `message` or ingested `source`; the final answer cannot
supply reinforcement evidence. Staging rejects an invalid severity per item and
reports invalid support without discarding unrelated valid extraction.

The existing relation call receives optional `sourceSupport` with the original
content and validated bounds. On restatement/extend it explicitly reports
`supportsTarget`; absence/false means no automatic reinforcement. Runtime keeps
the exact handle-to-claim mapping outside model input, revalidates target and
source under the commit lock, and records the occurrence receipt atomically.
This adds no model call. Semantic correctness against live models remains a
separate evaluation; deterministic tests inject synthetic semantic decisions.

## Shared ownership

One `SemanticJsonGenerator` is injected into both:

- `ModelBackedPostOutputKnowledgeAnalyzer`; and
- `ModelBackedKnowledgeRelationClassifier`.

The generator receives one already-constructed `ChatTransport`, model name,
generation settings, and `ChatInvocationBudget`. It does not read environment
variables or instantiate `NvidiaChatTransport`. A future composition root can
therefore reuse the authorized provider adapter and credential owner while
keeping the semantic jobs separate from the user's chat session.

`stream` is always forced to `false`. The exact stable role/content array is
measured before transport; the local reference measurer is exact UTF-8 bytes.
An exact model-token measurer may be injected later without changing the call
contract.

## Response and reasoning boundary

Only a non-empty assistant `message.content` that parses as one complete JSON
value is returned. These fail closed:

- empty or missing assistant content;
- a non-assistant message;
- Markdown-fenced JSON;
- prose before or after JSON; and
- malformed completion/JSON.

`ChatCompletion.reasoning`, usage, and finish reason are not read into the
semantic result. The analyzer adapter returns the parsed value to
`PostOutputKnowledgeIntake`, which validates/materializes the draft array. The
classifier adapter returns it to `RelationGatedMemoryCommit`, which
validates the five-way relation and local handles. The classifier instruction
requires JSON field `type`. Runtime also accepts field `relation` as an alias
for the same five canonical names and treats JSON `null` as omitted; it does
not invent a relation from unknown labels. The model still has no repository or
write authority.

## Cancellation and failure

`SemanticOperationContext` carries an optional `AbortSignal`. The coordinator
passes it through staging or resume, intake/commit, the appropriate adapter,
and finally `ChatRequest.signal`.

- A pre-aborted generator call makes no transport request.
- Transport cancellation during analysis becomes coordinator
  `staging_failed`, with no proposal attempt.
- Transport cancellation during relation classification becomes
  `commit_failed` at the same proposal checkpoint; completed earlier records
  remain explicit and are not replayed automatically.
- Repair of already committed entity/domain metadata is not a semantic model
  call. A signal supplied to `repairAndResume` applies when processing later
  semantic proposals after that explicit repair step.

No failure changes the already-streamed user answer.

## Verification boundary

Fake/local tests cover stable exact messages, one-call ownership, non-streaming
options, strict JSON, malformed local configuration, exact multibyte budget,
reasoning exclusion, defensive per-call requests, cancellation propagation,
stable adapter inputs/prompts, and coordinator failure mapping.

An actual in-memory SQLite coordinator integration uses one shared fake
transport for one analyzer call and two relation calls. Proposal one creates and
indexes dormant canon; proposal two retrieves that item and extends it. Private
fake reasoning is absent from semantic requests, coordinator results, and
memory state.

The [committed memory-loop benchmark](MEMORY_LOOP_BENCHMARK.md) uses the same
fake transport instance for two streamed chat calls and both stateless semantic
calls. Exact call order and separation of chat versus semantic state are
asserted in the compiled v2 report.

No test reads `.env.local`, calls a live provider, starts OpenHands, Docker, or
Supabase, or uses an external database.

See [ADR 0012](adr/0012-stateless-semantic-json-model-calls.md),
[Post-output knowledge intake](POST_OUTPUT_KNOWLEDGE_INTAKE.md),
[Relation-gated memory commit](RELATION_GATED_MEMORY_COMMIT.md), and
[Post-output memory coordinator](POST_OUTPUT_MEMORY_COORDINATOR.md).
