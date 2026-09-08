# Repository work in the A008 GUI

The standalone A008 GUI supports model tools directly. Felix's client is not
required. The existing shared tool loop remains the executor for CLI, ACP,
engine panels and standalone GUI.

## Run

From the A008 checkout in PowerShell:

```powershell
Set-Location C:\code\A008
npm run gui
```

Stop an older GUI host with Ctrl+C in its terminal first. The command rebuilds
the runtime and GUI and reads the existing `.env.local`. Open
`http://127.0.0.1:8787`, click Connect and choose Tools → Repository. The active
working directory and available native tools come from the connected runtime.

Click **Read AGENTS.md & list root**, or type your request into Chat. Each
structured tool call opens an approval dialog in this GUI. Check its arguments
and choose Reject, Allow once, or Allow all. Allow all approves the current request
and later tool requests automatically for this connected GUI session only; a
reconnect resets that choice. Actual observations return to the model and appear
under Tool activity. Tool-shaped prose never executes. The shortcut
buttons send ordinary user requests; they do not install a system prompt.

## Files, commands and Git

| Tool | Behavior |
| --- | --- |
| `exec_command` | Host shell commands and tests in cwd; Windows PowerShell without profiles on Windows. Can also move/delete files when approved. |
| `list_files` | One directory, including hidden entries; `offset`/`limit` pagination. |
| `read_file` | UTF-8 content and SHA-256 revision. Large files fail explicitly; use targeted shell reads or increase Tool result budget. |
| `create_file` | New UTF-8 file and parent directories. Existing files are not overwritten. |
| `edit_file` | Requires the SHA-256 from `read_file` and exactly one match of `old_text`; preserves other content. A stale or ambiguous edit fails before writing. |
| `git` | Literal argument array passed to the host's Git executable, without a shell. Supports status/diff, branches, staging, commits and other installed Git subcommands. Every call requires approval. |

Git needs to be installed on the host PATH, but requires no additional MCP
server. The existing client-supplied stdio MCP integration remains available;
this change does not add a general GUI plugin installer or server manager.
Commands and Git run with host access, not a filesystem sandbox. Native file
helpers refuse paths outside the workspace, symbolic links and direct `.git`
access. Concurrent host programs are not locked out: revision checking is an
optimistic check, not a cross-process filesystem transaction.

Tool definitions and observations count toward Chat input budget. Tool result
budget, tool count and timeout remain editable under Parameters → Budgets.
Truncated observations are marked. Committed history and semantic-memory intake
continue to receive the original user message and final answer, not intermediate
file contents or reasoning. Persistent instructions remain user-owned under
Parameters → Instructions; no coding prompt is automatically loaded.

The saved Codex example mentions `apply_patch` and `update_plan`. These names
are not exposed by A008. Adapt such tool-specific instructions in the editable
Instructions field to the actual catalog (file edits use `edit_file`); this is
not a drop-in implementation of Codex's tool API. The example file is unchanged.

## A different working directory

Set the workspace before starting the host:

```powershell
Set-Location C:\code\A008
$env:A008_GUI_WORKSPACE = 'C:\code\my-project'
npm run gui
```

The path must be an existing absolute directory. It selects the cwd shared by
the model's file/shell/Git tools and the manual terminal. Changing the host
workspace requires a restart. To return to the checkout cwd:

```powershell
Remove-Item Env:A008_GUI_WORKSPACE -ErrorAction SilentlyContinue
```

This setting selects the working directory only. Standalone memory still uses
the configured `A008_MEMORY_SQLITE_PATH`, `A008_SOURCE_STORE_PATH` and project
identity; it is not automatically switched or copied. Set distinct memory/source
paths when separate standalone projects should have separate knowledge. Engine
mode retains its automatic project isolation described in [ENGINE.md](ENGINE.md).

## Source reference

[OpenAI Codex apply-patch](https://github.com/openai/codex/tree/main/codex-rs/apply-patch)
and its [license](https://github.com/openai/codex/blob/main/LICENSE) were inspected
as reference. No source was imported, no Rust runtime was added, and no Codex
prompt was adopted. These small tools extend A008's existing TypeScript executor.

Verification is recorded in [A008-0068 evidence](evidence/A008-0068_gui-repository-tools.md).
