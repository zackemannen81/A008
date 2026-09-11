# A008-0097 Agentic Tool Changes

Status: Complete
Task ID: A008-0097

## Outcome

The GUI now presents tool execution as a semantic, collapsible narrative instead of a flat list. Runtime-provided retry provenance is preserved and recovered calls are shown as recovered rather than unresolved failures.

## Delivered

- Added runtime-facing tool-call fields for tool identity, status, timing, retry provenance, summaries and errors.
- Added derived display states: running, ok, recovered and failed, with failed calls represented as blocking in the unresolved-failure styling.
- Added live/completed summary, per-tool grouping, individual call expansion and Raw trace.
- Kept compatibility with the older host payload shape while the runtime migrates to the richer fields.
- Added status colors and a running pulse in the chat tool panel.

## Verification

- `npm --prefix gui run typecheck` passes.
- `npm --prefix gui run test` passes: 156 tests, 0 failures.

## Scope Review

The change is limited to the GUI session/tool view contract and its presentation. It does not infer retries from similar commands and does not alter execution, approval, provider or credential boundaries.
