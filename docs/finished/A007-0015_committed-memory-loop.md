# Current Task

Task ID: A008-0015
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01

## Task Summary

Upgrade the deterministic memory-loop proof so one active SQLite canonical item
is projected into question one, extended through the complete post-output
semantic pipeline, and projected at revision two into question two without
reasoning or unbounded history replay.

## Task Charter

### Goal

Prove the implemented read, streaming chat, stateless analysis/classification,
guarded commit/index, and next-turn reread boundaries in one executable two-turn
architecture benchmark over a shared fake transport and actual SQLite.

### Primary Deliverable

Version two of `npm run benchmark:memory-loop` plus its compiled-process test,
structured report, exact call-order/revision/projection assertions, and durable
benchmark documentation.

### In Scope

- Start with one current active indexed revision-one item rather than granting a
  new untrusted draft automatic activation.
- Compose actual hybrid read, memory-aware chat, intake, candidate source,
  relation commit, post-output coordinator, and SQLite services.
- Use one fake `ChatTransport` for chat and stateless semantic calls.
- Execute `chat -> knowledge_analysis -> relation_classification -> chat`.
- Prove question-one revision-one projection, guarded indexed `extend`, and
  question-two revision-two projection under the same canonical ID.
- Prove exactly two reads/chat calls and two semantic calls, bounded prior
  dialogue, exact canonical/audit state, reasoning/control exclusion, and a
  stable structured report with non-guaranteed timings.
- Update current truth, benchmark/orchestration docs, journal, and archive.

### Out of Scope

- Automatically activating a brand-new dormant untrusted proposal.
- A production/live/background coordinator or CLI/ACP/Canvas/GUI wiring.
- Live/paid calls, `.env.local`, credentials, provider quality, tokenizer,
  retries/fallback, durable queues, concurrent ordering, or repair policy.
- Changes to retrieval/relation/activation/reinforcement/decay/canonical/index
  semantics, privacy/ACLs, PostgreSQL/Supabase, Docker, deployment, publication,
  or release.

### Definition of Done

- [x] Actual SQLite and one shared fake transport complete the exact four-call
      loop with no external effect.
- [x] Revision-one active meaning is projected, extended/indexed, and projected
      at revision two on the next turn.
- [x] Two chat and two history-free semantic calls occur with one read per turn
      and no hidden replay.
- [x] Chat/semantic reasoning remains outside history, later context, results,
      canon, and index state.
- [x] The report explicitly states that new-draft auto-activation is unproven.
- [x] All prior tests and final gates remain green.

### Minimum Verification Gates

- [x] Clean install/audit, strict typecheck/build, and all 130 tests passed.
- [x] Compiled benchmark test validated call order, revision/projection,
      commit/index, bounded history, exclusions, and report v2.
- [x] Independent benchmark reported exact structural counts/bytes and
      non-guaranteed timing.
- [x] Prior relation/stale/index/cancellation/SQLite semantic tests passed.
- [x] CLI no-key and compiled ACP regressions passed.
- [x] Package, Markdown, template, staged-content, and diff gates passed.
- [x] No live provider, credential read, external service, deployment,
      publication, or release participated.

## References

- `docs/MEMORY_LOOP_BENCHMARK.md`
- `src/benchmark/memory-loop.ts`
- `test/memory-loop-benchmark.test.ts`
- `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- `docs/POST_OUTPUT_MEMORY_COORDINATOR.md`
- `docs/SEMANTIC_JSON_MODEL_CALLS.md`

## Checklist

- [x] Upgrade the executable benchmark to the full committed loop.
- [x] Strengthen the compiled-process contract test.
- [x] Run regression, benchmark, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0015, and restore the task template.

## Decisions and Notes

- New staged knowledge remains dormant. The benchmark extends already-active
  canon so next-turn projection follows existing policy and does not give model
  output activation authority.
- One fake transport represents shared provider ownership while `ChatSession`
  and stateless semantic calls retain separate histories and contracts.
- This is deterministic architecture evidence, not model-quality, production,
  or performance evidence. No new ADR was needed because product semantics were
  not changed.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine; production audit found
      zero vulnerabilities. Typecheck/build and all 130 tests passed with zero
      failures, cancellations, skips, or todo.
- [x] Independent benchmark order was `chat`, `knowledge_analysis`,
      `relation_classification`, `chat`; counts were two reads, two chat calls,
      and two semantic calls.
- [x] Question one selected `benchmark_reasoning_boundary` with the baseline
      proposition. One proposal completed as indexed `extend`; canon remained
      active and advanced revision 1 -> 2. Question two selected the same ID
      with the extended proposition; audit contained `knowledge_extended`.
- [x] Prior dialogue was `[0, 2]`; chat bytes were 641/908 and semantic bytes
      669/1115. Two reasoning plus two content deltas streamed. Chat/semantic
      reasoning and control IDs were absent from later context, history,
      semantic results, and canon.
- [x] Report recorded `newDraftAutoActivationProven: false`. Observed chat-turn
      times 10.254/2.379 ms are not guarantees.
- [x] CLI help/models exited zero and missing-key chat exited two. Package dry-
      run contained 151 files and no excluded runtime material.
- [x] Sixty-two pre-archive Markdown files had zero missing links, fence errors,
      or index omissions; final archive/template and staged-content checks were
      repeated.
- [x] No live provider, `.env.local`, OpenHands process, Supabase, Docker
      mutation, external database, deployment, publication, or release
      participated. Owner README/image and canonical lockfile edit were
      untouched.

## Handoff and Follow-ups

- Current state: Complete; the full deterministic committed loop is verified and
  documented.
- Next recommended step: pause. A later task should decide new-draft activation
  or live ownership only with explicit authority/privacy/failure policy.
- Blockers: None.
- Child tasks: None.
- Resume condition: A new owner-approved bounded task.
- Open questions: new-draft confirmation/activation, live identity/composition,
  durable retry, privacy, and UI remain later work.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
