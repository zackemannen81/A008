# A008 GUI host protocol v1

Discoverability: index. This is the complete surface an external client speaks
to. It is written so a client can be implemented without reading this
repository's decision history.

Decisions behind it: [`adr/0019-a008-owned-gui.md`](adr/0019-a008-owned-gui.md)
D3–D4, [`adr/0020-source-upload-ingest.md`](adr/0020-source-upload-ingest.md)
D3–D4, [`adr/0022-gui-is-a-test-surface.md`](adr/0022-gui-is-a-test-surface.md).
Where this document and an ADR disagree, the ADR is the decision and this
document has a bug.

## What the host is

`src/gui-host/` is a Node process. It serves static files, exposes four HTTP
routes and one WebSocket, and bridges that WebSocket to an `A008-acp` stdio
subprocess it owns.

```text
client ──HTTP/WS──> A008 GUI host ──stdio ACP──> A008-acp ──> memory runtime
                                                            └─> provider
```

The host holds no credential logic of its own and makes no provider call. It
reads `NVIDIA_API_KEY` and memory settings from its own environment and passes
nothing to the client. A client never sees a credential.

Start it with `npm run gui-host`, or `npm run gui` to build the bundled test
surface first. Default bind is `127.0.0.1:8787`.

## Origin rules — read this before writing a client

The host refuses a request whose `Origin` header is neither same-host nor
loopback over http/https. `POST /v1/shell` runs a real command in the host's
working directory, so a page in the user's browser must never reach it.

A desktop client is affected by this:

| Client origin | Default | Why |
| --- | --- | --- |
| no `Origin` header | **allowed** | not a browser; curl, Node `fetch`, a native HTTP client |
| `http://127.0.0.1:*`, `http://localhost:*` | **allowed** | loopback |
| same host as the host itself | **allowed** | same-origin |
| `null` (renderer loaded from `file://`) | **refused** | admitting it admits every local HTML file |
| `app://…` or any non-http scheme | **refused** | not http or https |
| any other origin | **refused** | cross-origin |

If your client presents an origin, name it:

```bash
A008_GUI_HOST_ALLOWED_ORIGINS="null,app://your-client"
```

Comma-separated, matched literally after trimming and lowercasing, empty by
default. Naming one origin admits that one and nothing else.

The simplest client avoids the question entirely by sending no `Origin` header,
which a native HTTP client does by default.

This guard is about the user's browser. It does not make a loopback port safe
against a hostile process on the same machine, and never did.

## HTTP

Every failure body is `{ "error": <message>, "message": <message> }`. The two
fields carry the same string; `message` is the one to display.

### `GET /health`

```json
{ "ok": true, "name": "A008-gui-host" }
```

### `GET /v1/models`

```json
{ "models": [{ "id": "nvidia/nemotron-3.5-lightning-30b-a3b", "name": "…" }] }
```

Needs no credential. Use it to check the host is reachable and configured.

### `POST /v1/shell`

`content-type: application/json` is required; anything else is `415`.

```json
{ "command": "node -e \"console.log(1)\"" }
```

```json
{ "stdout": "1\n", "stderr": "", "exitCode": 0,
  "timedOut": false, "truncated": false }
```

The command runs in the host process working directory, not in the client.

### `POST /v1/upload`

```text
content-type: application/octet-stream
x-a008-filename: <original name>
body: raw bytes
```

```json
{ "locator": "source:<sha256>/<sanitised-name>", "sha256": "…", "bytes": 1234,
  "mediaType": "text/plain", "extracted": true, "artifactId": "A008_knowledge_artifact_…" }
```

Things a client must not assume:

- **The filename is advisory.** The media type comes from the file's magic
  bytes. A PDF named `.txt` is reported as `application/pdf`.
- **`extracted: false` is a success, not a failure.** The original is stored and
  content-addressed either way. `false` means no extractor read it — today PDF,
  DOCX and images — and the same locator can be re-extracted later. Show the
  media type, not an error.
- **The same bytes twice return the same locator** and store one blob.
- Uploads need `A008_SOURCE_STORE_PATH`; without it the route answers `400`.

## `WS /v1/session`

One socket carries one or more sessions. JSON text frames, one message each.

### Client → host

```jsonc
{ "type": "session/new", "requestId": "r1", "model": "…" }   // model optional
{ "type": "prompt",  "requestId": "r2", "sessionId": "…", "text": "…" }
{ "type": "cancel",  "requestId": "r3", "sessionId": "…" }
```

### Host → client

```jsonc
{ "type": "session/new/ok", "requestId": "r1", "sessionId": "A008_v1_acp_session_…" }
{ "type": "thought",   "sessionId": "…", "text": "…" }   // repeats while streaming
{ "type": "answer",    "sessionId": "…", "text": "…" }   // repeats while streaming
{ "type": "prompt/ok", "requestId": "r2", "sessionId": "…" }
{ "type": "error", "message": "…", "requestId": "…", "sessionId": "…" }
```

`requestId` and `sessionId` on an `error` are present only when the host knew
them.

### The one rule that matters

**`thought` and `answer` are separate channels and must stay separate.**
`thought` is the model's reasoning. It is display-only: never concatenate it
into the answer, never store it, never send it back as conversation history.
A008 enforces this on its side and a client that merges them breaks the
guarantee for its users.

Both arrive as many small frames. Append per channel; a turn ends at
`prompt/ok`.

### Session lifetime

Closing the socket releases every session it opened. A client that reconnects
starts a new session; there is no resume.

## Configuration

Read by the host process. None of it reaches a client.

| Variable | Meaning |
| --- | --- |
| `A008_GUI_HOST_PORT` | listen port, default `8787` |
| `A008_GUI_HOST_ALLOWED_ORIGINS` | extra origins, comma-separated, empty by default |
| `A008_SOURCE_STORE_PATH` | upload store; must be outside the repository. Unset disables uploads |
| `NVIDIA_API_KEY` | provider credential |
| `A008_MEMORY_SQLITE_PATH` | memory store; must be outside the repository |
| `A008_PROJECT_ID`, `A008_AGENT_ID` | canonical `A008_v1_<kind>_<lowercase UUIDv4>` |
| `A008_PROVIDER_TIMEOUT_MS` | per-request ceiling, default `180000` |
| `A008_CHAT_TEMPERATURE`, `A008_CHAT_TOP_P`, `A008_CHAT_MAX_TOKENS`, `A008_CHAT_REASONING_BUDGET`, `A008_CHAT_THINKING` | override the verified model profile for chat turns |

`A008_CHAT_REASONING_BUDGET` is the one to reach for first: the profile ships it
equal to `maxTokens`, so reasoning can consume the whole output budget and
truncate the answer.

## What this protocol does not have

Named so a client does not wait for them: no authentication, no session resume
or reload, no multiplexed file transfer over the socket, no server-initiated
push outside a turn, no versioning handshake. The host answers `GET /health`
and that is the whole capability negotiation.

A client should treat any unknown frame `type` as ignorable rather than fatal,
so a later addition does not break it.

## Stability

An external client depends on this. It changes only through a claimed task and
an ADR, never as a side effect. Additive fields are the expected kind of change;
a client should ignore fields it does not recognise.
