# A008 GUI

The engine package also serves these existing views inside the external client's
A008 panel. Its URL carries an ephemeral session capability and connects to the
same chat automatically. Closing the panel detaches it; End session closes the
shared conversation. Model tool requests appear as activity, with execution
approval in the surrounding client (or an A008 dialog when running standalone).
See [engine integration](../docs/ENGINE.md) and [global settings](../docs/RUNTIME_SETTINGS.md).

This is the A008-owned product GUI/host client (ADR 0019, 0029 and 0030), not
OpenHands Agent Canvas. The same built assets may also be served as bounded
engine panels; Agent Canvas remains a separate ACP compatibility/operator path.

Dev: start `gui-host` on port 8787, then `npm run dev` in this directory.
Vite proxies `/health` and `/v1` to the host.

Do not put `NVIDIA_API_KEY` in this package.

## Session commands and parameters

Use **Connect**, then **Session commands** or type the CLI commands in Message:
`/help`, `/exit` (`/quit`, `/q`), `/reset` (`/clear`), `/undo`, `/history`,
`/model`, `/model <id>`, `/status`, `/cwd`, `/tools`, `/shell <command>` and
`/! <command>`. History comes from the runtime and excludes system/reasoning
text. Reset and undo preserve saved memory. Model changes start a conversation;
exit releases the session and leaves the page open. **Stop** cancels a turn.

Open **Parameters** in the header to select a model and apply stream, sampling,
reasoning and token settings. Unsupported options are explained or omitted.
Temperature off omits the field (provider default); zero explicitly requests
zero. The total token budget covers generated reasoning + answer per chat call,
not input tokens or memory processing. Seed/stop appear where supported.
**Apply parameters** changes subsequent chat requests in this session;
**Model defaults** loads the profile values for review before applying them.
Settings and chat history are not persisted across reconnects.

Chat, Memory and **Tools** remain accessible on a narrow screen; Tools contains
Terminal and Upload. The parameter dialog supports Tab/Escape and restores focus.
Restart the host after building so the ACP process registers the new controls.
See [the session proof](../docs/evidence/A008-0065_session-controls-proof.md).

## Memory diagnostics

Open **Memory** in the workspace header for **Overview**, **Relationship map**
and **Knowledge manager**. These are read-only views of the running ACP process's
project memory, with search, filters, record details and explicit graph limits.
Use **Refresh** after a chat turn or upload to inspect newly stored data.
No model call is needed to inspect memory. The normal host/ACP configuration is
still required; restart the host after building to register `memory/inspect`.
No sample memory ships in the renderer. See
[the host contract](../docs/HOST_PROTOCOL.md) and
[verification evidence](../docs/evidence/A008-0064_memory-gui-proof.md).
