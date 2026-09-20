# A008-0148 — User-configured MCP servers and Settings surface

Task ID: A008-0148
Parent Task: None
Status: Complete
Owner: Rickard (operator)
Created: 2026-09-21
Charter frozen at: 2026-09-21
Completed: 2026-09-21

## Summary

A008's bundled GUI can now persist and manage operator-configured local stdio MCP servers in Parameters → MCP. Valid enabled definitions are supplied only when a new bundled GUI session constructs its existing EngineHost/ModelToolSession tool runtime.

## Frozen Charter

### Goal

Make the existing stdio MCP capability usable from the bundled A008 product through Settings-owned configuration while preserving the existing shared engine/session tool owner.

### Primary Deliverable

One persisted operator-managed stdio MCP catalog, a bounded Settings editor, validation before host/engine handoff, and construction-time injection into the existing EngineHost → ModelToolSession path.

### In Scope

- Persist stable name, command, argument list, non-secret environment entries and enabled state.
- View, add, edit, remove and enable/disable server definitions in Settings.
- Validate configuration before it reaches execution and preserve stdio-only support.
- Supply the same enabled definitions to applicable V1 and V2 bundled-GUI session construction paths.
- Make the new-session-only lifecycle explicit without hot reload.
- Preserve existing ModelToolSession approval, cancellation, timeout and budget ownership.

### Out of Scope

- Conversation/session/history restoration or lifecycle ownership belonging to A008-0147.
- Renderer-side process ownership, a second MCP execution engine, remote transports, credential storage, installation/discovery/marketplace work, hot replacement, tool history persistence, native-tool policy changes, and Stage-5 migration work.

### Definition of Done

- Canonical configuration persists across restart; an empty catalog preserves no-MCP behavior.
- Settings owns inspection and valid add/edit/remove/disable operations and reports validation errors.
- Only EngineHost/ModelToolSession reaches MCP execution; renderer code never spawns a process.
- New applicable sessions receive enabled configured definitions; active sessions retain their constructed catalog.
- Existing approval, cancellation, timeout and catalog/tool-budget controls remain active.
- The V1 and V2 GUI host session constructors agree on effective enabled configuration.
- Focused persistence/configuration, Settings, handoff, safety-boundary and repository verification gates pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `d3d3dc1`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Actual check |
| --- | --- | --- | --- | --- |
| Persist stdio MCP configuration | PC-06 | The bundled product could not configure its existing MCP capability | Add `mcpServers` to the existing user catalog | Catalog persistence/empty-catalog tests |
| Settings surface | PC-06 | No supported operator workflow exists | One Parameters → MCP editor | GUI Settings tests |
| Validate before engine handoff | PC-01 / PC-05 | Malformed definitions could reach execution | Validate at catalog/host boundary; retain tool-owner validation | Invalid transport/configuration tests |
| Canonical session injection | PC-01 / PC-05 | Persistence alone would not make tools available | Read enabled catalog at existing new-session seams | V1/V2 handoff and real-host HTTP tests |
| Preserve controls | PC-05 | A new execution path could bypass tool safety policy | Reuse ModelToolSession unchanged as execution owner | Existing approval/cancellation/budget regressions |
| Respect A008-0147 boundary | PC-01 and task ownership | Competing session lifecycle ownership | Supply only canonical construction input | Scope review; no restore/hot reload implementation |

## Implementation

- `src/core/user-catalog.ts` adds additive `mcpServers` persistence, strict stdio-shaped validation, enabled filtering and legacy empty-catalog compatibility in `~/.a008/catalog.json` (or the configured catalog path).
- `gui/src/settings/mcp-servers.ts` and `mcp-servers-panel.tsx` provide Parameters → MCP list/add/edit/remove/enable/disable interaction, local validation feedback and an explicit new-session lifecycle notice.
- Typed `GET`/`POST /v1/mcp-servers` contracts are owned in `packages/protocol`, with generated OpenAPI updated. The host reads/writes only validated catalog content.
- `src/gui-host/local-acp-bridge.ts` and `src/gui-host/v2-session.ts` resolve the same enabled catalog only at new EngineHost session construction. They do not mutate active sessions.
- EngineHost passes the definitions to the existing ModelToolSession, which remains the only MCP process/catalog/tool execution owner. No renderer process spawning, transport expansion, approval-policy change, cancellation change or budget change was added.
- `test/http-contract.test.ts` now performs authenticated real-host GET/POST coverage for the new MCP routes, including malformed rejection, so the route inventory is exercised rather than merely declared.

## Parallel-task Boundary — A008-0147

A008-0148 supplies `persisted user configuration -> validated MCP server definitions -> existing session/tool owner`. It does not restore conversations/sessions, change canonical lifecycle state or introduce a competing session-construction interface. Configuration changes apply only to newly constructed tool/session runtimes.

## Verification

- `npm run typecheck` — passed.
- `npm --prefix gui run typecheck` — passed.
- `npm run test:core` — passed: 703 tests, 0 failures/skips.
- `npm run test:membership` — passed: 4 tests, 0 failures/skips.
- `npm run test:gui` — passed: 187 tests, 0 failures/skips.
- `git diff --check` — passed.
- The first full core run exposed a missing real-host HTTP inventory exercise for the two new MCP routes. The task added authenticated GET/POST plus malformed-request coverage to `test/http-contract.test.ts`; the full core suite then passed.

## Documentation Updates

- [x] `docs/SYSTEMDOC.md` — Settings → catalog → EngineHost → ModelToolSession ownership and lifecycle.
- [x] `docs/FILESTRUCTURE.md` — implementation and test owners.
- [x] `docs/CURRENT_STATUS.md` — current completed behavior.
- [x] `docs/JOURNAL.md` — completion entry.
- [x] Archive and handoff created.

## Handoff and Follow-ups

- Current state: A008-0148 is complete. New bundled GUI sessions receive enabled validated local stdio MCP definitions; active sessions are intentionally unchanged.
- Next recommended step: merge through the normal PR process. Any later session-restoration integration must consume the canonical construction seam owned by A008-0147.
- Blockers: none.
- Child tasks: none.
- Resume condition: N/A.
- Open questions: none.
