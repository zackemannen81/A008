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

- `chat-transcript.ts` — `buildChatTranscript` maps `GuiSession.thought` and
  `GuiSession.answer` onto separate turn fields. Thought is never concatenated
  into answer text. `emptyStateCopy` keeps a `default` arm so a widened
  `GuiSession["status"]` from A008-0033 cannot break the GUI build.
- `chat-history.ts` — pure reducer that owns committed turns. A user prompt
  commits the in-flight assistant turn; a stream that returns to empty buffers
  commits exactly once; stale buffers are suppressed until the session moves on.
- `chat-pane.tsx` — renders those fields into
  `data-a008-channel="user|thought|answer"` nodes. Thought is a collapsible
  display-only block; answer is a distinct bubble labeled A008.
- `capture-prompt.ts` — user text is observed by wrapping `session.prompt` on
  the shared session object (the composer calls the same method) and restoring
  it on unmount. An optional structural `messages` array is also accepted if
  the session client later adds one without renaming stub exports.
- `chat-pane.css` — Canvas-like layout (scrollable transcript, user right /
  assistant left, collapsible thought) reading `gui/src/brand/a008.css` tokens
  with local fallbacks. No OpenHands components.
- `test-loader.mjs` / `test-resolve.mjs` — extend the `gui/src/composer` Node
  test pattern so a test can import the React component itself (`.js` → `.tsx`,
  esbuild for JSX, CSS side-effect import stubbed).

## Decisions and Notes

- `GuiSession` stub has current thought/answer buffers, not a messages array.
  Required by the frozen goal, so ChatPane records user turns locally.
- Thought remains display-only (ADR 0009). Committed assistant history stores
  thought on a separate field and still renders it only in the thought node.
- ChatPane reads only the existing `GuiSession` members. `gui/src/session/` is
  not edited; the optional `messages` path is duck-typed.

## Charter Amendment Log

- none

## Verification

Working directory: `C:\code\A008-workers\A008-worker03`
Base: `origin/main` (`43d5e3e`)
Date: 2026-09-02

### GUI typecheck — pass

```text
npm --prefix gui run typecheck
```

Exit 0.

### Chat tests — 29/29 pass

```text
node --experimental-strip-types --import ./gui/src/chat/test-loader.mjs --test \
  ./gui/src/chat/chat-transcript.test.ts ./gui/src/chat/capture-prompt.test.ts \
  ./gui/src/chat/chat-history.test.ts ./gui/src/chat/chat-pane.dom.test.ts
```

```text
ℹ tests 29
ℹ pass 29
ℹ fail 0
```

`chat-pane.dom.test.ts` renders `ChatPane` with `react-dom/server` and asserts
on the emitted markup: the `answer` channel text equals the answer exactly, and
the thought token occurs in the whole document exactly once, inside the
`thought` channel node.

### DOM gate mutation check — the gate fails when it should

Concatenating thought into the answer node
(`{turn.thought}{turn.answer}`) was injected on purpose:

```text
ℹ tests 7
ℹ pass 5
ℹ fail 2
```

The mutation was reverted. The model-only tests alone did not catch it, which is
why the rendered-DOM test exists.

### Root typecheck and core suite — pass

```text
npm run typecheck   # exit 0
npm test            # ℹ tests 218 / ℹ pass 218 / ℹ fail 0
```

### GUI production build — pass

```text
npm --prefix gui run build
```

Exit 0. Vite built `gui/dist` (ignored).

### `git diff --check` — pass

No whitespace errors.

### No OpenHands / credentials

`gui/src/chat/**` contains no OpenHands imports, no `NVIDIA_API_KEY`, and no
authorization headers. A rendered-markup test asserts the DOM carries no
OpenHands, Agent Server, or PostHog identity.

## Skipped gates and reasons

- No browser or DOM-event test. The repository has no jsdom or browser test
  runner, and adding one is outside `gui/src/chat/**`. Rendering is covered by
  `react-dom/server`; interaction over time is covered by the pure reducer.
- No `test` script was added to `gui/package.json`; that file is outside this
  worker's write scope. The chat command above is the runner, as in A008-0035.
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
  exports; ChatPane already consumes that structural extension and should then
  stop depending on the `session.prompt` wrapper.

## Finalize When Complete

- Archived under `docs/finished/A008-0034_gui-chat.md`.
- `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`.
- Operator appends the signed `docs/JOURNAL.md` entry on merge.
