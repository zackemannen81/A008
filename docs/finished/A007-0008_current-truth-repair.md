# A008-0008 — Current-truth repair

Task ID: A008-0008
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Completed: 2026-09-01
Charter frozen at: 2026-09-01

## Task Summary

The post-A008-0007 audit found contradictory current-facing statements about
allocated worker worktrees and whether stable runtime identities exist. Repair
current truth before activating another product task.

## Task Charter

### Goal

Make current-facing repository documentation internally consistent with the
observed post-identity implementation and worktree state.

### Primary Deliverable

A bounded documentation correction that accurately states worker allocation,
implemented identity versus deferred integration, and the next product boundary.

### In Scope

- Replace the stale single-A008-0004 worker claim with the observed allocated
  A008-0004-through-A008-0008 worktree state.
- Replace the stale claim that stable identities are unimplemented with the
  accurate remaining gap: verified identity integration/lifecycle.
- Synchronize current status, system document, file map, and repository count
  for the A008-0008 worktree/task.
- Repair the accidental PROJECT_BRIEF line wrapping without changing direction.
- Re-run a current-facing stale-phrase audit and docs-first verification.

### Out of Scope

- Product source, tests, dependencies, ADR history, archived task records, or
  journal entries from completed work.
- Any new identity, memory, chat, ACP, GUI, provider, persistence, or privacy
  behavior.
- Worker cleanup, branch deletion, live calls, deployment, publication, or
  release.

### Definition of Done

- Current-facing docs agree that A008-0004 through A008-0008 have allocated
  worktrees and that no hard worker/process enforcement exists.
- Current-facing docs distinguish implemented runtime identity v0 from deferred
  verified integration, external intake, lifecycle, and persistence.
- No current-facing stale phrase found by the activation audit remains.
- Markdown links/fences/indexes, staged secret/raw-legacy scan, template restore,
  and `git diff --cached --check` pass.

### Minimum Verification Gates

- [x] `git worktree list --porcelain` evidence matches the corrected allocation.
- [x] Targeted current-facing stale-phrase audit returns zero contradictions.
- [x] Final Markdown links, fences, collection indexes, staged secret patterns,
  raw-legacy staging, template equality, and `git diff --cached --check` pass.
- [x] Explicitly record that no product test/build was run because no product or
  dependency file changed.

## References

- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/FILESTRUCTURE.md`
- `docs/PROJECT_BRIEF.md`
- `docs/finished/A008-0007_runtime-identity.md`

## Checklist

- [x] Correct the observed current-facing contradictions.
- [x] Verify worktree and stale-phrase truth.
- [x] Run documentation/security/diff gates.
- [x] Update journal, archive A008-0008, and restore the task template.

## Decisions and Notes

- Accepted ADR 0004 and completed archives retain their historical wording.
- Allocated worktrees are evidence of paths/branches, not active task count.
- The current task record was excluded from the final stale-phrase search
  because its frozen scope necessarily quotes the phrase being repaired.

## Charter Amendment Log

- none

## Verification

- [x] `git worktree list --porcelain` reported canonical `main` plus the five
  allocated task worktrees A008-0004 through A008-0008 at the documented paths.
- [x] Current-facing search outside historical ADR/archive/journal records and
  the active task returned zero stale worker-range, single-worktree, no-engine,
  and stable-identities-unimplemented phrases.
- [x] All 43 final Markdown files had zero missing relative links, unbalanced
  fences, or collection-index omissions. Staged candidates had zero known
  NVIDIA/OpenAI/GitHub/private-key patterns and no raw legacy path;
  `git diff --cached --check` passed.
- [x] `docs/CURRENT_TASK.md` was byte-identical to
  `docs/template_CURRENT_TASK.md` after archival.
- [x] Not performed: npm install, typecheck, build, product tests, credential
  read, live call, product/runtime change, cleanup, deployment, publication, or
  release. No product or dependency file changed, so product gates were not
  applicable to this documentation-only repair.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] ADRs and collection indexes were inspected; no change was required.

## Handoff and Follow-ups

- Current state: complete; current-facing worker and identity/memory truth is
  internally consistent.
- Next recommended step: define a bounded application orchestration contract
  that receives complete verified identity context before memory projection or
  post-output analysis.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: product orchestration remains outside this repair.

## Finalize When Complete

- [x] Archive this task under `docs/finished/`.
- [x] Restore the clean current-task template.
- [x] Append a signed `docs/JOURNAL.md` entry.
