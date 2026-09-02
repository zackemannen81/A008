# A008-0030 A008 GUI runtime proof

Task: A008-0030

Date: 2026-09-02

Evidence boundary: local A008 GUI host, real `A008-acp` subprocess, real local
memory runtime, loopback fake chat-completions endpoint. No live model
inference, no provider credential, no network egress.

## Result

The A008-owned GUI stack satisfied every condition in the A008-0030 definition
of done in one run. Fifteen operator checks passed and none failed.

The proven chain is the ADR 0019 D2 product path, end to end, with only the
provider replaced:

```text
HTTP/WebSocket client
  -> A008 GUI host          (src/gui-host/server.js, real process)
  -> A008-acp               (stdio subprocess, real ACP server)
  -> createLocalMemoryRuntime
  -> NVIDIA chat transport
  -> loopback fake SSE endpoint
```

Nothing inside the host was stubbed. The host was started as a separate OS
process from its compiled output and spoke to a real ACP subprocess.

## Observed checks

| # | Check | Observed |
| --- | --- | --- |
| 1 | `GET /health` | `{"ok":true,"name":"A008-gui-host"}` |
| 2 | `GET /v1/models` | 1 model, `nvidia/nemotron-3.5-lightning-30b-a3b` |
| 3 | Host serves the built GUI | 200, `index.html` referencing the hashed Vite bundle |
| 4 | `POST /v1/shell` runs in the host process | exit 0, stdout `shell-ran-in-host` |
| 5 | Credential reaches the provider server-side | fake endpoint received `authorization: Bearer <sentinel>` |
| 6 | `session/new` opens a session | `A008_v1_acp_session_4b4f12bd-...` |
| 7 | WebSocket streamed thought | `"Weighing the two options before answering."` |
| 8 | WebSocket streamed answer | `"A008 GUI end-to-end is live."` |
| 9 | Thought is a separate channel | answer text carries no reasoning content |
| 10 | No error frames | none |
| 11 | `prompt/ok` delivered | yes |
| 12 | Credential value never on the wire | sentinel absent from all frames and bodies |
| 13 | Token name `NVIDIA_API_KEY` never on the wire | absent |
| 14 | No `authorization` header echoed | absent |
| 15 | Run completed without throwing | yes |

## Observed WebSocket frames

Five frames, in order. Reasoning arrived as two `thought` frames and never
merged into the `answer` frame:

```json
{"type":"session/new/ok","requestId":"r1","sessionId":"A008_v1_acp_session_4b4f12bd-a163-4278-9cfd-c6c6b5b14c6b"}
{"type":"thought","sessionId":"A008_v1_acp_session_4b4f12bd-...","text":"Weighing the two options"}
{"type":"thought","sessionId":"A008_v1_acp_session_4b4f12bd-...","text":" before answering."}
{"type":"answer","sessionId":"A008_v1_acp_session_4b4f12bd-...","text":"A008 GUI end-to-end is live."}
{"type":"prompt/ok","requestId":"r2","sessionId":"A008_v1_acp_session_4b4f12bd-..."}
```

This matches the ADR 0019 D4 frame schema exactly.

## Credential boundary

The host process was given `NVIDIA_API_KEY` as a unique sentinel value. The
fake endpoint confirmed the sentinel arrived as `authorization: Bearer
<sentinel>`, proving the credential is used server-side. The same sentinel, the
literal token name `NVIDIA_API_KEY`, and the string `authorization` were then
searched across every WebSocket frame and every HTTP response body the client
observed. All three were absent. ADR 0019 D6 holds on the observed wire.

## Reproduction

1. `npm run build` and `npm --prefix gui run build`.
2. Start a loopback HTTP server that answers
   `POST /v1/chat/completions` with an SSE stream of
   `{"choices":[{"delta":{"reasoning_content":"..."}}]}` frames followed by
   `{"choices":[{"delta":{"content":"..."}}]}`, `finish_reason: "stop"`, and
   `data: [DONE]`.
3. Start `node dist/src/gui-host/server.js` with:
   - `NVIDIA_API_KEY` set to a sentinel value
   - `NVIDIA_CHAT_COMPLETIONS_URL` pointing at the loopback server
   - `A008_GUI_HOST_PORT`
   - `A008_MEMORY_SQLITE_PATH` under a temporary directory outside the repository
   - `A008_PROJECT_ID` and `A008_AGENT_ID` in canonical
     `A008_v1_<kind>_<lowercase UUIDv4>` form
   - `A008_DEBUG_TRACE=off`
4. Exercise `/health`, `/v1/models`, `/`, and `POST /v1/shell`.
5. Open `ws://127.0.0.1:<port>/v1/session`, send `session/new`, then `prompt`
   with the returned `sessionId`, and record every frame until `prompt/ok`.
6. Assert the sentinel, `NVIDIA_API_KEY`, and `authorization` appear in no
   recorded frame or body.

Malformed identity values fail closed before any session opens, with
`Runtime ID must use canonical A008_v1_<kind>_<lowercase UUIDv4> format.`
surfaced to the client through the host error frame. That path was observed
during an earlier run of this harness.

## Development proxy check

The production path serves the client and the API from one origin, so no proxy
is involved. Under `vite dev` the client is served from port 5173 while the host
listens on 8787, and the session client resolves its socket from
`location.host`, so the WebSocket upgrade must cross the Vite dev proxy.

With `ws: true` on the `/v1` proxy entry in `gui/vite.config.ts`, a socket
opened at `ws://localhost:5173/v1/session` completed the full sequence
`session/new/ok`, `thought`, `answer`, `prompt/ok` against the same host and
loopback fake endpoint.

The flag was then removed and the same check re-run to confirm it is
load-bearing. `GET /health` still proxied correctly, and the WebSocket never
reached `prompt/ok`. The flag was restored.

## Boundary

No live provider call, credential, deployment, publication, or release
participated. The GUI was exercised over HTTP and WebSocket, not through a
browser session; browser-level rendering of the merged panes is covered by the
module tests under `gui/src/`, not by this record.
