# A008-0182 Local file browser and basic editor

Task ID: A008-0182
Parent Task: None
Status: Ready
Owner: A008 (operator)
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Task Summary

The workspace GUI already exposes a Files entry point but lacks a safe, usable local file browsing and editing workflow. This task supplies that bounded operator surface.

## Task Charter

### Goal

Provide a local workspace file browser with a basic guarded text editor and syntax-highlighted source view.

### Primary Deliverable

A GUI Files pane backed by authenticated host file operations, able to browse workspace files, open bounded text files, edit using the existing SHA-256 concurrency guard, and render supported source text with the existing highlighter.

### In Scope

- Browse the active workspace within existing host containment rules.
- Open bounded UTF-8 text files and expose loading/error states.
- Save edits only through the existing exact-match/SHA-256 file-edit authority.
- Syntax-highlight supported opened source text using existing GUI highlighter.
- Add focused host/GUI tests and current-state documentation.

### Out of Scope

- Binary/media preview, search, create/rename/delete operations, tabs, diffing, file watching, direct filesystem browser access, terminal execution, model changes, skill management, and sidebar changes.

### Definition of Done

- The authenticated Files pane lists contained workspace paths, navigates directories, opens eligible text files, and shows explicit errors.
- Saving a changed file uses existing optimistic-concurrency validation and reports conflicts without overwriting.
- Source text is escaped and syntax-highlighted through the existing highlight owner.
- Tests cover API validation/containment and GUI browse/open/edit states; typecheck and established GUI tests pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `6e5daac`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Local file browse/read/edit | PC-LF-01; local project tools remain usable without hosted A008 backend | Operator cannot inspect or safely adjust the active local workspace through A008 GUI | Reuse host-local authenticated route and existing file-tool validation; no renderer filesystem access | Host and GUI tests |
| Syntax-highlighted source view | PC-LF-01; local operator controls; existing `gui/src/highlight` is the rendering owner | Opened code remains hard to inspect and a duplicate highlighter would split rendering authority | Use existing bounded syntax highlighter on escaped text | GUI rendered-output test |

### Minimum Verification Gates

- [ ] Relevant root and GUI typechecks pass.
- [ ] New focused tests and existing GUI suite pass.
- [ ] Final diff complies with frozen scope and no renderer gains filesystem authority.

### Verification Budget

- Live verification purpose / required provider behavior: not needed; no provider call.
- Budget owner / parent allocation: A008-0182.
- Policy revision / inherited or explicit approved limits: TASK_WORKFLOW live-verification budget; zero use.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: none.

## References

- `docs/PROJECT_BRIEF.md` PC-LF-01.
- Existing GUI Files and highlighting modules.

## Checklist

- [ ] Inspect existing file-tool, host-route, Files-pane and highlighter contracts.
- [ ] Implement the bounded host/client contract and Files pane.
- [ ] Add focused tests.
- [ ] Verify, update authority docs, archive, handoff and restore the current-task template.

## Decisions and Notes

- The host retains filesystem authority; the browser receives only bounded path/text results and submits guarded edits.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against frozen necessity arguments and scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Ready for implementation.
- Next recommended step: inspect existing file and GUI contracts.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository state and this charter.
- Open questions: none.
