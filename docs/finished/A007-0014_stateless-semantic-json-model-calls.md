# Current Task

Task ID: A008-0014
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
- Relevant records under `docs/adr/`
- `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- `docs/RELATION_GATED_MEMORY_COMMIT.md`
- `docs/POST_OUTPUT_MEMORY_COORDINATOR.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`
- `docs/adr/0010-relation-gated-memory-commit.md`
- `docs/adr/0011-post-output-memory-coordinator.md`

## Task Summary

Implement the missing provider-call boundary for the existing post-output
analyzer and relation-classifier ports. Both semantic jobs share one stateless
JSON call owner over the existing `ChatTransport`, remain outside conversation
history, discard provider reasoning, and propagate cancellation.

## Task Charter

### Goal

Provide safe, reusable analyzer and classifier adapters that make exactly one
strict, budgeted, history-free semantic JSON request per operation through an
injected existing chat transport.

### Primary Deliverable

An exported stateless semantic JSON generator over `ChatTransport`, exported
model-backed post-output analyzer and relation classifier adapters, end-to-end
cancellation propagation through the post-output coordinator, deterministic
fake/local tests, ADR 0012, and durable contract documentation.

### In Scope

- Define one shared semantic JSON generator port and one `ChatTransport`-
  backed implementation with operation, fixed instruction, pre-serialized
  semantic input, and optional `AbortSignal`, but no history or session state.
- Build exactly one system plus one user JSON message, force non-streaming mode,
  budget the stable exact role/content serialization, and call one injected
  transport after local validation.
- Require a valid assistant completion and strict whole-content JSON; reject
  empty, fenced, prose-wrapped, malformed, and non-assistant results.
- Discard completion reasoning, usage, and finish reason and expose no delta
  callback or committed chat message.
- Implement fixed-input model-backed analyzer and ID-free five-way classifier
  adapters while preserving intake and relation-gate validation authority.
- Propagate optional cancellation through analyzer, stager, classifier,
  committer, and coordinator ports/methods without breaking callers that omit
  it.
- Preserve explicit coordinator failure semantics for staging versus the same
  unprocessed proposal checkpoint.
- Verify exact calls/budgets/JSON/reasoning/cancellation/copies with fake
  transport and one shared-transport actual-SQLite multi-proposal flow.
- Export and document all implemented contracts and current truth.

### Out of Scope

- `.env.local`, real-key validation, live/paid calls, provider-specific
  structured-output options, retries/fallback, tools, embeddings, or tokenizer
  integration.
- A second NVIDIA/provider implementation, transport behavior changes, or a
  separate memory credential owner.
- Automatic CLI, ACP, Agent Server, Canvas, GUI, `ChatSession`, or
  `MemoryAwareChatSession` invocation.
- Durable queues/checkpoints, schedulers, retry policy, telemetry, or failure UI.
- Changes to extraction/relation/candidate/canonical/index/lifecycle semantics,
  weakening/decay, or the concurrent semantic-duplicate `new` race.
- Privacy/retention/consent/ACL policy, PostgreSQL/Supabase, Docker, deployment,
  publication, release, or OpenHands source changes.

### Definition of Done

- One injected stateless generator and transport serve both concrete semantic
  adapters without history or hidden provider owners.
- Every request has the exact two-message stable envelope, a pre-transport hard
  budget, non-streaming settings, and one transport call.
- Only strict assistant JSON survives; reasoning and operational metadata never
  enter drafts, decisions, checkpoints, or memory.
- Cancellation reaches semantic provider requests and remains visible at the
  correct staging/proposal boundary without replay.
- Existing intake and relation validators retain all materialization, handle,
  ID-mapping, and write authority.
- Actual SQLite proves ordered shared-transport analysis/classification and
  later visibility of earlier canon/index state.
- Prior regressions, benchmark, no-key smokes, package, security, and docs gates
  remain green.

### Minimum Verification Gates

- [x] Clean `npm ci`, production audit, strict typecheck/build, and all 130
      fake/local-only tests passed with zero failures.
- [x] Focused tests covered exact messages/calls, budgets, strict JSON,
      reasoning exclusion, cancellation, stable prompts/input, defensive
      request data, and failure mapping.
- [x] Actual in-memory SQLite used one shared fake transport for analyzer and
      classifier and proved ordered proposal visibility.
- [x] Five-way/stale/index regressions and `npm run benchmark:memory-loop`
      remained green and provider-free.
- [x] CLI help/models exited zero, missing-key chat exited two, and compiled ACP
      loopback remained green without credentials.
- [x] Package dry-run, Markdown links/fences/indexes, task-template equality,
      staged secret/raw-legacy/database scan, and diff checks passed.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase,
      Docker mutation, external database, deployment, publication, or release
      participated.

## References

- A008-0013 handoff in `docs/JOURNAL.md`.
- `docs/SEMANTIC_JSON_MODEL_CALLS.md`
- `docs/adr/0012-stateless-semantic-json-model-calls.md`
- `src/core/types.ts`
- `src/core/chat-invocation.ts`

## Checklist

- [x] Adopt and document stateless semantic JSON call ownership.
- [x] Implement generator, analyzer/classifier adapters, and cancellation path.
- [x] Export and test focused fake plus actual SQLite coordinated flow.
- [x] Run regression, benchmark, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0014, and restore the task template.

## Decisions and Notes

- ADR 0012 selects direct stateless use of the injected existing
  `ChatTransport`, not `ChatSession`, for structured semantic jobs.
- Strict JSON uses whole-content `JSON.parse`; provider-specific response-format
  fields are not assumed.
- Parsed model output remains untrusted until downstream runtime validators.
- Reasoning may exist on a completion but is never parsed, replayed, staged, or
  persisted.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine; production audit found
      zero vulnerabilities. Typecheck/build and all 130 tests passed with zero
      failures, cancellations, skips, or todo.
- [x] Focused tests proved one exact non-streaming call, stable two-message
      envelopes, malformed local-config rejection before transport, strict JSON
      failures, exact multibyte budget, reasoning/metadata exclusion, defensive
      requests, and pre/in-flight cancellation.
- [x] Cancellation propagated through the concrete analyzer/intake/coordinator
      and classifier/commit paths. Analyzer cancellation was `staging_failed`;
      classifier cancellation was `commit_failed` at proposal zero.
- [x] Actual in-memory SQLite made three calls through one shared fake transport:
      one analyzer and two classifiers. The first proposal created/indexed
      dormant canon; the second retrieved and extended it to revision two.
- [x] The standalone benchmark recorded two reads/calls, repeated
      `benchmark_reasoning_boundary`, prior-dialogue counts `[0, 2]`, request
      bytes 666/823, four committed messages, and zero reasoning/control-ID
      leakage. Observed 10.073/2.76 ms timings are not guarantees.
- [x] CLI help/models exited zero; missing-key chat exited two before transport.
      Package dry-run contained 151 files including the new compiled semantic
      modules and no tests, credentials, databases, raw legacy, or dependencies.
- [x] Sixty pre-archive Markdown files had zero missing relative links,
      unbalanced fences, or index omissions; closure/template and staged-content
      checks were repeated after archiving.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase,
      Docker mutation, external database, deployment, publication, or release
      participated. The owner README/image remained untouched, and the unrelated
      canonical lockfile change remained outside this worktree.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/HYBRID_MEMORY_READ_PATH.md`
- [x] post-output intake/relation/coordinator contracts
- [x] ADR 0012 and collection index

## Handoff and Follow-ups

- Current state: Complete; concrete stateless semantic adapters are implemented,
  locally verified, documented, and ready for later authorized composition.
- Next recommended step: choose the live/background invocation owner only with
  complete verified identity, privacy/user controls, durable retry/repair, cost,
  and user-visible failure policy.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: live composition, durable queue, privacy, failure UI, exact
  tokenizer, and provider-backed retrieval planning remain later tasks.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
