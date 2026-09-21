# A008-0151 — ZeroCostRadar live refresh and model import

Task ID: A008-0151
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 9ccd8aaf6869fb6a543600bd35c0049374f9f0fe

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/HOST_PROTOCOL.md`
- `docs/finished/A008-0134_validated-zero-cost-model-catalog.md`
- `docs/finished/A008-0136_gui-capability-sync.md`

## Task Summary

Turn the existing read-only Zero Cost Radar surface into a bounded live-discovery
surface: an explicit update check fetches the latest published A008-compatible
ZeroCostRadar feed, and executable discovered models can be added through the
existing host-owned user catalog without moving provider authority into the GUI.

## Task Charter

### Goal

Let an operator refresh Zero Cost Radar on demand and import a discovered model
when A008 already has an execution path for that route.

### Primary Deliverable

Parameters → Zero Cost supports explicit live refresh plus truthful one-click
model import through the existing host/user-catalog boundary.

### In Scope

- Publish/consume one versioned A008-compatible ZeroCostRadar model-route feed.
- Add an explicit host refresh operation that fetches and strictly validates it.
- Preserve the bundled A008-0134 snapshot as the offline/default view.
- Add an Update check control with loading/success/error state.
- Add a per-route add control only when the route is executable by current A008.
- Persist imported models through the existing user catalog and expose them via
  the existing `/v1/models` owner.
- Prevent duplicate imports and present built-in/currently-added state truthfully.
- Add focused protocol, host/client and GUI regressions plus owning docs.

### Out of Scope

- New OpenRouter, OpenCode, Groq or Google execution adapters.
- New credentials, automatic account setup, routing, fallback or default changes.
- Background polling or unattended refresh.
- Automatic execution or provider inference during discovery.
- Treating discovery presence as proof that an unsupported provider is runnable.

### Definition of Done

- Initial radar load still works without external network access.
- Update check fetches the current published ZeroCostRadar feed on explicit user action.
- Remote payload is schema-validated and malformed/non-success responses fail closed.
- Successful refresh replaces the visible session catalog and reports its verification date.
- Import is enabled for currently supported addable routes and disabled with a reason otherwise.
- Import is idempotent and the model is visible from `GET /v1/models` afterward.
- No refresh or import silently changes chat provider, default model, routing or paid fallback.
- Focused tests, typecheck, GUI build and diff hygiene pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `7f5931ad3d636dc730e3168cb6960105f308c8b6`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Explicit live ZeroCostRadar refresh | PC-06 supported model controls and explicit unsupported outcomes; A008-0134/0136 keep discovery separate from routing | Operator can re-check current discovery data without rebuilding A008; without it the GUI remains pinned to the bundled 2026-09-19 snapshot | One explicit host/client refresh operation returning a strictly validated published feed; no polling or persistence | Host/client tests for success, malformed payload and upstream failure; GUI refresh-state test |
| One-click import for executable routes | PC-01 one shared engine + PC-06 model controls through existing owners | A discovered NVIDIA route that A008 can already execute can become selectable without manual catalog editing; without this the radar remains observation-only | Reuse existing user-catalog add path; gate unsupported providers rather than invent adapters | Add/import test proves persistence and `/v1/models` visibility; unsupported route remains non-actionable |
| Keep remote discovery non-authoritative for execution | PC-05 explicit execution boundary + PC-06 explicit unsupported outcomes | Remote data cannot silently create a new execution provider or fallback | Validate data, preserve host ownership and require current execution support before import | Review diff for no new provider adapter/fallback/default/credential path |

### Minimum Verification Gates

- [x] Focused protocol/client/host tests pass.
- [x] Focused Zero Cost GUI tests pass.
- [x] `npm run typecheck --silent` passes.
- [x] `npm --prefix gui run build --silent` passes.
- [x] `git diff --check` passes.
- [x] No live model inference or paid call is made.

## References

- `src/providers/zero-cost-model-catalog.ts`
- `src/core/user-catalog.ts`
- `src/gui-host/provider-routes.ts`
- `gui/src/settings/zero-cost-radar-panel.tsx`
- ZeroCostRadar public repository/feed: `zackemannen81/zerocostradar`

## Checklist

- [x] Claim A008-0151 on main and create isolated branch.
- [x] Re-read current zero-cost and user-catalog ownership.
- [x] Add versioned ZeroCostRadar producer feed.
- [x] Add typed refresh operation and client path.
- [x] Add bounded executable-route import.
- [x] Add GUI controls and state.
- [x] Add/adjust focused tests.
- [x] Update owning documentation.
- [x] Run minimum verification gates.
- [x] Archive task, write handoff and restore CURRENT_TASK template.

## Decisions and Notes

- Bundled catalog remains the offline baseline; live refresh is explicit and fail-closed.
- Current user-catalog execution resolves arbitrary non-OpenAI/KIE providers as NVIDIA,
  so only genuine NVIDIA discovery routes are addable in this task unless already shipped.
- A route already present in the shipped ModelRegistry is available, not an import target.
- Unsupported providers remain visible discovery results with an explicit reason.

## Charter Amendment Log

- none

## Verification

- Canonical ZeroCostRadar feed published as `data/a008-model-routes.json` and verified live at the public Netlify asset URL.
- Full A008 suite: 714/714 core + 4/4 membership + 189/189 GUI = 907 tests, zero failures/skips.
- Focused host/provider coverage includes explicit live refresh, malformed-feed fail-closed behavior and idempotent user-catalog import.
- `npm run typecheck --silent` passed.
- `npm --prefix gui run build --silent` passed with only the pre-existing bundle-size/Zod annotation warnings.
- `npm run verify:protocol --silent` passed with an independent offline packed consumer.
- `npm run verify:client --silent` passed with an independent offline packed consumer.
- `git diff --check` passed.
- No live model inference or paid provider call was made.
- Full-suite verification exposed an existing test-harness leak from the operator's real `~/.a008/catalog.json`; the runtime-preferences real-host fixture now injects an isolated catalog path and passes deterministically.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md`
- [x] `docs/FILESTRUCTURE.md` if structure changes
- [x] archive + handoff

## Handoff and Follow-ups

- Current state: complete and ready for review/merge.
- Next recommended step: A008-0152 provider execution support for currently discovery-only ZeroCostRadar routes.
- Blockers: none.
- Child tasks: none.
- Resume condition: none; use the handoff and PR state.
- Open questions: none.
