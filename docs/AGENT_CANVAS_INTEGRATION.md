# Agent Canvas integration

Status: ACP bridge and local Canvas runtime path verified on Windows.

## Boundary

```text
Agent Canvas
  -> OpenHands Agent Server
     -> custom stdio command: a007-acp
        -> createLocalMemoryRuntime
           -> one NVIDIA ChatTransport
           -> MemoryAwareChatSession + post-output coordinator
           -> NvidiaChatTransport
              -> NVIDIA chat-completions endpoint
```

Canvas and Agent Server remain external components. Agent Server owns the a007
subprocess; a007 owns chat state and the only provider call. No browser code
receives `NVIDIA_API_KEY`.

## Prepare a007

From the canonical repository:

```powershell
Set-Location C:\code\a007
npm ci
npm run build
```

The executable command for a local Agent Server is shown with forward slashes
because the observed Canvas shell parser removes Windows backslashes:

```text
node C:/code/a007/dist/src/acp/server.js
```

`npm run acp` is useful for direct protocol development, but Agent Server should
launch the compiled command above so it does not rebuild for every conversation.

## Configure Agent Canvas

In Settings -> Agent:

1. Select `ACP` as the agent.
2. Select `Custom` as the preset.
3. Enter `node C:/code/a007/dist/src/acp/server.js` as the command.
4. Enter `nvidia/nemotron-3.5-lightning-30b-a3b` as the custom model.

Add `NVIDIA_API_KEY` through the Agent Server-backed Secrets screen. Agent
Canvas documents that global secrets are exported into the ACP subprocess. Do
not place the key in the command, Canvas source, repository, or shell history.

The optional `NVIDIA_CHAT_COMPLETIONS_URL` environment variable is intended for
an operator-controlled proxy or local fake endpoint. It is not a user-supplied
chat value and must not point at an untrusted service.

Optional memory and diagnostics for the ACP subprocess, also supplied through
Agent Server secrets or the launching environment:

- `A007_PROJECT_ID` — stable project runtime ID. Generated and persisted beside
  the SQLite file when omitted.
- `A007_MEMORY_SQLITE_PATH` — absolute SQLite path outside the repository.
  Defaults to `~/.a007/memory.sqlite`.
- `A007_DEBUG_TRACE=off|safe|raw` — off by default. Raw writes local prompts
  and answers.
- `A007_DEBUG_TRACE_FILE` — required absolute JSONL path whenever ACP tracing
  is enabled. ACP stdout remains protocol-only.

Reset local memory by deleting the SQLite file and `a007-project-id` sidecar.
See `docs/LOCAL_MEMORY_SURFACES.md` and `docs/DEBUG_TRACE.md`. The loopback
fake NVIDIA fixture now answers non-streaming semantic JSON with `[]` so a
Canvas chat turn can complete without writing memory.

## Prepare the external Canvas runtime

The verified external source boundary is the clean clone at
`C:\code\OpenHands`, revision
`744e8652f254613045b779eb148bf4f741177975`. From that clone:

```powershell
npm ci
npm run build
```

Install `uv`/`uvx` from Astral's official distribution and put its executable
directory on the launching shell's `PATH`. The normal source command is:

```powershell
npm run dev:minimal
```

This command starts Agent Server plus Vite and intentionally omits automation.
Set `VITE_DO_NOT_TRACK=1`, use a task-specific `OH_CANVAS_SAFE_STATE_DIR`, set
`VITE_WORKING_DIR` to the intended workspace, and keep session/secret keys in
that isolated state. Do not let the command read an unrelated OpenHands `.env`.

### Observed Windows startup limitation

On the A007-0005 host, the pinned Agent Server needed about 42 seconds to become
ready while `dev:minimal` allowed only 30 seconds, including after its `uvx`
environment was warm. The bounded fallback was to run the exact command emitted
by `scripts/dev-safe.mjs` in one shell:

```powershell
uvx --from "openhands-agent-server==1.44.1" `
  --with "openhands-sdk==1.44.1" `
  --with "openhands-tools==1.44.1" `
  --with "openhands-workspace==1.44.1" `
  --with "agent-client-protocol<0.11" `
  --with "posthog>=6,<7" `
  agent-server --import-modules canvas_ui_tool `
  --host 127.0.0.1 --port 18115
```

The shell must first set the same values that `buildAgentServerEnv` normally
constructs: `PYTHONUTF8`, isolated `OH_PERSISTENCE_DIR`,
`OH_CONVERSATIONS_PATH`, `OH_BASH_EVENTS_DIR`, `OH_SECRET_KEY`,
`OH_SESSION_API_KEYS_0`, `AGENT_SERVER_URL`, `OH_EXTRA_PYTHON_PATH`, and
`DO_NOT_TRACK=1`. Provider values must come from the reviewed secret boundary;
the A007-0005 proof instead supplied a fixed test key and loopback URL.

In a second shell, start the matching Vite surface:

```powershell
$env:VITE_BACKEND_HOST = "127.0.0.1:18115"
$env:VITE_BACKEND_BASE_URL = "http://127.0.0.1:18115"
$env:VITE_SESSION_API_KEY = "<same local session key>"
$env:VITE_WORKING_DIR = "C:/code/a007"
$env:VITE_DO_NOT_TRACK = "1"
npm run dev:frontend
```

This fallback is development evidence, not a maintained a007 launcher. Stop
both shells after use and verify their ports are free.

## Implemented protocol surface

- ACP stable protocol version 1 on newline-delimited JSON stdio.
- Initialize and new in-memory session.
- One model select option backed by the a007 registry.
- Text prompts and non-fetched resource links.
- Streamed reasoning as `agent_thought_chunk` and answer text as
  `agent_message_chunk`.
- Per-session cancellation with failed-turn rollback.

Not implemented: tools, permissions, files, MCP, images, audio, embedded
resources, authentication methods, load/resume, persistence, runtime model
switching, memory, or durable identity mapping. New ACP sessions now use the
canonical a007 runtime-ID format, but no Agent Server conversation binding is
available through the current request.

## Current evidence

The official ACP client still provides the compiled-process contract evidence.
A007-0005 additionally installed and built the pinned Canvas clone, started real
Canvas and Agent Server processes, configured the Custom ACP command through the
UI, and visibly rendered `A007-CANVAS-LOOPBACK-OK`. The loopback fixture observed
the exact prompt and verified model; Agent Server ended the conversation as
`finished`. The safe screenshot and limitations are in
[`evidence/A007-0005_agent-canvas-runtime-proof.md`](evidence/A007-0005_agent-canvas-runtime-proof.md).

No real NVIDIA credential, live model inference, paid usage, tool, memory,
automation backend, desktop package, publication, or release participated.
OpenHands did attempt optional OpenAI device-auth/status and title-generation
paths without credentials, so this is not a zero-external-control-plane-egress
claim.
