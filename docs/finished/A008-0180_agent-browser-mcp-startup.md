# Current Task

Task ID: A008-0180
Parent Task: None
Status: Complete
Owner: A008 (operator)
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Task Summary

Make the configured agent-browser MCP server's first-call failure diagnosable and repair a deterministic local startup defect if reproduction identifies one.

## Task Charter

### Goal

Provide a reproducible, local diagnostic outcome for agent-browser MCP startup and eliminate any A008-owned startup defect found within that boundary.

### Primary Deliverable

A deterministic probe/regression test and actionable MCP health result for the configured agent-browser stdio server.

### In Scope

- Reproduce agent-browser MCP initialize/tools-list behavior through A008's existing stdio probe.
- Preserve actionable process/handshake/catalog failure distinction and add bounded diagnostics necessary to distinguish startup failures.
- Repair an A008-owned defect only if local reproduction proves it.
- Update owning documentation and task handoff.

### Out of Scope

- Browser automation behavior after successful MCP initialization.
- Changes to agent-browser package implementation, provider routing, or unrelated MCP server semantics.
- Multi-session, file browser/editor, skills, sidebar, parameter-menu work.

### Definition of Done

- A deterministic regression verifies the observed agent-browser initialization outcome.
- A008 health/probe output distinguishes the verified failure stage without exposing environment secrets.
- Targeted MCP regression, root typecheck, and GUI tests pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `ec1c0fc`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| MCP startup diagnosis/repair | PC-LF-01; local tools and operator controls remain usable without hosted infrastructure | A local configured browser tool must either initialize or expose a concrete local failure stage; omission leaves the operator unable to distinguish A008 configuration/process failure from downstream browser behavior. | Exercise the existing stdio probe against the installed agent-browser command; add only safe stage diagnostics and a regression where needed. | Focused MCP probe test, typecheck, GUI tests. |

### Minimum Verification Gates

- [ ] Focused MCP probe regression.
- [ ] `npm run typecheck`.
- [ ] `npm --prefix gui run test`.
- [ ] `git diff --check`.

### Verification Budget

- Live verification purpose / required provider behavior: Not needed; local stdio process only.
- Budget owner / parent allocation: N/A.
- Policy revision / inherited or explicit approved limits: N/A.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.

## References

- `docs/PROJECT_BRIEF.md` PC-LF-01
- `src/tools/mcp-runtime.ts`
- `src/gui-host/mcp-health.ts`
- `docs/handoffs/A008-0153.md`

## Checklist

- [x] Claim task ID on main.
- [x] Freeze charter.
- [x] Reproduce with the installed agent-browser MCP command through the existing probe.
- [x] Add the regression proving the repository-owned MCP startup boundary.
- [x] Run verification and update documentation/handoff/archive.

## Decisions and Notes

- The A008 MCP probe already models process, handshake, catalog, and close stages; the task may not invent a retry/fallback policy.
- External A008 Client MCP launch timed out before navigation in this session. That observation does not establish a repository defect.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against necessity and frozen scope.
- [x] Focused `node --test dist/test/model-tools.test.js`: 16 passed.
- [x] `npm run typecheck`, `npm --prefix gui run test` (205 passed), and `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` not needed; no structure changed.

## Handoff and Follow-ups

- Current state: Complete.
- Next recommended step: Investigate the external A008 Client MCP runtime separately if its timeout persists.
- Blockers: None in the repository-owned MCP startup boundary.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: Whether the observed external-client timeout occurs before the repository-owned MCP process is launched.