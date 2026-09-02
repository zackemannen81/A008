# Current Task

Task ID: A008-0017
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

Turn on write-path reconciliation reinforcement for the live CLI/ACP memory
runtime so restatement and extend follow the marked Reinforce flow: boost
`relevanceScore`, then re-evaluate the activation threshold. Retrieval remains
non-mutating. Decay stays out of scope.

## Task Charter

### Goal

Make local CLI/ACP post-output `restatement` and `extend` apply the existing
engine reinforcement contract so already-active items gain strength and dormant
items can re-enter `active` when the boosted score meets the threshold.

### Primary Deliverable

Live `CodingAgentMemoryPolicy` settings in `createLocalMemoryRuntime` that use
the policy default reconciliation boost and keep projection reinforcement at
zero, plus deterministic SQLite proofs of active strengthening and dormant
threshold reactivation.

### In Scope

- Set live `reconciliationReinforcement` to the existing policy default `0.2`.
- Keep live `projectionReinforcement` at `0` so hybrid read/`projectSelected`
  still never mutates score or activation.
- Export the live boost constants from the composition root.
- Prove `restatement` of an already-active item increases `relevanceScore` and
  remains active.
- Prove `restatement` of a dormant item below threshold that crosses the
  threshold after the boost becomes active.
- Prove `restatement` of a dormant item that stays below threshold remains
  dormant after the boost.
- Prove the chat read path still does not change score, revision, or
  activation.
- Update owning docs and a durable ADR with the actual live policy.

### Out of Scope

- Weaken/decay, cyclic unused-item penalties, or a new Strength-handling module.
- Changing five-way relation semantics, intake dormancy, or the user-assertion
  `new` keepAlive gate.
- Enabling mutating `SemanticMemory.project()` on the hybrid read path.
- Live/paid provider calls, Agent Server conversation binding, durable retry,
  PostgreSQL, or OpenHands source changes.

### Definition of Done

- [x] Live CLI/ACP composition uses reconciliation boost `0.2` and projection
      boost `0`.
- [x] Active restatement/extend increases canonical `relevanceScore` by that
      boost (clamped to 1) and then re-evaluates `activationFor`.
- [x] Dormant restatement that crosses `activationThreshold` becomes `active`.
- [x] Dormant restatement that remains below threshold stays `dormant`.
- [x] Hybrid memory reads do not reinforce, reactivate, or revise canon.
- [x] Owning docs and ADR record the live write-path reinforcement contract.

### Minimum Verification Gates

- [x] Clean install, production audit, strict typecheck/build, and full suite.
- [x] Focused SQLite live-runtime tests for the three restatement outcomes and
      non-mutating read.
- [x] Existing user-assertion, CLI/ACP two-turn, benchmark, and relation tests
      remain green.
- [x] Package dry-run, Markdown, template, staged-content, and `git diff --check`.
- [x] No live provider, `.env.local`, OpenHands mutation during this task,
      deployment, or publication.

## References

- `docs/SEMANTIC_MEMORY.md`
- `docs/LOCAL_MEMORY_SURFACES.md`
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0013-local-memory-surfaces-and-debug-trace.md`
- `docs/adr/0014-live-write-path-reinforcement.md`
- `src/memory/memory-engine.ts`
- `src/memory/coding-agent-policy.ts`
- `src/runtime/local-memory-runtime.ts`

## Checklist

- [x] Owner reviews and freezes the write-path reinforcement charter.
- [x] Freeze the reviewed charter in a separate commit.
- [x] Enable live reconciliation reinforcement and keep projection boost at zero.
- [x] Add SQLite proofs for active boost, dormant reactivation, dormant remain,
      and read non-mutation.
- [x] Update owning docs, ADR, journal/archive, and restore the task template.

## Decisions and Notes

- Reinforcement order stays as implemented: add boost, then
  `keepAlive || score >= activationThreshold`. There is no separate Activate
  node before Reinforce.
- Retrieval is not use. The marked chat-read path does not reinforce.
- Analyzer confidence still cannot grant activation. User-assertion `keepAlive`
  remains the only `new` activation gate.
- Decay/weaken is a later policy task.

## Charter Amendment Log

- none

## Verification

- [x] Production audit found zero vulnerabilities. Typecheck/build and all 150
      tests passed.
- [x] Live SQLite restatement: active `0.7` became `0.9` after a non-mutating
      read; dormant `0.35` became active `0.55`; dormant `0.1` stayed dormant
      at `0.3`.
- [x] Existing user-assertion, CLI/ACP, benchmark, and relation tests remained
      green. Package dry-run contained 167 files.
- [x] Skipped: live/paid provider, Canvas browser replay, weaken/decay.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed
- [x] `docs/LOCAL_MEMORY_SURFACES.md`, `docs/SEMANTIC_MEMORY.md`

## Handoff and Follow-ups

- Current state: Complete. Live write-path reinforcement matches the marked
  restatement/extend Reinforce flow. Retrieval is still non-mutating.
- Next recommended step: a later decay/weaken policy task if cyclic unused-item
  penalties are required.
- Blockers: none.
- Child tasks: None allocated.
- Resume condition: Not applicable.
- Open questions: none remaining for this slice.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
