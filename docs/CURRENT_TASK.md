# Current Task

Task ID: A008-0136
Parent Task: A008-0103
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 6187567b8d2ffec909c2784bbe6eda112afbe506

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/CLIENT_API_V2.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/finished/A008-0132_stage4-turn-recovery-foundation.md`
- `docs/finished/A008-0134_validated-zero-cost-model-catalog.md`

## Task Summary

Expose recent merged capability in the bundled GUI without widening runtime authority. Add a read-only ZeroCostRadar over the validated A008-0134 catalog and surface implemented Stage-4 V2 discovery/status while preserving the existing V1 bundled-GUI session path until Stage 5.

## Task Charter

### Goal

Make the bundled GUI accurately expose the latest model-discovery and stable-client capability already present on main.

### Primary Deliverable

A GUI capability sync that adds a read-only ZeroCostRadar and an honest Stage-4 protocol/runtime status surface, backed by repository-owned contracts and host data.

### In Scope

- Add a typed read-only host/HTTP contract for the A008-0134 zero-cost catalog.
- Add a Parameters → Zero Cost Radar view with filtering, lifecycle/access/capability badges, verification date, data-policy warning, source links and A008-profile readiness.
- Add a small runtime/protocol status view backed by public `GET /v2/info`.
- Update `/v2/info` feature advertisement so implemented A008-0132 identity/order/snapshot/terminal semantics are discoverable.
- Audit current GUI for other recent merged capability that is absent or stale and repair bounded presentation gaps.
- Add focused host/protocol/GUI regressions and update owning docs.

### Out of Scope

- Registering catalog-only models or providers.
- Selecting/falling back to a zero-cost route automatically.
- Provider credential onboarding beyond existing provider settings.
- Moving bundled GUI session traffic from V1 to V2; that belongs to Stage 5.
- Implementing remaining Stage-4 command idempotency, reconnect/resume leases or restart uncertainty.
- Revalidating the external zero-cost catalog against provider websites.

### Definition of Done

- GUI exposes all current `ZERO_COST_MODEL_ROUTES` through a typed read-only host route.
- Radar clearly distinguishes existing A008 profiles from catalog-only candidates.
- Radar does not mutate registry, provider settings, routing or credentials.
- GUI visibly reports the running host's V2 protocol/server instance/features/limits and labels Stage 4 as foundation/in-progress rather than complete.
- `/v2/info` advertises the A008-0132 features it actually implements.
- Existing bundled GUI remains on V1 session transport and its current reconnect behavior is unchanged.
- Current GUI copy no longer claims Luna is the only built-in OpenAI profile.
- Focused protocol/host/GUI tests, typecheck/build and diff hygiene pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md` PC-01 and PC-06.
Contract revision: `6187567b8d2ffec909c2784bbe6eda112afbe506`.
Accepted constraints: ADR 0040/0041 staged client programme; A008-0132 Stage-4 foundation; A008-0134 data-only zero-cost catalog.

The smallest sufficient change is read-only presentation plus truthful discovery metadata. No runtime/provider authority moves into the GUI.

## Checklist

- [x] Claim A008-0136 on main.
- [x] Freeze charter.
- [x] Add zero-cost HTTP contract and host route.
- [x] Add ZeroCostRadar GUI.
- [x] Add Stage-4 runtime/protocol GUI status.
- [x] Audit recent merged GUI gaps.
- [x] Add/adjust focused tests.
- [x] Run verification gates.
- [x] Update current docs, archive and handoff; journal remains the operator merge entry.
- [x] Restore `docs/CURRENT_TASK.md` from template before final push (performed after archive copy).

## Decisions and Notes

- ZeroCostRadar is deliberately discovery-only. A candidate with no `a008ProfileId` is not a usable A008 model merely because it appears in the radar.
- Stage 4 is exposed through public discovery/status only. The bundled GUI continues to speak V1 until the frozen programme reaches Stage 5.
- Existing V1 45-second browser reconnect/resume is a compatibility behavior and must not be presented as V2 Stage-4 reconnect/resume.

## Charter Amendment Log

-none

## Verification

- `npm test --silent`: 671 core + 4 membership + 175 GUI = 850 tests, 0 failures/skips.
- Focused real-host/protocol/V2 gate: 58/58 tests passed after the additive route and discovery-feature changes.
- `npm run typecheck --silent`: passed.
- `npm --prefix gui run build --silent`: passed; Vite retains the pre-existing >500 kB chunk warning only.
- `npm run verify:protocol --silent`: packed protocol plus packed dependency installed offline outside A008; independent TypeScript consumer compiled and ran.
- `git diff --check`: passed.
- Generated protocol diff is bounded to the new HTTP OpenAPI route/schema; unrelated generator-format churn was removed.
- GUI audit confirmed A008-0130 attachment acquisition is already exposed; A008-0131 native Responses required no new control surface; A008-0133 Terra was already selectable and its stale provider copy is repaired; A008-0134 was the missing GUI surface now supplied by Zero Cost Radar.
- No live provider inference or paid call was performed.

## Documentation Updates

- [x] `README.md`
- [x] `gui/README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/CLIENT_AUTH.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/tasks/A008-0103_stable-client-api-program.md`
- [ ] `docs/JOURNAL.md` — operator merge entry after the implementation PR lands

## Handoff and Follow-ups

- Current state: complete and verified; ready for integration.
- Next recommended step: continue A008-0103 with the separately bounded Stage-4 command receipts/idempotency child; do not treat this GUI visibility slice as Stage-5 migration.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository branch state.
- Open questions: none.