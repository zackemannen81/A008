# Task A008-0037 — GUI settings and brand

Status: Ready
Owner: A008-worker06
Parent: A008-0030
Branch: `grok/A008-0037-gui-settings-brand`
Clone: `C:\code\A008-workers\A008-worker06`

## Write scope

- `gui/src/settings/**`
- `gui/src/brand/**`
- `gui/src/styles.css` if present
- `docs/handoffs/A008-0037.md`
- `docs/finished/A008-0037_gui-settings-brand.md`

Do not edit `gui/src/app.tsx` structure. You may add classes in brand CSS that
`app.tsx` already references (`.a008-app`, `.a008-header`, `.a008-main`,
`.a008-aside`).

## Goal

A008 visual identity and settings: product name A008, model label from session,
connection status, memory/status fields that do not show secrets. Distinct from
OpenHands/Agent Canvas chrome. No telemetry.

## Gates

- No OpenHands wordmark, no PostHog, no API keys in the UI
- Restore CURRENT_TASK template, handoff, PR, do not merge
