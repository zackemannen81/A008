![A008](https://github.com/zackemannen81/A008/blob/main/A008hero.jpg?raw=true)

# A008

A008 is a provider-neutral AI client and local engine with one shared runtime for
chat, tools, projects and persistent semantic memory. It currently ships a CLI,
an A008-owned web GUI/host, an ACP compatibility bridge, a portable engine
bundle, shared protocol contracts and an authenticated V2 WebSocket surface for
independent/native clients.

The repository is the canonical successor to A007. A007 is retired; A008 is the
current Single Source of Truth.

## Current state

| Area | Implemented state |
| --- | --- |
| Shared engine | Project-bound `ProjectRuntimeRegistry` / `EngineHost`, shared sessions, process ownership fencing and portable engine packaging |
| Web client | A008-owned Vite/React GUI using the compatible V1 host surface |
| Native/external API | V2 discovery, scoped device auth, one-use tickets and authenticated `WS /v2/session` |
| Semantic memory | Project-namespaced SQLite, semantic scope retrieval, additive projection, post-output extraction/reconciliation and L2/L3 lifecycle |
| Providers | NVIDIA Build, kie.ai and OpenAI chat dispatch; NVIDIA/kie image generation |
| Discovery | Read-only Zero Cost Radar over 26 validated free/free-tier provider-model routes; catalog presence never registers or routes a model |
| Projects | Create new projects or register/open an existing root without mutating its files |
| Tools | Approved repository/file/Git/shell tools plus approved stdio MCP tools |
| Compatibility | Stable V1 web/ACP paths remain covered while V2 is built out |

The stable-client API programme has completed Stages 1–3 and Stage 4 is now in progress. Its first child establishes stable application turn/message identity, event ordering, snapshot boundaries and terminal turn outcomes; command idempotency and reconnect/restart recovery remain later Stage-4 boundaries.
See [`docs/tasks/A008-0103_stable-client-api-program.md`](docs/tasks/A008-0103_stable-client-api-program.md).

## What works now

- Transactional chat sessions with streamed thought/content separation, rollback
  on failed turns and model-aware generation controls.
- One runtime/provider/memory ownership model shared by CLI, ACP, standalone GUI,
  portable engine and V2 session transport.
- Eight built-in chat profiles plus a user catalog. Live dispatch selects NVIDIA
  Build, kie.ai or OpenAI from the selected model/provider configuration.
- Persistent semantic memory with exact/entity/lexical/tag/domain retrieval,
  accumulated semantic discussion scope, bounded provider context, current/history
  separation and durable provenance.
- Post-output knowledge intake from the original user/source content and final
  answer only. Model proposals are validated, relation-classified and reconciled
  through runtime-owned canonical state; reasoning never becomes memory.
- Independent evidence and association lifecycle with reinforcement, dormant
  state, decay policy, receipts and audit in knowledge schema 4.
- Read-only memory diagnostics: overview, relationship map and knowledge manager.
- Parameters exposes a read-only Zero Cost Radar plus current V2/Stage-4 runtime
  discovery. The bundled GUI still uses V1 session transport until Stage 5.
- Structured model tools with explicit approval: repository read/create/edit,
  literal Git operations, shell execution and stdio MCP.
- Source intake with content-addressed storage and extraction for UTF-8 text,
  Markdown, PDF text layers and Word documents.
- Sandboxed renderer-local Code Canvas for completed HTML artifacts.
- Standalone PIN gate, same-origin enforcement, secret redaction and write-only
  provider-key settings.
- Short-loss V1 web-session recovery with heartbeat and a 45-second in-memory
  resume capability. This is a V1 GUI behavior, not the V2 Stage-4 contract.

For the detailed observed state, use
[`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) and
[`docs/SYSTEMDOC.md`](docs/SYSTEMDOC.md).

## Requirements

- Node.js `>=24.0.0 <25`
- npm
- At least one provider credential for live chat: `NVIDIA_API_KEY`, `KIE_API_KEY`
  or `OPENAI_API_KEY`

Model listing, help, contract verification and most automated tests do not need a
provider credential. Automated tests do not load `.env.local` or make live
provider calls.

## Install and verify

```powershell
npm ci
npm --prefix gui ci
npm run typecheck
npm test
npm run verify:protocol
npm --prefix gui run build
```

The latest merged-plus-A008-0136 verification passed **671 core + 4 membership +
175 GUI = 850 tests** with zero failures/skips. Root typecheck/build, production
GUI build and the independently packed `@a008/protocol` consumer proof also pass.

Useful additional checks:

```powershell
npm run benchmark:memory-loop
npm run package:engine
```

## CLI quick start

List available models without loading a credential:

```powershell
npm run build
node .\dist\src\cli.js models
```

For local chat, copy `.env.example` to `.env.local`, configure one supported
provider key, then run:

```powershell
npm run cli -- chat
```

Interactive commands include `/help`, `/model`, `/status`, `/history`, `/undo`,
`/reset`, `/cwd`, `/tools`, `/shell` (or `/!`) and `/exit`.

The CLI uses the same project-scoped memory-aware runtime as ACP. Provider
reasoning is display-only; committed chat and semantic intake receive the final
answer, not private reasoning.

See [`docs/LOCAL_MEMORY_SURFACES.md`](docs/LOCAL_MEMORY_SURFACES.md),
[`docs/RUNTIME_SETTINGS.md`](docs/RUNTIME_SETTINGS.md) and
[`docs/DEBUG_TRACE.md`](docs/DEBUG_TRACE.md).

## Standalone A008 GUI

```powershell
npm run gui
```
That builds `gui/` and starts the A008 GUI host. By default the single-origin
application is served at `http://127.0.0.1:8787`.

For hot-reload renderer development, run host and Vite separately:

```powershell
npm run gui-host
npm --prefix gui run dev
```

The bundled web GUI intentionally remains on the compatible V1 surface while the
new independent-client API is developed. It includes Chat, Memory, Tools, Help,
Projects, provider/model parameters, appearance themes, source upload, repository
work and Code Canvas.

Standalone mode can use `A008_GUI_PIN` with exactly six digits. Provider keys stay
in the host process and are never returned to the renderer. Shell and upload
requests use the same authenticated host boundary.

See [`docs/HOST_PROTOCOL.md`](docs/HOST_PROTOCOL.md) for V1 behavior and
[`docs/GUI_REPOSITORY_TOOLS.md`](docs/GUI_REPOSITORY_TOOLS.md) for repository
work from the GUI.

## Projects

Projects supports two distinct creation paths:

- **New project** — preview and create a root, optional Git, Docs-First starter
  and multi-agent policy.
- **Add existing** — register an already-existing absolute directory and open it
  through the shared runtime owner without modifying files inside that project.

Existing-project registration generates the A008 project identity and writes only
the external project registry. It does not guess, merge or migrate legacy memory.

## V2 API for native and independent clients

Stage 3 provides a usable authenticated session transport for clients such as
Tauri or Expo.

Discovery is public:

```text
GET /v2/info
```

Owner-local device credentials are created after a build:

```powershell
npm run build
npm run device -- grant --name MyClient --project PROJECT_ID --capability session
npm run device -- list
npm run device -- revoke DEVICE_ID
```

The raw device credential is printed once. Only its SHA-256 hash and bounded
metadata are stored in A008. Keep the raw credential in the platform secure
store; never place it in a URL, repository or provider prompt.

A device obtains a short-lived one-use ticket with authenticated
`POST /v2/auth/ticket`, then opens:

```text
WS /v2/session
Sec-WebSocket-Protocol: a008.v2
```

The first frame must authenticate within five seconds:
```json
{ "type": "authenticate", "ticket": "..." }
```

Implemented Stage-3 actions are:

```text
session/new
session/inspect
session/prompt
session/cancel
session/control
tool/permission
```

Each connection is bound to one authenticated principal/project and at most one
attached session. Device existence, project scope, capability and expiry are
rechecked on every operation. Revocation or expiry closes the live socket,
cancels owned work and denies pending tool approvals.

Current limits include 4 KiB pre-auth frames, 1 MiB authenticated input, 8 MiB
output and 64 KiB prompt text. The shared wire schemas live in
`packages/protocol/src/v2-auth.ts` and `packages/protocol/src/v2-session.ts`.

See [`docs/CLIENT_AUTH.md`](docs/CLIENT_AUTH.md) for the implemented contract and
[`docs/CLIENT_API_V2.md`](docs/CLIENT_API_V2.md) for the accepted complete V2
target.

### Important Stage-4 boundary

V2 now has stable application turn/message identity, per-session event sequencing, authoritative snapshot capture/drain ordering and explicit terminal turn outcomes from A008-0132. It does **not yet** promise reconnect/resume leases, command-idempotency receipts/replay or restart uncertainty handling. Native clients should not invent those remaining semantics independently; they belong to later Stage-4 children of A008-0103.

## Providers and models

A008 dispatches chat through the shared `ChatTransport` boundary. The default
composition is `EmbeddedAcmeChatTransport` over `acme-engine@0.1.5`, with A008
supplying model/provider configuration and ACME owning model execution. Explicit
`A008_CHAT_TRANSPORT=direct` keeps the provider-native reference/debug paths:

- NVIDIA Build through `NvidiaChatTransport`
- kie.ai through `KieChatTransport`
- OpenAI through `OpenAiChatTransport`

`A008_CHAT_TRANSPORT=acme` keeps the remote `acme-model-runtime/2` sidecar as an
explicit compatibility/deployment route; it is not the default.

The built-in registry currently contains eight verified profiles. User-added chat
models and provider/image settings live in the A008 user catalog rather than in
project source. Explicit model identity owns routing, so a saved provider
preference cannot silently hijack a selected model from another provider.

Provider keys may be supplied by environment or the reviewed local secret store.
The GUI receives only configured/source metadata, never key values.

Image generation is available through NVIDIA NIMs or kie Market jobs. Listed
video/music/native-provider endpoints that are marked unwired remain unsupported.

## Semantic memory

The live local runtime uses project-namespaced SQLite knowledge storage. A turn
can retrieve through exact/entity, lexical, stored tag/domain and classified
semantic-scope signals, then project matching state/history/events/utterances/
claims/artifacts/provenance additively under a hard context budget.

After a delivered answer, A008 can analyze durable claims, compare each proposal
to bounded current candidates, apply one of `new`, `restatement`, `extend`,
`supersede` or `conflict`, update indexes and persist canonical knowledge.
User/source attribution and exact support spans gate reinforcement and acceptance.

Evidence and semantic associations have independent lifecycle metadata,
reinforcement receipts, decay policy and audit. Reads and inspection do not
strengthen memory merely by observing it.
See [`docs/KNOWLEDGE_MEMORY_MODEL.md`](docs/KNOWLEDGE_MEMORY_MODEL.md) for the
accepted knowledge model and [`docs/SEMANTIC_MEMORY.md`](docs/SEMANTIC_MEMORY.md)
for the lower-level memory contract.

## Portable engine

A008 can be packaged with its own Node runtime and production dependencies:

```powershell
npm run package:engine
```

The extracted engine carries the compiled core, host, GUI, ACP surface and shared
protocol contract. Runtime data remains outside the installation. The package is
verified from an extracted copy rather than only from the source checkout.

See [`docs/ENGINE.md`](docs/ENGINE.md).

## Agent Canvas / ACP compatibility

Agent Canvas remains a supported operator compatibility path, not the primary
A008 product GUI. After building, its Custom ACP command can point to:

```text
node C:/code/A008/dist/src/acp/server.js
```

`A008-acp` uses the official ACP SDK, shares the same local runtime/memory
composition, streams thought and answer separately, supports session controls and
structured tool approvals, and has been exercised through a real local Agent
Canvas / Agent Server browser path against a deterministic loopback provider.

See [`docs/AGENT_CANVAS_INTEGRATION.md`](docs/AGENT_CANVAS_INTEGRATION.md).

## Architecture boundary

```text
CLI --------------------------.
A008 web GUI -> V1 host ------|----> shared ProjectRuntimeRegistry / EngineHost
native client -> V2 host -----'                 |
                                                v
                                      project-bound session
                                                |
                      .-------------------------+----------------------.
                      |                         |                      |
                      v                         v                      v
                 ChatSession              approved tools       semantic memory
                      |                                            read + write
                      v
              provider dispatch
          .-----------+-----------.
          |           |           |
          v           v           v
       NVIDIA       kie.ai      OpenAI

Agent Canvas -> Agent Server -> A008-acp -------^
```

The core does not read provider credentials itself. Composition roots own
environment/storage concerns and inject provider transports, project identity,
SQLite and tool boundaries. Supported clients converge on the same runtime owner
instead of implementing independent chat or memory engines.

The public contract package is `packages/protocol/`. It has no provider,
filesystem, runtime or React dependency and is independently packed/installed as
part of verification.

## Stable client API programme

| Stage | Status |
| --- | --- |
| 1. Current contract | Complete |
| 2. Project/session ownership | Complete |
| 3. V2 and authentication | Complete |
| 4. Turns and recovery | In progress — identity/order/snapshot/terminal foundation complete |
| 5. SDK and web migration | Not started |
| 6. Independent Expo proof | Not started |
| 7. Compatibility release | Not started |

Stage 4 is in progress. A008-0132 stabilizes turn/message identity, snapshot/event ordering and terminal outcomes; later children still own command replay/idempotency, reconnect/lease and restart uncertainty. Stage 5 then moves the completed shared contracts into an independent SDK and migrates the bundled web client.

## Security boundaries

- Provider credentials never belong in browser/native source, project files,
  URLs or model prompts.
- Native V2 devices use scoped expiring credentials and short-lived one-use WS
  tickets; owner grant/revoke remains local administration.
- Tool execution requires structured calls and explicit approval. Retrieved text
  or command-shaped assistant prose cannot grant execution authority.
- Source paths and project bindings are host-owned; ordinary V2 clients select
  registered project IDs, not arbitrary storage paths.
- The HTML Code Canvas preview is a unique-origin sandbox with network-denying
  policy and no host credential/tool handles.
- Raw legacy A007 material is provenance only and must not be executed or
  recommitted. Its historical exposed credential has been revoked.

For the complete current constraints and known gaps, read
[`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md).

## Configuration highlights

- `A008_GUI_HOST_PORT` — standalone host port.
- `A008_GUI_PIN` — optional six-digit standalone browser gate.
- `A008_GUI_HOST_ALLOWED_ORIGINS` — additional reviewed browser origins.
- `A008_SOURCE_STORE_PATH` — source/image blob store; must be outside the repo.
- `A008_PROVIDER_TIMEOUT_MS` — single provider-request timeout.
Chat generation controls also have deployment overrides such as
`A008_CHAT_TEMPERATURE`, `A008_CHAT_TOP_P`, `A008_CHAT_MAX_TOKENS`,
`A008_CHAT_REASONING_BUDGET` and `A008_CHAT_THINKING`. Runtime/global settings are
revision-guarded and documented in
[`docs/RUNTIME_SETTINGS.md`](docs/RUNTIME_SETTINGS.md).

## Docs-first workflow

Repository authority lives in the repository, not in chat history or agent
memory. Start with [`AGENTS.md`](AGENTS.md), then follow the reading order in
`docs/CURRENT_TASK.md`.

The key truth surfaces are:

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — approved product contract.
- [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) — observed current reality.
- [`docs/SYSTEMDOC.md`](docs/SYSTEMDOC.md) — durable implemented behavior.
- [`docs/JOURNAL.md`](docs/JOURNAL.md) — append-only work history.
- [`docs/FILESTRUCTURE.md`](docs/FILESTRUCTURE.md) — repository map.
- [`docs/adr/`](docs/adr/) — accepted architecture decisions.
- [`docs/tasks/`](docs/tasks/) — active/frozen programme and task records.
- [`docs/finished/`](docs/finished/) — immutable completed-task archives.

## Project lineage

```text
A007  original project — retired
  |
  `-- A008  active canonical repository / SSOT
```

Downstream A007-derived frontends are not upstream authority for A008.

## License

A008-owned repository contents are licensed under the Apache License 2.0.
Third-party code and dependencies retain their own licenses and notices.
