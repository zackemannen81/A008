# A008 Engine

A008 runs as a local ACP engine with its existing Chat, Memory, Tools and
Parameters views. The external client hosts the panel. All panel operations
use the same project runtime and session as external chat (ADR 0028).

## Build and run

From the source checkout, run `npm ci`, `npm --prefix gui ci`, `npm run build`
and `npm --prefix gui run build`. Then:

```powershell
npm run package:engine -- C:\A008-packages\a008-engine
```

The output directory must be new and outside the repository. The package
contains compiled runtime, compiled GUI, discovery manifest, the installed
production dependency closure including native SQLite, a matching Node binary,
its upstream license and a dependency/build inventory. The packager downloads
only the matching Node license. Build on the target OS/architecture; native
modules are tested with the bundled Node version. Do not replace that executable
without rebuilding/verifying native dependencies.

Configure provider credentials in the environment of the process that launches
the client. The engine inherits `NVIDIA_API_KEY` and optional reviewed provider
configuration. Credentials are never included in the package, browser frame,
tool arguments or saved global instructions. The engine does not load the source
checkout's `.env.local` when launched through the manifest.

In the companion client build with engine panel support, discover the extracted
folder through `A007_BRAIN_ROOTS` or select its manifest-backed engine. Connect
A008, select a local project and start a chat session. Open its A008 panel under
Brains. The panel connects automatically to that exact session. Closing the
panel keeps the chat session alive; the explicit session Close action ends it.
Stopping the engine closes its panels and cancels pending work.

The entry can also be launched manually for an ACP client:

```powershell
& C:\A008-packages\a008-engine\runtime\node.exe C:\A008-packages\a008-engine\dist\src\engine\server.js
```

Stdin/stdout carry ACP JSON only. This command waits for an ACP client; it is
not an interactive terminal. The same package retains `dist/src/cli.js` and
`dist/src/gui-host/server.js` for standalone CLI/GUI operation.

## Data and instructions

Global settings remain in `~/.a008/settings.json`, or `A008_SETTINGS_PATH`.
Version 1 settings are read and retain all values; the next explicit save writes
version 2 with additional editable tool limits. User instructions are sent with
each chat turn and survive reset, model changes and engine restart. The optional
`docs/prompts/coding/codex.md` is neither bundled nor auto-loaded.

Engine memory and uploaded sources are outside the package, under
`~/.a008/engine/projects/<hash-of-canonical-workspace>/`, or `A008_ENGINE_DATA_PATH`.
The session's actual absolute `cwd` selects its project. Existing standalone
memory is not deleted or silently copied. See the legacy attachment option below
when deliberately reusing an existing store. Conversation turns and model
parameters are session state; durable knowledge and global settings survive a
process restart. A new process starts new conversations.

The engine uses `ProjectRuntimeRegistry` to share one runtime per canonical
workspace. A supplied registry is borrowed: closing an EngineHost closes only
its sessions, while the caller disposes the registry after all borrowers stop.
The registry also offers strict `attachExisting` for validated absolute SQLite
and optional source paths plus an existing project namespace; it does not create
a missing store. Same-process competing workspace/namespace owners are rejected.
This API is internal composition, not a new public endpoint. Registry-backed
engines also hold a cross-process SQLite namespace lease. Separate small
`.a008-owner-<hash>.sqlite` files beside the store/identity sidecar carry OS locks,
not knowledge. Do not delete these files while an owner runs. Normal close or
process death releases locks automatically; persistent empty files are harmless.
CLI/direct ACP runtime factories and the standalone host also honor these leases
as of A008-0109. Separate processes cannot share one namespace concurrently;
multiple in-process clients share it through an injected ProjectRuntimeRegistry.
`openConfigured` preserves v1/CLI lazy initialization of explicitly configured
stores, including memory-off mode. `attachExisting` remains the strict no-create
path for existing-data attachment. No automatic storage migration is performed.
The companion client's file/editor/Git functions remain its own surfaces.
MCP support currently covers approved stdio servers, not HTTP/SSE servers.

To deliberately attach an existing standalone store to one workspace, set
`A008_ENGINE_LEGACY_CWD` to that absolute workspace and set both
`A008_MEMORY_SQLITE_PATH` and `A008_SOURCE_STORE_PATH` to the existing locations.
Only that workspace uses the attachment; all others keep isolated engine stores.
Stop the standalone process before attaching. This reuses data in place; it does
not copy, delete or convert the owner's knowledge.

## Tools and permissions

A008-0110 standalone mode also exposes V2 discovery and ticket issuance, with
owner-local device credentials. See [CLIENT_AUTH.md](CLIENT_AUTH.md). V2 chat
and WebSocket commands are not available yet; engine panels remain on v1.

The engine offers `exec_command` and tools from approved stdio MCP server
descriptors supplied by the client at `session/new`. Windows commands use
PowerShell without profiles; Unix uses the platform shell. Native file/editor
features in the surrounding client remain separate. A coding prompt may refer
to tool names from another application: only the offered definitions exist.

Each actual tool call requires Allow once or Reject in the client (or the
standalone GUI/CLI). Instructions and retrieved content do not grant execution
permission. A request from a client without a permission handler is denied.
Tool calls, results and failure status are visible. Results return to the model;
only the original user question and final answer enter post-output memory.
Execution timeout, result byte limit, calls per turn and catalog size are editable
under Parameters → Budgets. Input budget includes tool definitions and results.

Commands run with host filesystem access in the displayed working directory.
This is not a filesystem sandbox. Shell children receive basic OS environment
variables; provider credentials and process injection options are omitted.
Approved MCP servers receive their explicit private environment from the client's
policy. Cancelling pending approval executes nothing; cancelling running work
stops local shell processes and reports no confirmed success. Actions already
performed cannot be rolled back by cancellation. A remote side effect performed
by an MCP server may already have happened when cancellation arrives.

## Panel protocol

Initialize advertises `agentCapabilities._meta["engine.panels"] = 1`.
`session/new` returns `_meta["engine.panels"]` entries containing `id`, `title`,
`sessionId` and a loopback URL. This is a versioned extension, not a standard
ACP panel feature. The native client validates the session, URL and descriptor.
The URL fragment contains a fresh session capability. The panel sends it in
same-origin HTTP authorization and WebSocket connection authentication. It is
not persisted. Only local, session-bound API access is accepted.

The native client renders the frame without Node integration or provider keys.
It owns permission dialogs through standard ACP `session/request_permission`.
The panel shares history, model configuration, memory, global preferences,
uploads and streamed activity with external chat.

`memory/capabilities` is available before a session, with `projectId: null` and
`projectSelection: "session-or-absolute-cwd"`. Recall/write select a project using
`sessionId`, an absolute `cwd`, a known canonical A008 project ID, or the client's
existing `local:<absolute-workspace>` ID. Omitting context is allowed only when
exactly one project runtime exists; ambiguous requests fail visibly.
Explicit close emits `session_info_update._meta["engine.closed"] = true` so
the client removes a stale panel. Model changes emit `config_option_update`.

## Verification and integration handoff

From a built A008 source checkout, validate an extracted bundle against the
companion client checkout without provider charges:

```powershell
node scripts/verify-engine-package.mjs C:\A008-packages\extracted C:\code\felix-a007\a007-frontend
```

This uses the real discovery/process host, actual package executable and actual
shell execution in a temporary workspace with a loopback synthetic provider.
It does not establish an installed Electron product or live-provider gate.
The companion client changes must be included in the client build; an unchanged
older client does not gain panel support by discovering this package alone.
