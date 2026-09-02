# Current Task

Task ID: A008-0016
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

## Task Summary

Connect the implemented memory-aware read/chat/post-output loop to the local CLI
and A008 ACP surface used by Agent Canvas, then make the exact provider-visible
requests and raw provider responses inspectable through an explicitly enabled,
secret-safe debug trace.

## Task Charter

### Goal

Make the same project-namespaced, SQLite-backed semantic-memory runtime locally
testable through both CLI and Agent Canvas without adding a second provider or
credential owner, while preserving streamed answers, reasoning isolation, and
safe opt-in observability.

### Primary Deliverable

A shared local memory-runtime composition root consumed by CLI and A008 ACP,
plus an opt-in `off | safe | raw` diagnostic trace contract, deterministic
two-turn surface proofs, and exact operator instructions for local CLI and
Agent Canvas testing.

### In Scope

- Add one outer composition root that owns the existing NVIDIA credential and
  `ChatTransport`, project-namespaced SQLite repository, hybrid reader,
  `MemoryAwareChatSession`, stateless semantic analyzer/classifier, relation
  commit, index writer, and post-output coordinator.
- Share the injected transport/model boundary between answer and semantic calls;
  do not construct a second NVIDIA client or read credentials below composition.
- Define a bounded local identity profile for CLI and ACP: one stable configured
  project namespace, one session conversation, one stable surface agent, and a
  fresh runtime task per turn. Do not expose these IDs to provider messages.
- Configure the SQLite path outside tracked repository content, create it safely,
  preserve project namespace isolation, and document reset/inspection behavior.
- Route CLI chat through the memory-aware read path, retain streaming reasoning
  and answer presentation, and invoke post-output processing only from original
  user text plus final answer.
- Route each A008 ACP session used by Agent Canvas through the same application
  composition while preserving ACP thought/answer/cancellation behavior and
  keeping protocol stdout free of diagnostics.
- Stream the visible answer without waiting for memory analysis. Treat later
  post-output failures as observable memory outcomes that never roll back or
  rewrite the delivered answer.
- Add one shared diagnostic observer with modes:
  - `off` (default): no trace events or trace file;
  - `safe`: structured lifecycle, sizes, operation names, selected-memory IDs,
    commit/index outcomes, and redacted summaries; and
  - `raw`: exact serialized provider message bodies and raw SSE/JSON response
    frames/content, with explicit local-content exposure warnings.
- Use `A008_DEBUG_TRACE=off|safe|raw` and
  `A008_DEBUG_TRACE_FILE=<absolute path>` as the cross-surface settings, with an
  equivalent CLI option that shares one parser/config owner.
- Exclude authorization headers, API keys, environment dumps, secret-bearing
  request metadata, and transport internals from every trace mode. Raw mode may
  expose prompts, projected memory, reasoning, answers, and semantic JSON only
  after explicit opt-in.
- Correlate read/chat/analyze/classify/commit/index trace events without putting
  trace IDs into model context, conversation history, canon, or retrieval index.
- Bound trace event/file sizes, mark truncation explicitly, and ensure tracing
  cannot consume or alter the provider stream.
- Add user-visible diagnostics for memory commit/index failure without treating
  the already delivered chat answer as failed.
- Document and test the exact provider payload ordering, bounded history,
  reasoning exclusion, memory projection, semantic calls, commit, reread, and
  trace security boundary for both surfaces.

### Out of Scope

- Modifying or vendoring the external `C:\code\OpenHands` source tree, creating a
  native Agent Canvas settings panel, or bypassing Agent Server/ACP.
- Production deployment, multi-user authentication/ACLs, telemetry upload,
  remote trace collection, PostgreSQL/Supabase, Docker, encryption/keychain,
  backup, synchronization, or server-scale topology.
- Persisted cross-process ACP/Agent Server conversation binding, load/resume,
  durable post-output queues, background scheduling, retry timing, provider
  fallback, or concurrent multi-process write ownership.
- Treating raw debug output as conversation history, semantic evidence, or
  knowledge input.
- Live or paid provider calls by the implementation agent. The owner may run the
  documented local commands with the existing ignored `.env.local`; any agent-
  executed live call requires separate explicit authority.
- Final general-purpose temporal/conflict review UX, review queues, decay policy,
  or broad memory-policy redesign. The minimum new-memory activation behavior is
  the frozen owner decision below.

### Definition of Done

- [x] CLI and A008 ACP/Canvas use the same shared memory-aware application
      composition and credential/transport owner.
- [x] A two-turn CLI proof and a two-prompt ACP process proof each demonstrate
      read -> streamed answer -> post-output commit/index -> next-turn reread
      against actual temporary SQLite and deterministic provider fixtures.
- [x] Provider-visible chat contains only fixed system handling, bounded recent
      dialogue, materialized bounded memory, and the original message envelope;
      runtime/control IDs and reasoning remain excluded.
- [x] Post-output semantic calls are history-free and use only their frozen
      analyzer/classifier contracts; failures remain separate from delivered
      chat output.
- [x] Debug is off by default. Safe/raw modes expose their documented events,
      raw mode proves exact request and raw streamed/non-streamed response
      visibility, and no mode exposes credentials or corrupts ACP stdout.
- [x] Local SQLite and debug artifacts are ignored/untracked, bounded, resettable,
      and absent from package/archive output.
- [x] CLI and Agent Canvas local test instructions start from a clean install and
      state all data exposure, credential, cost, and cleanup expectations.
- [x] The owner-approved new-memory activation choice is implemented and tested
      rather than hidden behind a pre-seeded active benchmark item.
- [x] Owning architecture/status/security docs and a durable ADR are updated with
      the actual behavior.

### Minimum Verification Gates

- [x] Clean install, production audit, strict typecheck/build, full unit/contract/
      integration suite, CLI regressions, and compiled ACP process regressions.
- [x] Actual temporary SQLite E2E proofs for both surfaces with deterministic
      fake chat and semantic responses, canonical revision/index assertions, and
      no external network.
- [x] Trace-off produces zero diagnostics; safe/raw trace tests cover exact event
      order, payload/response fidelity, truncation, cancellation, HTTP/SSE/JSON
      errors, and secret/header/environment exclusion.
- [x] ACP wire stdout remains protocol-only under every trace mode; diagnostics
      use only the approved local sink.
- [x] Reasoning remains display/trace-only and absent from committed dialogue,
      retrieval input, semantic inputs/results, canonical memory, and next-turn
      provider context.
- [x] Failure tests cover memory read failure, chat rollback, post-output stage/
      classification failure, stale reconciliation, pending index repair, trace
      sink failure, and restart with existing SQLite.
- [x] Package dry-run, ignored-artifact, staged-secret/content, Markdown link/
      fence/index, task-template, and `git diff --check` gates pass.
- [x] Manual Agent Canvas loopback runbook was updated and the compiled A008 ACP
      process was replayed against a loopback fake NVIDIA endpoint. The external
      OpenHands checkout remained at `744e8652` with no source changes. The full
      browser Canvas/Agent Server GUI was not re-driven in this session. A live
      provider run remains owner-executed.

## References

- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- `docs/POST_OUTPUT_MEMORY_COORDINATOR.md`
- `docs/SEMANTIC_JSON_MODEL_CALLS.md`
- `docs/MEMORY_LOOP_BENCHMARK.md`
- `docs/adr/0004-agent-canvas-acp-boundary.md`
- `docs/adr/0006-runtime-identity-v0.md`
- `docs/adr/0008-memory-aware-chat-orchestration.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`
- `docs/adr/0010-relation-gated-memory-commit.md`
- `docs/adr/0011-post-output-memory-coordinator.md`
- `docs/adr/0012-stateless-semantic-json-model-calls.md`
- `docs/adr/0013-local-memory-surfaces-and-debug-trace.md`
- `docs/LOCAL_MEMORY_SURFACES.md`
- `docs/DEBUG_TRACE.md`
- `src/cli.ts`
- `src/acp/A008-acp-agent.ts`
- `src/runtime/nvidia-session.ts`
- `src/orchestration/memory-aware-chat-session.ts`

## Checklist

- [x] Owner reviews and resolves every pre-freeze decision below.
- [x] Freeze the reviewed charter in a separate commit; do not infer approval
      merely from edits or discussion.
- [x] Establish shared local configuration, identity, SQLite, lifecycle, and
      diagnostic contracts behind provider-neutral ports.
- [x] Implement the shared composition root and deterministic trace observer.
- [x] Integrate CLI without regressing terminal streaming/reset/error behavior.
- [x] Integrate ACP without changing protocol ownership or stdout integrity.
- [x] Compose post-output processing and explicit failure/repair diagnostics.
- [x] Add surface E2E, trace-security, restart, cancellation, failure, package,
      and documentation verification.
- [x] Replay the external Canvas loopback runbook and record safe evidence.
- [x] Update owning docs, journal/archive the completed task, and restore the
      active-task template.

## Decisions and Notes

- Diagnostic default: `off`. Interactive development mode: `safe`. `raw`
  requires an explicit setting and a prominent warning that full prompts,
  projected memory, reasoning, answers, and semantic payloads may be written
  locally.
- Canonical raw/safe sink: an explicitly configured local JSONL trace file.
  ACP stdout remains reserved for protocol messages. CLI may additionally
  render safe events to stderr; raw multiline frames use the file only.
- Local identity: require/configure one stable project ID; generate conversation
  per CLI/ACP session, a stable surface-agent ID, and a fresh task ID per turn.
  Do not invent an Agent Server conversation binding. True Agent Server
  conversation binding and resume remain deferred.
- Turn completion: stream the answer immediately, then await bounded post-output
  completion before declaring the application turn settled; report memory
  failure independently and retain the delivered answer. No durable background
  owner is introduced by this slice.
- New-memory activation: a narrow, runtime-owned origin/authority gate may
  activate an explicit durable user assertion. The full normalized proposition
  must appear as a contiguous substring of the original user message, and the
  user message must not end with `?`. Analyzer confidence alone never grants
  activation. Assistant-only or ambiguous extraction remains dormant.
- The final conflict/review design discussed with the owner (`auto`, contextual,
  manual, off; temporal/scope/authority resolution) remains larger than surface
  wiring and is not implemented by this frozen charter.

### Pre-freeze owner review

1. **New-memory activation:** approved — implement the narrow user-assertion
   activation gate inside A008-0016.
2. **Debug presentation:** approved — JSONL file is the canonical raw/safe sink,
   with optional safe CLI stderr summaries.
3. **Turn completion:** approved — answer-first then awaited memory settlement.
4. **Local identity:** approved — stable configured project plus process/session-
   local conversation/agent/task identities; Agent Server conversation binding
   and resume remain deferred.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine; production audit found
      zero vulnerabilities.
- [x] Strict typecheck/build passed. All 147 fake/local-only tests passed with
      zero failures, cancellations, skips, or todo.
- [x] `npm run benchmark:memory-loop` retained the committed extend loop with
      `newDraftAutoActivationProven: false`.
- [x] CLI `models`/`--help` exited 0 without a key; missing-key chat exited 2
      before transport.
- [x] Two-turn CLI, in-process ACP, and compiled ACP process proofs used actual
      temporary SQLite. A user assertion became active revision 1 and was
      projected on the next turn.
- [x] Trace-off created no file. Safe traces omitted prompt bodies. Raw traces
      showed request/response bodies and SSE frames without API keys or
      `Authorization` values. ACP stdout remained protocol-parseable under raw.
- [x] Package dry-run contained 167 files including compiled runtime modules and
      no tests, databases, credentials, raw legacy, or traces.
- [x] Owned Markdown fences were balanced; ADR/file-structure indexes include
      the new records; `git diff --check` was clean.
- [x] Record skipped checks and reasons: the full browser Canvas/Agent Server
      GUI was not re-driven. OpenHands remained at
      `744e8652f254613045b779eb148bf4f741177975` unmodified. The A008-owned ACP
      process loopback and updated runbook were the substitute. No live/paid
      provider call, `.env.local` load, push, or deployment.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed
- [x] `docs/LOCAL_MEMORY_SURFACES.md`, `docs/DEBUG_TRACE.md`,
      `docs/AGENT_CANVAS_INTEGRATION.md`, `README.md`, `docs/PROJECT_BRIEF.md`

## Handoff and Follow-ups

- Current state: Complete. Local CLI and A008 ACP share one memory runtime,
  user-assertion activation, and opt-in tracing.
- Next recommended step: owner-executed live NVIDIA run, or a later task for
  Agent Server conversation binding, durable retry, or conflict/review UX.
- Blockers: none.
- Child tasks: None allocated.
- Resume condition: Not applicable.
- Open questions: none remaining for this slice.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
