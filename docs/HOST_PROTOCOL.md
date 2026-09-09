# A008 GUI host protocol v1

A008-0068 (ADR 0029) adds optional `state.runtime.tools` to session snapshots:
an array of `{ name: string, description: string }` for the runtime's native
model tools. It is informational; calls and permissions use the existing tool
frames. Absence means catalog metadata is unavailable, not that tools are enabled.
`A008_GUI_WORKSPACE` selects the standalone host cwd at startup; this environment
option adds no HTTP mutation route and does not change memory-store ownership.

Discoverability: index. This is the complete surface an external client speaks
to. It is written so a client can be implemented without reading this
repository's decision history.

Decisions behind it: [`adr/0019-a008-owned-gui.md`](adr/0019-a008-owned-gui.md)
D3–D4, [`adr/0020-source-upload-ingest.md`](adr/0020-source-upload-ingest.md)
D3–D4, [`adr/0022-gui-is-a-test-surface.md`](adr/0022-gui-is-a-test-surface.md).
Memory inspection and session controls are additive amendments in
[`ADR 0025`](adr/0025-memory-inspection-gui.md) and
[`ADR 0026`](adr/0026-gui-session-controls.md).
Where this document and an ADR disagree, the ADR is the decision and this
document has a bug.

## What the host is

Engine mode (ADR 0028) serves this same GUI/API from a session-bound loopback
listener and an in-process ACP bridge. It borrows the external client's existing
session instead of spawning a second one. [ENGINE.md](ENGINE.md) defines discovery,
authentication, close metadata and project selection. Standalone mode below still
spawns ACP. Panel URLs contain an ephemeral fragment capability; `/v1/*` and the
WebSocket require it. Static assets and health contain no session data.

Additive frames: `session/activity` carries `sessionId`, `active`, optional `text`
and `state`; `tool` carries `sessionId`, `id`, `title`, `status`, `text`.
Standalone GUI permissions arrive as `tool/permission` with `sessionId`, `id`,
`title`, `text`. The client responds with `type: "tool/permission"`, `requestId`,
`sessionId`, `permissionId`, `allow` (boolean). Pending IDs are single use and
session-owned. The bundled standalone GUI offers Reject, Allow once and Allow all;
Allow all is client-local state that auto-sends the existing `allow: true` response
for later requests in that same GUI session and resets on reconnect. It does not
change this wire contract or grant authority from model/content. In engine mode the
surrounding native client owns the standard ACP permission dialog; the frame cannot
grant it through the panel bridge.

Session controls additionally support `configureRuntime` with `settings` and the
last observed `revision`; snapshots include `runtimePreferences`. The complete
contract and persistence boundary are in [RUNTIME_SETTINGS.md](RUNTIME_SETTINGS.md).

A008-0091 Code Canvas adds no HTTP, WebSocket, ACP, permission or session-snapshot
field. The bundled renderer derives a transient HTML artifact only from completed
assistant answer content and previews it locally in a sandboxed `srcdoc` iframe.
Writing that content to the workspace remains an ordinary approved repository-tool
action; clients must not infer a host-side artifact API from the Canvas UI.

`src/gui-host/` is a Node process. It serves static files, exposes HTTP
routes and one WebSocket, and bridges that WebSocket to an `A008-acp` stdio
subprocess it owns.

```text
client ──HTTP/WS──> A008 GUI host ──stdio ACP──> A008-acp ──> memory runtime
                                                            └─> provider
```

Chat completions still run in the ACP subprocess. ADR 0032 lets the host call
NVIDIA's catalog (`GET /v1/models` upstream) and image-generation endpoints with
the process or secrets-file key. ADR 0033 adds kie.ai: curated catalog, OpenAI-compatible chat in ACP, and async
Market image jobs on the host. ADR 0036 adds OpenAI GPT-5.6 Luna chat through
the same ACP/provider-neutral boundary. The renderer never sees a credential.
`GET` provider-settings reports only whether each key is configured.

Start it with `npm run gui-host`, or `npm run gui` to build the bundled test
surface first. Default bind is `127.0.0.1:8787`.

## Standalone PIN gate

Set `A008_GUI_PIN` to exactly six digits to enable the lightweight standalone
browser gate. An unauthenticated `/` serves the built-in PIN page; `POST
/auth/login` accepts `{ "pin": "123456" }`. A successful login replaces the
PIN with a random process-lifetime session token in an `HttpOnly`,
`SameSite=Strict` cookie (`Secure` behind an HTTPS proxy). The browser cookie
expires after 24 hours; restarting the host invalidates it immediately.

With the gate enabled, every `/v1/*` route and `WS /v1/session` requires that
session cookie. `GET /health` remains public. Five failed PIN attempts from one
client produce a 60-second lockout and HTTP 429 with `Retry-After`. The PIN is
never sent to the renderer after login and should live only in local environment
configuration. This is a convenience gate, not an identity system: six digits
have low entropy, so an Internet-exposed host should also use an edge control
such as Cloudflare Access.

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

In standalone mode this route needs no credential only when `A008_GUI_PIN` is
disabled; with the PIN gate enabled it requires the authenticated cookie. Engine
mode retains its separate capability authentication.

Each model also carries `defaults` (the complete parameter object below) and
`capabilities`: `maxTokens` (integer ceiling), `topP`, `thinking`, `seed`, `stop`
(booleans), `reasoningBudget` (integer ceiling or null), `reasoningEfforts`
(string array), and `verifiedOn` (ISO date). These describe the supported A008
controls for the hosted endpoint. The current built-in model list has seven entries, including `gpt-5.6-luna`.
Defaults here come from model profiles; environment overrides appear in the
session snapshot after connection. No environment values or input modalities
are published by this route. User-catalog additions (NVIDIA Build or kie.ai)
appear here after they are added from Parameters → Provider.

### `GET /v1/browser/frame-check?url=`

```json
{ "url": "https://chatgpt.com/", "embeddable": false, "reason": "frame-ancestors" }
```

GET the target from the host (not the renderer) and read
`Content-Security-Policy` / `X-Frame-Options`. `embeddable` is false when the
site forbids framing A008. Report-Only CSP is ignored. A probe failure returns
`embeddable: true` so the pane can still try. `url` must be absolute http(s).
The host does not return page bodies.

### `GET /v1/catalog/nvidia`

Live NVIDIA Build list. Needs `NVIDIA_API_KEY`. Never returns the key.

### `GET /v1/catalog/kie`

Curated kie.ai market ids (chat, image, video). Needs no credential. Video is
listed, not invoked.

### `POST /v1/catalog/nvidia`

```json
{ "id": "gemini-3-flash", "provider": "kie" }
```

Adds a chat model to `~/.a008/catalog.json`. `provider` defaults to `nvidia`.

### `DELETE /v1/catalog/nvidia?id=`

Removes that user-catalog chat model.

### `GET /v1/provider-settings`

Reports `nvidiaApiKeyConfigured`, `kieApiKeyConfigured`,
`openAiApiKeyConfigured`, `chatProvider`, `imageProvider`, NVIDIA image
model/endpoint, kie chat/image model ids, and per-provider key sources
(`environment` | `secrets-file` | `missing`). Never a key value.

### `POST /v1/provider-settings`

Write-only NVIDIA, kie.ai and/or OpenAI API keys plus the catalog fields above.
`chatProvider` accepts `nvidia`, `kie`, or `openai`; image provider remains
NVIDIA/kie only. Empty key strings are rejected. Omitted keys leave stored values
unchanged.

### `POST /v1/images`

```json
{ "prompt": "a coffee shop interior" }
```

Uses `imageProvider`. NVIDIA path is the configured NIM; kie path is
createTask + recordInfo, then the first result URL is downloaded. Stores
PNG/JPEG in the source store and returns a `source:<sha256>/…` locator.

### `GET /v1/blobs/:sha256/:name`

Serves a stored generated image. Private cache.

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
  bytes. A PDF named `.txt` is reported as `application/pdf`, and a `.docx` is
  told apart from a `.xlsx` by what is inside the archive, not by its name.
- **`extracted: false` is a success, not a failure.** The original is stored and
  content-addressed either way. `false` means no extractor read it, and the same
  locator can be re-extracted later. Show the media type, not an error.
- **Which types are read.** UTF-8 text and Markdown, PDF, and Word (`.docx`).
  Everything else — images, spreadsheets, presentations, plain archives, unknown
  binaries — is stored with its sniffed media type and `extracted: false`. A PDF
  that is a scan has no text layer to read and also comes back `false`; so does
  a file that turns out to be corrupt. None of those are errors at this route.
- **The same bytes twice return the same locator** and store one blob.
- Uploads need `A008_SOURCE_STORE_PATH`; without it the route answers `400`.

## `WS /v1/session`

One socket carries one or more sessions. JSON text frames, one message each.

### Client → host

```jsonc
{ "type": "session/new", "requestId": "r1", "model": "…" }   // model optional
{ "type": "prompt",  "requestId": "r2", "sessionId": "…", "text": "…" }
{ "type": "cancel",  "requestId": "r3", "sessionId": "…" }
{ "type": "session/control", "requestId": "r4", "sessionId": "…", "control": { "action": "inspect" } }
```

### Host → client

```jsonc
{ "type": "session/new/ok", "requestId": "r1", "sessionId": "A008_v1_acp_session_…" }
{ "type": "thought",   "sessionId": "…", "text": "…" }   // repeats while streaming
{ "type": "answer",    "sessionId": "…", "text": "…" }   // repeats while streaming
{ "type": "prompt/ok", "requestId": "r2", "sessionId": "…" }
{ "type": "error", "message": "…", "requestId": "…", "sessionId": "…" }
{ "type": "session/control/ok", "requestId": "r4", "sessionId": "…", "state": { /* snapshot below */ } }
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

### Session controls (ADR 0026)

The host accepts only sessions owned by the requesting socket. A current ACP
composition advertises `_meta["a008.sessionControl"] = 1` in its initialize
agent capabilities and registers `_a008/session/control`. The host uses this
capability to attach `state` to `session/new/ok` and `prompt/ok`. Old frames
remain valid; an older ACP bridge omits snapshots and rejects controls with a
clear upgrade error. A consumer must not manufacture history from thought text.

| Control | Effect |
| --- | --- |
| `{ "action": "inspect" }` | Current snapshot, without a provider call |
| `{ "action": "reset" }` | Clears committed conversation messages; keeps system/model/settings |
| `{ "action": "undo" }` | Removes the latest committed user/assistant pair; snapshot adds `undone` boolean |
| `{ "action": "model", "model": "<registry id>" }` | Starts a fresh conversation with this model's runtime defaults; ACP session ID stays owned |
| `{ "action": "configure", "parameters": {…} }` | Atomically replaces the chat parameters for subsequent prompts |
| `{ "action": "close" }` | Aborts active work and releases the session; snapshot adds `closed: true` |

All controls except close are refused while a prompt or another control is
running. Cancellation remains busy until the prompt finishes; late streamed
chunks are ignored by the bundled client. Reset, undo, model and close never
delete durable memory. Unknown models/invalid parameters preserve prior state.

Example snapshot (synthetic values):

```json
{
  "model": "nvidia/nemotron-3.5-lightning-30b-a3b",
  "parameters": {
    "stream": true, "temperature": null, "topP": 0.95,
    "maxTokens": 8192, "enableThinking": true, "reasoningBudget": 4096,
    "reasoningEffort": null, "seed": null, "stop": null
  },
  "messages": [{ "role": "user", "content": "Hello" }, { "role": "assistant", "content": "Hello." }],
  "runtime": { "cwd": "C:/fixture", "projectId": "<canonical project id>", "memoryPath": "C:/fixture/memory.sqlite" }
}
```

Messages contain committed user/assistant text only, never system text or
reasoning. A failed/cancelled generation does not add a partial turn; a turn
already committed before post-output cancellation remains committed.

Configure requires exactly the nine parameter fields above. `null` explicitly
omits an optional field even over profile/environment defaults. Turning
temperature off means provider-default sampling, whereas `0` is an explicit
request value. Turning reasoning off suppresses its budget on the wire. The
parameter object reports the retained budget so it can be re-enabled later.

| Parameter | Validation / meaning |
| --- | --- |
| `stream` | Boolean; false uses the existing non-streamed JSON adapter path |
| `temperature`, `topP` | null or a finite number 0–1; topP must be null if unsupported |
| `maxTokens` | Integer 1 to the selected endpoint ceiling; generated reasoning and answer share it |
| `enableThinking` | Boolean or null on supported Nemotron models; null elsewhere |
| `reasoningBudget` | null, −1 (no reasoning cap), or integer 0 to endpoint ceiling; cannot exceed maxTokens while reasoning is enabled |
| `reasoningEffort` | null or one of the model's advertised effort strings |
| `seed` | null or nonnegative JavaScript-safe integer; null if unsupported |
| `stop` | null or 1–4 nonempty strings, each at most 256 characters; null if unsupported |

This is a chat generation budget, not an input-context, whole-session, memory
processing or monetary budget. The retrieval/analyzer/classifier requests keep
their own fixed parameters. Settings/history are process-local and not saved
across a reconnect. The bundled GUI exposes controls in Parameters and Session
commands; slash aliases match CLI. `/exit`, `/quit`, `/q` leave the page open.

## Configuration

Read by the host process. Credentials never reach a client. Session snapshots
expose cwd, project identity, memory path and effective generation settings.

| Variable | Meaning |
| --- | --- |
| `A008_GUI_HOST_PORT` | listen port, default `8787` |
| `A008_GUI_HOST_ALLOWED_ORIGINS` | extra origins, comma-separated, empty by default |
| `A008_SOURCE_STORE_PATH` | upload store; must be outside the repository. Unset disables uploads |
| `NVIDIA_API_KEY` | NVIDIA provider credential |
| `KIE_API_KEY` | optional kie.ai credential |
| `OPENAI_API_KEY` | optional OpenAI chat credential; enables built-in `gpt-5.6-luna` |
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


## Agent 007 shared memory (`A007_MEMORY_V1`)

The ACP process also exposes a provider-neutral memory surface for hosts such as Agent 007. These are custom JSON-RPC methods on the same verified ACP process; they do not create a second server or expose the SQLite file directly.

### `memory/capabilities`

Request:

```json
{ "protocol": "A007_MEMORY_V1", "version": 1 }
```

A successful response proves the live runtime supports the named operations. Current capabilities include `recall`, `write`, `provenance`, `lexical`, `deterministic`, `project-scoped`, and `durable` when the configured store is not in-memory.

### `memory/recall`

```json
{ "query": "project decision", "limit": 6, "scopes": ["local"] }
```

External recall deliberately composes `KnowledgeMemoryReader` without its optional model-backed retrieval-scope classifier. It therefore performs no hidden provider/model call. The tradeoff is narrower deterministic/lexical retrieval compared with A008's enriched internal chat retrieval.

### `memory/write`

```json
{ "content": "Decision: use the normalized runtime boundary.", "scopes": ["project"] }
```

External writes are stored durably as attributed evidence (`speaker: agent007`) with provenance in the same A008 knowledge store. They do **not** run the model-backed analyzer/classifier and do not silently promote caller text into accepted semantic bindings. The capabilities response reports `writeSemantics: "evidence"`.

The shipped `agent007.brain.json` advertises this memory as `SHARED`, but the manifest is only discovery metadata. Agent 007 must still live-probe `memory/capabilities` after the ACP identity handshake before enabling the memory.

## Memory diagnostics (`A008_MEMORY_INSPECT_V1`)

ADR [0025](adr/0025-memory-inspection-gui.md), A008-0064. `GET /v1/memory`
delegates to custom ACP `memory/inspect` in the same process that owns chat
memory. It neither starts a chat session nor calls a model. Normal ACP startup
configuration (including the server-side credential) must still be valid.
Origin checks, response redaction and `Cache-Control: no-store` apply.

| Query field | Meaning and limit |
| --- | --- |
| `query` | Case-insensitive substring search of complete record details and IDs; at most 300 characters. |
| `kind` | `entity`, `state`, `history`, `claim`, `event`, `utterance`, `artifact`, `provenance`; omitted means all. |
| `domain` | Exact stored domain after case/whitespace normalisation; at most 300 characters. |
| `status` | Exact record status or evidence activation; at most 300 characters. |
| `offset` | Integer 0–1,000,000; default 0. |
| `limit` | Integer 1–100; default 40. |

Example: `GET /v1/memory?kind=claim&status=dormant&limit=40&offset=0`.
ACP takes the same fields as an object, with numeric offset/limit. Both validate
before inspecting; unknown fields, duplicates in HTTP, and invalid bounds fail.
HTTP uses 400 for invalid queries, 405 for non-GET methods, 403 for refused
origins, and 503 for a bridge without inspection support. ACP rejects invalid
params and reports method-not-found when the agent has no inspector.
ACP startup/transport failures use the existing host error response.

The response contains:

- `protocol: "A008_MEMORY_INSPECT_V1"`, `projectId`, `durable`.
- `summary`: unfiltered `total`, `counts` by kind, lifecycle `active`/`dormant`
  counts, `contestedSlots`, `domains: [{name,count}]`, and available `statuses`.
  Domain counts count stored claim/utterance label attachments once. Binding
  rows display the labels of their establishing claim, without inflating counts.
- `records`: one filtered page, ordered by kind, label, ID; `matched`, `offset`,
  `limit` describe the page. A record has `id`, `sourceId`, `kind`, `label`,
  `status`, `activation`, `tags`, `domains`, `detail` and `truncated`.
- `detail` is a JSON text preview of `{record, labels?, lifecycle?}`, capped at
  16,000 characters; `label` is capped at 500. `truncated` is true if either
  is clipped. A truncated detail is text, not necessarily parseable JSON.
  Search still examines complete stored text. Returned containers are defensive.
- `graph`: `nodes`, `edges: [{from,to,relation}]`, `totalNodes`, `totalEdges`.
  The graph uses all filtered matches, independent of table offset/limit.
  It traverses stored links to choose at most 80 records, then returns at most
  240 links whose endpoints are displayed. Totals precede graph caps. Edges are
  stored references, provenance, binding ownership/object/claim references and
  relation-index links. Targets outside this inventory (such as transition-only
  provenance targets) do not become invented nodes or visible edges.

`activation: "untracked"` means no lifecycle is attached to this record;
state/history never inherit evidence activation. `status` retains the stored
claim decision, speech act, entity/event type or provenance relation. Bindings
are `current`, `closed`, or `contested`. Diagnostic IDs are typed and stable;
binding IDs include the slot, interval and establishing claim because the model
has no standalone binding ID. They are inspection addresses, not new canon IDs.

Inspection scans the local project namespace in memory. It has no write method,
does not reinforce evidence, does not resolve conflicts, and does not alter
`A007_MEMORY_V1` or the context projected to a model. No server-scale performance
or remote authentication boundary is claimed.
