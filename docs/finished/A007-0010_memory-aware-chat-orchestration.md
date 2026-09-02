# Current Task

Task ID: A008-0010
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/SEMANTIC_MEMORY.md`
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/RUNTIME_IDENTITY.md`
- `docs/adr/0003-initial-runtime-and-provider-boundary.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0006-runtime-identity-v0.md`
- `docs/adr/0007-sqlite-hybrid-memory-read-path.md`

## Task Summary

Implement the first provider-neutral application orchestration boundary that
combines a verified runtime context, one read-only semantic-memory projection,
bounded committed dialogue, and the original user message into exactly one
request through the existing `ChatSession` provider owner.

## Task Charter

### Goal

Prove a complete memory-aware chat turn without leaking control-plane data,
duplicating provider ownership, replaying unbounded history, or introducing the
post-output write/lifecycle loop.

### Primary Deliverable

An exported `MemoryAwareChatSession` plus deterministic prompt-envelope and
bounded `ChatSession` invocation support. The surface accepts parsed project,
conversation, runtime-task, and agent identities, calls `HybridMemoryReader`
once, and calls the existing chat transport once.

### In Scope

- Record the application read-path composition decision and trust boundary in
  an A008-owned ADR and operator-facing contract document.
- Add a provider-neutral runtime context type. Project, conversation, and agent
  identity are fixed for one memory-aware session; each turn supplies one
  parsed runtime-task identity, original message, applicability scopes, and
  optional required knowledge IDs.
- Implement a deterministic `MemoryPromptComposer` that accepts only
  `ProjectionResult` plus the original message. It emits a versioned fixed
  system instruction and JSON user envelope containing materialized semantic
  fields, never runtime task/project/conversation/agent IDs, knowledge IDs,
  retrieval plans/evidence, scores, activation state, provenance, or audit.
- Extend `ChatSession.send` with an optional validated invocation plan that
  can add ephemeral system context, substitute provider-visible user content,
  bound the provider-visible committed dialogue window, and enforce a hard
  measurement budget over the exact serialized provider-visible messages.
  Default callers retain current behavior.
- Keep canonical chat history distinct from invocation context: successful
  turns commit the original user text and assistant answer; memory envelope,
  synthetic system instruction, and history truncation are never committed.
- Feed the memory reader the original message plus at most the last two
  committed raw user/assistant messages. Use the same at-most-two-message window
  in the provider request.
- Invoke the memory reader before transport. Retrieval, identity, prompt, or
  total-budget failure calls no transport and commits no chat history.
- Preserve exactly one existing `ChatTransport.complete` call, delta
  callbacks, cancellation, generation options, assistant validation, and
  successful-turn commit/failed-turn rollback semantics.
- Reject overlapping turns on one memory-aware session rather than allowing
  stale-history races.
- Return completion, projection, and bounded memory evidence as separate
  application results; only the composed prompt crosses into model context.
- Add deterministic tests for identity/session consistency, prompt-field
  exclusion, ordering/window limits, total budget, empty projection,
  retrieval/provider failure, cancellation, concurrency, one-read/one-call
  ownership, non-mutation of memory, and unchanged legacy ChatSession/CLI/ACP
  behavior.

### Out of Scope

- Wiring the new surface into CLI, ACP, Agent Server, Agent Canvas, or GUI. No
  complete verified external runtime mapping currently enters those surfaces.
- Inventing project/conversation/task/agent IDs from paths, prompts, ACP session
  IDs, or working directories; durable identity mappings and lifecycle.
- Post-output extraction, response analysis, relation classification,
  reconciliation, confirmed-use reinforcement/reactivation, weakening, decay,
  archive, or any canonical memory write.
- Provider-backed classification, summaries, query planning, or embedding
  generation; hidden/duplicate inference; live provider calls or credentials.
- Exact provider tokenizer/headroom policy, tools/MCP, fallback/retry, model
  switching, transcript persistence, streaming storage, or multi-process
  orchestration.
- Supabase/PostgreSQL/pgvector, Docker changes, production privacy/user-control
  policy, account ACLs, encryption, retention, deletion/export, backup, or
  deployment.

### Definition of Done

- One valid turn calls `HybridMemoryReader.read` exactly once with the fixed
  verified identities, original message, task scopes/requirements, and no more
  than two prior committed dialogue messages.
- The transport receives exactly one request containing persistent system
  context, one fixed A008 context-contract system message, no more than two
  prior dialogue messages, and one JSON user envelope with selected
  materialized memory plus the exact original message.
- Runtime IDs, knowledge IDs, retrieval evidence/plans, scores, state,
  provenance, and audit are absent from every provider-visible message.
- The exact stable serialization of provider-visible messages is measured and
  rejected before transport when over the configured hard maximum.
- Successful state stores only original user and assistant messages. Ephemeral
  memory/context never appears in `ChatSession.messages`.
- Retrieval, composition, budget, cancellation, invalid response, and provider
  failures leave prior chat and memory state unchanged.
- Concurrent sends on one memory-aware session produce one active owner and one
  deterministic rejection, never two provider calls based on the same history.
- Existing CLI/ACP/direct ChatSession behavior and all prior tests remain green.
- Current truth, system docs, file map, public exports, decision index, journal,
  and immutable archive describe the implemented boundary.

### Minimum Verification Gates

- [x] Clean `npm ci`, `npm audit --omit=dev`, strict typecheck, build, and
      full fake/local-only test suite pass with zero failures.
- [x] Focused unit tests cover stable prompt serialization, field exclusion,
      empty memory, multibyte exact-budget enforcement, window ordering, and
      defensive input/result behavior.
- [x] Focused orchestration tests cover runtime identity mismatch, exactly one
      memory read/provider call, retrieval-before-provider ordering, no hidden
      calls, rollback/cancellation, concurrency rejection, and memory
      non-mutation.
- [x] Direct ChatSession, CLI help/models/missing-key, ACP agent, and compiled
      ACP loopback regressions remain provider-free and green.
- [x] Package dry-run includes every exported runtime artifact and excludes
      databases, credentials, raw legacy, dependency trees, and test fixtures.
- [x] Final Markdown links/fences/indexes, staged secret/raw-legacy/database
      scan, template equality, and `git diff --cached --check` pass.
- [x] Explicitly record that no live provider, `.env.local`, external
      OpenHands process, Supabase service, Docker mutation, deployment,
      publication, or release participated.

## References

- A008-0009 handoff in `docs/JOURNAL.md`.
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/SEMANTIC_MEMORY.md`
- `docs/RUNTIME_IDENTITY.md`
- `docs/adr/0003-initial-runtime-and-provider-boundary.md`
- `docs/adr/0006-runtime-identity-v0.md`
- `docs/adr/0007-sqlite-hybrid-memory-read-path.md`

## Checklist

- [x] Adopt and document the memory-aware invocation boundary.
- [x] Implement bounded ephemeral ChatSession invocation composition.
- [x] Implement prompt envelope and memory-aware application session.
- [x] Export and test the complete provider-neutral surface.
- [x] Run regression, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0010, and restore the task template.

## Decisions and Notes

- Two prior raw dialogue messages means the latest committed user/assistant
  messages after excluding persistent system messages. No hidden summarization
  provider is introduced.
- Full committed conversation remains available to application state in this
  slice, but only the bounded window crosses the provider boundary.
- The model does not need routing identity. The prompt composer therefore strips
  both runtime and knowledge IDs while retaining materialized propositions and
  semantic metadata.
- The memory envelope is user-level data. A separate fixed system instruction
  says it is reference data, not executable instructions. This reduces trust
  confusion without claiming complete prompt-injection prevention.
- No-op/empty memory still goes through the same explicit envelope so the
  invocation contract is deterministic.
- Runtime/knowledge-ID exclusion means the orchestrator never injects its
  control-plane values. It cannot remove identical text deliberately written in
  the persistent system prompt, conversation history, canonical proposition,
  or current user message without corrupting that semantic input.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed 8 packages and audited 9; `npm audit --omit=dev`
  reported zero vulnerabilities. `npm run typecheck`, `npm run build`, and
  `npm test` passed. The full suite reported 87 tests, 87 passes, and zero
  failures, cancellations, skips, or todo.
- [x] CLI `--help` and `models` smokes exited 0 without loading `.env.local`;
  missing-key `chat` exited 2 before transport construction.
- [x] `npm pack --dry-run --json` reported 123 files and included the compiled
  chat-invocation, memory-aware-session, and prompt-composer artifacts.
- [x] Final Markdown links/fences/index membership, staged secret/raw-legacy/
  database-file checks, task-template equality, and diff checks passed.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase
  service, Docker mutation, external database, deployment, publication, or
  release participated.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/RUNTIME_IDENTITY.md`
- [x] ADR and ADR index

## Handoff and Follow-ups

- Current state: Complete; the provider-neutral read-before-chat boundary is
  implemented, verified, documented, and ready to merge.
- Next recommended step: define the bounded post-output analysis contract for
  structured knowledge proposals and explicit relation decisions. Live
  CLI/ACP identity intake remains an independent prerequisite.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: Later tasks must define live surface identity intake,
  post-output analysis/write orchestration, confirmed-use lifecycle, exact
  tokenizer/headroom, and privacy controls independently.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
