# A008-0134 — Validated zero-cost model catalog

Task ID: A008-0134
Parent Task: None
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 2026-09-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`

## Task Summary

Validate currently available zero-cost/free-tier model routes against provider-owned current documentation and add one importable, data-only TypeScript catalog for later A008 use.

## Task Charter

### Goal

Give A008 one bounded source snapshot of currently verified zero-cost model routes without changing runtime model support, selection, routing, credentials, fallbacks, or ACME execution.

### Primary Deliverable

`src/providers/zero-cost-model-catalog.ts`

### In Scope

- Verify current provider/model availability and zero-cost status.
- Record exact provider model IDs, API style/base URL, lifecycle, capabilities, quotas/expiry where verified, and source provenance.
- Distinguish zero-price models/endpoints from provider free-tier quota.
- Add documentation that the catalog is advisory data and does not itself implement provider support.

### Out of Scope

- Runtime registration, provider adapters, routing, automatic fallback, credential UI, ACME changes, live paid calls, or default-model changes.
- Claiming a route remains free after its recorded verification date.
- Treating research/trial endpoints as suitable for confidential data.

### Definition of Done

- One typed source file can be imported internally without side effects.
- Every listed route has provider-owned current evidence as of 2026-09-19.
- Temporary/dynamic/trial routes are explicit.
- TypeScript typecheck passes.
- Owning documentation states that the catalog does not imply runtime support.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `cb7a4548c944efc539dcac853d407818b9f58fbe`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Add validated model-route snapshot | PC-06: expose supported model controls through existing owners and preserve explicit unsupported outcomes; a listed capability alone does not implement or authorize it | Gives later model-control/provider work a current, provenance-bearing input without falsely registering unsupported providers | One data-only TS catalog under `src/providers/`; no imports into runtime owners | `npm run typecheck`; source review for uniqueness, dated verification, lifecycle/cost distinction and no runtime imports |
| Document the boundary | PC-06 explicit unsupported outcomes | Without the boundary, consumers could mistake catalog presence for supported routing | Short CURRENT_STATUS/FILESTRUCTURE notes | Review diff for no runtime/model-registry/dispatch changes |

### Minimum Verification Gates

- [ ] Provider-owned current-source review completed.
- [ ] `npm run typecheck` passes.
- [ ] Catalog contains no credentials and introduces no executable network call.
- [ ] No runtime/model-registry/dispatch/ACME file changed.

## References

- ZeroCostRadar catalog and September 2026 freshness sweeps.
- Provider-owned NVIDIA Build, OpenCode Zen, OpenRouter, Groq and Google Gemini documentation verified 2026-09-19.

## Checklist

- [x] Claim A008-0134 on `main`.
- [x] Create isolated task branch.
- [x] Review repository authority and provider ownership boundaries.
- [x] Validate candidate routes against current provider-owned sources.
- [ ] Add typed data-only catalog.
- [ ] Update owning documentation.
- [ ] Run verification.
- [ ] Archive task, write handoff and restore `docs/CURRENT_TASK.md`.

## Decisions and Notes

- The unit is a provider/model route rather than a model because the same model can have materially different cost, quota, privacy and lifecycle semantics through different providers.
- Groq entries are `free-tier`, not zero-price models: the models have published token prices while the Free Plan has separate request/token limits.
- Dynamic free pools must fail closed; the catalog never authorizes fallback to a paid sibling.
- No provider live inference is required for this task; current provider-owned catalog/pricing/API documentation is the availability authority.

## Charter Amendment Log

- none

## Verification

- pending

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] archive + handoff

## Handoff and Follow-ups

- Current state: implementation pending.
- Next recommended step: consume selected entries only in a separately authorized provider/routing task.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
