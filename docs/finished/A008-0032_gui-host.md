# Task A008-0032 — GUI host ACP WebSocket bridge

Status: Complete
Owner: A008-worker01
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Branch: `grok/A008-0032-gui-host`
Base: `origin/main` (`43d5e3e`)
Clone: `C:\code\A008-workers\A008-worker01`

## Write scope

- `src/gui-host/**`
- `test/gui-host.test.ts` and `test/gui-host/**`
- `package.json` — `gui-host` script, and appending the new test file to `test`
- `docs/handoffs/A008-0032.md`
- `docs/finished/A008-0032_gui-host.md`
- `docs/CURRENT_TASK.md` only to restore the template before push

## Goal

Node GUI host implementing ADR 0019 D3–D4: `/health`, `/v1/models`,
`POST /v1/shell` (reusing `src/tools/terminal.ts`), and WebSocket
`/v1/session` bridged to `A008-acp` stdio. Credentials stay in process
environment and never reach the renderer.

## Primary Deliverable

`src/gui-host/` — `server.ts` (HTTP + upgrade + static), `acp-bridge.ts`
(spawned `A008-acp` stdio client), `protocol.ts` (host protocol v1 frames),
`websocket.ts` (RFC 6455 server framing), `origin.ts` (browser-origin guard),
`redact.ts` (wire redaction).

## Outcome

### Host protocol v1 (ADR 0019 D4), exact frames

- `GET /health` → `{ "ok": true, "name": "A008-gui-host" }`
- `GET /v1/models` → `{ "models": [{ "id", "name" }] }` from
  `defaultModelRegistry`; no provider profile internals are exposed.
- `POST /v1/shell` `{ command }` →
  `{ stdout, stderr, exitCode, timedOut, truncated }`, produced by the existing
  `runTerminalCommand` from `src/tools/terminal.ts` running in the GUI host
  process cwd. The host does not reimplement command execution.
- `WS /v1/session` with the D4 frame set and nothing else:
  client `session/new` / `prompt` / `cancel`; server `session/new/ok` /
  `thought` / `answer` / `prompt/ok` / `error`.

`thought` is fed by ACP `agent_thought_chunk` and `answer` by
`agent_message_chunk`, so the GUI thought stream is the ACP thought stream.
No Agent Server REST/WebSocket schema and no OpenHands TypeScript client are
used. The WebSocket server is hand-written framing over `node:http` upgrade;
no new dependency was added.

### ACP ownership (D3)

`createSpawnedAcpBridge` spawns `dist/src/acp/server.js` — the existing
`A008-acp` stdio server — with the host's environment and cwd, runs the ACP
`initialize` handshake, and multiplexes sessions. `src/acp/` was not modified.
One subprocess is shared by all connected renderers; each WebSocket owns only
the session ids it created, so one renderer cannot prompt or cancel another's
session. Closing the host closes the ACP subprocess and every open socket.

### Credentials (D3, D6)

- `NVIDIA_API_KEY` and memory settings are read from `process.env` only, are
  passed to the ACP subprocess, and are never placed in a frame or an HTTP
  body.
- Every server WebSocket frame and every JSON HTTP body is written through
  `redactWireText`, which removes the configured secret value and the literal
  tokens `NVIDIA_API_KEY` and `authorization`.
- The renderer receives no authorization header and no `.env.local` content.

### Browser-origin guard

`POST /v1/shell` runs a real command in the host process cwd, so a page on
another origin must not reach it. Every HTTP route and the `/v1/session`
upgrade refuse a request whose `Origin` header is present and neither
same-origin nor loopback (403). `POST /v1/shell` also requires an
`application/json` content type (415 otherwise), which a cross-origin HTML
form cannot set, so a simple-request CSRF cannot reach the shell. Non-browser
clients that send no `Origin` (curl, Node `fetch`) are unaffected, and the
Vite dev proxy on `localhost:5173` is a loopback origin and is allowed.

### Failure text

The ACP SDK reduces an unhandled agent error to a generic JSON-RPC
`Internal error` and moves the real reason into `data.details`. The bridge
recovers that text, and falls back to the ACP subprocess stderr tail when the
subprocess refuses to start, so a misconfigured host reports
`ACP connection closed: A008-acp failed: [redacted] is required for NVIDIA
chat.` instead of a bare `ACP connection closed`. HTTP failure bodies carry
both `error` and `message`; `message` is the field the merged A008-0036 GUI
shell client reads.

### Static GUI

`gui/dist` is served when it exists (explicit `staticDir`, then
`A008_GUI_STATIC_DIR`, then `<cwd>/gui/dist`, then the package-relative
`gui/dist`). Path traversal outside the root is refused. `gui/` was not edited.

## Gates

- [x] Fake ACP and injected agent cover `session/new`, a prompt that streams
      `thought` then `answer`, `cancel`, and the error path — over both an
      injected in-process bridge and the spawned stdio ACP transport
- [x] No WebSocket frame and no HTTP body contains `NVIDIA_API_KEY` or an
      authorization header
- [x] `npm run typecheck` — exit 0
- [x] `npm test` — 234 passed, 0 failed (218 before this task, 16 added)
- [x] Archive, restore the CURRENT_TASK template, handoff, PR, do not merge

## Out of scope (honored)

- `gui/`, `src/acp/` internals, `src/memory/`, `src/tools/terminal.ts`
- `docs/JOURNAL.md` (operator appends on merge)
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`
- Live NVIDIA or any paid provider call
- Desktop packaging, MIT file imports from the pinned OpenHands revision
- Merge to `main`

## Verification

Working directory: `C:\code\A008-workers\A008-worker01`
Date: 2026-09-02

### `npm run typecheck` — pass

```text
> A008@0.0.0 typecheck
> tsc -p tsconfig.json --noEmit
```

Exit 0, no diagnostics.

### `npm test` (whole suite) — pass

```text
ℹ tests 234
ℹ suites 0
ℹ pass 234
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7188.0877
```

Baseline on `main` was 218. The 16 new tests are the whole delta.

### `node --test dist/test/gui-host.test.js` — pass

```text
✔ parseClientMessage accepts host protocol v1 client frames (3.0455ms)
✔ redactWireText removes credential names and values (0.6644ms)
✔ isAllowedOrigin admits loopback and same-origin browsers only (0.6581ms)
✔ GET /health and /v1/models do not require a credential (78.6213ms)
✔ POST /v1/shell reuses the injected terminal runner in host cwd (21.3468ms)
✔ POST /v1/shell runs a local node process through runTerminalCommand (157.231ms)
✔ POST /v1/shell refuses cross-origin and non-JSON callers (11.1936ms)
✔ HTTP failures carry the message field the GUI shell client reads (9.7965ms)
✔ WebSocket upgrade refuses a cross-origin page (16.718ms)
✔ WebSocket session streams thought and answer then prompt/ok (15.5435ms)
✔ WebSocket cancel ends an in-flight prompt (7.3707ms)
✔ WebSocket error path stays free of credentials (8.7577ms)
✔ GUI host serves static files from the configured directory (11.0913ms)
✔ spawned fake ACP bridge streams thought and answer (352.2298ms)
✔ spawned fake ACP bridge cancels an in-flight prompt over stdio (332.0825ms)
✔ spawned fake ACP bridge reports a failed turn as an error frame (320.5928ms)
ℹ tests 16
ℹ pass 16
ℹ fail 0
```

### Credential gate detail

`assertWireClean` runs over every raw frame and body observed in a test and
asserts the literal secret is absent, `/NVIDIA_API_KEY/` does not match, and
`/authorization/i` does not match. It is applied to `/health`, `/v1/models`,
the streaming session, the cancel path, the error path, and the spawned-ACP
path. The error-path test deliberately makes the agent throw
`NVIDIA_API_KEY=<secret> authorization=Bearer <secret>` and asserts the frame
is `"[redacted]=[redacted] [redacted]=Bearer [redacted]"`.

### Real `A008-acp` subprocess smoke check — pass, no provider call

Not a committed test; run once by hand against the real
`dist/src/acp/server.js` in a temporary cwd.

- Without `NVIDIA_API_KEY`: `/health` 200, `/v1/models` 200, and `session/new`
  returns
  `{"type":"error","message":"ACP connection closed: A008-acp failed: [redacted] is required for NVIDIA chat.","requestId":"n1"}`.
  The env-var name is redacted on the wire, as ADR 0019 D6 requires.
- With a dummy non-credential value: `session/new` returns
  `{"type":"session/new/ok","requestId":"n1","sessionId":"A008_v1_acp_session_..."}`.
  The frames contain neither the value nor the token `NVIDIA_API_KEY`.

Session creation performs no provider request, so no paid call was made.

### `git diff --check` — pass

No whitespace errors.

- Skipped: live NVIDIA prompt through the GUI host. A real turn is a paid
  provider call and needs explicit task authority (AGENTS.md Safety). Closest
  substitute: the spawned fake ACP transport, which exercises the real ACP
  stdio wire, the real `A008AcpAgent`, and a fake `ChatTransport`.
- Skipped: browser click-through of the GUI against a running host. The GUI
  session client is A008-0033 and does not exist yet
  (`gui/src/session/use-gui-session.ts` is still the stub), so there is no
  renderer to drive.
- Skipped: `docs/JOURNAL.md` append (operator on merge).
- Skipped: merge to `main` (operator only).

## Documentation Updates

- [x] `docs/finished/A008-0032_gui-host.md` (this archive)
- [x] `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`
- [x] `docs/handoffs/A008-0032.md`
- [ ] `docs/CURRENT_STATUS.md` — outside write scope
- [ ] `docs/SYSTEMDOC.md` — outside write scope
- [ ] `docs/FILESTRUCTURE.md` — outside write scope; `src/gui-host/` is a new
      directory the operator should map on merge
- [ ] `docs/JOURNAL.md` — operator on merge

## Handoff and Follow-ups

- Current state: Complete on A008-worker01; awaiting operator merge.
- Next recommended step: operator reviews the PR. A008-0033 can then replace
  the `useGuiSession` stub against the D4 frames this host serves.
- Blockers: none for this slice.
- Child tasks: none.
- Open questions for the operator, none blocking:
  1. `gui/vite.config.ts` proxies `/v1` without `ws: true`, so the dev proxy
     will not upgrade `/v1/session`. A008-0033 must either connect directly to
     `ws://127.0.0.1:8787/v1/session` or that config (owned by another task)
     needs `ws: true`.
  2. Wire redaction removes the literal tokens `NVIDIA_API_KEY` and
     `authorization` from assistant text as well as from credentials. That is
     what ADR 0019 D6 asks for, and it means an answer that legitimately
     discusses those tokens is shown redacted.
