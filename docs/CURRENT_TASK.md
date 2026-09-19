# Current Task

Task ID: A008-0135
Parent Task: None
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: c3f0afafa8854f4439e013581b43c64fe7687c67

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant current API/runtime/model documentation

## Task Summary

Reconcile current public and governing documentation with the merged A008 runtime and product reality after A008-0127 through A008-0134. This is a documentation-only truth repair; historical records remain historical.## Task Charter

### Goal

Make current A008 documentation describe the runtime, model catalog, V2 boundary and verification state that actually exist on merged `main`.

### Primary Deliverable

A bounded docs-only reality sync across current README/governing/reference surfaces, with stale assertions removed or qualified.

### In Scope

- Repair stale current claims in `README.md`, `AGENTS.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/CLIENT_AUTH.md` and current architecture/reference docs when contradicted by merged code.
- Reconcile current ACME dependency/version, built-in model count and Stage-4 capability boundary.
- Update `docs/FILESTRUCTURE.md` only if the maintained map is stale.
- Record closure in current status/system docs/journal/handoff/archive.

### Out of Scope

- Runtime, protocol, provider, memory or GUI behavior changes.
- Completing later Stage-4 recovery/idempotency work.
- Rewriting immutable task archives, accepted ADR history or old journal entries.
- Merging or deleting the owner backup branch `chatGPT/A008-0135-stage4`.

### Definition of Done

- Current docs no longer claim seven built-in profiles when eight are shipped.
- Current docs consistently describe `acme-engine@0.1.5` as the embedded dependency.
- Stage-4 docs distinguish implemented A008-0132 identity/order/snapshot/terminal semantics from still-unimplemented reconnect/idempotency/restart semantics.
- README verification baseline matches the latest merged 846-test proof.
- No product source files change.### Minimum Verification Gates

- [ ] Compare claims against package manifest, model registry and merged task records.
- [ ] Search current docs for stale version/profile/Stage-4 assertions.
- [ ] `git diff --check`.
- [ ] Confirm changed paths are documentation/control records only.

## Necessity Gate

- **Authority:** PC-01 and PC-06 in `docs/PROJECT_BRIEF.md` at the frozen revision above, plus the docs-first truth ownership rules in `docs/TASK_WORKFLOW.md`.
- **Behavior and necessity:** stale current documentation presently misstates supported model inventory, embedded execution version and V2 recovery semantics; consumers and future workers cannot reliably identify supported behavior from repository authority.
- **Smallest sufficient change:** edit only current truth surfaces that make false or ambiguous present-tense claims; preserve implementation and immutable history.
- **Verification:** compare exact claims to source/manifests/current merged evidence, then run stale-assertion searches and diff hygiene.

## Checklist

- [x] Claim A008-0135 on main.
- [x] Freeze docs-only charter.
- [ ] Audit current public/governing docs against merged implementation.
- [ ] Repair confirmed stale claims.
- [ ] Run verification gates.
- [ ] Update journal, archive and handoff.
- [ ] Restore `docs/CURRENT_TASK.md` from template before final push.## Decisions and Notes

- Historical statements remain untouched when clearly scoped to their original task/version.
- A present-tense statement inside a current truth surface must either match merged reality or be explicitly qualified as historical.
- The existing unclaimed backup branch is not task authority and is outside this cleanup.

## Charter Amendment Log

-none

## Verification

- Pending.

## Documentation Updates

- [ ] `README.md`
- [ ] `AGENTS.md` if stale
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] Current API/reference docs as required
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` if structure claims require repair

## Handoff and Follow-ups

- Current state: audit in progress.
- Next recommended step: reconcile confirmed stale present-tense claims.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository branch state.
- Open questions: none.