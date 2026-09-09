# A008-0091 — Session code artifact and isolated preview

Task ID: A008-0091
Parent Task: A008-0090
Status: Complete
Owner: Codex (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09; contract revision `6e0b966e8dea3f9f3138010084bb09b55471c642`

## Task Summary

Supersede A008-0090 with the clarified owner intent: code shown and iterated in
chat is transient session content, not a repository mutation. A008 may turn a
completed assistant HTML code block into a local code artifact with editable
source and an isolated HTML/Canvas preview. Writing that content to the project
remains a separate explicit repository-tool action under the existing approval
boundary.

## Task Charter

### Goal

Let the user create, inspect, edit and preview a self-contained HTML/Canvas
artifact beside the existing A008 conversation without creating a second chat
engine, granting execution authority to model text, or silently writing files.

### Primary Deliverable

An A008-owned code-artifact panel in `gui/` that recognizes bounded completed
assistant `html` code fences, keeps the current artifact in GUI session state,
allows local text edits, and renders it in an isolated no-credential preview.

### In Scope

- Parse complete fenced `html` / `htm` blocks from completed assistant answers.
- Keep one current artifact in renderer/session UI state; a later completed HTML
  block replaces the prior model version while local manual edits remain local.
- Render assistant prose and fenced code as distinct chat markup; HTML blocks
  expose an explicit Canvas action.
- Add a Code / Preview panel reachable from the existing chat header and capable
  of opening automatically when the user chooses an HTML block.
- Preview through `iframe srcdoc` with sandboxing and injected CSP that blocks
  provider access, network subresources/connections, forms, frames and objects.
- Bound artifact source size and reject incomplete/oversized candidate blocks.
- Keep current file/Git tools and approval semantics unchanged.
- Add focused parser, preview-policy, DOM and layout regressions plus owning docs.

### Out of Scope

- Repository persistence, automatic file writes or save-to-disk from artifact state.
- A new model tool, hidden prompt mutation or a second provider/chat path.
- Multi-file projects, npm/package installation, bundlers, language servers,
  Monaco/CodeMirror or a full IDE.
- Server-side execution of artifact code, shell execution or filesystem access.
- Durable artifact persistence, sharing, accounts, ACLs or session resume.
- External-network preview dependencies, remote deployment or publication.
- Changes to `vectorfield.html`; it remains an unrelated owner-created demo.

### Definition of Done

- [x] Completed assistant HTML fences render as code blocks and can become the
      current artifact without mutating the repository.
- [x] Code panel permits local edits and Preview rerenders the current source.
- [x] Preview supports inline HTML/CSS/JavaScript/Canvas while remaining in a
      sandboxed unique-origin iframe with restrictive CSP.
- [x] Assistant prose or command-shaped text alone cannot create host execution.
- [x] No artifact action writes to disk; repository mutation still requires the
      existing model file/Git tools and their approval/cancellation flow.
- [x] Oversized or malformed/incomplete HTML fences fail as artifact candidates
      without breaking ordinary chat rendering.
- [x] GUI typecheck/build, focused GUI tests and full repository tests pass.
- [x] Owning protocol/system/status/file-structure docs describe actual behavior.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `6e0b966e8dea3f9f3138010084bb09b55471c642`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Session code artifact | PC-01 / ADR 0030 focused standalone GUI | User can work with code in the existing conversation without a parallel chat engine | Derive one transient artifact from completed assistant HTML content in the existing GUI | Pure parser + DOM tests; no new provider/session path |
| Isolated HTML/Canvas preview | PC-05 explicit execution/credential boundaries | Model-produced code can be previewed without gaining host/provider authority | Sandboxed unique-origin `srcdoc` iframe with injected restrictive CSP; no host route | Preview-policy test asserts sandbox/CSP and absence of host/provider API |
| Repository separation | PC-05 established structured approved tools | Artifact iteration must not silently become filesystem mutation | Keep artifact state renderer-local; do not add write route/tool; existing file/Git tools unchanged | Source/diff review + existing tool approval regressions |
| Bounded GUI integration | PC-06 supported user controls/content | Code content needs an explicit visible surface and unsupported oversized input must fail clearly | One Code/Preview panel, one current artifact, bounded source | GUI component/parser tests and production build |

### Minimum Verification Gates

- [x] Parser distinguishes prose, complete HTML fences, incomplete fences and
      source over the artifact byte ceiling.
- [x] Preview builder injects restrictive CSP and iframe uses only `allow-scripts`
      sandboxing, never `allow-same-origin`, forms, popups or top navigation.
- [x] Chat DOM keeps thought isolated and renders code separately from prose.
- [x] Artifact edits remain renderer-local; no new HTTP/WS mutation or native tool.
- [x] Existing repository-tool approval regression remains green.
- [x] `npm test`, GUI production build and `git diff --check` pass.
- [x] Final diff is reviewed against the frozen necessity arguments.

## References

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/HOST_PROTOCOL.md`
- `docs/SYSTEMDOC.md`
- `docs/CURRENT_STATUS.md`
- `docs/tasks/A008-0090_integrated-code-canvas.md` (superseded)
- ADR 0019, 0028, 0029, 0030

## Checklist

- [x] Claim A008-0091 and supersede A008-0090 without rewriting its frozen scope.
- [x] Copy this charter to `docs/CURRENT_TASK.md` on the implementation branch.
- [x] Implement pure artifact parsing and preview policy first.
- [x] Render fenced code in chat and wire explicit artifact selection.
- [x] Add Code/Preview panel with renderer-local edits.
- [x] Add focused security/DOM/layout tests.
- [x] Run full verification and review no new host/provider/tool surface exists.
- [x] Update owning docs, archive, handoff and restore CURRENT_TASK template.

## Decisions and Notes

- Artifact source is content, not execution authority and not a repository file.
- Only a completed assistant `html`/`htm` fence can seed a model artifact in this
  slice. JavaScript/CSS-only and multi-file artifacts are explicitly unsupported.
- The preview may execute inline scripts only inside its sandbox. Network and
  external dependencies are disabled by injected CSP.
- Local textarea edits change only the current browser artifact state. They are
  not added to chat history or semantic memory and are lost on page/session reset.
- A later request to export/apply artifact state to files requires its own bounded
  design if existing chat/file-tool flow is insufficient.

## Charter Amendment Log

- none

## Verification

- [x] `npm --prefix gui run build` passed after the final reset/new-conversation artifact cleanup.
- [x] `npm --prefix gui test`: 125/125 passed, including parser, DOM, sandbox/CSP and credential-boundary regressions.
- [x] Root `npm test`: 540 core, 4 membership and 125 GUI tests passed. Existing repository-tool approval tests remained green.
- [x] Source/diff review found no new host HTTP/WS route, ACP method, provider path or native/model tool for artifact mutation.
- [x] Final `git diff --check` passed after archive/handoff cleanup and CURRENT_TASK template restoration.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete. The bounded session artifact, local editor and isolated preview are implemented in the product GUI.
- Repository boundary: unchanged; persistence still requires the existing approved file/Git tools.
- Blockers: none.
- Child tasks: none.
- Follow-up candidates, not part of this task: multi-file artifacts, durable artifact persistence, or a dedicated explicit export/apply UX.

## Finalize When Complete

- Archive under `docs/finished/A008-0091_session-code-artifact.md`.
- Restore `docs/CURRENT_TASK.md` from template.
- Write `docs/handoffs/A008-0091.md` and append signed journal entry.
