# Current Task

Task ID: A008-0011
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
- `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- `docs/adr/0003-initial-runtime-and-provider-boundary.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0007-sqlite-hybrid-memory-read-path.md`
- `docs/adr/0008-memory-aware-chat-orchestration.md`

## Task Summary

Make provider reasoning an explicit display-only channel and establish the first
bounded post-output boundary that can stage semantic knowledge proposals from
the original user message and final assistant answer without writing memory.

## Task Charter

### Goal

Prevent streamed or returned reasoning from contaminating conversation history,
retrieval, future provider context, or knowledge analysis while creating a safe,
provider-neutral staging step for later explicit relation classification and
reconciliation.

### Primary Deliverable

An exported `PostOutputKnowledgeIntake` service and analyzer port that accept
only semantic turn data, produce validated budgeted proposal batches, perform no
canonical write, and are covered by a runnable deterministic two-turn
reasoning-isolation benchmark.

### In Scope

- Record the output-channel and staged-intake decision in an A008-owned ADR and
  operator-facing contract document.
- Define reasoning as ephemeral presentation data. It may stream to CLI stderr
  or ACP thought events and may be returned as completion metadata, but it is
  never a `ChatMessage`, committed history, retrieval input, prompt context, or
  knowledge-analysis input.
- Add a provider-neutral analyzer port whose exact input contains only the
  normalized original user message and final assistant answer. It receives no
  `ChatCompletion`, reasoning, usage, finish reason, history, memory projection,
  retrieval evidence, or runtime/control identity.
- Add deterministic staging that validates analyzer output, bounds proposal
  count and exact stable serialized UTF-8 size, normalizes and sorts tags,
  domains, and entities, rejects duplicate semantic proposals, and returns
  defensive copies.
- Let analyzer output propose only proposition, kind, tags, domains, entities,
  and confidence. Runtime owns scope, authority, relevance, activation,
  keep-alive, source-backed, and provenance defaults; unknown analyzer fields
  are ignored rather than forwarded.
- Associate staged batches with validated project/conversation/task/agent
  context outside the analyzer boundary. Apply the caller-verified
  applicability scopes to every staged proposal so analysis cannot widen scope.
- Keep staging read/write-free: it imports no repository, `SemanticMemory`,
  provider adapter, environment reader, or network client and never calls
  `reconcile` or updates retrieval indexes.
- Strengthen direct ChatSession and memory-aware regression tests so reasoning
  deliberately containing retrieval-like noise never appears in committed
  history, the next memory request, or the next provider request.
- Add a deterministic fake/local-only two-turn benchmark command proving:
  actual SQLite hybrid retrieval selects the same relevant knowledge on both
  turns; reasoning and answers stream on separate channels; only user/answer
  dialogue commits; the second request stays bounded and contains no prior
  reasoning or control IDs.
- Export the new boundary and update durable documentation, package inventory,
  and public-surface tests.

### Out of Scope

- Provider-backed extraction or relation classification, a second inference
  call, prompt design for an analyzer provider, embeddings, or live credentials.
- Automatic `new`/`restatement`/`extend`/`supersede`/`conflict` decisions,
  canonical memory writes, retrieval-index writes, reinforcement, reactivation,
  weakening, decay, archive, or deletion.
- Treating reasoning as evidence even when it appears plausible, useful, or
  more detailed than the final answer.
- Wiring post-output staging or memory-aware chat into CLI, ACP, Agent Server,
  Canvas, or GUI; verified live identity intake remains absent.
- Persisting staged batches, retry/queue/background execution, telemetry,
  privacy/retention/consent controls, Supabase/PostgreSQL, Docker changes,
  deployment, publication, or release.

### Definition of Done

- A type-level analyzer boundary cannot receive reasoning or a complete provider
  response; runtime tests capture exactly `message` and `answer` as its only
  input keys.
- A valid analysis calls the analyzer exactly once and returns a context-bound,
  deterministic batch of bounded `KnowledgeProposal` plus retrieval metadata.
- Analyzer-controlled scope/lifecycle/authority/provenance fields cannot cross
  the staging boundary; every proposal uses verified runtime scopes and safe
  runtime defaults.
- Invalid, duplicate, excessive, or over-budget analyzer output fails closed
  without a memory/repository write surface.
- Reasoning emitted in turn one is display-only and absent from committed
  messages, turn-two retrieval input, and turn-two provider-visible messages.
- The runnable local benchmark reports two reads, two provider calls, bounded
  dialogue, repeated correct knowledge selection, separate reasoning/answer
  deltas, and zero reasoning/control leakage.
- All prior ChatSession, CLI, ACP, provider, identity, memory, SQLite,
  retrieval, and orchestration behavior remains green.
- Current truth, system docs, semantic-memory docs, file map, public exports,
  decision index, journal, and immutable archive describe the boundary.

### Minimum Verification Gates

- [x] Clean `npm ci`, `npm audit --omit=dev`, strict typecheck, build, and full
      fake/local-only test suite pass with zero failures.
- [x] Focused intake tests cover exact analyzer input, reasoning exclusion,
      identity association, normalization, runtime-owned fields, exact
      multibyte budget, limits, duplicates, malformed output, one-call
      ownership, failure propagation, and defensive copies.
- [x] Two-turn orchestration regression proves reasoning is absent from
      committed history, retrieval history, and subsequent provider context.
- [x] `npm run benchmark:memory-loop` completes locally with actual SQLite
      hybrid retrieval and emits deterministic structural assertions plus
      observed measurements clearly labeled non-guaranteed.
- [x] Direct ChatSession, CLI help/models/missing-key, ACP agent/process, and
      compiled loopback regressions remain provider-free and green.
- [x] Package dry-run includes every exported/runtime benchmark artifact and
      excludes databases, credentials, raw legacy, dependency trees, and test
      fixtures.
- [x] Final Markdown links/fences/indexes, staged secret/raw-legacy/database
      scan, task-template equality, and `git diff --cached --check` pass.
- [x] Record that no live provider, `.env.local`, external OpenHands process,
      Supabase service, Docker mutation, external database, deployment,
      publication, or release participated.

## References

- Owner reasoning/display-only clarification in the A008-0011 activation turn.
- A008-0010 handoff in `docs/JOURNAL.md`.
- `docs/SEMANTIC_MEMORY.md`
- `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0008-memory-aware-chat-orchestration.md`

## Checklist

- [x] Adopt and document the reasoning/output-channel boundary.
- [x] Implement bounded post-output proposal staging.
- [x] Export and test the provider-neutral surface.
- [x] Add and run the local two-turn memory-loop benchmark.
- [x] Run regression, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0011, and restore the task template.

## Decisions and Notes

- `ChatCompletion.reasoning` remains available to an immediate UI adapter only;
  retaining it for transcript replay or analysis would require a later explicit
  decision and is not silently permitted.
- The final assistant answer may contain errors. Staging therefore produces
  untrusted dormant proposals, not facts or automatic canonical writes.
- Exact semantic relation classification requires materialized candidate
  comparison and is intentionally the next boundary, not hidden in extraction.
- The benchmark is a deterministic architecture proof, not a model-quality,
  tokenizer, latency, throughput, or live-provider benchmark.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine;
  `npm audit --omit=dev` reported zero vulnerabilities. Typecheck/build and all
  95 tests passed with zero failures, cancellations, skips, or todo.
- [x] Focused intake and two-turn tests prove exact message+answer analyzer
  input, conservative runtime policy, exact multibyte budget, malformed-output
  rejection, reasoning isolation, and unchanged failure/concurrency behavior.
- [x] `npm run benchmark:memory-loop` reported two actual SQLite reads, two fake
  provider calls, repeated correct knowledge selection, `[0, 2]` prior-dialogue
  counts, two reasoning and two answer deltas, four committed dialogue messages,
  zero reasoning/control leakage, and 666/823 provider-message bytes. Observed
  10.469/3.128 ms turn times are not guarantees.
- [x] CLI help/models exited 0 without a key; missing-key chat exited 2 before
  transport. `npm pack --dry-run --json` reported 131 files containing the
  compiled intake/benchmark and no excluded runtime material.
- [x] All 51 pre-archive Markdown files had zero missing relative links,
  unbalanced fences, or collection-index omissions. Final archive/template and
  staged-content/diff checks were repeated after closure.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase
  service, Docker mutation, external database, deployment, publication, or
  release participated. The unrelated canonical lockfile metadata edit stayed
  outside this worktree and task.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- [x] ADR and ADR index

## Handoff and Follow-ups

- Current state: Complete; reasoning isolation, bounded proposal staging, and
  the deterministic two-turn proof are implemented, verified, and documented.
- Next recommended step: compare staged drafts with bounded materialized current
  candidates, validate explicit five-way relations, then reconcile/index under
  runtime-owned policy.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: Later tasks must define provider-backed extraction ownership,
  candidate materialization, relation decisions, explicit commit policy,
  background failure presentation, and live surface identity intake.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
