# ADR 0012 — Stateless semantic JSON model calls

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A007 has provider-neutral ports for post-output knowledge analysis and five-way
relation classification. Their runtime validators, candidate boundaries,
canonical write authority, partial outcomes, and resume semantics already
exist. The remaining gap was how a concrete model performs those two semantic
jobs without creating a second provider implementation or turning them into
conversation turns.

Using `ChatSession` would be the wrong state owner. It commits user and assistant
messages and is intentionally designed for dialogue. Semantic extraction and
classification are stateless structured jobs whose prompts and responses must
never become chat history. Provider completions may also contain reasoning,
usage, and finish metadata that have no semantic authority.

## Decision

- `ChatTransportSemanticJsonGenerator` is one provider-neutral, stateless call
  owner over an injected existing `ChatTransport`. It reads no environment,
  credential, model registry, repository, or network client directly.
- One generator may be shared by `ModelBackedPostOutputKnowledgeAnalyzer` and
  `ModelBackedKnowledgeRelationClassifier`. Runtime composition chooses the
  concrete transport and model; the adapters do not construct another NVIDIA
  client or credential boundary.
- Every call contains exactly one fixed system instruction and one user JSON
  envelope with stable key order: `{ operation, input }`. There is no committed
  history, current chat message, memory projection, or stream callback.
- The exact serialized role/content array is measured through the existing
  `ChatInvocationBudget` before transport. Calls are forced to `stream: false`.
- The analyzer serializes only `{ message, answer }`. The classifier reuses the
  existing ID-free exact relation input containing proposal meaning and local
  candidate handles.
- System instructions identify the user envelope as untrusted data and demand
  strict JSON only. Provider-specific response-format fields are not assumed.
- Assistant content must be non-empty strict JSON. Markdown fences,
  prose-wrapped JSON, non-assistant messages, and malformed completions fail as
  `ChatError` `invalid_response`.
- The generator returns only the parsed JSON value. Completion reasoning,
  usage, and finish reason are ignored. The existing intake and relation-gate
  services remain the authorities that validate semantic draft shape and
  relation handles before any memory effect.
- An optional `SemanticOperationContext` propagates one `AbortSignal` through
  coordinator, stager/intake, relation committer, analyzer/classifier, and the
  transport request. Existing callers may omit it.
- Semantic cancellation retains the existing explicit coordinator boundary:
  extraction cancellation is `staging_failed`; classification cancellation is
  `commit_failed` at the same unprocessed proposal checkpoint.

## Alternatives considered

### Use `ChatSession` for semantic prompts

Rejected. Its useful transactional dialogue semantics would make synthetic
semantic prompts and responses eligible for history. A direct stateless use of
the same transport preserves one provider implementation without creating chat
state.

### Give each adapter its own provider client

Rejected. That would duplicate endpoint, authentication, timeout, cancellation,
and response-mapping ownership and risk divergent provider behavior.

### Parse JSON from reasoning when final content is empty

Rejected. Reasoning is display-only, speculative provider metadata. Treating it
as a semantic fallback would violate the established history and knowledge
boundary.

### Accept Markdown fences or extract the first JSON fragment

Rejected. Recovery heuristics can silently reinterpret prose or injected text.
Strict whole-content parsing gives deterministic failure to the existing
checkpoint owner.

### Require a provider-specific JSON schema option

Rejected for this slice. The shared transport contract has no verified portable
structured-output field. Stable prompts plus strict local parsing establish the
provider-neutral boundary without changing the NVIDIA adapter.

## Consequences

- A007 now has concrete model-backed analyzer and classifier adapters that can
  share the existing provider transport without history or reasoning retention.
- A later live composition task must inject the authorized transport, model,
  generation limits, and budgets and must decide when/where the coordinator
  runs. This task does not read `.env.local` or invoke itself after chat.
- Invalid semantic model output remains an explicit staging or proposal failure;
  the already-delivered user answer is not rolled back.
- Exact byte budgeting is implemented. Exact provider-token measurement remains
  a later injected measurer concern.
- Fake transport plus actual SQLite integration proves one analysis and two
  ordered classifier calls through the same generator; it does not establish
  live model quality.
