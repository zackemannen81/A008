# Task A008-0035 — GUI composer and slash commands

Status: Ready
Owner: A008-worker04
Parent: A008-0030
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

## Gates

- Slash parser tests
- Restore CURRENT_TASK template, handoff, PR, do not merge
