# ADR 0013 — Local memory surfaces and secret-safe debug trace

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A007 already had the memory-aware read path, post-output coordinator, stateless
semantic JSON adapters, and a two-turn architecture benchmark. CLI and a007 ACP
still constructed a bare `ChatSession`. Operators could not locally test the
closed memory loop through the same surfaces Agent Canvas uses, and they could
not inspect exact provider-visible requests without risking credential leakage.

Four owner decisions were frozen in A007-0016: a narrow user-assertion
activation gate, JSONL as the canonical diagnostic sink, answer-first then
awaited memory settlement, and process/session-local identities without an
Agent Server conversation binding.

## Decision

- `createLocalMemoryRuntime` is the one outer composition root for CLI and a007
  ACP. It owns the existing NVIDIA credential/`ChatTransport`, one
  project-namespaced SQLite repository, hybrid reader, memory-aware chat,
  analyzer/classifier, relation commit, index writer, and post-output
  coordinator. It does not construct a second NVIDIA client.
- Local identity is one configured or sidecar-persisted project ID, one
  conversation per CLI/ACP session, one process-stable agent, and a fresh
  runtime task per turn. Those IDs never enter provider messages, canon, or
  traces as model context.
- SQLite lives outside the repository, defaulting to `~/.a007/memory.sqlite`.
  Paths inside the a007 tree are rejected. Deleting the file and project-id
  sidecar resets local memory.
- Turns stream the visible answer first, then await bounded post-output
  settlement. Memory failures are reported independently and never roll back or
  rewrite the delivered answer. One automatic index repair is attempted; there
  is no durable background owner.
- New untrusted drafts remain dormant unless a runtime-owned gate finds the
  full normalized proposition as a contiguous substring of the original user
  message and the message does not end with `?`. Analyzer confidence cannot
  grant activation. The gate applies at `SemanticMemory.reconcile` for `new`
  decisions so staged proposals keep the existing dormant intake contract.
- Debug tracing is `off` by default. `safe` records structured lifecycle,
  sizes, operation names, selected-memory IDs, and commit/index outcomes.
  `raw` records exact provider message bodies and raw SSE/JSON frames after
  explicit opt-in. Authorization headers, API keys, environment dumps, and
  secret-bearing metadata are excluded from every mode.
- `A007_DEBUG_TRACE` and `A007_DEBUG_TRACE_FILE` are the cross-surface
  settings. CLI `--debug-trace` / `--debug-trace-file` share that parser.
  ACP stdout remains protocol-only; CLI may print safe one-line summaries to
  stderr. Raw frames use the JSONL file. Trace IDs correlate events and never
  enter model context.

## Alternatives considered

### Keep CLI/ACP on bare `ChatSession` and only document the benchmark

Rejected. The product proof required the same composition Agent Canvas launches,
not a second hidden test harness.

### Activate new drafts from analyzer confidence or always-on keep-alive

Rejected. Confidence is untrusted model output. The existing commit validator
also forbids staged `keepAlive`/`sourceBacked` flags, so activation is a
runtime reconcile policy, not an analyzer field.

### Put diagnostics on ACP stdout or treat raw traces as knowledge

Rejected. ACP stdout is the protocol wire. Raw traces are local operator
observability and are never conversation history, semantic evidence, or
retrieval input.

### Persist Agent Server conversation bindings now

Deferred. The current ACP new-session request still lacks a verified external
conversation handle. Inventing one would create false identity.

## Consequences

- Local CLI and Agent Canvas/ACP can exercise the closed memory loop against
  one SQLite namespace and one provider transport.
- Brand-new assistant-only extractions remain dormant; explicit user
  assertions can become active and appear on the next turn.
- Operators can inspect exact provider payloads only after opt-in, with
  explicit local-content warnings and secret redaction.
- Durable retry queues, multi-process SQLite ownership, Agent Server resume,
  and general conflict/review UX remain later work.
