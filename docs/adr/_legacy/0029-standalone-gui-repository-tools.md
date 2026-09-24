# ADR 0029 — Standalone GUI repository tools

Status: Accepted
Date: 2026-09-07
Task: A008-0068
Amends: ADR 0022, ADR 0028

## Decision

The owner selects A008's standalone GUI for local repository work. It is a
supported surface for the shared model tool loop, independently of the external
client. No second executor or provider adapter is introduced.

Native file tools offer directory listing, UTF-8 reads, exclusive file creation
and revision-guarded exact edits. Git is a native tool invoking the installed
executable with literal arguments. All tools retain the existing per-call
permission boundary, cancellation, byte limits and ephemeral observations.

Session snapshots add optional `runtime.tools` metadata for the native catalog.
Older clients can ignore it; older hosts are shown as lacking catalog metadata.
`A008_GUI_WORKSPACE` selects an existing absolute cwd at standalone host startup;
it does not silently alter memory ownership or saved global instructions.

## Consequences

The GUI can perform real coding work without an external frontend or copied
coding prompt. Existing MCP/engine integration remains compatible. Git requires
the host executable. File helper checks and optimistic revision matching do not
constitute a process sandbox or a cross-process file lock. A plugin marketplace,
GUI MCP server manager and IDE-style manual editor remain outside this slice.
