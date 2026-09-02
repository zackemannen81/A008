# Task A008-0035 — GUI composer and slash commands

Status: Complete
Owner: A008-worker04
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Branch: `grok/A008-0035-gui-composer`
Clone: `C:\code\A008-workers\A008-worker04`

## Write scope

- `gui/src/composer/**` only
- `docs/handoffs/A008-0035.md`
- `docs/finished/A008-0035_gui-composer.md`

## Goal

Composer with the A008-0029 slash set. `/help` `/exit` `/quit` `/reset`
`/clear` `/undo` `/history` `/model` `/status` `/cwd` `/tools` `/shell` `/!`
are handled in the GUI and not sent as model prompts except `/shell` which
must call the terminal module API (`runShellCommand` from `gui/src/terminal`
or a session method if the stub exposes `session.shell`). Keep `Composer`
export.

Unknown `/foo` is an error in the composer, not a prompt.

## Outcome

`gui/src/composer/` now owns a slash parser, a submit dispatcher, and the
`Composer` input. Plain text calls `session.prompt`. Known slash commands
never call `session.prompt`. Unknown `/foo` returns
`Unknown command: /foo. Type /help.` `/shell` and `/!` call `session.shell`
when present, otherwise `runShellCommand` imported from
`gui/src/terminal/terminal-pane.js`.

The session stub has no reset/undo/history mutation API. Those commands are
still intercepted and shown as composer notices.

## Verification

- `npm --prefix gui run typecheck` exit 0
- `npm --prefix gui run build` exit 0
- `node --experimental-strip-types --import ./gui/src/composer/test-loader.mjs --test ./gui/src/composer/slash.test.ts` 11/11 pass
- `git diff --check` pass

## Gates

- [x] Slash parser tests
- [x] Restore CURRENT_TASK template, handoff, PR, do not merge
