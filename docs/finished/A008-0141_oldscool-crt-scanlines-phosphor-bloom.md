# A008-0141 — Oldscool CRT scanlines and phosphor bloom

Task ID: A008-0141
Parent Task: None
Status: Complete
Owner: A008
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 7790625bb66c6f51a4837df754ec1eb89127719b

## Task Summary

Add the owner-requested Oldscool visual expression to the existing renderer-local app-theme system: dark CRT surfaces, phosphor-green controls, scanlines and restrained bloom. Neutral and Deep Space remain unchanged.

## Task Charter

### Goal

Make Oldscool a selectable, persistent CRT-inspired app theme with theme-scoped scanline and phosphor-bloom effects.

### Primary Deliverable

A renderer-local `oldscool` theme selectable from Parameters → Appearance, with semantic theme tokens, first-paint persistence, a CRT scanline layer and restrained phosphor bloom scoped exclusively to Oldscool.

### In Scope

- Add the `oldscool` app-theme identity, palette and appearance picker card.
- Persist and apply Oldscool before React mounts using the existing appearance preference.
- Add static CRT scanlines and phosphor bloom scoped to `[data-a008-theme="oldscool"]`.
- Cover theme identity, storage, token completeness and CRT presentation selectors with GUI regression tests.
- Update current system/status/structure documentation and ADR 0038 as the existing theme decision owner.

### Out of Scope

- Runtime, session, model, provider, tool, memory, host-protocol or API changes.
- Layout, typography, navigation or Relationship Map semantic changes.
- Any theme changes to Neutral or Deep Space.
- Changes to the sandboxed Code Canvas preview document.
- Animation, simulated CRT distortion, audio, new dependencies, or a separate graph palette.

### Definition of Done

- [x] Parameters exposes Oldscool, which persists and applies before first renderer paint.
- [x] Oldscool provides complete semantic and visualization token families.
- [x] Only Oldscool renders a non-interactive scanline layer and restrained phosphor bloom on its designated chrome/control states.
- [x] Neutral and Deep Space retain their existing output and no runtime-facing behavior changes.
- [x] GUI typecheck, relevant GUI tests, GUI production build and `git diff --check` pass.
- [x] The task is archived, handed off, journaled, and `docs/CURRENT_TASK.md` is restored from its template.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md` PC-06 — supported user controls and content through their existing owners.
Contract revision: `7790625bb66c6f51a4837df754ec1eb89127719b`.
Accepted constraint: ADR 0038 defines renderer-local named themes, root semantic CSS tokens, immediate root-attribute switching, and explicitly prohibits runtime/session/memory/tool/preview effects.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Oldscool theme identity and palette | PC-06; ADR 0038 renderer-local appearance preference and semantic-token owner | The requested visual expression cannot be selected or retained across reloads | Extend the existing union, preference parsing, pre-paint bootstrap, picker, and token block | Theme storage/render/token GUI regressions |
| CRT scanlines and phosphor bloom | PC-06; ADR 0038 permits chrome presentation but preserves app behavior and preview isolation | Oldscool would remain only a recolour and fail to provide the requested CRT/phosphor expression | One pointer-inert static app overlay plus targeted CSS shadows under the Oldscool root selector | Static selector regression and GUI build review |
| Documentation and lifecycle evidence | PC-06; docs-first workflow | Future operators could not distinguish renderer-only presentation from runtime behavior | Update existing theme decision/system docs and archive the frozen task | Documentation review, archive/handoff/template comparison |

### Minimum Verification Gates

- [x] Theme identity/storage/token and CRT-selector GUI regressions pass.
- [x] GUI typecheck passes.
- [x] GUI production build passes.
- [x] `git diff --check` passes.
- [x] Final review confirms the change is renderer-only and Neutral/Deep Space selectors are untouched.

## References

- `docs/PROJECT_BRIEF.md` PC-06
- `docs/adr/0038-global-app-theme-system.md`
- `gui/src/brand/theme.ts`
- `gui/src/brand/themes.css`
- `gui/src/brand/a008.css`
- `gui/src/settings/appearance-panel.tsx`

## Checklist

- [x] Confirm operator allocation `A008-0141` on remote main.
- [x] Read the governing docs and freeze this charter.
- [x] Complete the Oldscool identity/palette/persistence/picker implementation.
- [x] Add Oldscool-scoped scanline and phosphor-bloom styling.
- [x] Add focused regression coverage.
- [x] Run verification gates and review final scope.
- [x] Update owning documentation.
- [x] Archive, hand off, append journal entry and restore the current-task template.

## Decisions and Notes

- The provided Oldscool concept image is a local design reference in `docs/concepts_sandbox/`; it is not copied into product output.
- The scanline layer is static and pointer-inert. It does not alter input, focus, session state or preview isolation.
- Bloom is limited to Oldscool chrome and primary/active control states, using existing theme variables; it does not imply graph strength or memory semantics.

## Charter Amendment Log

- none

## Verification

- `npm --prefix gui run test -- --test-name-pattern="theme"`: 177 GUI tests passed, 0 failures/skips.
- `npm --prefix gui run typecheck`: passed.
- `npm --prefix gui run build`: passed. Existing Rollup warnings remain for two Zod annotation comments and the >500 kB chunk size.
- `git diff --check`: passed.
- Final scope review: the changed implementation is limited to renderer theme identity, markup, CSS and tests. No runtime, session, provider, tool, memory, host/API or Code Canvas preview behavior changed. All scanline/bloom selectors are gated by `html[data-a008-theme="oldscool"]`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/adr/0038-global-app-theme-system.md`

## Handoff and Follow-ups

- Current state: complete; ready for the requested local commit.
- Next recommended step: operator may visually inspect Oldscool in the bundled GUI after integrating the local commit.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository branch state.
- Open questions: none.
