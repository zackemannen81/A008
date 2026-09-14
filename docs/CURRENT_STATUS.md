# Current Status

Reality as of 2026-09-15. This document records observed state; intended design
belongs in `docs/PROJECT_BRIEF.md`.

## What exists

A008-0108 adds cross-process namespace leases for registry-backed engines, with
serialized sidecar initialization and automatic OS release after exit/crash.
Real child-process checks verify conflict-before-factory, canonical aliases,
simultaneous first open and independent namespaces in one SQLite file. Legacy
standalone/direct CLI/ACP composition remains outside this guard until migrated;
the combined deployment and V2 gate remain open.

A008-0107 extracts ProjectRuntimeRegistry and makes EngineHost borrow or own it.
Canonical workspace aliases reuse one runtime; explicit existing attachments
validate project identity, SQLite namespace and source paths. Same-process
competing workspace/namespace owners fail before runtime creation. Multiple
project namespaces can still share one SQLite file. Borrowers close their own
sessions; the registry refuses disposal while sessions remain. Engine layout and
v1/ACP panels are unchanged. Standalone facade migration and cross-process
coverage of legacy owners remain stage-2 work; no V2 availability is implied.

A008-0106 accepts ADR 0041 and CLIENT_API_V2.md for the next implementation stages.
Stage 1 is complete: v1 contracts/inventory and the V2 decision gate are covered.
V2 endpoints, shared project/session facade, device auth and recovery guarantees
remain accepted targets, not implemented availability.

A008-0105 completes the shared v1 HTTP transport contracts: 35 schema components,
21 inventory rows / 22 HTTP methods and generated OpenAPI 3.1.1. Host/core/GUI
types share the package; existing client parsing/tolerance and runtime policy
are preserved. All operations pass real-host checks using synthetic providers,
memory and temporary filesystem state. Tests: 576 core, 4 membership, 161 GUI,
zero skips/failures; independent installed package and portable engine proof pass.
GUI build/typecheck passes (532.56 kB main JS, 161.06 kB gzip), retaining size and
dependency annotation warnings. HTTP/WS contract extraction is complete; the
V2 decisions are accepted; ownership/auth implementation continues.
A008-0105 is merged through PR #46 at 5ff163d; no running-host restart
was performed for this build.

A008-0103 freezes the seven-stage API program through ADR 0040. Its first child,
A008-0104, consolidates v1 WS/session/model/runtime-preference contracts into
`packages/protocol`, used by host/core wire adapters and GUI. Ninety captured
legacy cases preserve parser tolerance/errors. Actual host frames/models and an
independently installed TypeScript package consumer pass; the portable engine
also passes discovery, ACP/panel history, tool approval, upload/memory and stop
checks with synthetic data. Full tests: 573 core, 4 membership, 161 GUI pass.
GUI production build passes with a 526.22 kB main chunk (159.20 kB gzip) and
Rollup's size/annotation warnings after adding shared Zod validation to the GUI.
The [operation inventory](HOST_PROTOCOL_V1_INVENTORY.md) identified HTTP payload
extraction completed by A008-0105 above. Stage 1 is now complete; the program remains In Progress:
V2/auth, explicit project ownership, SDK and Expo are not implemented.
Integrated through PR #45 on remote main c3970d5; no running-host restart
was performed for this build.

A008-0101 replaces ordinary full-namespace SQLite writes with keyed row deltas.
Evidence and association baselines, receipts, audit and derived indexes still
commit atomically; unchanged rows and no-op writes are untouched. Lazy decay,
active/dormant evaluation, retrieval and schema 4 are unchanged. The bulk writer
remains for explicit replacement/migration. Snapshot capture and comparison still
scale with project size; this is not engine-wide dirty tracking. Offline tests
and synthetic measurements are recorded in
[the evidence](evidence/A008-0101_incremental-persistence.md). The running host
and existing user databases were not restarted or migrated during verification.

A008-0099 fixes the standalone Connect/project-open reload loop. Shell workspace
reads and source uploads retain same-origin PIN cookies. Their previous explicit
cookie omission caused PIN 401 responses after a successful session handshake;
A008-0098 then reloaded the still-authenticated app. GUI tests: 160 passed; PIN
host tests: 3 passed; production GUI build passed. Authenticated browser Connect
and opening an existing project from idle were verified without provider calls.
A008-0100 also fixes switching projects while already connected: a rejected close
of the replaced ACP session still tears down the old local socket/state so the
existing project callback can start a fresh session. The rejection remains
observable to callers. GUI tests: 161 passed; production build/typecheck passed;
authenticated browser switching between existing projects passed.

A008-0098 recovers expired standalone GUI PIN sessions at the existing auth boundary. Before React mounts, the bundled renderer wraps same-origin fetch responses and redirects to `/` only when a `/v1/*` request returns the host PIN gate's exact `401 Authentication required.` body. The response is inspected through `clone()`, so callers retain it unchanged. Native `#engine=` capability mode, cross-origin responses and unrelated 401s are not redirected. The six-digit PIN contract, 24-hour cookie lifetime and process-lifetime auth token are unchanged. Verification: 564 core, 4 membership and 159 GUI tests pass; GUI production build passes.

A008-0094 adds host-owned project bootstrap. Projects in the sidebar can create
a named local folder with optional Git, Docs-First starter files, multi-agent
policy (max workers and worker-clone root, no clones) and project-scoped global
memory. Preview lists exact mutations; Confirm executes them. The renderer posts
JSON only. Opening a project starts a new ACP session in that root.

A008-0093 adds a persistent global app theme. The GUI starts as Neutral, the
extracted current charcoal palette. Parameters → Appearance → App theme can
switch to Deep Space immediately without reload, a new session, a provider call
or memory/tool changes. Theme identity is renderer-local
(`localStorage` `a008.preferences.appearance.theme`); missing or unknown values
default to Neutral. CSS custom properties on `html[data-a008-theme]` own colour
values; existing `--a008-*` names alias that model. Visualization colours are a
separate `--a008-viz-*` family used by the Relationship Map. The sandboxed Code
Canvas preview document does not inherit the host theme. Verification: 543
core, 4 membership and 143 GUI tests pass; the production GUI build passes.
See [ADR 0038](adr/0038-global-app-theme-system.md).

A008-0092 hardens standalone mobile connectivity. The GUI host now sends
WebSocket protocol pings every 25 seconds and retains a disconnected ACP session
under a 45-second in-memory, capability-bound resume lease. The bundled GUI
auto-reconnects after 0.5/1/2/5 seconds (then 5-second capped), resumes the same
committed session when possible, clears `Allow all`, and never replays an
interrupted prompt. Invalid or expired resume capabilities fail closed.
Verification: 543 core, 4 membership and 129 GUI tests pass; production GUI
build passes. Tests include a silent peer heartbeat timeout, same-session resume,
capability hijack/expiry rejection and no-prompt-replay recovery.

A008-0087 adds OpenAI GPT-5.6 Luna as a built-in third chat provider through
the existing `ChatTransport`/ACP/tool-permission path. A008-0088 fixes the first
live Chat Completions compatibility issue: Luna requests omit `temperature`, and
function-tool turns normalize effective reasoning effort to `none` because the
provider rejects tools with non-none reasoning on this endpoint. A008-0089 fixes
the next live streaming issue: OpenAI SSE events may carry `usage: null` before
the final usage event, and the adapter now treats that as "usage not available
yet" instead of dereferencing null and misreporting a network failure. Explicit
model identity wins OpenAI routing, so a saved OpenAI provider preference cannot
hijack NVIDIA/Kimi/etc. selections. The OpenAI key remains write-only in
Parameters or `OPENAI_API_KEY`; the renderer receives only configured/source
metadata. With no NVIDIA key, retrieval scope can use Luna. Verification: 540
core, 4 membership and 119 GUI tests pass, the production GUI builds, and an
owner-authorized live streaming A008 adapter smoke request with a function tool
returned `OK` without exposing the locally configured key. See [ADR 0036](adr/0036-openai-gpt-56-luna-provider.md).

A008-0085 corrects the extraction instruction after a further owner-reported
malformed JSON response. Canonical serialized examples distinguish greetings
from durable mixed-message/source facts; support shapes no longer use pseudocode.
Invalid-response diagnostics identify the semantic operation and model. Offline
core 528/528 and GUI 118/118 pass; live compliance is pending explicit test
authority and is not established by these tests. The prepared opt-in check is
`scripts/check-semantic-extraction.mjs` (dry-run by default, at most three calls).

A008-0084 makes the existing memory map stable and readable: spaced primary-domain
clusters, selective labels, curved stored links, and a focus camera over the
selected neighbourhood. Node positions survive selection; the inspector follows
actual directed links and preserves full escaped text. Graph limits, retrieval
and lifecycle remain unchanged. GUI build/typecheck and 118 GUI tests pass;
eight inspection core tests pass, including real HTTP/ACP with no provider call.
Synthetic browser checks cover 80 nodes/240 links, desktop/narrow sizes,
keyboard selection, focus/zoom, search/filter and empty states.
See [handoff](handoffs/A008-0084.md) and [repeatable preview](../gui/test/README.md).

A008-0083 fixes the observed Kimi semantic HTTP 400 by omitting immutable top P
through the existing capability owner. Relation instructions now specify the
exact decision shape and exclude the input envelope. Offline end-to-end NVIDIA
payload/commit regression passes, as do 524 core, 116 GUI and 4 membership tests.
The reported malformed JSON is still rejected; live model compliance has not
been re-evaluated. See [handoff](handoffs/A008-0083.md).

A008-0079's [instruction and memory specification](backlog/instruction-plane-and-memory-lifecycle.md)
is owner-reviewed and frozen as an Accepted target by
[ADR 0035](adr/0035-frozen-instruction-and-memory-target.md), including P1–P6.
A008-0080 implements L1: one final chat system instruction, late fallback
selection, integrated memory handling and explicit CLI/session-base provenance.
The 501 core and 116 GUI tests pass, including real local host/ACP/engine and
captured NVIDIA/kie payloads. Live model obedience has not been evaluated.
A008-0081 implements L2: per-claim severity, lazy exponential decay, source
support and exact-target reinforcement with atomic occurrence receipts. Creation
policy belongs to runtime preferences; L2 introduced knowledge schema 3 for
the accepted legacy conversion. Restatement reuses canonical evidence, while
reads and inspection never strengthen it.
A008-0082 implements L3: independently supported, directed and scoped semantic
associations have their own baselines, occurrence receipts and audit alongside
RelationIndex. The existing comparator resolves handles and edge-specific source
spans; no new model call is added. One-hop expansion evaluates edge and endpoint
eligibility separately, preserving direct hits and eligible alternate routes.
Graph/inspection reads do not strengthen or promote links. Existing record detail
shows outgoing association baselines and evaluated state.

Schema 4 adds association persistence transactionally. L2 baselines remain
unchanged; old links retain untracked traversal until exact supporting evidence
initializes the corresponding edge. Settings format 4 adds the independent
association policy and preserves it through older-client saves. See the
[association contract](KNOWLEDGE_MEMORY_MODEL.md#75-independent-semantic-associations).

Verification: 521 core tests, 116 GUI tests and 4 membership checks pass, with
no failures/skips. The ten new groups in
[test/knowledge-model/lifecycle-v1.test.ts](../test/knowledge-model/lifecycle-v1.test.ts)
cover A09-A24 and claim-side A29: fixed clocks, read/write isolation, source
attribution, duplicate/cancelled commits, two SQLite connections, restart,
versioned migration failure/retry, the previous published store's rejection and
backup restoration. Ten additional groups in
[association-lifecycle.test.ts](../test/knowledge-model/association-lifecycle.test.ts)
cover A25-A29 and P2/P4/P6: exact directed/scoped identity, day-45 boundary,
independent claim/edge proof, same-call proposal resolution, alternative routes,
read isolation, rollback/retry/concurrent namespaces and the published L2 store's
upgrade/rejection plus backup restoration. A30 is recorded in the completed
charters. Existing L1 and
state/history/direct-retrieval regressions remain passing. Tests use synthetic
semantic decisions; live model source-support judgments and the user's running
database were not evaluated or migrated. The
[constitution](KNOWLEDGE_MEMORY_MODEL.md#12-storage-deliberately-deferred)
describes backup/restore before opening existing data with the new build.

A008-0078 adopts the Core Product Contract in `docs/PROJECT_BRIEF.md` and the
Necessity Gate in `docs/TASK_WORKFLOW.md`, under
[ADR 0034](adr/0034-product-contract-and-necessity-gate.md). The local task
template records exact authority, observable necessity, smallest sufficient
approach and verification. This is a required development review practice;
it changes no runtime behavior and makes no claim of automatic enforcement or
measured prevention of agent drift. Existing detailed product decisions remain
binding, including their explicit exceptions.

A008-0071 adds NVIDIA Build catalog browse/add, chat image generation (default
FLUX.1-schnell), write-only API key and image endpoint in Parameters → Provider,
start-view task cards, and a Files side panel. User models persist in
`~/.a008/catalog.json`. The renderer never receives the key. NVIDIA "Free
Endpoint" is hosted inference against NGC credits, not an unlimited free quota.
See [ADR 0032](adr/0032-nvidia-catalog-and-image-generation.md).

A008-0070 replaces the Chat workbench's tool-help catalog with an
environment/sources card, moves that catalog to Help, adds empty-chat shortcuts
(Review, Terminal, Browser, Files, Workbench) and lays out the Memory
Relationship Map as a domain-clustered radial graph. Git status in the card is a
host-shell observation; writes still go through chat approvals. See
[ADR 0031](adr/0031-workbench-context-and-memory-map.md).

A008-0069 gives the standalone GUI neutral surfaces, left navigation, a centred
conversation and integrated composer. Runtime details and thought blocks start
collapsed. Desktop/narrow navigation retains chat drafts and exposes tools,
memory, help and parameters. See [ADR 0030](adr/0030-focused-standalone-workspace.md).

A008-0068 adds standalone GUI repository work: the connected tool catalog,
cwd, read/root/Git shortcuts, native UTF-8 file tools and literal-argument Git.
The real standalone GUI-host → ACP → synthetic-provider loop verifies approved
file creation/editing and Git observations, plus denied writes. See
[repository runbook](GUI_REPOSITORY_TOOLS.md). User instructions remain editable.

A008-0067 adds the portable engine and generic companion-client panel/permission
integration. A real extracted package runs through the client's actual process
host, shares its session with the panel, executes approved isolated commands,
returns tool observations to a synthetic provider, uploads sources, and shuts
down cleanly. Desktop/narrow-browser panel proof exists; this is not installed
Electron product or live-provider proof. See [engine runbook](ENGINE.md) and
[verification](evidence/A008-0067_engine-package.md).

A008-0066's owner-merged preferences are now documented in
[runtime settings](RUNTIME_SETTINGS.md). Version 1 settings retain their values;
an explicit save upgrades to version 2 with four editable tool limits.

| Surface | Observed state |
| --- | --- |
| Repository | Git repository with A008-0001 through A008-0020 implemented. |
| Docs-first control state | A008-owned entry point, workflow, brief, status, system document, journal, file map, task register, decisions, backlog, and multi-agent policy are established by A008-0001. |
| Legacy CLI provenance | Local untracked Node.js ES-module client under `docs/_legacy/agenten007/`; Axios, readline, NVIDIA chat-completions, four model profiles, streamed/non-streamed responses, tool-call aggregation, settings, history, and fallback behavior were observed. `node --check test.js` passed. |
| OpenHands source | Clean external `C:\code\OpenHands` clone on `main` at `744e8652f254613045b779eb148bf4f741177975`; Agent Canvas 1.16.0 dependencies are installed and its application build passed without source changes. Agent Server 1.44.1 was supplied by `uvx`; MIT source boundary remains external. |
| Memory architecture input | The owner supplied a Context-First Knowledge Architecture document. A008-0006 adopted bounded invariants into an A008-owned decision and implementation without adopting an external code baseline. `C:\code\acme` remains related prior work only and is not a source or dependency. |
| Bootstrap bundle | Generated input/prompt/charter/summary manifest verified: all four SHA-256 entries match. The bundle remains ignored intake material. |
| Multi-agent add-on | Local ignored Apache-2.0 reference package exists. Its process server was not installed or configured for A008. |
| Worker-clone root | `C:\code\A008-workers` is the configured sibling root. A008-0004 through A008-0015 use isolated Git worktrees; A008-0005 runtime state/evidence helpers are external siblings. No cleanup of those task paths is authorized or claimed. |
| Runtime package | Private single-package Node.js/TypeScript ESM application. Node.js `>=22.12`, npm lockfile, TypeScript build/typecheck, public core exports, and CLI binary metadata exist. |
| Chat core | Provider-neutral messages, typed tool definitions/calls/results, generation options, separate reasoning/content deltas, usage, model profiles and transactional `ChatSession`. Failed turns do not mutate history. Reasoning is never committed; only a current tool invocation may replay its associated reasoning ephemerally (ADR 0028). |
| NVIDIA adapter | Native-fetch adapter for `POST /v1/chat/completions`, injected endpoint/fetch/timeout, streaming SSE and non-streaming JSON, reasoning/content deltas, live channel-leak normalization, cancellation, timeout, and typed HTTP/network errors. It reads no environment itself. |
| kie.ai adapter | A008-0073. OpenAI-compatible chat at `https://api.kie.ai/<model>/v1/chat/completions` (`KieChatTransport`) and async Market image jobs (`KieJobTransport`: createTask, poll recordInfo, download first `resultUrls` entry). Curated market list in Parameters. Video/music and Claude/GPT native APIs are listed or documented, not wired. |
| OpenAI adapter | A008-0087. `OpenAiChatTransport` calls `https://api.openai.com/v1/chat/completions`, maps A008 tools to function calls, assembles streamed tool fragments/content, supports cancellation/timeout and typed HTTP errors, and never reads the environment itself. |
| Model registry | Seven built-in profiles. Six NVIDIA-hosted profiles were verified against the vendor's Build-tab API sample on 2026-09-04; OpenAI `gpt-5.6-luna` (text/image upstream, medium reasoning default, 128000 output ceiling) was verified against OpenAI API documentation on 2026-09-09. The other profiles are `nvidia/nemotron-3.5-lightning-30b-a3b` (default, text), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (text, image, video, audio), `moonshotai/kimi-k3` (text, image), `deepseek-ai/deepseek-v4-pro-0813`, `meta/muse-glimmer-30b` and `poolside/laguna-xs-2.1` (text). `ModelProfile` carries `inputModalities` and `verifiedOn`; the suite fails on a profile without a date. A008 still sends only text to a chat turn — `ChatMessage.content` is a `string` per ADR 0020 D6 — so a declared image modality records a capability A008 cannot yet use. |
| CLI | `models`, `chat`, `--help`, and interactive `/help` `/exit` `/quit` `/reset` `/clear` `/undo` `/history` `/model` `/status` `/cwd` `/tools` `/shell` `/!`. Chat uses the shared local memory runtime; model/help paths require no credential. Terminal access is native `/shell` in cwd, not LangChain. Optional `--debug-trace` / `--debug-trace-file` share the environment parser. |
| Shared provider composition | `createNvidiaChatTransport` owns NVIDIA credential validation, model defaults, optional trusted endpoint override, and construction of the existing adapter. Live CLI/ACP without an injected transport use `createDispatchingChatTransport`, which selects NVIDIA, kie.ai, or OpenAI from the selected model/user catalog. `createLocalMemoryRuntime` injects that one transport into CLI and ACP memory turns. Any one of `NVIDIA_API_KEY`, `KIE_API_KEY`, or `OPENAI_API_KEY` is enough to start. Core remains environment-neutral. |
| Agent Canvas ACP bridge | `A008-acp` implements stable ACP v1 over stdio with initialize, canonical `A008_v1_acp_session_<UUIDv4>` in-memory sessions, the verified model option, text/resource-link prompts, thought/answer streaming, cancellation, and the shared local memory runtime. Agent Server is expected to own the process. |
| Agent Canvas runtime proof | Real Canvas 1.16.0 and Agent Server 1.44.1 processes on Windows configured the compiled A008 Custom ACP command, sent a browser prompt, reached the existing adapter at a loopback fake SSE endpoint, rendered `A008-CANVAS-LOOPBACK-OK`, and finished the conversation. Safe evidence and screenshot are tracked under `docs/evidence/`. |
| A008 GUI role | ADR 0029/0030 support standalone repository work and a focused A008-owned interface. The external client remains supported through the shared host contract. ADR 0022's earlier design restriction is superseded for this surface. |
| A008 GUI program | A008-0030 Complete. ADR 0019 wave 1 landed all six children (A008-0032..A008-0037) on `main`. The product GUI is `gui/` plus `src/gui-host/`; Canvas + Agent Server remains an operator ACP path and is not the product. |
| A008 GUI host | `src/gui-host/` is a Node process that serves the built `gui/dist`, answers `GET /health`, `GET /v1/models`, and `POST /v1/shell` through the existing `runTerminalCommand`, and bridges `WS /v1/session` to an `A008-acp` stdio subprocess using the ADR 0019 D4 frame schema. It reads `NVIDIA_API_KEY`, `KIE_API_KEY`, `OPENAI_API_KEY`, optional `~/.a008/secrets.json` copies, and memory settings from process environment; redacts credential values and the `authorization` token from outbound text; rejects any cross-origin request that is neither same-origin nor loopback on every route and on the WebSocket upgrade; and requires `application/json` on `POST /v1/shell`. It also answers `POST /v1/upload`, which writes the original bytes to a content-addressed store outside the repository and asks the ACP process to ingest the resulting locator. ADR 0032/0033 let the host call NVIDIA catalog/image endpoints and kie.ai job endpoints; chat completions still run in ACP. The renderer never reads a key. Standalone mode now accepts optional `A008_GUI_PIN` with exactly six digits: root serves a PIN gate until login, a successful login issues a random `HttpOnly`/`SameSite=Strict` session cookie, every `/v1/*` route and the WebSocket require it, and five failed attempts trigger a 60-second lockout. `GET /health` stays public. `npm run gui-host` starts it; `npm run gui` builds the GUI first and then starts it. A008-0092 adds 25-second protocol heartbeats plus a 45-second in-memory detached-session resume grace using an opaque 32-byte capability; expiry/explicit close/host shutdown release or invalidate it. |
| A008 memory diagnostics | A008-0064 adds Memory Overview, Memory Relationship Map Graph and Memory Knowledge Manager to the existing diagnostic GUI. GET /v1/memory reaches read-only memory/inspect in the chat ACP runtime; no model call, second store or mutation. Actual totals, dormant evidence, state/history, search, filters, pagination, stored links and escaped details are visible. Refresh is explicit and the graph is capped at 80 nodes/240 links. Browser proof covers desktop/mobile, empty/unavailable states and chat/draft preservation. See docs/evidence/A008-0064_memory-gui-proof.md. |
| A008 GUI session controls | A008-0065 implements all CLI interactive commands and aliases through real ACP session controls. Parameters supports endpoint-specific reasoning, sampling, generated-token limits, stream, seed and stop. Null omits optional request fields; semantic calls keep their own options. Snapshot history replaces display-only placeholders. Mobile Chat/Memory/Tools and modal keyboard behavior are browser-verified; see `docs/evidence/A008-0065_session-controls-proof.md`. |
| A008 GUI client | `gui/` is a Vite/React/TypeScript app with A008 branding and no OpenHands imports. `useGuiSession` speaks host protocol v1 over one WebSocket and exposes status, sessionId, model, separate thought and answer buffers, error, `connect`, `prompt`, and `cancel`. Standalone tool permission UI offers Reject, Allow once and session-scoped Allow all; Allow all auto-approves later permission frames through the existing boolean response and resets on reconnect. The chat pane renders user, answer, and thought as distinct DOM channels; fenced code is syntax-highlighted with highlight.js; each assistant turn shows only the tool calls from that turn. Empty chat shows the owner ASCII mark over a transparent 4D starfield, a rule, the heading and start cards. The composer carries the A008-0029 slash set; the terminal pane calls `POST /v1/shell`; settings and brand own the shell chrome. No provider call, credential, or telemetry ships in the renderer. After established transport loss it auto-reconnects with 0.5/1/2/5-second bounded backoff and attempts same-session resume; pending operations are rejected rather than replayed, and Allow all resets. |
| A008 session Code Canvas | A008-0091 adds a renderer-local HTML artifact beside the existing conversation. Completed assistant `html`/`htm` fences render as highlighted code and can be opened explicitly in Code Canvas; one current artifact can be edited locally (highlighted overlay editor) and previewed through a unique-origin `srcdoc` iframe sandboxed with only `allow-scripts`. The preview document is not highlighted. The injected CSP denies network connections/subresources, frames, workers, forms, objects and base URLs; no provider credential, ACP object, shell, filesystem handle, new host route or model tool enters the preview. A later model HTML version replaces an untouched artifact; local edits are preserved until the user chooses Use model update. Reset/new conversation clears the transient artifact. Repository persistence remains the existing `create_file`/`edit_file`/Git flow and therefore keeps its approval boundary. |
| A008 source upload ingest | `POST /v1/upload` stores an uploaded original under `A008_SOURCE_STORE_PATH` as `source:<sha256>/<sanitised-name>` and sends only that locator to the ACP process over `_a008/source/ingest`. `src/ingest/` decides the media type from magic bytes, extracts text, and sets its own provenance: text lifted from a document is `appears_in` and spoken by the uploader, a model's description of an image is `derived_from` and spoken by the model. `LocalMemoryRuntime.ingestSource` proves locator containment lexically and again through `realpath` before reading, then passes the extractor's content, speaker, relation and content kind straight to `ingest()`. An ingested source can additionally run the analyze/classify/commit coordinator, opt-in per call and off by default because one source can mean well over a hundred sequential provider calls. A source batch is origin-marked: it carries its locator as `sourceMessage` rather than its content, the commit path reuses the utterance `ingestSource` already created instead of re-ingesting it as a user turn, and `user-assertion-v1` acceptance is refused on origin alone. Uploading a document is not asserting its contents, and a document contains every proposition extracted from it, so both layers exist to stop an uploaded file being committed as user-stated fact. Three extractors run by default because none makes a provider call: UTF-8 text and Markdown, PDF through a lazily imported `pdfjs-dist`, and Word through a ZIP and OOXML reader built on Node's own `zlib` with no dependency. All three set `appears_in` and the uploader as speaker. Every OOXML format is a ZIP, so the sniffer reads the archive's part names to tell Word from a spreadsheet, a presentation or a plain archive, rather than reporting every ZIP as a document. A PDF with no text layer, an empty Word part and a corrupt archive are refused by name instead of stored as an empty success. `gui/src/upload/` is the renderer client. |
| A008 upload runtime proof | A real GUI host process, a real `A008-acp` subprocess, the real local memory runtime and the real extraction registry completed an upload: a text document stored, extracted and ingested as an artifact; the same bytes deduplicated to one blob; a PDF named `.txt` identified as a PDF; a traversal filename contained; a cross-origin upload refused; and the credential absent from every response body. Re-run and extended by A008-0056 with a real PDF and a real Word document each extracted end to end to distinct artifacts, and a spreadsheet stored under its own media type without extraction. 17 of 17 checks. Sixteen of seventeen documents in the owner's own folder extracted read-only on the same day; the seventeenth is a scan with no font object at all and is refused by name. Recorded in `docs/evidence/A008-0041_upload-ingest-proof.md` and `docs/evidence/A008-0056_document-extraction-proof.md`. |
| A008 GUI runtime proof | A real GUI host process, a real `A008-acp` subprocess, the real local memory runtime, and a loopback fake SSE endpoint completed one session: `session/new`, two `thought` frames, one `answer` frame, `prompt/ok`. The credential sentinel reached the provider server-side and appeared in no observed frame or body. Recorded in `docs/evidence/A008-0030_gui-runtime-proof.md`. |
| Knowledge-model program | A008-0021 is Complete (`docs/finished/A008-0021_close-knowledge-model-gap.md`). ADR 0018 D9 holds: S1–S10 pass in-memory and against SQLite with identical payloads; live CLI/ACP use `src/memory/knowledge/` without V3/V4/V7; `KnowledgeItem` is compatibility only. `docs/CURRENT_TASK.md` on `main` is the empty template. |
| Semantic-memory core | Exported provider-neutral contracts, `SemanticMemory`, explicit five-way reconciliation, active+dormant discovery, exact-budget projection, and separate audit/history exist. This is the v0 surface the gap analysis measures; it is not the accepted model. A project-namespaced SQLite adapter durably stores canon/audit and indexes exact entities, FTS5 lexical content, tags, domains, and optional vectors. A deterministic planner and hybrid reader deduplicate/score bounded candidates, keep three thresholds distinct, and project selected active canon without mutation. The reader is consumed by the exported orchestration surface below, not directly by CLI/ACP/Canvas. |
| Memory-aware orchestration | Exported `MemoryAwareChatSession` validates project/conversation/task/agent context, reads hybrid memory once, strips routing/control fields into a deterministic user-level envelope, sends at most two prior dialogue messages through one existing `ChatSession` transport call, applies an exact serialized-message budget, and commits only original user/assistant history. CLI and A008 ACP construct it through `createLocalMemoryRuntime`. |
| Post-output staging | Exported `PostOutputKnowledgeIntake` gives an analyzer only normalized original message and final answer, never reasoning or control state. The default ceiling is 128 proposals per answer, raised from 8 by A008-0046 after owner testing showed an ordinary factual text yielding 49; the semantic output budget moved from 1024 to 16384 tokens with it, because a truncated JSON array fails the strict parse and discards the whole batch. The analyzer instruction (A008-0047) asks for completeness rather than a summary. Support evidence is an exact quote from the original source; runtime computes UTF-16 spans and ignores model offsets. It validates and exact-budgets semantic drafts, applies runtime-owned scopes and conservative defaults, and returns untrusted proposal batches without repository access, relation decisions, or memory writes. |
| Relation-gated memory commit | Exported `IndexedRelationCandidateSource` and `RelationGatedMemoryCommit` process one staged proposal through one bounded current-candidate search, an exact-budget semantic envelope with invocation-local handles, validated five-way output, all-candidate revision guards, the existing canonical reconcile owner, and explicit `updated`/`not_required`/`pending_repair` index state. Classifier JSON may name a canonical relation as `type` or `relation`; unknown labels fail closed with the returned value. Live CLI/ACP construct a model-backed classifier and invoke the coordinator after each delivered answer. |
| Post-output memory coordination | Exported `PostOutputMemoryCoordinator` stages once, processes proposals sequentially, distinguishes stage/commit/index-repair outcomes, and validates in-memory checkpoints for retry or repair-then-resume without replaying earlier completed work. Local CLI/ACP invoke it after each delivered answer and attempt one index repair. |
| Stateless semantic model calls | Exported `ChatTransportSemanticJsonGenerator` makes exact-budget, non-streaming, history-free strict-JSON calls through one injected existing `ChatTransport`. Exported analyzer/classifier adapters share it; reasoning/usage/finish metadata are discarded, and cancellation propagates through the coordinator. Local composition injects the existing transport. |
| Local memory surfaces | `createLocalMemoryRuntime` owns SQLite path/project identity, one NVIDIA transport, the SQLite knowledge engine, memory-aware chat, post-output through `KnowledgeEngineCommit`, and `user-assertion-v1` ACCEPT. Live restatement reinforces evidence only. `PROJECT` writes nothing. Direct matches ignore dormancy. `KnowledgeItem` remains a compatibility/migration surface. Opt-in off/safe/raw JSONL tracing is secret-redacted and off by default. |
| Committed memory-loop proof | `npm run benchmark:memory-loop` composes actual in-memory SQLite read/write/index state with two memory-aware chat turns and one shared fake transport. Exact call order is chat/analyze/classify/chat; active canon extends from revision one to two and the second turn projects the new proposition. New-draft auto-activation remains explicitly unproven. |
| Runtime identity core | Exported branded/parser-validated project, conversation, runtime-task, agent, and ACP-session IDs use versioned lowercase UUIDv4 values. A namespaced external-reference contract, atomic in-memory ACP binding repository, conflict/idempotency rules, and defensive lookup surfaces exist. No complete external conversation binding is created at runtime. |
| Live knowledge projection | ADR 0023: a surface may not suppress another surface. `projection-items.ts` collects all seven — state, claim, event, history, utterance, artifact, provenance — then deduplicates identical propositions to the highest-ranked carrier, ranks by surface weight with a stable tiebreak, and applies a 32768-byte default budget. All three reasons a record can be missing are reported in `omittedKnowledgeIds`; one item larger than the whole budget is still sent. Until A008-0058 the projection returned state, or failing that claims, or failing that utterances, and never read the other four surfaces at all, so one current-state hit discarded everything else the read had admitted. `live-reader.ts` had no tests; it has fourteen now, with a fixture that reproduces the reported live failure rather than a tidied version of it. |
| Retrieval matching | Records carry their own tags and domains. `KnowledgeLabelStore` holds them beside the record the way `EvidenceLifecycleStore` holds strength, normalised on both sides of every comparison, merged rather than replaced on re-attach, and introduced in knowledge schema 2 and preserved by L2 schema 3 migration. `live-commit` attaches what the analyzer already produced to both the claim and the utterance. A label retrieval channel makes a record reachable because it is *about* the subject even when the message names none of its entities, and the claim's binding is reachable the same way. `filter()` matches on either axis and treats unlabelled as unlabelled rather than unmatched, and a label hit is exempt from the entity gate that would otherwise undo it. `channelCounts.tag` and `channelCounts.domain` were hardcoded to zero because nothing could set them; they count now. Matching is lexical: the message is compared against the labels the store holds. The semantic step — classify into domains and *related* domains and accumulate a `current_scope` — is a provider call and is specified in `docs/backlog/current-scope-retrieval.md`, not built. |
| Automated tests | A008-0092 verification on 2026-09-09: 543 core, 4 membership and 129 GUI tests pass; the production GUI typecheck/Vite build passes. Root `npm test` remains the full gate: `test:core` compiles and runs the named core suite, `test:membership` verifies suite membership, and `test:gui` discovers `gui/src/**/*.test.ts` through the shared loader. No test loads `.env.local` or makes a live provider call. |

## Security observation

The raw legacy client contains a hard-coded NVIDIA credential. The owner reports
that credential was revoked and replaced on 2026-09-01. The retired value is not
recorded in live documentation or Git, and the raw client remains ignored and
unexecuted. The replacement exists only in ignored `.env.local` as
`NVIDIA_API_KEY`; automated tests do not load it.

## What does not exist

- kie.ai video, music, Claude native `/messages`, and GPT/Grok `/responses` are
  out of A008-0073. Video ids appear in the curated list as "Not wired".
- No maintained A008 launcher for the external Canvas/Agent Server source stack,
  installed desktop package, deployment, published package, or release artifact.
  The verified Windows fallback remains a development runbook.
- No checked-in cross-repository browser automation suite, fully hermetic
  external-egress harness, complete runtime identity context supplied to ACP, or
  durable mapping between an Agent Server conversation and an A008 ACP session.
  The identity/binding contract exists, but the current request lacks the
  external and application handles needed to register a verified binding.
- No provider-backed embedding generation, model-tokenizer
  adapter, graph retrieval, server-scale database adapter, or production memory
  API exists in A008. Local CLI/ACP now supply a bounded identity context,
  inject the existing transport/model/budgets, and invoke post-output in
  process. Durable queues, Agent Server conversation binding, and paid live
  provider runs remain separate.
- Portable engine extraction is verified. Installed desktop product, live-provider,
  filesystem sandbox and full protocol conformance gates remain unproved.
- A008-0064 adds a browser memory-diagnostics and chat-navigation proof against
  a real host/ACP process with synthetic SQLite and a loopback fake provider.
  It does not establish a complete GUI regression suite or live NVIDIA proof.
- The staging ceiling is also a cost dial. The post-output coordinator commits
  proposals strictly sequentially with one relation-classifier call each, so a
  128-proposal answer costs 1 analyzer plus up to 128 classifier calls,
  serialized. At the observed 49 proposals that is roughly six times the calls
  and six times the post-output latency of the previous ceiling of 8. No
  batching or parallelism exists.
- GUI layout has no automated regression guard. The chat transcript's
  scroll-to-bottom depends on the shell grid being height-capped, which only a
  browser can prove; `gui/src/brand/shell-layout.test.ts` asserts the CSS
  declaration, not the rendered layout.
- A single knowledge extraction is now a long generation. An owner run of this
  workload took 87 seconds in the provider playground, against a provider
  adapter whose own default ceiling is 60 seconds. `A008_PROVIDER_TIMEOUT_MS`
  now defaults to 180000, but nothing bounds the post-output path as a whole:
  the coordinator commits sequentially, so one answer can be one long analyzer
  call plus tens of classifier calls back to back.
- The verified model profile declares `maxTokens: 16384` while the provider
  playground accepts 32768 for the same model. The profile is not wrong, it is
  conservative; raising it means re-checking the model card, so
  `A008_CHAT_MAX_TOKENS` exists as the per-deployment override instead.
- No CI runs any of this. Root `npm test` is now the full gate and covers the
  GUI, but nothing enforces that a human or a pipeline runs it before a merge.
- `test:core` still names its 43 test files by hand. A008-0040 refilled the two
  that had silently fallen out, but nothing prevents the next one from doing the
  same. The GUI half is discovery-based; the core half is not.
- No enforced multi-agent worker limit or configured process supervisor. Ten
  allocated task worktrees, A008-0004 through A008-0015, exist under the
  registered worker root; allocation does not assert current activity.

## Known gaps and risks

- Live NVIDIA verification still requires explicit credential/cost authority;
  rotation alone did not authorize or perform a provider call.
- OpenHands `dev:minimal` has a 30-second Agent Server readiness timeout while
  the pinned backend needed about 42 seconds on this Windows host. The exact
  locked backend and Vite processes work when started separately.
- Canvas's optional automation and `/projects` probes produce 404/400 console
  resource errors in the minimal stack. Optional OpenAI subscription control-
  plane paths also ran without credentials, so the proof does not establish
  zero external egress even though the successful model turn was loopback-only.
- Agent Canvas component exports require routing, query, i18n, backend, and
  telemetry state; deep embedding needs a focused spike.
- OpenHands host mode and extensions have broad trust surfaces. Extensions run
  unsandboxed in the renderer realm.
- A008-0092 handles short standalone socket loss with heartbeat detection and a
  45-second detached-session resume lease. It still has no durable resume across
  page reload or host restart, no cross-device session transfer, and no idle
  timeout or total cap for sessions whose WebSocket remains healthy.
- A PDF with no text layer is refused, not read. Fifteen of sixteen documents in
  the owner's own test set extracted; the sixteenth is a 15-page scan with no
  font object at all, and it comes back `extracted: false` naming the reason.
  OCR is not in scope, and the vision describer that could read it is not in the
  default registry because it is a paid call.
- Spreadsheets, presentations and plain archives are stored and named but not
  extracted. The sniffer now tells them apart from Word; no extractor claims
  them.
- Image uploads are stored but not extracted. The `ImageDescriber` port and
  its NVIDIA implementation exist and are fake-verified, but the registry holds
  no vision-capable model and a live vision call is a paid call needing explicit
  authority.
- A contested slot is permanent, and slots contested before A008-0062 stay
  contested. The defect that was creating them constantly is fixed — a statement
  slot is a set now, so two different true facts about one entity no longer read
  as disagreement — but who resolves a genuine contested slot is still open
  question 2 in `docs/KNOWLEDGE_MEMORY_MODEL.md`.
- A semantic JSON parse failure now names the cause. It reports the content
  length, the finish reason and a bounded excerpt, and says explicitly when the
  answer was cut off by the output budget. A markdown fence wrapping the whole
  content is unwrapped (ADR 0012 D6); a fence buried in prose, prose-wrapped
  JSON and malformed JSON are all still refused.
- The analyzer instruction names `confidence` without saying it is a number.
  A008-0059 made the parser read the ordinal words a model actually writes, so
  an extraction is no longer discarded over that field, but the instruction
  itself is owner-authored and still invites the ambiguity.
- Retrieval matches a label the message literally contains. A question that does
  not name the subject area — "hur fungerar människans minne?" against records
  tagged `neurologi` — still finds nothing. Closing that needs the classification
  call in `docs/backlog/current-scope-retrieval.md`.
- `taskApplies` drops an expanded record whose text names none of the message's
  entities, including one reached over a relation hop that has already justified
  itself. Pre-existing, arguably a gate too many, deliberately not changed by
  A008-0060.
- An uploaded source produces exactly one `Utterance`, whatever its length, and
  `classifySpeech()` picks its kind with heuristics written for chat messages.
  Recorded in `docs/backlog/document-ingest-granularity.md`.
- Nothing prunes the source store, and `A008_SOURCE_STORE_PATH` validation is
  duplicated between `src/gui-host/source-store.ts` and
  `src/runtime/local-runtime-config.ts` because the two were sibling write
  scopes in one wave.
- `gui/src/terminal/run-shell-command.test.ts` and
  `gui/src/settings/settings-view.test.ts` run their assertions through a
  hand-rolled harness rather than `node:test`, so each reports one test in place
  of several. Failures still propagate, but the reported GUI count understates
  the assertions actually run.
- `POST /v1/shell` runs arbitrary commands in the host process working
  directory. The origin guard, JSON content-type requirement and optional
  standalone PIN gate protect the browser path. With no PIN configured the old
  loopback-only trust model remains. A six-digit PIN is deliberately low-entropy
  convenience authentication, not a hardened public identity boundary; an
  Internet-exposed host should also use identity-aware edge access.
- Host wire redaction strips the literal tokens `NVIDIA_API_KEY`, `KIE_API_KEY`,
  `OPENAI_API_KEY`, and `authorization` from assistant text as well as from credentials, so an
  answer that legitimately discusses those names is shown redacted. That is the
  intended ADR 0019 D6 trade.
- Current GUI sessions use authoritative `details.messages` (A008-0065).
  `gui/src/chat/capture-prompt.ts` remains only as compatibility with older hosts
  that supply no snapshot; it is not used on the current host/ACP path.
- `node:fs`, `node:path`, and `node:url` are declared for the whole GUI
  TypeScript program, because one session test imports them and an ambient
  module declaration cannot be scoped to test files without a separate project.
  Renderer code can still reach those three. Every other Node built-in is
  blocked since A008-0039 set `"types": []` on the GUI package.
- The SQLite memory adapter is single-process and the projection is byte-
  budgeted. Its optional vector channel compares the bounded local namespace in
  process. Production use still needs complete verified runtime-context intake,
  exact tokenizer coupling, provider-backed planning/embeddings and semantic
  ports, server topology/storage, and privacy/user controls.
- Runtime identity v0 has no durable repository, external Agent Server
  conversation intake, account/ACL layer, lifecycle/migration behavior, or
  binding from a live chat surface into memory-aware orchestration.
- The prompt composer frames remembered propositions as user-level JSON data
  and strips routing/control fields, but adversarial remembered text still
  requires defense-in-depth and evaluation; prompt-injection safety is not
  claimed.
- CLI and A008 chat state treat reasoning as display-only. ACP correctly emits
  it as thought events, but an external Agent Server/Canvas event log is outside
  A008 ownership and must not later be rebound as semantic history.
- Post-output intake stages only untrusted proposals. Provider-neutral candidate
  comparison, relation validation, guarded reconciliation, explicit index
  repair, sequential checkpoints, and stateless model-backed analyzer/
  classifier adapters now exist. Local CLI/ACP invoke them after each answer
  and attempt one in-process index repair. A durable checkpoint queue and
  background repair owner do not.
- Historical v0 verification (the current L2 live path is described above):
  the local loop proved next-turn reuse for an `extend` of existing
  active canon and, separately, for a brand-new user assertion that the runtime
  activation gate marks keep-alive. Live restatement/extend also boost
  `relevanceScore` by `0.2` and may reactivate dormant canon when the boosted
  score meets the threshold. Assistant-only or question-only extraction
  remains dormant unless that write-path threshold is crossed. Analyzer
  confidence still cannot grant activation. Cyclic weaken/decay is not
  implemented.
- A008 owns the provider call on the selected ACP path. Future memory analysis
  now has one stateless shared call contract, but live composition must inject
  the existing transport rather than construct another provider client.
- Third-party and transitive licenses have not received a complete audit.

## Verification performed during bootstrap

- Read-only tree and Git inspection of A008 and OpenHands; related ACME code was
  inspected but explicitly not adopted as the memory-engine baseline.
- Legacy JavaScript syntax check only; no execution or network call.
- Bootstrap manifest SHA-256 verification.
- Documentation verification is recorded in the A008-0001 archive and journal.

## Verification performed for the first code slice

- Clean npm install from lockfile, TypeScript typecheck/build, and all 26 fake-
  only automated tests.
- CLI help/model-list and negative missing-credential smoke tests without
  loading `.env.local`.
- Secret-pattern, raw-legacy staging, Markdown, collection-index, and diff checks
  recorded in the A008-0003 archive and journal.

## Verification performed for the ACP bridge

- Clean install, strict typecheck/build, and 36/36 fake-only tests.
- Official ACP TypeScript client spawned the compiled bridge and completed
  initialize, session creation, model selection, and one prompt against a
  loopback fake NVIDIA SSE endpoint.
- The process emitted standard thought and answer updates; CLI help, model-list,
  and missing-key regressions remained green.
- No OpenHands install/build, Agent Server, browser, real credential, live
  provider, paid usage, publication, or release participated.

## Verification performed for the Agent Canvas runtime

- A008 clean install, typecheck, build, and 38/38 fake-only tests passed.
- OpenHands clean install and application build passed; the pinned external
  checkout remained clean after runtime use.
- The initial Canvas home route rendered 27 interactive elements with no error
  overlay, console error, or page error.
- The browser configured Custom ACP, sent one prompt, displayed the user turn
  and deterministic answer, showed no error banner, and later showed no Running
  state. Agent Server recorded `execution_status: finished` with A008 agent/model
  state.
- The loopback fixture observed the exact prompt, verified model, authorized
  test header, and two-message payload on `127.0.0.1:18999`; `.env.local` and the
  real NVIDIA key were not read.
- The safe proof, screenshot, Windows findings, OpenHands warnings, ancillary
  no-credential control-plane behavior, and negative evidence are recorded in
  `docs/evidence/A008-0005_agent-canvas-runtime-proof.md`.
- All spawned proof processes were stopped and their four ports were free.

## Verification performed for semantic memory v0

- Clean npm install, strict typecheck/build, and all 54 fake-only tests passed;
  existing CLI/ACP/provider tests remained green.
- Reconciliation tests cover new, dormant restatement without duplication,
  extend, supersede/history, and conflict with explicit caller decisions.
- Projection tests cover dormant reactivation through reinforcement+threshold,
  scope isolation without decay, keep-alive and required failure, deterministic
  ranking, canonical-content protection from policy rewrites, exact serialized
  UTF-8-byte enforcement, and audit/provenance exclusion.
- The same task produced byte-identical serialized context with 100 and 100,000
  total current items when added records were unrelated.
- Repository tests cover duplicate IDs, invalid-state rollback, supersede-cycle
  rejection, concurrent transaction serialization, and defensive reads.
- No credential, `.env.local`, provider, network, database, OpenHands process,
  live model, paid usage, publication, or release participated.

## Verification performed for runtime identity v0

- Clean npm install, strict typecheck/build, and all 66 fake-only tests passed;
  existing chat/provider/ACP/memory behavior remained green.
- All five identity kinds round-trip through strict version/kind/UUIDv4 parsing;
  malformed, uppercase, docs-task, wrong-kind, invalid factory, and unknown-kind
  values are rejected.
- Binding tests cover idempotency, multiple task/session bindings with stable
  project+agent context, session/external/project/agent conflicts, atomic
  concurrent external claims, lookup resolution, and defensive reads.
- Direct ACP tests prove canonical default IDs and malformed/duplicate injected
  rejection. The compiled ACP process returned a canonical ID and completed its
  existing loopback provider turn.
- Identity source has no provider, environment, filesystem, network, chat, or
  memory dependency. No credential, external Agent Server/Canvas process, live
  model, paid usage, durable storage, publication, or release participated.

## Verification performed for the SQLite hybrid memory read path

- Clean lockfile install, production dependency audit, strict typecheck/build,
  and all 79 fake/local-only tests passed with zero failures.
- SQLite tests cover schema creation/rejection, close/reopen durability,
  knowledge+audit rollback, serialized concurrent updates, project namespace
  isolation, derived-index invalidation, and temporary-file cleanup.
- Retrieval tests cover deterministic bounded planning, exact/entity, FTS5
  lexical, tag, domain, and injected-vector channels, canonical-ID dedupe,
  score evidence, threshold separation, missing-vector degradation, namespace
  rejection, and dormant discovery without projection or mutation.
- The same relevant canon among 100 and 100,000 records produced byte-identical
  serialized projection, one bounded candidate, and a 221-byte projection. The
  recorded local run took 24 ms and 5,443 ms respectively; timing is evidence,
  not a performance guarantee.
- CLI help/model-list/missing-key smokes, package dry-run, dependency license,
  Markdown, database/secret/raw-legacy staging, template, and diff gates passed.
- No live provider, `.env.local`, Supabase service, Docker mutation, external
  database, deployment, publication, or release participated.

## Verification performed for memory-aware chat orchestration

- Clean lockfile install and production dependency audit passed with zero
  vulnerabilities; strict typecheck/build passed; all 87 fake/local-only tests
  passed with zero failures, skips, cancellations, or todo.
- Prompt tests cover deterministic JSON, empty memory, multibyte exact UTF-8
  budgets, message ordering/windowing, defensive copies, malformed projections,
  and exclusion of orchestrator-owned runtime/knowledge IDs and control fields.
- Orchestration tests prove one read before one provider call, two-message
  retrieval/provider windows, original-only history commit, malformed identity
  and result rejection, pre-transport budget failure, retrieval/provider/
  cancellation/invalid-response rollback, active-turn rejection, and reset
  protection.
- An actual SQLite + `HybridMemoryReader` + `MemoryAwareChatSession` test
  projected canonical memory into the fake request while leaving knowledge,
  revision, activation, provenance, and audit state byte-for-byte unchanged.
- Existing direct ChatSession, CLI, ACP agent, compiled ACP loopback, NVIDIA
  adapter, identity, lifecycle, SQLite, and 100-versus-100,000 retrieval tests
  remained green.
- CLI help/models succeeded without a key; missing-key chat stopped before
  transport. Package dry-run contained 123 entries including all compiled
  orchestration artifacts and did not publish.
- No live provider, `.env.local`, external OpenHands process, Supabase service,
  Docker mutation, external database, deployment, publication, or release
  participated.

## Verification performed for reasoning isolation and post-output staging

- Clean `npm ci` installed eight packages and audited nine. Production audit
  reported zero vulnerabilities; strict typecheck/build and all 95
  fake/local-only tests passed with zero failures, skips, cancellations, or
  todo.
- Intake tests capture exactly message+answer at the analyzer boundary and
  cover one-call ownership, runtime identity association, caller-owned scope,
  conservative runtime fields, ignored control/reasoning fields, normalization,
  duplicates, malformed output, structural limits, exact multibyte UTF-8
  budget, analyzer/measurer failure, and defensive copies.
- Direct session, CLI, and memory-aware two-turn tests stream and return private
  reasoning while proving it is absent from committed messages, the next memory
  request, and the next provider-visible request.
- `npm run benchmark:memory-loop` completed two fake-provider turns through an
  actual in-memory SQLite hybrid reader. It recorded two reads/calls, selected
  `benchmark_reasoning_boundary` twice, used zero then two prior dialogue
  messages, emitted two reasoning and two content deltas, committed four
  dialogue messages, and found no reasoning or control-ID leakage. Provider
  requests measured 666 and 823 UTF-8 bytes; observed turn times were 10.469 ms
  and 3.128 ms and are not guarantees.
- CLI help/models exited zero and missing-key chat exited two before transport.
  Package dry-run contained 131 entries including compiled intake and benchmark
  artifacts, with no tests, databases, credentials, raw legacy, or dependency
  tree, and did not publish.
- No live provider, `.env.local`, external OpenHands process, Supabase service,
  Docker mutation, external database, deployment, publication, or release
  participated.

## Verification performed for relation-gated memory commit

- Clean `npm ci` installed eight packages and audited nine; production audit
  reported zero vulnerabilities. Strict typecheck/build and all 109
  fake/local-only tests passed with zero failures, cancellations, skips, or
  todo.
- Focused tests prove one bounded candidate-store call, deterministic
  score/ID ordering and handles, dormant materialization, defensive copies,
  exact multibyte classifier budgeting and tail trimming, ID/provenance/score/
  reasoning exclusion, malformed decision rejection before writes, all-
  candidate revision guards, overlap rejection, explicit post-commit index
  failure, and repair without a second reconcile.
- Actual in-memory SQLite tests execute `new`, `restatement`, `extend`,
  `supersede`, and `conflict`; verify current/historical/dormant canon and audit;
  retrieve the result again through exact/entity, lexical, tag, and domain
  channels; and reject a revision changed during classification with
  `stale_state`.
- `npm run benchmark:memory-loop` retained two actual SQLite reads, two fake
  provider calls, repeated `benchmark_reasoning_boundary` selection, `[0, 2]`
  prior-dialogue counts, four committed messages, two reasoning plus two answer
  deltas, zero reasoning/control leakage, and 666/823 request bytes. Observed
  9.908/2.713 ms turn times are not guarantees.
- CLI help/models exited zero without a key; missing-key chat exited two before
  transport. Package dry-run contained 139 entries including compiled relation
  source/service JavaScript and declarations and no tests, databases,
  credentials, raw legacy, or dependency tree.
- No live provider, `.env.local`, external OpenHands process, Supabase service,
  Docker mutation, external database, deployment, publication, or release
  participated.

## Verification performed for sequential post-output coordination

- Clean `npm ci` installed eight packages and audited nine; production audit
  reported zero vulnerabilities. Strict typecheck/build and all 117
  fake/local-only tests passed with zero failures, cancellations, skips, or
  todo.
- Focused tests prove one exact staging call, semantic-input field exclusion,
  ordered per-proposal calls, zero-proposal completion, explicit staging and
  commit failure, same-index resume without restaging/replay, pending-index
  barriers, failed and successful repair, repair-resume without a second
  reconcile, malformed-checkpoint zero-call rejection, defensive containers,
  and overlap rejection.
- Actual in-memory SQLite stages two proposals once: the first creates dormant
  canon and entity/domain metadata; the second retrieves that same item and
  extends it. Final state is one current revision-two item with ordered create/
  extend audit and exact/entity, lexical, tag, and domain retrieval.
- `npm run benchmark:memory-loop` retained two actual SQLite reads, two fake
  provider calls, repeated knowledge selection, `[0, 2]` prior-dialogue counts,
  four committed messages, two reasoning plus two answer deltas, zero reasoning/
  control leakage, and 666/823 request bytes. Observed 9.933/2.741 ms turn times
  are not guarantees.
- CLI help/models exited zero without a key and missing-key chat exited two.
  Package dry-run contained 143 entries including compiled coordinator
  JavaScript/declarations and no tests, databases, credentials, raw legacy, or
  dependency tree.
- No live provider, `.env.local`, external OpenHands process, Supabase service,
  Docker mutation, external database, deployment, publication, or release
  participated.

## Verification performed for stateless semantic JSON model calls

- Clean `npm ci` installed eight packages and audited nine with zero
  vulnerabilities. Strict typecheck/build and all 130 fake/local-only tests
  passed with zero failures, cancellations, skips, or todo.
- Focused tests prove exact two-message call shape, stable operation envelopes,
  one non-streaming call, local-configuration rejection before transport,
  strict whole-content JSON, exact multibyte UTF-8 budget, ignored completion
  reasoning/usage/finish metadata, fresh request containers, and cancellation
  propagation plus staging/commit checkpoint mapping.
- An actual in-memory SQLite coordinator used one shared fake semantic
  transport for one analyzer call and two classifier calls. The first proposal
  created/indexed dormant canon; the second retrieved and extended it. Private
  fake reasoning and durable/runtime IDs were absent from semantic requests and
  coordinator results.
- Existing direct chat, CLI, ACP, NVIDIA adapter, identity, lifecycle,
  retrieval, five-way relation, index repair, and compiled memory-loop tests
  remained green. The standalone benchmark, CLI no-key smokes, package dry-run,
  and final documentation/security gates are recorded in the A008-0014 archive.
- No live provider, `.env.local`, external OpenHands process, Supabase service,
  Docker mutation, external database, deployment, publication, or release
  participated.

## Verification performed for the committed two-turn memory loop

- Clean `npm ci` installed eight packages and audited nine; production audit
  found zero vulnerabilities. Strict typecheck/build and all 130 fake/local-
  only tests passed with zero failures, cancellations, skips, or todo.
- The independent v2 benchmark made four calls through one fake transport in
  exact order `chat`, `knowledge_analysis`, `relation_classification`, `chat`.
  Two actual SQLite reads selected the same active canonical ID.
- Question one projected the revision-one proposition. One proposal completed
  as guarded `extend` with index `updated`; canon remained active and advanced
  to revision two; question two projected the extended proposition.
- Provider-visible prior dialogue counts were `[0, 2]`; chat request bytes were
  641/908 and semantic request bytes 669/1115. Two chat reasoning and two answer
  deltas streamed. Chat/semantic reasoning and runtime/control IDs were absent
  from later context, history, semantic results, and canon.
- The report explicitly records `newDraftAutoActivationProven: false`; the proof
  does not weaken the dormant default for new untrusted proposals. Observed
  10.254/2.379 ms chat-turn times are not guarantees.
- CLI help/models exited zero without a key, missing-key chat exited two before
  transport, and package dry-run contained 151 files with no excluded runtime
  material.
- No live provider, `.env.local`, external OpenHands process, Supabase, Docker
  mutation, external database, deployment, publication, or release
  participated.

## Verification performed for local CLI/ACP memory surfaces

- Clean `npm ci` installed eight packages and audited nine; production audit
  found zero vulnerabilities. Strict typecheck/build and all 147 fake/local-
  only tests passed with zero failures, cancellations, skips, or todo.
- Two-turn CLI, in-process ACP, and compiled ACP process proofs used actual
  temporary SQLite and deterministic fake chat/semantic responses. A user
  assertion became active, indexed, and projected on the next turn.
- Trace-off created no file. Safe traces omitted prompt bodies. Raw traces
  showed exact request/response bodies and SSE frames without API keys or
  authorization headers. ACP stdout remained protocol-parseable under raw
  mode.
- Failure tests covered missing credentials, memory read failure, chat
  rollback, staging failure, stale reconcile, pending index repair, trace sink
  failure, cancellation without post-output, and restart against existing
  SQLite.
- The standalone benchmark retained the committed extend loop with
  `newDraftAutoActivationProven: false`.
- No live provider, `.env.local` paid call, OpenHands source mutation,
  deployment, publication, or release participated. The full external Canvas
  browser loopback was not re-executed in this slice; the compiled ACP process
  contract against a loopback fake NVIDIA endpoint was.

## Verification performed for live write-path reinforcement

- Strict typecheck/build and all 150 fake/local-only tests passed.
- Live SQLite restatement of an active item added `0.2` relevance and left a
  preceding hybrid read unmutated.
- Dormant `0.35` became active at `0.55`; dormant `0.1` stayed dormant at
  `0.3`.
- The architecture benchmark still uses zero boosts and
  `newDraftAutoActivationProven: false`.
- No live provider, `.env.local`, OpenHands mutation, deployment, or
  publication participated.

## Verification performed for reasoning isolation

- Strict typecheck/build and all 158 fake/local-only tests passed.
- The live Nemotron fixture (`reasoning_content` 146 chars, `content` 3031
  chars including CoT then `Hej!`) normalizes so only the Swedish answer is
  committed content.
- Semantic JSON requests omit `reasoning_budget` and send `enable_thinking:
  false`.
- Holy invariant: no emitted reasoning substring appears in analyzer input,
  committed history, retrieval query text, or proposals.
- Analyzer timeout after a successful chat is one `memory_failure` and
  `turn_complete` `degraded`.
- No live NVIDIA call was required for automated completion.

## Verification performed for write-path source message

- Strict typecheck/build and all 160 fake/local-only tests passed.
- Overlapping session turns cannot change another turn's `sourceMessage`
  activation. HTTP traces include `operation`. `turn_complete` carries
  `chatStatus` and `memoryStatus`.
- No live NVIDIA call was required for automated completion.

## Verification performed for classifier type aliases

- Strict typecheck/build and all 164 fake/local-only tests passed.
- The live Nemotron payload `{ relation: "new", targetHandle: null }` commits
  as `{ type: "new" }` with empty candidates.
- Unknown `create`, missing type, and conflicting `type`/`relation` fail before
  reconcile or index and name the returned value.
- No live NVIDIA call was required for automated completion.

A008-0107 verification: 581 core, 4 membership and 161 GUI tests pass, with
root/GUI builds, independently installed protocol and portable engine proof.
GUI size/annotation warnings are unchanged. No running-host restart performed.

A008-0108 verification: 584 core, 4 membership, 161 GUI tests; root/GUI builds,
installed protocol and portable engine proof pass. No running-host restart.
