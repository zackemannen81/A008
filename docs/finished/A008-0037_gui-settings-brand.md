# Task A008-0037 — GUI settings and brand

Status: Complete
Owner: A008-worker06
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `grok/A008-0037-gui-settings-brand`
Clone: `C:\code\A008-workers\A008-worker06`

## Goal

A008 visual identity and settings: product name A008, model label from session,
connection status, memory/status fields that do not show secrets. Distinct from
OpenHands/Agent Canvas chrome. No telemetry.

## Primary Deliverable

`BrandMark` and `SettingsPane` implementations plus A008-owned brand CSS.

## In Scope

- `gui/src/settings/**`
- `gui/src/brand/**`
- `gui/src/styles.css` if present
- `docs/handoffs/A008-0037.md`
- `docs/finished/A008-0037_gui-settings-brand.md`

## Out of Scope

- Restructuring `gui/src/app.tsx`
- OpenHands wordmark, PostHog, API-key fields
- Live NVIDIA GUI E2E
- Editing sibling GUI modules, `src/gui-host/`, or shared current-truth docs
- Merge to `main`

## What landed

- Product name A008 in `BrandMark` (geometric mark + wordmark + "AI client").
- Cyan HUD chrome on `.a008-app`, `.a008-header`, `.a008-main`, `.a008-aside`
  using `--a008-*` tokens. No `--oh-*` tokens.
- `SettingsPane` shows product, session model, connection, session id, memory
  (`local, host-owned`), telemetry (`off`), and credentials (`host process
  only`). No key field, no path, no PostHog.
- Error text is redacted before render (env-key names, bearer tokens, home
  paths, sqlite paths). Connect is offered only when idle or error.
- `gui/src/styles.css` was absent; identity stays in `gui/src/brand/a008.css`.

## Verification

- [x] No OpenHands wordmark, no PostHog, no API keys in the UI
- [x] Keep `BrandMark` and `SettingsPane` exports
- [x] `gui` typecheck and production build
- [x] Settings view checks (secret-safe mapping)
- [x] Static markup smoke (A008 identity; leaked key name redacted)
- [x] Restore CURRENT_TASK template, handoff, PR, do not merge

Exact commands and outputs are in `docs/handoffs/A008-0037.md`.

## Documentation Updates

Shared current-truth files were out of write scope. Operator should update
`docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, and `docs/JOURNAL.md` on merge.

## Handoff and Follow-ups

- Current state: Complete on `grok/A008-0037-gui-settings-brand`
- Next recommended step: operator review and merge; do not merge from this worker
- Blockers: none
- Child tasks: none
