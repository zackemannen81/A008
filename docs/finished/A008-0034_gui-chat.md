# Task A008-0034 — GUI chat transcript

Status: Complete
Owner: A008-worker03
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Charter frozen at: Ready (`docs/tasks/A008-0034_gui-chat.md`)
Branch: `grok/A008-0034-gui-chat`
Clone: `C:\code\A008-workers\A008-worker03`

## Write scope

- `gui/src/chat/**` only
- `docs/handoffs/A008-0034.md`
- `docs/finished/A008-0034_gui-chat.md`

## Goal

A008 chat transcript: user messages, assistant answer, streaming thought as a
separate channel (display-only). Consume `useGuiSession` props from the stub
contract. Canvas-like UX, A008 copy. No OpenHands components.

## Primary Deliverable

`ChatPane` (export kept) renders an A008 transcript whose DOM contract keeps
thought off the committed answer channel.

## In Scope

- `gui/src/chat/**` only
- Handoff and this archive

## Out of Scope

- Other `gui/src/*` directories, `gui/src/app.tsx`, `src/gui-host/`
- OpenHands components or `@openhands/*` imports
- Credentials, live NVIDIA, merge to `main`
- Filling `docs/CURRENT_TASK.md` in the pull request
- `docs/JOURNAL.md` (operator on merge)
- `docs/CURRENT_STATUS.md` / `docs/SYSTEMDOC.md` (operator; overlapping write)

## Definition of Done

ChatPane renders user, answer, and thought as separate channels. Thought is
never mixed into committed answer text in the DOM contract. Archive, restore
CURRENT_TASK template, handoff, PR, do not merge.

## Minimum Verification Gates

- [x] Thought never mixed into committed answer text in the DOM contract
- [x] Restore CURRENT_TASK template, handoff, PR, do not merge

## What landed

- `buildChatTranscript` maps `GuiSession.thought` and `GuiSession.answer` onto
  separate turn fields. Thought is never concatenated into answer text.
- `ChatPane` renders those fields into `data-a008-channel="user|thought|answer"`
  nodes. Thought is a collapsible display-only block; answer is a distinct
  bubble labeled A008.
- User text is observed by wrapping `session.prompt` on the shared session
  object (Composer calls the same method). An optional structural `messages`
  array is also accepted if the session client later adds one without renaming
  stub exports.
- Canvas-like layout (scrollable transcript, user right / assistant left,
  collapsible thought) with A008 copy. No OpenHands components.

## Decisions and Notes

- `GuiSession` stub has current thought/answer buffers, not a messages array.
  Required by the frozen goal, so ChatPane records user turns locally.
- Thought remains display-only (ADR 0009). Committed assistant history stores
  thought on a separate field and still renders it only in the thought node.

## Charter Amendment Log

- none

## Verification

Working directory: `C:\code\A008-workers\A008-worker03`
Date: 2026-09-02

### GUI typecheck — pass

```text
Set-Location gui; npm run typecheck
```

Exit 0.

### DOM-contract unit tests — 13/13 pass

```text
Set-Location gui
npx tsc -p tsconfig.json --noEmit false --outDir tmp-chat-test --rootDir src
node --test tmp-chat-test/chat/chat-transcript.test.js tmp-chat-test/chat/capture-prompt.test.js
Remove-Item -Recurse -Force tmp-chat-test
```

```text
ℹ tests 13
ℹ pass 13
ℹ fail 0
```

Named checks include: thought token absent from the answer channel; thought-only
and answer-only turns; overlay does not concatenate thought into answer;
streaming extends the same turn; a new live turn does not rewrite a completed
answer; user history stays off the answer channel; optional `messages`;
`suppressLive`; error text stays off thought/answer channels; prompt capture
records user text and restores the original `prompt`.

### GUI production build — pass

```text
Set-Location gui; npm run build
```

Exit 0. Vite built `gui/dist` (ignored).

### `git diff --check` — pass

No whitespace errors.

### No OpenHands / credentials

`gui/src/chat/**` contains no OpenHands imports, no `NVIDIA_API_KEY`, and no
authorization headers.

## Skipped gates and reasons

- Root `npm test` (210 core cases) was not re-run. Write scope is
  `gui/src/chat/**`; no `src/` or `test/` product files changed.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, and `docs/JOURNAL.md` were not
  edited. They are outside this worker's write scope; the operator updates them
  on merge.
- Live NVIDIA, GUI host E2E, and merge to `main` remain out of scope.

## Handoff and Follow-ups

- Current state: ChatPane implemented; template restored.
- Next recommended step: operator review and merge of the pull request.
- Blockers: none
- Child tasks: none
- Resume condition: n/a
- Open questions: A008-0033 may add a `messages` array without renaming stub
  exports; ChatPane already consumes that structural extension.

## Finalize When Complete

- Archived under `docs/finished/A008-0034_gui-chat.md`.
- `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`.
- Operator appends the signed `docs/JOURNAL.md` entry on merge.
