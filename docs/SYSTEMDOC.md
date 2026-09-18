# System Document

This document describes durable behavior that exists now. Intended product
architecture belongs in `docs/PROJECT_BRIEF.md` until implemented.

## Shared v1 wire contract

`packages/protocol/src` owns the existing WS/session/model/runtime-preference
wire types, Zod schemas, serialization and compatibility parsing. Core and GUI
modules retain thin adapters; runtime policy and platform transport/auth stay
outside the package. Shared snapshot guards preserve additive fields, while
direct Zod parsing can normalize them. Generated structural JSON schemas require
the shared semantic runtime-budget checks described in the package README.

The root and portable engine ship `dist/packages/protocol/src`; the independent
tarball ships its own `dist`. V1 message tolerance, errors, ACP sessions and
permission behavior remain unchanged. The [HTTP/WS inventory](HOST_PROTOCOL_V1_INVENTORY.md)
records current ownership. A008-0105 adds shared HTTP request/response shapes,
legacy upload/shell/frame/memory parsing and generated OpenAPI from the same
owner. Existing core/host HTTP producer types and GUI consumers use these DTOs;
normalization, runtime checks and previously non-validating GUI adapters remain.
Binary responses are described as bytes, without wrappers. Memory graph edge
membership requires the shared validator beyond structural JSON Schema.
A008-0103's accepted future boundary is not a current isolation, negotiation or
recovery guarantee.

## Implemented system

A008 implements a repository control plane and its first bounded application
surfaces:

```text
owner direction
  -> one active task with frozen scope
  -> repository-owned authority documents
  -> bounded work and verification
  -> current status + decisions + journal + immutable archive
  -> next actor resumes from repository state
```

The task ID register allocates stable addresses on `main`. Each branch has at
most one active task. Ready freezes the charter. Discoveries route to the task,
a bounded child, backlog, or concepts sandbox.

## Current source boundary

```text
A008 repository authority
  |- tracked docs and decisions
  |- provider-neutral chat core, NVIDIA adapter, CLI, and ACP bridge
  |- semantic-memory contracts, service, hybrid reader, and repositories
  |- memory-aware application orchestration and bounded prompt composition
  |- post-output staging, stateless semantic calls, sequential coordination,
  |  relation commit, and benchmark
  |- runtime identity contracts and ACP binding reference repository
  `- tracked provenance boundary documents

local/external evidence (not A008 authority)
  |- docs/_legacy/agenten007  raw CLI, ignored and secret-bearing
  |- C:\code\OpenHands         MIT Agent Canvas source clone
  |- owner Context-First doc   source input; A008 memory v0 now exists
  |- C:\code\acme             related prior work; not an adopted baseline
  `- bootstrap/protocol/add-on reference packages
```

External source becomes A008 behavior only through a claimed task that pins its
revision, records its license, imports or adapts a bounded surface, verifies the
result, and updates this document.

## Application runtime

`A008-engine` owns one shared runtime per canonical project directory inside its
process. Native ACP chat and authenticated web panels borrow the same session.
Disconnecting a panel preserves that session. Explicit close and engine EOF cancel
active turns, settle approval requests, close MCP children, panels and SQLite.
The engine package includes compiled CLI/ACP/GUI, a matching Node executable,
production dependencies and notices. Data lives outside the installation. Full
lifecycle, attachment and protocol details are in [ENGINE.md](ENGINE.md).

Model tools enter through typed definitions and structured JSON/SSE calls. Native
`exec_command` and client-approved stdio MCP tools require per-action approval.
Validation precedes approval/execution; denial, cancellation, timeout, unknown
tools, malformed schemas or exhausted budgets never become successful operations.
Observations re-enter an ephemeral provider transcript. Only the original user
message and final answer reach committed history and post-output intake.

[Runtime settings](RUNTIME_SETTINGS.md) configure global instructions and local
budgets. Each turn captures one snapshot; model generation settings remain scoped
to its session. Saving settings neither calls a model nor mutates knowledge.

```text
CLI / A008-acp -> createLocalMemoryRuntime
  |- resolved NVIDIA / kie.ai / OpenAI credential + one ChatTransport
  |- project-namespaced SQLite knowledge store
  |- KnowledgeMemoryReader (DEFINE..PROJECT; writes nothing)
  |- MemoryAwareChatSession
  |- stateless analyzer/classifier (classifier is a comparator)
  |- KnowledgeEngineCommit (INGEST/ACCEPT/RECONCILE/UPDATE)
  `- PostOutputMemoryCoordinator
                 |
                 v
          ChatTransport
            -> EmbeddedAcmeChatTransport (default)
               -> acme-engine@0.1.4 createAcmeModelRuntime().execute()
               -> ACME provider adapter -> selected provider endpoint
            -> explicit direct dispatch (A008_CHAT_TRANSPORT=direct)
               |- NvidiaChatTransport
               |- KieChatTransport
               `- OpenAiChatTransport
            -> explicit remote AcmeChatTransport (A008_CHAT_TRANSPORT=acme)
               -> acme-model-runtime/2 GET /v1/model/compatibility
               -> POST /v1/model/execute SSE
```

A008-0118 established the remote `acme-model-runtime/2` contract and Stage
3.5 GO. A008-0127 moves the normal execution path in-process: the default
`EmbeddedAcmeChatTransport` consumes registry-published `acme-engine@0.1.4`,
derives runtime profiles from A008's registry/catalog and credentials, and calls
`createAcmeModelRuntime().execute()` without a sidecar process, URL, token or
sidecar profile environment. `A008_CHAT_TRANSPORT=direct` retains direct
NVIDIA/kie/OpenAI dispatch for reference/debug work; `A008_CHAT_TRANSPORT=acme`
retains the remote model-runtime/2 path for compatibility/deployment. There is
no post-dispatch fallback. A008 remains the owner of model selection, provider
strategy, prompts, tools, memory and cognition. A008-0128 consumes ACME 0.1.4 and marks embedded OpenAI Chat Completions profiles with `maxOutputTokensParameter="max_completion_tokens"`, while NVIDIA/KIE retain their existing output-token wire semantics. Invocation-local images map to
ACME image parts with `requiredCapabilities.vision=true`; committed conversation
history remains text-only.

`ChatSession` owns in-memory conversation history. It constructs a pending turn,
calls the transport, and commits user plus assistant messages only after a valid
completion. Transport failure leaves prior history unchanged.

`composeChatInvocation` owns the single final chat system message (A008-0080,
ADR 0035 L1). It combines the explicit session base, invocation/global
`systemMessages`, and applicable `contextSystemMessages`, in that order. The
generic fallback is selected only when session/global configuration is absent;
memory data-handling rules do not suppress the fallback. The runtime factories
and CLI preserve an absent explicit base instead of injecting the fallback
early. An explicit base equal to the fallback remains explicit configuration.

The invocation plan can substitute provider-visible current user content, bound
the outgoing dialogue tail and enforce the hard budget over the exact composed
role/content serialization. Envelope serialization and retrieval are unchanged.
Tool continuations reuse the same instruction/settings snapshot. The pending
committed turn uses the original normalized user text and actual final answer;
the automatically selected fallback and contextual rule are never committed as
dialogue. Existing explicit session-base metadata remains separate from dialogue.
Bare chat composition also emits one fallback instruction when no base is set.

Core contracts own provider-neutral messages, options, deltas, completions,
usage, errors, model metadata, and the transport port. Core imports do not read
environment variables or terminal state.

`createNvidiaChatTransport` remains the NVIDIA credential/transport owner. It
validates `NVIDIA_API_KEY`, resolves the optional trusted endpoint override,
and constructs `NvidiaChatTransport`. `createNvidiaChatSession` still returns a
bare `ChatSession` for tests and direct callers.

Live CLI and ACP chat without an injected transport use
`createConfiguredChatTransport` (A008-0114 over A008-0073/0087/0088, with
A008-0127 embedded execution). The default is `EmbeddedAcmeChatTransport`.
Explicit model identity still owns routing: A008 derives the ACME selection and
provider hint from the selected built-in/user-catalog profile, while ACME owns
only execution. Any one of `NVIDIA_API_KEY`, `KIE_API_KEY`, or
`OPENAI_API_KEY` is enough to compose the relevant embedded route.
`A008_CHAT_TRANSPORT=direct` selects the prior direct dispatch path;
`A008_CHAT_TRANSPORT=acme` selects the remote sidecar path and requires its
runtime URL. Luna Chat Completions control restrictions remain A008-owned:
when `gpt-5.6-luna` carries function tools, the effective request uses
`reasoningEffort: "none"` on both the direct OpenAI adapter and the ACME-mapped
Chat Completions path. Selected session effort is not rewritten. Stream usage
handling and other provider-specific payload rules remain in the provider
adapters. Image generation on the host
follows `imageProvider`: NVIDIA NIMs or kie Market jobs
(`POST /api/v1/jobs/createTask` then poll `GET /api/v1/jobs/recordInfo`).

CLI chat and A008 ACP now use `createLocalMemoryRuntime`, which injects one
transport into answer and semantic calls. Identity, SQLite path, and debug
settings are read only at this outer composition.

`NvidiaChatTransport` owns NVIDIA payload mapping, authorization header,
stream/non-stream response parsing, timeout/cancellation, and provider error
classification. Fetch, endpoint, and timeout are injected at construction. It
implements no fallback or retry policy.

Live Nemotron streams may emit only a short prefix on `reasoning_content` and
continue the same chain-of-thought on `content` before the user-visible answer.
The transport normalizes those channel transitions so reasoning never becomes
`message.content` or content deltas. Semantic JSON calls use a dedicated
non-thinking generation profile and never inherit chat `enableThinking` or
`reasoningBudget`. Intake receives only `verifiedFinalAnswer`. Successful chat
with failed post-output is a degraded memory outcome, not a failed chat turn.

The CLI is one composition surface. `models` and help work without a key. `chat`
uses the shared memory runtime, streams reasoning to stderr and answers to
stdout, then awaits post-output settlement. Memory failures print to stderr
without failing the delivered answer. Slash commands (`/help`, `/exit`,
`/quit`, `/reset`, `/clear`, `/undo`, `/history`, `/model`, `/status`, `/cwd`,
`/tools`, `/shell`, `/!`) are handled in the CLI and never sent to the model.
`/shell` runs a local process in `process.cwd()` through `runTerminalCommand`.
`@langchain/community` is not a dependency.

## Agent Canvas ACP surface

`A008-acp` uses the official `@agentclientprotocol/sdk` 1.4.0 stable-v1 stream
implementation on stdin/stdout. It creates an independent in-memory
`ChatSession` for each ACP session, creates a canonical versioned A008
`acp_session` runtime ID, exposes the one verified model as a session config
option, converts text and non-fetched resource links into a bounded chat turn,
maps reasoning/content deltas to standard ACP thought/answer chunks, and
propagates cancellation through `AbortSignal`. Failed or cancelled turns retain
the prior committed history. Malformed or duplicate injected IDs are rejected
before the process-local session map changes.

Agent Server is the process owner and protocol client. Agent Canvas is the
external UI that configures a Custom ACP command and renders Agent Server
events. A008-0005 observed this exact chain in real local Canvas 1.16.0 and Agent
Server 1.44.1 processes: a browser prompt reached the compiled bridge, the
existing adapter called a loopback fake endpoint, Canvas rendered the expected
answer, and Agent Server finished the conversation. The external repositories
remain unmodified and outside A008 authority.

On the verified Windows path, Custom ACP commands use forward-slash absolute
paths (`C:/code/...`); backslashes were consumed as shell escapes. The standard
`dev:minimal` launcher also timed out at 30 seconds before the backend's observed
42-second readiness. Starting its exact locked Agent Server and Vite commands
separately is the documented development fallback, not an A008 product runtime.

ACP supports model switching, structured native tools, approved stdio MCP and
per-action permission requests. Rich prompt media, load/resume and an ACP
authentication method remain outside the current implementation. Local SQLite
memory is composed per process/project with separate session conversations.
Canonical ACP session identity is still ephemeral and is not
bound to Agent Server's conversation identity because the current new-session
request does not provide that external handle.

Each ACP session opens one local memory conversation under the process project
and agent. Protocol thought/answer/cancellation behavior is unchanged. Memory
diagnostics never enter ACP stdout. Debug traces, when enabled, use an
explicit JSONL file.

All A008 model-inference evidence uses injected fake fetch responses or the
loopback HTTP fixture. No live model call or paid usage has been made or
claimed. The external Canvas/Agent Server proof did trigger optional OpenAI
subscription control-plane checks and failed title generation without
credentials; therefore it does not prove globally blocked external egress.

## A008 GUI host

A008-0068 supports repository work directly from this standalone GUI (ADR 0029).
`A008_GUI_WORKSPACE` optionally selects an existing absolute working directory
at startup; cwd defaults to the host's launch directory. It applies to native
file tools, Git and shell commands. It does not automatically select a different
standalone memory store. Session snapshots expose optional `runtime.tools`
native catalog metadata. Tools → Repository shows the catalog, cwd and explicit
model-request shortcuts. See [GUI repository tools](GUI_REPOSITORY_TOOLS.md).

The shared executor offers `list_files`, `read_file`, `create_file`, `edit_file`
and `git` alongside `exec_command`. File edits require a matching SHA-256 and
one exact text occurrence; new-file creation refuses overwrite. Git receives
literal argv without shell expansion. All retain the established explicit
approval boundary and existing runtime budgets. Duplicate or unknown model tool
calls fail closed and name the id or tool. ACP stderr `memory>` diagnostics are
not concatenated onto unrelated turn errors. In the standalone GUI, tool activity
renders inside the assistant turn in the transcript, not as a footer above the
composer. The bundled standalone GUI may let
the operator choose Allow all for the current GUI session; this is local client
state that answers later permission requests and resets on reconnect, not model-
derived authority or a persistent policy. These tools do not create another
memory/provider owner.

`src/gui-host/` is the A008-owned Node process that makes the shared core
reachable from a browser without Agent Server. It is the product path in
ADR 0019 D2. `npm run gui-host` starts it against an already-built GUI;
`npm run gui` builds `gui/` first and then starts it on one origin.

The host serves `gui/dist` as static content when that directory exists, and
answers health, models, shell, upload, memory, and provider routes:

```text
GET    /health
GET    /v1/models              built-in + user-catalog chat models
GET    /v1/catalog/nvidia      live NVIDIA Build list (needs API key)
POST   /v1/catalog/nvidia      add a chat model to ~/.a008/catalog.json
DELETE /v1/catalog/nvidia?id=
GET    /v1/catalog/kie         curated kie.ai chat/image/video ids (no key)
GET    /v1/provider-settings   providers, models, key configured? (never the key)
POST   /v1/provider-settings   write-only NVIDIA/kie/OpenAI keys and provider settings
POST   /v1/images              generate; store PNG/JPEG in the source store
GET    /v1/blobs/:sha256/:name serve a stored generated image
GET    /v1/browser/frame-check  whether a URL's CSP/XFO allows the iframe
POST   /v1/shell
```

`POST /v1/shell` delegates to the existing `runTerminalCommand` in
`src/tools/terminal.ts`, so the GUI terminal and the CLI `/shell` command share
one implementation and one working directory. The renderer never executes a
command itself.

`WS /v1/session` uses the in-process fixed-project bridge and shared EngineHost
session facade (A008-0109); the registry owns its runtime. Frames follow ADR 0019 D4 with the additive ADR 0026 controls: the client sends `session/new`,
`prompt`, and `cancel`; the host answers `session/new/ok`, `thought`, `answer`,
`prompt/ok`, and `error`. Reasoning arrives as `thought` frames and is never
concatenated into an `answer` frame. No Agent Server schema and no OpenHands
TypeScript client participate. `session/control` and `session/control/ok`
carry the session operations and snapshots specified in HOST_PROTOCOL.md.

Credentials stay in the host process. `NVIDIA_API_KEY`, `KIE_API_KEY`,
`OPENAI_API_KEY`, optional secrets-file copies under `~/.a008/secrets.json`,
the optional NVIDIA endpoint
override, and memory settings are read from process environment or that file.
The renderer never reads a key. Outbound text is redacted so neither a
credential value, the literal tokens `NVIDIA_API_KEY`, `KIE_API_KEY` and
`OPENAI_API_KEY`, nor the string `authorization` reaches the renderer; the trade is that an answer
legitimately discussing those names is shown redacted. The host may call
NVIDIA catalog/image endpoints and kie.ai job endpoints; chat completions still
run through the shared local runtime.

The bundled renderer installs one standalone-auth recovery guard before React mounts. For same-origin `/v1/*` fetches only, an exact host PIN-gate `401 Authentication required.` response sends the browser back to `/`, where the existing login page owns re-authentication. The guard reads a cloned response, does not consume the caller body, and is disabled when a valid native `#engine=` capability is present. Other 401 responses keep their existing semantics.

Shell and source-upload fetches use `credentials: "same-origin"` so the browser
sends its existing HttpOnly PIN cookie to the GUI host. The renderer does not
read that cookie. Native engine headers remain supported. Omitting cookies from
these requests would falsely trigger PIN recovery after workspace observations
run on successful Connect (A008-0099).

Three boundaries protect the shell surface. Any request carrying an `Origin`
that is neither same-origin nor loopback is refused with 403 on every route and
on the WebSocket upgrade. Standalone hosts may additionally set the exact
six-digit `A008_GUI_PIN`: unauthenticated root requests receive a built-in login
page, successful login creates a random process-lifetime `HttpOnly`,
`SameSite=Strict` cookie, and every `/v1/*` route plus `WS /v1/session` requires
that cookie. Five failed attempts from one client cause a 60-second lockout;
`GET /health` remains public. `POST /v1/shell` additionally requires
`application/json`. The PIN gate is deliberately lightweight and does not
replace identity-aware edge protection for an Internet-exposed host.

Runtime failures retain their reason through host wire redaction. Explicit
spawned-ACP integrations retain SDK detail and subprocess stderr-tail recovery.

A008-0092 / ADR 0037 makes standalone session ownership recoverable across a
brief transport interruption. Every `session/new` receives a random 32-byte
resume capability and remains attached to its socket while that socket is live.
The host sends protocol pings every 25 seconds; if the previous ping is still
unanswered at the next cadence, it closes the dead peer. On disconnect it aborts
all in-flight prompt controllers immediately, unsubscribes socket observers, and
detaches the socket's sessions for a 45-second in-memory grace period. It does
not replay the aborted operation.

`session/resume` may claim only a detached session whose exact capability matches;
the new socket then owns the same ACP session and receives its current snapshot.
Invalid, already-attached or expired capabilities fail closed. Expiry performs
ACP `session/close`; explicit close and host shutdown invalidate the lease too.
`A008AcpAgent` remains the session-state owner and close implementation. A socket
that never opened a session still cannot create a runtime during cleanup.
The resume token never enters model/provider/memory context and is not persisted,
so reload, another device and host restart do not resume a session. Still-connected
sessions have no new idle timeout or total-session cap.

A008-0030 proved this chain end to end against a real host process, a real ACP
subprocess, the real local memory runtime, and a loopback fake endpoint. See
`docs/evidence/A008-0030_gui-runtime-proof.md`.

## Source upload ingest

`POST /v1/upload` is how a document or an image becomes evidence. The path is
split across host intake and runtime ingest. ADR 0041/A008-0109 now routes the
in-process bridge through the shared registry owner; it never creates a competing
SQLite runtime. The locator-only boundary from ADR 0020 D1 remains. A008-0130 adds no second store or attachment wire: clipboard paste, file picker, drag/drop and explicit absolute local filepath all converge on this same host/source-store boundary before the composer sends its bounded native-image attachment descriptor. The local-path mode never asks the renderer to read host file bytes.

```text
browser file/paste/drop -> POST /v1/upload (raw bytes, x-a008-filename)
explicit local path     -> POST /v1/upload (x-a008-local-path; host reads bytes)
        -> host: origin guard, byte cap, sniff, write same content-addressed blob
        -> _a008/source/ingest (locator only)
        -> agent: containment, read, sniff, extract, ingest()
        -> Artifact + Utterance + provenance
```

The host writes the original to `A008_SOURCE_STORE_PATH`, which is validated and
refused when it lands inside the repository, exactly as the SQLite path is.
Blobs are addressed by SHA-256, so the same upload twice yields one stored file
and one locator, and a source can be re-extracted later with a better extractor
without the user re-uploading anything. The declared filename is advisory: it is
sanitised to a single path segment and never decides the media type.

The host reads no file content and makes no provider call. It sends the
locator; the runtime resolves it, and rejects anything that escapes the
store root twice over — lexically on the locator's shape before the filesystem
is touched, then through `realpath`, which is the only check that catches a link
inside the store pointing out of it.

`src/ingest/` owns extraction as a port. A registry picks the first extractor
that claims the sniffed media type, and a type nothing claims raises a named
error carrying that type rather than falling through to a guess. Each extractor
sets its own provenance, which is the point of the port: text lifted out of a
document `appears_in` it and is spoken by the uploader, while a model's
description of an image is `derived_from` it and is spoken by the model.
Recording the second as the first would attribute a machine's account to a
person and let it through `user-assertion-v1` as a user assertion.

Image description is its own port rather than a `ChatMessage` shape, so the
provider-neutral core stays text-only and exactly one ingest-side file knows
about image payloads.

Wave 1 stores evidence and does not run the analyze/classify/commit coordinator.
That coordinator's staging input is a dialogue pair and its instruction is
written for one; document text through it would be a dialogue-shaped judgement
recorded as fact.

## A008 GUI client

Explicit GUI `endSession` always runs local teardown after its host close attempt,
including a rejected close. The promise still reports that failure. This matters
when project opening has already closed the previous v1 bridge: the existing
project callback catches the stale close, then Connect opens a fresh session
instead of retaining the previous ready state (A008-0100). Teardown discards the
old socket and resume capability and rejects pending local work; it does not
claim that a failed remote close succeeded.

`gui/` is an A008-owned Vite + React + TypeScript application. ADR 0030
introduces a neutral workspace inspired by the owner's Codex screenshot. It
imports no third-party client UI code, Canvas route or telemetry. `gui/src/app.tsx` is the shell; each feature module owns only its own
directory per ADR 0019 D7.

`useGuiSession` in `gui/src/session/` is the browser client for host protocol
v1. It owns one socket per mount, resolves its URL from `location` so the
production single-origin path and the dev proxy both work, and publishes
status, `sessionId`, model, separate `thought` and `answer` buffers, `error`,
`connect`, `prompt`, `cancel`, `controlSession`, and `endSession`. ADR 0026 adds
`details` (runtime snapshot), `busy` and transient `pendingText`. It does not connect on mount; the settings
pane offers an explicit Connect action. The hook-facing `connect` settles rather
than rejecting, because the settings pane fires it and forgets it, while the
underlying client still rejects for programmatic callers. Failure is carried by
`status` and `error`. After an established standalone socket is lost, the client
keeps the known session snapshot, clears session-scoped `Allow all`, rejects any
pending prompt/control without replay, and retries resume after 0.5, 1, 2 and
then 5 seconds (5-second cap). During recovery it uses the existing `connecting`
state without a fatal error banner. Successful `session/resume/ok` restores
`ready` on the same session; an expired/refused capability becomes an explicit
error and the next manual Connect starts a new session.

`gui/src/chat/` renders user text, the assistant answer, and streaming thought
as three distinct DOM channels, with the thought channel display-only. A
rendered-DOM test asserts that the answer node's text equals the answer exactly
and that thought text appears exactly once in the document, inside the thought
node. Current sessions render committed messages from the runtime snapshot and
overlay the pending user/thought/answer only while a turn runs. A prompt
acknowledgment ends the live marker; reset/undo/model changes synchronize the
display with the core. The older reducer/capture shim is used only when an older
host supplies no snapshot.

`gui/src/composer/` carries the A008-0029 slash set, `gui/src/terminal/` calls
`POST /v1/shell` rather than executing anything in the browser, and
`gui/src/settings/` plus `gui/src/brand/` own the shell chrome and A008
identity. No provider call, credential, or telemetry ships in the renderer.

### Session Code Canvas (A008-0091)

A completed assistant `html` or `htm` fence may become one transient Code Canvas
artifact in the existing GUI. The artifact is derived from answer content after
the turn completes; it is not a model tool result, repository file, memory record
or host-side object. Chat still uses the same `useGuiSession`/ACP/provider path.
Ordinary prose, streaming/incomplete fences and code above the 256 KiB UTF-8
ceiling remain ordinary chat content and cannot seed the preview.

Fenced code in chat and the Code Canvas Code tab are syntax-highlighted with
`highlight.js` 11.12.0 (`gui/src/highlight/`). Colours map to A008 theme tokens.
The sandboxed preview document is not highlighted. Blocks above 256 KiB stay
escaped plaintext.

`gui/src/artifact/` owns parsing, artifact state presentation and preview policy.
The Code tab edits only browser state. Preview uses `iframe srcdoc` without
`allow-same-origin`; the sandbox grants only `allow-scripts`. A policy prepended
before the artifact denies default/network/worker/frame/object/form/base access
and permits only inline script/style plus data/blob media required for local
rendering. A bootstrap also disables the common connection APIs in the sandbox.
No credential, ACP transport, shell runner, filesystem API or new HTTP/WS route is
passed into the artifact. The preview is therefore a content-rendering boundary,
not execution authority on the A008 host.

When a later completed model answer contains HTML, an untouched open artifact may
advance to that model version. If the user has local edits, A008 preserves them
and exposes an explicit Use model update action instead of overwriting them.
Reset/new conversation clears the transient artifact. Saving or applying code to
the workspace is deliberately separate: the model must still use the existing
`create_file`, `edit_file` or Git tools, with their existing approval/cancellation
boundary. There is no direct Save-to-repository path in A008-0091.

### Focused workspace (A008-0069, amended by A008-0070)

Left navigation selects Chat, Memory, Tools, Help or Projects.
Projects create, register or open a local workspace through host `POST /v1/projects/*`
preview/bootstrap/register/open routes. New-project bootstrap may write the A008-owned
Docs-First starter and optional policy after preview/confirmation. `Add existing`
is separate: it requires an already-existing directory, writes only the external
project registry, never initializes Git or changes project contents, and refuses a
root already registered under another entry. Global memory uses the registered
project identity as its namespace; existing unregistered/legacy memory is not
heuristically attached or migrated. The multi-agent bootstrap still records max
workers and an external worker-clone root without creating clones. Runtime details
are collapsed.
Chat has a centred transcript, collapsed thought blocks, and a rounded composer
with the existing commands plus a shortcut to model parameters. Closing the
parameter dialog restores focus to its opener. Navigation keeps chat mounted,
so drafts and in-session history survive. It does not create saved conversations.

Empty chat shows the owner ASCII mark (`gui/src/brand/a008-ascii.ts`) above
the start cards, then a rule and the heading. The mark is decorative
(`aria-hidden`). Behind that empty pane a transparent 4D starfield canvas
runs until the first message or generated image; `prefers-reduced-motion`
skips the animation loop. Empty chat also offers Review, Terminal, Browser, Files and Workbench shortcuts
(Ctrl+Shift+G, Ctrl+`, Ctrl+T, Ctrl+P, Ctrl+Alt+S). The chip dock can be hidden;
a Shortcuts control restores it, and the choice is remembered in localStorage.
Keyboard shortcuts still work while the dock is hidden. Workbench opens a floating
environment/sources card: git branch and change counts from host-shell
`git status -sb` / shortstat, session uploads, and clipboard ingest through
`POST /v1/upload`. It is not the tool catalog. Help hosts that catalog and the
shortcut reference. Tools keeps Terminal, Files, Browser and Upload as working
panes. The Browser pane is a sandboxed iframe; sites that set
`frame-ancestors` or `X-Frame-Options` (ChatGPT, NVIDIA Build, …) are not
framed. The host probes those headers and the pane offers Open in the system
browser instead. On a narrow screen the workbench card occupies the main area; the same
button closes it. `brand/themes.css` defines Neutral (the extracted current charcoal palette) and
Deep Space (blue-black/navy with restrained electric-blue interaction) as semantic
custom properties on `html[data-a008-theme]`. `brand/a008.css` aliases the older
`--a008-*` names onto that model so unmigrated feature CSS follows the selected
theme; `brand/workspace.css` is loaded last for shell and responsive composition.
Parameters → Appearance → App theme switches immediately. The choice is stored in
renderer-local `a008.preferences` as `{ appearance: { theme } }`, not in runtime
settings or session state. Missing or unknown values default to Neutral. Graph
and Memory kind colours use a separate `--a008-viz-*` family. The Code Canvas
host chrome may follow the theme; the sandboxed preview document does not.
See [ADR 0031](adr/0031-workbench-context-and-memory-map.md) and
[ADR 0038](adr/0038-global-app-theme-system.md).

### GUI session operations and parameters (A008-0065)

The composer and its Session commands menu implement every interactive CLI
command and alias. History shows committed user/assistant text; status/cwd
report facts from the same ACP runtime. Reset keeps system/model/settings,
undo removes a committed pair, and model switch opens a fresh local-memory
conversation within the owned ACP session. End session releases it and leaves
the page running. These operations do not delete saved memory.

The header Parameters dialog includes Appearance, which selects Neutral or Deep
Space without a connected session. Model, Provider, Budgets and Instructions
remain session/runtime controls. Appearance is renderer-local only.

The header Parameters dialog uses endpoint capability metadata from GET
/v1/models. Stream, temperature omission or 0–1, top P, total generated-token
budget, supported reasoning toggles/budgets/efforts, seed and stop sequences
are applied as a complete per-session configuration. Null survives default
merges and omits the provider field; temperature 0 remains an explicit value.
The reasoning budget is omitted while reasoning is disabled. Input tokens and
semantic-memory processing are outside the chat output budget. Values and
model-specific exclusions are validated before the provider call.

`LocalMemorySession` owns this configuration. Chat uses the existing transport;
retrieval/analyzer/classifier options remain independent. ACP advertises its
custom control capability only when the composition registers the method.
The host serializes controls with prompts, checks socket ownership, cleans up
failed/new sessions and refuses unsupported controls on older ACP bridges.
Cancellation holds the busy state through the terminal acknowledgment.

At 850px and below Chat, Memory, Tools and Help each use the full workspace width.
Tools retains Terminal, Files, Browser and Upload; the Chat workbench card covers
the conversation while open. Navigation preserves chat, draft and workbench state.
The modal traps focus natively, restores it on Escape or close, and scrolls
independently on a phone-sized viewport.

See [ADR 0026](adr/0026-gui-session-controls.md) for endpoint sources and
[the proof](evidence/A008-0065_session-controls-proof.md) for browser/payload gates.

## Evidence lifecycle (L2)

A008-0081 implements ADR 0035 P1-P5 in the existing knowledge engine. The
[constitution](KNOWLEDGE_MEMORY_MODEL.md#72-the-lifecycle-record) owns the
policy, occurrence and migration rules. Claims receive validated severity from
the existing analyzer; one operation time evaluates a persisted exponential
baseline. Direct dormant matches stay eligible. Inspection exposes baseline and
evaluated values; model projection contains no lifecycle numbers.

Live reinforcement resolves one invocation-local handle to one stored claim and
requires independent support from the original message or attributed source.
The analyzer names that support as an exact quote; staging resolves it to a
span. Entity commit reuses an existing registry identity when a later label
slugs to the same id (`HTML5 Canvas` / `html5_canvas`) instead of refusing a
duplicate register.
Restatement reuses canonical evidence where acceptance permits. Writes execute
synchronously after asynchronous comparison: refresh stale state under the
SQLite write lock, validate the target/source, then commit evidence, state,
boost, receipt and audit together. In-memory writes restore the prior snapshot
on failure. Reads never call these writes. Schema 3 converts legacy baselines
without inventing severity, history or elapsed age; see the constitution's
backup/restore procedure. Settings format 4 holds advanced creation policy in
the existing runtime owner; existing-client saves preserve it.

The v0 compatibility engine retains its old contract.

## SQLite persistence boundary (A008-0101)

The context refreshes a stale revision under the existing immediate write lock,
captures a before snapshot, runs the complete synchronous operation and persists
the before/after row differences. Nested mutations share that transaction.
`sqlite-rows.ts` owns one row serialization for incremental writes and explicit
bulk replacement; the schema and knowledge semantics are unchanged. Rows use
their existing composite keys. Removed rows are deleted, changed rows upserted,
and unchanged rows execute no mutation SQL. Derived entity-label, semantic-label,
slot and FTS indexes commit with their owning records. FTS preserves repeated
historical binding entries and replaces only changed record groups.

Failure rolls back SQLite and reloads the context. Revision tracking incorporates
local FTS writes completed at commit while retaining the external data version
observed under the lock, so a concurrent post-commit write cannot be masked.
Explicit persist still rejects stale context. Bulk namespace replacement remains
available for migration/import callers; ordinary context writes never clear it.
Snapshot capture, serialization and comparison remain proportional to project
size. This change reduces SQL write volume, not in-memory working-set size or
all processing to constant time. Reads and lazy L2/L3 decay remain write-free.

## Independent association lifecycle (L3)

A008-0082 implements ADR 0035 P6 alongside RelationIndex. Its
[constitution contract](KNOWLEDGE_MEMORY_MODEL.md#75-independent-semantic-associations)
owns identity, source proof and numeric policy. A directed edge is keyed by the
project namespace, canonical endpoints, exact semantic relation and sorted unique
applicability scope. No binding interval or endpoint strength participates.

`association-commit.ts` captures runtime claim/entity handles before the existing
asynchronous comparator. The comparator may independently propose source-supported
associations, including a handle for the actual newly committed/reused proposal
claim. Runtime resolves unchanged endpoints and checks source locator/content and
edge-specific bounds under the existing transaction lock. Unresolved/unproven
edges are skipped with diagnostics. No new entities, truth or state are created
by the association strength operation, and no extra model call is made.

`association-lifecycle.ts` owns independent metadata, creation/recurrence receipts
and audit. It shares only pure exponential arithmetic with evidence lifecycle.
Creation defaults are strength 0.4, half-life 45 days, threshold 0.2, boost 0.2,
cap 1; numeric policy is stored once per edge. Read-time evaluation never writes.
One-hop expansion skips a dormant or inapplicable edge, then independently checks
endpoint evidence eligibility. A failed route cannot consume deduplication and
block a valid alternative. No edge score, ranking change or recursive propagation
is introduced. Existing runtime applicability scopes are passed explicitly; labels
or domains cannot impersonate them.

Knowledge schema 4 atomically adds metadata/receipt/audit tables. Existing L2
baselines and all namespaces survive unchanged; pre-L2 stores still receive the
accepted L2 conversion. Legacy links have no invented strength or proof. Graph
lines remain inventory; outgoing record detail contains the separate baseline
and evaluated association values. Scoped variants share a graph line and retain
their separate detail. Model projections do not carry these numbers.

Offline acceptance and regression evidence is in
[test/knowledge-model/association-lifecycle.test.ts](../test/knowledge-model/association-lifecycle.test.ts)
and the [L3 charter](tasks/A008-0082_association-lifecycle.md). No live model
judgment, user-data upgrade or running-application restart is claimed.

## Structural entity references and relation contract (A008-0122)

`entities[]` from post-output extraction denotes distinct referents. The entity registry resolves each label independently through deterministic lexical identity, so slug-equivalent forms such as `React` and `react` reuse one entity while co-mentioned values such as `gui/package.json`, `gui/package-lock.json`, and `React` remain separate identities. Preferred display spelling is stored independently from the canonical ID. Structured proposition ownership determines statement-slot ownership where present; unstructured fallback uses a proposition-specific statement identity and never `entities[0]`.

`ClaimEntityReferenceStore` owns structural claim↔entity membership. Schema 5 persists it in `A008_knowledge_claim_entities`; the inspection graph projects it as `entity_ref`. These links are referential topology only: they have no semantic relation type, support span, strength, reinforcement, decay, or association lifecycle. `RelationIndex` remains the sole owner of independently classified L3 semantic associations.

Batch relation classification receives deterministic handles for current-batch entities before proposal commit, plus `structuredProposition` for new proposals and stored candidates when available. Single and batch classifier instructions compose the same explicit relation-type and association-evidence fragments; neither refers to an unseen prompt. Severity remains absent from relation comparison and continues to be lifecycle-only.

Inspection exposes each record's direct `storedDomains` plus projection-only `effectiveDomains` and `primaryEffectiveDomain`. Entity effective domains derive from connected claims; utterance/artifact/provenance display grouping derives from supporting claims. Derived domains are never persisted back onto entity semantics.

Dialogue staging carries the final assistant answer separately from the original user message. A dialogue proposal is eligible for `user-assertion-v1` only when runtime verified support resolves inside the original message. Answer-only discoveries are ingested as assistant utterances, remain asserted rather than user-accepted, and preserve assistant attribution/provenance. Existing development stores with pre-0122 alias-collapsed topology are not migrated or backfilled.

## Semantic-memory core

### GUI memory diagnostics (A008-0064)

The header's Memory navigation opens three read-only views: Memory Overview,
Memory Relationship Map Graph and Memory Knowledge Manager. The existing chat
and composer stay mounted while hidden, preserving transcript, session and draft.
The page refreshes on entry and on explicit Refresh, records the read time, and
aborts obsolete client requests. It does not poll or cache memory in localStorage.

`GET /v1/memory` reaches custom ACP `memory/inspect`, then
`LocalMemoryRuntime.inspectMemory` and `inspectKnowledge` on the same knowledge
context chat owns. No provider invocation or additional SQLite owner is created.
The contract and limits are specified in [HOST_PROTOCOL.md](HOST_PROTOCOL.md).

Overview shows actual inventory, lifecycle and contested-slot counts plus domain
attachments. Knowledge Manager provides substring search, surface/domain/status
filters, pagination and escaped stored details. It offers no mutation actions.
The graph shows only stored connections among its bounded nodes. A008-0084
refines ADR 0031's domain-clustered layout: deterministic circle packing separates
primary domains around a hub chosen by displayed link count. Stable ID ordering
breaks ties; selection changes emphasis, never coordinates. Bounds grow instead
of clamping nodes together. Kind colours remain intact even on the selected hub;
node size reflects displayed links and dashed rings identify dormant evidence.

Labels prioritize selected/hovered records, their neighbours and cluster leads;
collision checks omit crowded labels, never records. Full labels remain in native
titles, a caption and the inspector. Curved lines represent only stored edges.
The inspector lists exact incoming/outgoing/self relations and navigates their
existing endpoints; parallel relations remain separate entries. Its link count
means displayed stored links, not unique related records or the complete store.

Focus mode hides unrelated records and frames the selected neighbourhood without
changing its positions. Fit restores the current frame; zoom and native scrolling
work on desktop and narrow screens. The inspector follows the graph below the
existing responsive breakpoint. Distances make no similarity claim; domain
shading and reads do not create/reinforce edges or activate evidence. Graph limits
remain 80 records and 240 links. Empty, unavailable, loading and truncated states
are explicit; the inventory includes evidence a chat projection may omit.
The isolated synthetic preview and verification recipe are in
[gui/test/README.md](../gui/test/README.md); no preview route enters production.

### Memory runtime

The memory capability is an independent provider-neutral application surface
now constructed by local CLI/ACP composition:

```text
local CLI/ACP composition
  |- write -> PostOutputMemoryCoordinator
  |          |- PostOutputKnowledgeIntake (once)
  |          |  `- model-backed analyzer ----.
  |          `- KnowledgeEngineCommit
  |             |- model-backed ID-free batch classifier (once) ----.
  |             `- validated sequential INGEST + ACCEPT + RECONCILE/UPDATE
  |                                                |
  |                      shared stateless generator <--'
  |                              `- existing ChatTransport
  `- read  -> KnowledgeMemoryReader
             |- DEFINE / RETRIEVE / EXPAND / FILTER / COMPOSE / PROJECT
             |- direct slot/entity/exact match ignores lifecycle
             `- PROJECT writes nothing; sectioned payload mapped to envelope

Knowledge SQLite (live)
  |- SqliteKnowledgeStore (interval, evidence, lifecycle families)
  `- v0 A008_memory_knowledge rows migrate into unknown-bounded intervals

v0 compatibility
  |- InMemoryMemoryRepository
  `- SqliteMemoryRepository (KnowledgeItem canon/audit)

separate control query -> v0 memory audit events
separate history query -> slot interval list (live) or supersede chain (v0)
```

Live knowledge state is current open bindings (`validTo = null`) plus closed
intervals for history. Evidence lifecycle is `active`/`dormant` on utterances,
claims, events, and artifact summaries only. `KnowledgeItem`
`current`/`superseded` plus `active`/`dormant` remains the v0 compatibility
record; live CLI/ACP do not write it.

`SemanticMemory.reconcile` applies caller-supplied `new`, `restatement`,
`extend`, `supersede`, or `conflict` decisions. It performs no extraction,
semantic classification, provider call, network access, or environment read.
Restatement preserves the canonical ID/proposition and reinforces the existing
item; extend uses the caller-approved enriched proposition; supersede retains a
linked historical item; conflict records audit without changing canon.
An optional expected-revision guard is validated inside the same repository
transaction before any transition or audit mutation; stale, missing, or
superseded guarded candidates fail with `stale_state`.

`discover` queries current canon including dormant relevant candidates.
`project` reinforces only in-scope or hard-required records, then evaluates the
record threshold or `keepAlive`. Scope misses do not decay. Policies control
relevance, boost, and rank order but cannot rewrite canonical contents.

The hybrid reader accepts verified runtime IDs, the current message, task
scopes, and at most two bounded recent raw turns. A model-backed scope classifier first returns an explicit retrieval-necessity decision plus bounded direct/related domains and tags. A successful `retrieve=false` decision produces an empty projection without touching the knowledge store. Classifier failure is fail-open and falls back to the deterministic lexical path. Longer lexical queries require two independent content-token overlaps, while short queries may still match one strong term. Its deterministic planner
derives retrieval labels and queries but never selects knowledge IDs. Candidate
channels are bounded independently, merged by canonical ID, and scored once.
Candidate admission, projection eligibility, and persistent activation remain
distinct. Optional vectors require injected precomputed embeddings; absence
degrades to the remaining channels without a provider call.

Projection materializes ID plus proposition, kind, tags, scope, and authority
as stable JSON. It excludes provenance, activation/canonical metadata, selection
trace, and audit. An injected measurer enforces a hard limit on that exact
string; v0 provides exact UTF-8-byte accounting. Required and `keepAlive`
records fail explicitly if absent, ineligible, or over budget. Projection
failure rolls back reinforcement and audit changes.

`projectSelected` is the hybrid path's read-only projection operation. It
re-reads canonical records, attempts required and keep-alive items first, and
materializes only current active records. Dormant candidates remain visible in
separate evidence but are neither projected nor mutated.

`SqliteMemoryRepository` accepts an explicit file path and validated
`ProjectId`, owns schema v1, validates canonical state on open, atomically
persists knowledge plus audit, and maintains project-scoped FTS5/tag/entity/
domain/optional-vector indexes. It is a durable single-process local adapter,
not a multi-process or production privacy claim.

## Memory-aware application orchestration

`MemoryAwareChatSession` fixes parsed project/conversation/agent identity and
parses one runtime task per turn. It takes at most the last two committed raw
user/assistant messages, reads memory once, validates that the result repeats
the verified context, composes a deterministic prompt, and calls the existing
`ChatSession` once.

The fixed system context says that retrieved content is reference data rather
than instructions. The stable user JSON contains only materialized proposition,
kind, tags, scope, authority, and the original message. Runtime IDs, knowledge
IDs, retrieval evidence/plans, scores, lifecycle state, provenance, audit, and
the projection's control serialization are excluded.

Provider-visible history is bounded independently of full in-memory committed
history. The exact outgoing role/content array is UTF-8-byte budgeted before
transport. A successful turn commits only original user and assistant messages;
synthetic context is ephemeral. Pre-transport failures make no call or state
change, provider failures retain normal rollback, and overlapping turns are
rejected.

CLI and A008 ACP now construct this orchestration through
`createLocalMemoryRuntime`. That root supplies a local identity profile, one
SQLite namespace, and the existing transport. Provider-backed
planning/embeddings, exact model-token measurement, privacy/user controls,
server topology, Agent Server conversation binding, and durable background
repair remain unimplemented.

## Reasoning and post-output staging

Provider reasoning is a separate ephemeral channel. The NVIDIA adapter returns
it as `ChatCompletion.reasoning` and emits reasoning deltas. CLI writes those
deltas to stderr and ACP maps them to thought chunks, while `ChatSession`
commits only `completion.message`. Consequently reasoning is absent from chat
history, bounded retrieval history, and later provider-visible messages.

`PostOutputKnowledgeIntake` establishes a narrow provider-neutral staging
boundary. It validates runtime context outside the analyzer and allocates a new
analyzer input containing exactly normalized original message and final answer.
It explicitly materializes only proposition, kind, tags, domains, entities, and
confidence from untrusted analyzer output. Caller-verified scopes and
conservative authority, relevance, activation, source-backed, keep-alive, and
provenance defaults remain runtime-owned.

Staging normalizes semantic labels, rejects duplicates and malformed results,
enforces structural limits plus an exact stable serialized-batch budget, and
returns defensive proposal batches. It has no repository, memory service,
provider, environment, or network port and therefore cannot write canon or
indexes. The separate concrete analyzer adapter delegates a strict JSON call to
an injected stateless generator; automatic/background integration remains a
later boundary.

## Stateless semantic JSON model calls

`ChatTransportSemanticJsonGenerator` owns history-free structured model work
over one injected existing `ChatTransport`. It constructs exactly one fixed
system message plus one stable `{ operation, input }` user envelope, measures
the exact serialized role/content array, forces non-streaming mode, and makes
one transport call. It does not use `ChatSession`, so semantic prompts and
responses cannot become committed dialogue.

`ModelBackedPostOutputKnowledgeAnalyzer` supplies only normalized original
message and final answer. `ModelBackedKnowledgeRelationClassifier` supplies the
existing exact ID-free proposal/candidate envelope. Both may share one generator
and therefore one transport/model configuration without constructing another
provider implementation or credential owner.

The runtime uses the existing generation capability registry for semantic top P
and output ceilings. Explicit null omits top P for Kimi K3; it cannot be restored
by the generator default. Luna semantic JSON calls use reasoning effort `none`
while chat defaults to `medium`, preserving the existing deterministic
`temperature: 0` semantic profile. Other models retain their fixed semantic
sampling.
The classifier instruction distinguishes the input envelope from the output
decision and gives concrete JSON shapes (A008-0083).
A008-0085 adds serialized, fictional extractor examples covering empty social
exchange, a greeting with a durable fact and an ingested source. All example
outputs pass the existing stager. Analyzer support is an exact `quote` from the
original message or ingested source (optional 1-based `occurrence` when the
quote repeats). Runtime computes canonical UTF-16 `start`/`end`; model-supplied
offsets are ignored. Newline encoding is the only mechanical variant. A rewritten
quote may still reinforce when the proposition itself is a unique exact
substring of the original source. A quote that exists only in the answer is
omitted, not treated as malformed. Missing or ambiguous quotes skip
reinforcement and keep the proposal. The instruction describes types in prose
instead of displaying JSON-like pseudocode.
Completeness applies only after a durability eligibility gate. Routine execution
narration, transient workflow state, immediate requests and one-off occurrences are
not promoted into durable preferences, habits or standing goals unless the source
explicitly establishes persistence. Assistant-answer-only discoveries require a
higher durability threshold. Extracted entities are instructed to name stable,
independently identifiable referents; generic concepts belong in tags/domains.
No runtime greeting blacklist is added. Invalid-response diagnostics identify the
model and semantic operation, retaining strict failure and the bounded response
excerpt. Provider/cancellation failures retain their original error identity.

Only non-empty strict JSON assistant content is returned. A single whole-content
Markdown fence may be unwrapped (ADR 0012 D6); prose, fragments and malformed JSON
fail closed. Provider reasoning is ignored; finish reason is diagnostic only.
Parsed results remain untrusted until existing intake and relation-gate validators
explicitly materialize allowed fields and handles.

An optional `SemanticOperationContext` forwards one `AbortSignal` from process
or resume through the relevant semantic port to `ChatRequest.signal`. Analysis
cancellation remains `staging_failed`; classification cancellation remains
`commit_failed` at the same proposal checkpoint. Local CLI/ACP composition
injects the existing transport/model/budget and invokes the coordinator after
each delivered answer.

## Relation-gated write orchestration

`IndexedRelationCandidateSource` turns one staged proposal into one bounded,
project/scope-constrained exact/entity, lexical, tag, and domain candidate
search. It uses no semantic vector or provider. Hits are deduplicated and
deterministically ordered, then materialized through `SemanticMemory`; dormant
current items remain valid comparison evidence.

`RelationGatedMemoryCommit` revalidates the staged batch and gives an injected
classifier an exact-budget semantic envelope. Candidate handles are local to
the call. Project/runtime/knowledge IDs, revisions, scores, retrieval reasons,
provenance, audit, history, and provider reasoning are absent. Runtime validates
`new`, `restatement`, `extend`, `supersede`, or `conflict` from field `type` or
alias `relation`, maps only known handles to durable IDs, and passes every
materialized ID/revision into guarded reconciliation. Names are trimmed and
case-folded; JSON `null` is omitted; unknown or conflicting names fail closed
with the returned value.

Canonical SQLite state plus FTS/tag derivations commit atomically. A successful
non-conflict then attempts one staged entity/domain document upsert. The result
is explicitly `updated`, `not_required`, or `pending_repair`; the latter carries
a copied bounded document that `repairIndex` can retry without a second
classifier or reconcile call. One service instance rejects overlapping commit
and repair operations.

The boundary is constructed by the local CLI/ACP composition root over the
shared stateless generator. Model-backed relation classification receives the
staged proposals as one bounded batch. It compares them with the pre-existing
claim surface and permits a later proposal to target only an earlier proposal
handle from the same batch. The returned decisions remain untrusted until A008
validates every handle and applies them sequentially through the existing
knowledge commit path. Injected legacy classifiers without a batch method keep
the old per-proposal path; a real multi-item model batch never silently fans
back out into N provider calls.

## Sequential post-output coordination

`PostOutputMemoryCoordinator` allocates one exact staging input from task ID,
original message, final answer, and verified scopes, then calls staging once.
For a batch-capable live committer it requests one relation-classification batch
and consumes contiguous proposal-indexed results. Each validated decision is
then applied sequentially through the same acceptance, provenance,
reinforcement, reconciliation and persistence code used by single commits.
Thus N extracted proposals use one extraction model call plus one relation model
call, while canonical mutation remains ordered and A008-owned.

The coordinator returns `completed`, `staging_failed`, `commit_failed`, or
`index_repair_required`. A commit failure checkpoint identifies the same
unprocessed proposal; `resume` does not restage or replay earlier records. A
pending index result is a barrier because later candidate discovery could
depend on missing entity/domain metadata. `repairAndResume` retries only that
document, changes the existing record to `updated`, and continues with the next
proposal without a second classifier or reconciliation for the repaired item.

Checkpoint validation covers identity kinds, exact staged serialization,
contiguous records, next-index range, and latest pending-document consistency.
Containers are copied defensively and one coordinator instance rejects
overlapping operations. Checkpoints are in-memory control state only. Local
surfaces await one turn's post-output, including one automatic index repair;
there is no durable queue, scheduler, or retry timing.

`npm run benchmark:memory-loop` builds a deterministic committed loop over
actual in-memory SQLite and one shared fake transport. It performs chat,
knowledge analysis, relation classification, guarded `extend` plus index
update, then a second chat read. The first turn projects active revision-one
meaning and the second projects revision two under the same canonical ID.
Structural assertions cover bounded two-message dialogue,
separate reasoning/content, stateless semantic requests, canonical/audit state,
and reasoning/control-ID exclusion. It deliberately does not prove automatic
activation of a brand-new dormant draft. Reported timings are observations, not
guarantees.

## Local CLI and ACP memory composition

`createLocalMemoryRuntime` is the live local composition root. By default it
constructs `EmbeddedAcmeChatTransport` and passes A008-owned registry/catalog
metadata, credentials, endpoints and execution controls into
`acme-engine@0.1.4`; no separately started ACME process or
`A008_ACME_MODEL_RUNTIME_URL`/token/build configuration is needed. The embedded
runtime is rebuilt for subsequent calls when the user catalog fingerprint
changes. Explicit `A008_CHAT_TRANSPORT=direct` uses the existing direct provider
dispatch. Explicit `A008_CHAT_TRANSPORT=acme` retains the remote compatibility
mode, where `A008_ACME_MODEL_RUNTIME_URL` is required and optional token/build
settings describe that remote runtime. NVIDIA-hosted embedded profiles share the
A008 NVIDIA endpoint; OpenAI and KIE-compatible routes use their A008-owned
endpoints and keys. The A008 runtime then opens a SQLite file outside the repository,
resolves a stable project ID, migrates any v0 supersede chains into intervals
with unknown boundaries, and wraps one transport for both chat and stateless
semantic calls.

Each CLI process or ACP session gets one conversation ID. Each turn allocates a
fresh task ID, reads the knowledge engine, streams the answer, then awaits
post-output. `ACCEPT` policy `user-assertion-v1` may accept a verified user
assertion; it does not write `keepAlive`, strength, or activation onto state.
Assistant-only extraction stays unaccepted. Restatement `REINFORCE`s evidence
only. `PROJECT` writes nothing. Direct matches ignore evidence dormancy.

Debug tracing is off by default. Safe/raw JSONL files are optional and
secret-redacted. CLI may emit safe `trace>` lines to stderr. ACP stdout stays
protocol-only. HTTP traces carry `httpCallId` and
`operation=chat|knowledge_analysis|relation_classification`. `turn_complete`
records `chatStatus` and `memoryStatus`.

Live read uses `KnowledgeMemoryReader` over SQLite knowledge tables. Direct
matches ignore evidence dormancy. Vector RAG remains a v0 optional adapter, not
live. See `docs/LOCAL_MEMORY_SURFACES.md` and `docs/DEBUG_TRACE.md`.

## Runtime identity core

Runtime identity is an independent control-plane surface:

```text
RuntimeIdentityFactory / parseRuntimeId
  -> A008_v1_<project|conversation|task|agent|acp_session>_<UUIDv4>

complete verified context
  -> AcpIdentityBindingRepository
     `- InMemoryAcpIdentityBindingRepository (reference adapter)

A008-acp session/new -> canonical acp_session ID only
local CLI/ACP composition -> configured project, session conversation,
  process agent, and per-turn task
SQLite memory adapter -> validated project ID as hard namespace
MemoryAwareChatSession -> validated project/conversation/task/agent envelope
```

Runtime IDs are branded by kind for TypeScript and fully parsed at runtime. The
format uses a fixed A008 prefix, v1 marker, kind, and lowercase UUIDv4. It stores
no user, path, prompt, task-description, or other semantic content. Product
runtime task IDs are distinct from docs-first addresses such as `A008-0007`.

`AcpIdentityBinding` links project, conversation, runtime task, agent, ACP
session, and bounded namespaced external references. Registration is idempotent
for an identical binding. ACP session and external handles are unique. Multiple
sessions may share a conversation only with the same project and agent; task
may differ. The in-memory adapter serializes concurrent registrations, commits
working-copy indexes atomically, and returns defensive records.

External references and bindings are routing/control state, not knowledge or
model context. The adapter is not durable. No Agent Server conversation binding
is registered; local CLI/ACP sessions use process/session-generated
conversation, agent, and task IDs under one configured project namespace.
Persistence of those bindings, external intake, lifecycle/migrations,
accounts/ACLs, and load/resume remain unimplemented.

## Multi-agent operation

The repository has a documented multi-agent control policy in
`docs/MULTIAGENT.md`. It defines isolated write units, operator locks, handoff,
and evidence order. Future writing clones or worktrees are allocated under the
external worker root `C:\code\A008-workers`, never inside the canonical
`C:\code\A008` tree. A008-0004 through A008-0015 have allocated worktrees. No
A008-specific process server or hard concurrency enforcement exists yet.

## Security boundary

Git ignore rules contain raw legacy material and common credential files.
The legacy key was revoked/rotated by the owner, but ignoring does not sanitize
the raw source. The replacement key is local environment input and is not read
by core or tests. A008-0005 also left `.env.local` unread and supplied only a
fixed test key plus loopback URL to the ACP process. The ACP process receives
credentials only through its process environment. Its optional endpoint
override is operator-controlled and must not be derived from chat input. Live
calls, host-agent tools, extensions, packaging, and production services remain
unavailable until their tasks define explicit credentials, permissions,
sandboxing, costs, egress, and gates.

The provider-neutral memory logic has no provider, environment, or network
dependency. The optional SQLite adapter is a filesystem/database boundary that
receives its path and project namespace explicitly; it reads no credential or
environment configuration. Provenance is excluded from context but may still
contain sensitive data. The adapter is approved only for local technical proof;
persistent user data remains prohibited until classification, authorization,
encryption, retention, deletion, and export policies are owned.

The memory-aware orchestration code likewise reads no environment, credential,
file, database, or network directly. Its prompt strips routing and memory
control data. Canonical propositions can still contain adversarial text; JSON
data framing and a fixed trust instruction reduce authority confusion but do
not establish complete prompt-injection resistance.

The post-output intake service receives no reasoning or complete provider
result and owns no write port. Its staged drafts remain untrusted. The separate
relation gate exposes only materialized meaning and local handles to its
classifier; it retains control IDs and canonical authority at runtime. The
benchmark and relation tests use in-memory SQLite and fake/local components
only.

The semantic JSON generator can reach a provider only through its explicitly
injected `ChatTransport`; it owns no credential or endpoint. Fixed system
instructions frame operation inputs as untrusted data, exact budgets apply
before transport, and only strict assistant JSON is returned. Provider
reasoning and operational metadata are discarded. This narrows authority but
does not establish model-output truth or complete prompt-injection resistance;
the downstream runtime validators remain mandatory.

The sequential coordinator copies only the already-approved staging input,
keeps checkpoints out of semantic/model context, and treats an incomplete index
as a stop condition. Local composition attempts one repair then reports the
outcome without rewriting the answer. Checkpoints may contain sensitive runtime
correlation IDs and are not authorized for persistence by this slice.

Opt-in debug tracing is off by default. Safe and raw JSONL sinks never record
authorization headers, API keys, or environment dumps. Raw mode may persist
prompts, projected memory, reasoning, answers, and semantic JSON after explicit
opt-in. Trace IDs stay out of model context. ACP stdout remains protocol-only.

The identity core likewise has no provider, environment, filesystem, database,
or network dependency. External references are excluded from model context but
may be sensitive correlation handles; persistent use requires the same owned
privacy, authorization, retention, deletion, and export policies.

## Authority order

For observed current reality, when evidence disagrees:

1. Executable or working-tree evidence.
2. `docs/CURRENT_STATUS.md` and this implemented-system document, corrected with
   the same change.
3. Accepted decisions and contracts.
4. The frozen active charter.
5. Agent reports, runtime logs, and chat summaries.

This order establishes what exists, not what is authorized. Implementation
authority comes from the Core Product Contract in `docs/PROJECT_BRIEF.md` and
its accepted detailed decisions, bounded by the frozen task. Existing code,
tests or stale descriptions cannot authorize new policy or override a required
outcome. Record a discrepancy and route it rather than treating it as permission.

## Implementation necessity

ADR 0034 adopts the Necessity Gate in `docs/TASK_WORKFLOW.md`. The brief owns
PC-01 through PC-06; the workflow owns the gate; task charters record arguments
and Verification records results. Entry and contribution guidance route to
these owners. The operator reviews before Ready/delegation, implementers recheck
material changes and the final diff, and updated contracts require revalidation.

This is a repository working rule, with no runtime enforcement or semantic
scoring engine. It preserves existing product exceptions and the operator's
allocation/integration responsibilities. Main's current-task file remains an
empty copy of the updated template.

## Shared project runtime owner (A008-0107)

`src/engine/project-runtime-registry.ts` owns canonical project runtime reuse and
disposal. EngineHost retains session/panel/tool lifetime and can borrow an
explicit registry. Strict existing-store attachment recognizes persisted
namespace metadata, artifacts or initialization records (and empty-store sidecar
identity), preserving existing SQLite/source bindings. Incremental evidence
writes need not create transition-counter metadata. Same-process claims exclude
competing owners; distinct namespaces can share a database. A008-0108 adds cross-process
SQLite namespace leases to this registry. Short sidecar-initialization leases
serialize identity selection. Lifetime leases use separate SQLite lock files,
held without application state and never unlinked; OS locks release on process
death. A008-0109 extends leases to direct local runtime factories used by CLI/ACP,
and moves standalone to the shared session facade. Internal registry construction
passes its already-held lease explicitly to avoid recursively acquiring it.

## V2 authentication and session transport (A008-0110/A008-0112)

`src/gui-host/v2-auth.ts` owns discovery, principal/capability checks and scoped 30-second one-use tickets. DeviceRegistry reads current hashed credentials from its separate local SQLite registry on each operation. Owner-local device-cli grant/list/revoke has no HTTP equivalent. V1/PIN/panel routing is unchanged.

`WS /v2/session` uses subprotocol `a008.v2`. `src/gui-host/v2-websocket.ts` owns first-frame ticket admission, five-second authentication timeout, the 4-KiB pre-auth/1-MiB authenticated frame limits, socket authority checks and structured V2 errors. `src/gui-host/v2-session.ts` owns V2 session attachment over the existing `ProjectRuntimeRegistry`/`EngineHost`; it does not create another runtime owner. One connection binds to one principal/project and at most one attached session. Session new/inspect/prompt/cancel/control and tool permission commands recheck current device/project/session capability before runtime work.

Device revoke or expiry discovered by the live authority check closes the socket, cancels its owned work and resolves pending permissions denied. Tool permission IDs are one-use and bound to the owning connection/session. Outgoing V2 frames pass the existing credential-redaction boundary. A008-0112 deliberately does not implement Stage-4 sequence numbers, snapshot subscription boundaries, terminal turn outcomes, reconnect/resume or command-idempotency receipts. See [CLIENT_AUTH.md](CLIENT_AUTH.md) and [CLIENT_API_V2.md](CLIENT_API_V2.md).
