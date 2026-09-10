# A008-0093 — Global App Theme System

Task ID: A008-0093
Parent Task: None
Status: Ready
Owner: Grok (operator)
Created: 2026-09-11
Last updated: 2026-09-11
Charter frozen at: 2026-09-11; contract revision `f14e1f96407c969a4bb4ec5d53a818739c6139e3`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0019-a008-owned-gui.md`
- `docs/adr/0021-workspace-shell.md`
- `docs/adr/0027-runtime-preferences-and-instructions.md`
- `docs/adr/0030-focused-standalone-workspace.md`
- `docs/adr/0038-global-app-theme-system.md`

## Task Summary

Introduce a persistent, global semantic theme system for the A008 GUI. Preserve
the existing interface as Neutral and add a Deep Space theme based on the
approved blue-black/navy target. Theme changes are local presentation state
only and must not affect chat/session/runtime/tool/memory behaviour.

## Task Charter

### Goal

Let the user switch the whole A008 GUI between Neutral and Deep Space through
semantic design tokens, without components knowing specific themes and without
touching session, model, memory, tools or Code Canvas preview behaviour.

### Primary Deliverable

An A008-owned theme identity plus CSS token sets, a Parameters → Appearance →
App theme picker, renderer-local persistence, and a first-pass chrome/Memory
migration onto those tokens.

### In Scope

- Theme identity `neutral` | `deep-space` with display name and short
  description. TypeScript selects identity; CSS owns colour values.
- Root data attribute, preferably `html[data-a008-theme]`, applied before first
  paint from the persisted preference.
- Required semantic token model (extend only when an existing component needs
  another functional level; never add physical colour tokens such as `--blue-1`):

  ```css
  /* App */
  --a008-bg-app
  --a008-bg-sidebar

  /* Surfaces */
  --a008-surface-1
  --a008-surface-2
  --a008-surface-3
  --a008-surface-hover
  --a008-surface-selected

  /* Borders */
  --a008-border-subtle
  --a008-border-default
  --a008-border-active

  /* Text */
  --a008-text-primary
  --a008-text-secondary
  --a008-text-muted
  --a008-text-disabled

  /* Interaction */
  --a008-accent
  --a008-accent-hover
  --a008-accent-soft
  --a008-focus-ring

  /* Status */
  --a008-success
  --a008-warning
  --a008-danger

  /* Effects */
  --a008-glow-accent
  --a008-shadow-panel
  ```

- Bind existing token names in `gui/src/brand/a008.css` (`--a008-bg`,
  `--a008-panel`, `--a008-fg`, `--a008-border`, `--a008-good`, retired
  `--a008-cyan` aliases, and the rest of that file's current public tokens) to
  the semantic model so unmigrated feature CSS still follows the selected theme.
- Neutral values extracted from the current A008 CSS. The example hex in the
  owner brief is direction only; `#181818` / `#eeeeee` / `#e4e4e4` and the
  rest of today's `a008.css` win over the brief's sample Neutral block.
- Deep Space token set following the owner brief's blue-black/navy/slate
  direction. Brief hex values are starting points; visual balance outranks
  hex identity. Not cyberpunk, neon-UI, or a second design system.
- Separate visualization tokens, for example:

  ```css
  --a008-viz-identity
  --a008-viz-state
  --a008-viz-claim
  --a008-viz-event
  --a008-viz-artifact
  --a008-viz-provenance
  ```

  Add `--a008-viz-history` and `--a008-viz-utterance` if those existing Memory
  kinds need their own colour. Neutral visualization values preserve current
  Memory kind colours. Deep Space may use the owner mapping (identity cyan,
  state green, claims violet, events amber, artifacts blue, provenance magenta)
  without a user-facing palette picker.
- Parameters gains an **Appearance** section containing **App theme**, with
  Neutral and Deep Space choice cards. The selected theme is visually and
  accessibly marked. Appearance is usable without a connected ACP session.
  Theme change applies immediately, does not reload, and does not start a new
  chat/session.
- Persist as a renderer-local global preference with logical shape
  `{ "appearance": { "theme": "deep-space" } }`. Missing or unknown theme
  defaults to `neutral` without destroying unrelated preferences. Do not write
  theme into `~/.a008/settings.json` or through `session/control`.
- First-pass migration of common chrome onto semantic tokens: app root,
  sidebar, header, navigation, panels, dialogs, cards, buttons, inputs,
  composer, workbench, Memory surfaces, and Code Canvas **shell**. Hardcoded
  colours that encode global UI semantics should become tokens. True
  visualization/status colours may remain as viz/status tokens.
- Relationship Map consumes theme surfaces and viz tokens. No
  `if (theme === "deep-space")` in graph logic. Stored relationship strength
  continues to drive opacity/thickness when used semantically. Deep Space may
  look richer because its token values are richer (darker canvas, selective
  node glow, colder inspector, accent strength bars, fewer gray décor lines),
  not because the algorithm changed.
- Focused tests listed under Minimum Verification Gates, plus owning docs.

Prefer extending `gui/src/brand/` (token CSS) and `gui/src/settings/`
(Appearance control) over creating `gui/src/theme/`. A small identity/storage
module may sit next to brand or settings if that is clearer than dumping
parsers into CSS files. Do not add a subsystem folder just because this
charter mentioned one.

### Out of Scope

- Layout redesign, navigation moves, or mobile-navigation changes.
- Relationship Map algorithm, clustering, retrieval or lifecycle changes.
- Typography family change.
- Animations sprinkled across the UI.
- Code Canvas sandbox, CSP, srcdoc policy, or preview-document styling.
- Light theme, OLED, Warm, High Contrast, Custom, or OS-theme detection.
- Third-party theme libraries.
- User-selectable visualization palette control.
- Runtime settings schema, ACP/host protocol, provider, memory engine, tool
  permissions, or conversation persistence.
- Live provider calls, push, publication, or desktop packaging.

### Definition of Done

- [ ] A008 starts with Neutral when no theme is stored.
- [ ] Parameters has Appearance → App theme with Neutral and Deep Space.
- [ ] Switching applies immediately without reload and without a new
      chat/session, model change, memory mutation or tool-permission change.
- [ ] The choice survives page reload / app restart.
- [ ] Neutral stays visually close to today's A008.
- [ ] Deep Space changes the whole app's base material, not only Memory.
- [ ] Shared chrome uses semantic tokens; both themes define every required
      token.
- [ ] Relationship Map is theme-compatible through tokens, not theme branches.
- [ ] Visualization colours are a separate token family from chrome.
- [ ] Older GUI preferences remain readable; missing theme defaults to Neutral
      with no data loss.
- [ ] Code Canvas preview document is not restyled by the host theme.
- [ ] Desktop and narrow/mobile chrome render correctly.
- [ ] Existing tests pass; new tests cover parsing, default, persistence and
      live switching.
- [ ] Owning docs and ADR 0038 describe the implemented behaviour.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `f14e1f96407c969a4bb4ec5d53a818739c6139e3`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Semantic theme tokens and root identity | PC-06 supported GUI controls; ADR 0019 D1 product GUI; ADR 0021 `a008.css` is the token source so a palette change is one file; ADR 0038 | Owner cannot change the visual expression without editing components; hardcoded hex would freeze Neutral or force `if (theme)` branches | Named themes as CSS variables on `data-a008-theme`; existing `--a008-*` names alias the semantic model | CSS/static contract: both themes define every required token; no component theme-id branch for chrome |
| Neutral preserves current look | ADR 0021 D2 as amended by ADR 0030 charcoal default; ADR 0038 Neutral is a migration | Introducing Deep Space would silently redesign A008 for every user | Extract current `a008.css` values into Neutral; do not use the brief's sample Neutral hex when it differs from shipped tokens | Token review against current `gui/src/brand/a008.css`; Neutral screenshot/desktop+narrow check |
| Deep Space token set | Owner request frozen by ADR 0038; PC-06; ADR 0030 presentation/local UI only | The approved Memory Relationship Map material cannot be used across the product GUI | One additional token set; no layout, type-family, or engine change | Visual acceptance (desktop + narrow) plus token contract |
| Appearance control and persistence | PC-06; ADR 0019 D6 (no credentials in storage); A008-0075 renderer-local GUI prefs; ADR 0027 runtime settings remain budgets/instructions | Choice resets or flashes Neutral on load; putting theme in `settings.json` would mix presentation into the engine and require protocol | Parameters → Appearance cards; renderer-local `{appearance.theme}`; apply before first paint; unknown/missing → `neutral` | Unit roundtrip/default/unknown; DOM attribute updates immediately; unrelated prefs preserved |
| Runtime/session/canvas isolation | PC-01 shared engine; PC-05 execution/credential boundary; ADR 0021 D6 presentation-only; A008-0091 preview isolation | Theme switch could spawn a session, call a provider, clear chat, mutate memory, or leak host colours into the sandboxed preview | No host/ACP/runtime write path; Canvas chrome may follow tokens, preview `srcdoc` document must not | Regression: same `sessionId`; no provider call; conversation preserved; preview document independent of host theme |
| Visualization palette vs chrome | PC-06 memory inspection (ADR 0025/0031/0038); strength remains stored data | Mixing graph colours into chrome would require a new app theme for a later graph palette, and glow could fake relationship strength | `--a008-viz-*` family; map existing Memory kinds; graph JS stays theme-agnostic | CSS contract for viz tokens; graph still maps stored strength to opacity/thickness; no `theme ===` in map logic |

### Minimum Verification Gates

- [ ] Unknown or missing theme parses to `neutral`.
- [ ] Neutral and Deep Space round-trip through persistence.
- [ ] Older preference documents remain readable; saving theme preserves
      unrelated GUI preferences.
- [ ] DocumentElement (or equivalent app root) receives the selected
      `data-a008-theme` attribute; changing the picker updates it immediately.
- [ ] Appearance renders both choices; the active theme is indicated
      accessibly (`aria-pressed` / equivalent).
- [ ] Theme switch keeps the same `sessionId`, does not call a provider, does
      not clear the conversation, and does not alter the Code Canvas artifact
      source or preview document styles.
- [ ] Both themes define all required semantic and visualization tokens.
- [ ] Neutral token values match the extracted current palette.
- [ ] Desktop and narrow/mobile screenshots or browser review cover Chat,
      Parameters Appearance, Memory Relationship Map and Code Canvas chrome vs
      preview isolation.
- [ ] `npm test`, GUI production build and `git diff --check` pass.
- [ ] Final diff is reviewed against this necessity gate and frozen scope.

## References

- Owner brief for this task (A008 — App Theme System), frozen here rather than
  in chat history.
- `gui/src/brand/a008.css` — current Neutral source of truth.
- `gui/src/brand/workspace.css` — standalone composition; keep layout, retokenize colours.
- `gui/src/settings/parameters-panel.tsx` — current tabs: Model, Provider, Budgets, Instructions.
- `gui/src/chat/empty-shortcuts.tsx` — existing renderer-local GUI preference pattern.
- `gui/src/memory/memory.css` — hardcoded kind colours and graph canvas colours to retokenize.
- `gui/src/artifact/code-artifact.css` — host chrome may follow tokens; preview iframe must not.
- `docs/RUNTIME_SETTINGS.md` — engine budgets/instructions; not the theme store.

## Checklist

- [x] Claim `A008-0093` on `main` and freeze this charter as Ready.
- [ ] Copy this charter into `docs/CURRENT_TASK.md` on the implementation branch only.
- [ ] Extract current Neutral token values from `gui/src/brand/a008.css`.
- [ ] Add theme identity, persistence, early root attribute, and CSS token sets.
- [ ] Add Parameters → Appearance → App theme picker.
- [ ] Alias existing `--a008-*` names onto the semantic model.
- [ ] Migrate common chrome and Memory/graph hardcoded global colours to tokens.
- [ ] Keep Relationship Map algorithm and Code Canvas sandbox unchanged.
- [ ] Add focused unit/DOM/CSS-contract/session-isolation tests.
- [ ] Browser-verify desktop and narrow: Neutral closeness, Deep Space whole-app
      material, Memory map, Appearance picker, Canvas preview isolation.
- [ ] Update owning docs; review the final diff against the gate; archive,
      restore the current-task template, and write the handoff.

## Decisions and Notes

- This charter is Ready and frozen. Implementation stays inside the recorded
  scope and gates.
- Persistence is renderer-local on purpose. `~/.a008/settings.json` is the
  ADR 0027 runtime document; writing `appearance.theme` there would expand
  host/ACP, mix presentation into the engine, and risk CLI/runtime coupling.
  The owner JSON example is the logical shape, not a store-path mandate.
- Appearance must work while disconnected. Model/budget controls may still
  require a session; theme does not.
- Do not introduce `gui/src/theme/` unless brand and settings cannot own the
  split without becoming a dumping ground.
- Deep Space glow is selective. Relationship strength is data. Those are
  different signals even when both are visible.
- Future themes and a selectable visualization palette are explicitly not
  implemented. Token ownership should not block them.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/JOURNAL.md` on operator merge
- [ ] ADR 0038 consequences if implementation refines a recorded detail without
      changing the decision

## Handoff and Follow-ups

- Current state: Task ID `A008-0093` is claimed on `main`. Charter is Ready.
  Direction is [ADR 0038](../adr/0038-global-app-theme-system.md).
  `docs/CURRENT_TASK.md` on `main` remains the empty template.
- Next recommended step: implement on a dedicated branch from this revision;
  copy this charter into that branch's `docs/CURRENT_TASK.md` while working.
- Blockers: none.
- Child tasks: none.
- Resume condition: implementation begins under this frozen charter with
  local/fake verification only. No live provider call.
- Open questions: exact Deep Space hex values are implementation judgment
  inside the recorded visual direction; Neutral must stay a migration.

## Finalize When Complete

- Archive under `docs/finished/A008-0093_global-app-theme-system.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0093.md`.
- Operator appends the signed journal entry on merge to `main`.
