A008-0154 adds `src/tools/mcp-runtime.ts` for the ephemeral stdio probe, execution identity, server scope, and schema-driven session binding. `src/gui-host/mcp-health.ts` owns the process-local catalog ledger and probe memory behind `GET /v1/mcp-servers/health` and `POST /v1/mcp-servers/probe`. Parameters → MCP renders READY, FAILED, and RESTART REQUIRED. `ModelToolSession` remains the only owner that executes MCP tools for a chat.

A008-0152 adds `src/providers/compatible/{provider-routes,openai-compatible-chat-transport}.ts` as the explicit OpenAI-compatible execution boundary for validated Radar routes. `src/core/{execution-provider,user-catalog,provider-secrets}.ts` owns exact provider resolution, persisted route metadata and host-owned credentials; `src/providers/acme/embedded-acme-chat-transport.ts` composes the same routes into ACME `compatible[]`; `src/runtime/chat-dispatch.ts` owns the direct/reference switch. Protocol/client/GUI add the revalidated `POST /v1/catalog/zero-cost/models` route and write-only provider-key fields. Unknown providers no longer coerce to NVIDIA.

A008-0151 adds `src/gui-host/zero-cost-radar.ts` as the bounded live-feed fetch/validation owner while preserving `src/providers/zero-cost-model-catalog.ts` as the bundled offline snapshot. `packages/protocol/src/{routes,http-operations}.ts` and generated HTTP OpenAPI add explicit `POST /v1/catalog/zero-cost`; `packages/client` exposes the same refresh operation. `gui/src/settings/zero-cost-radar*.ts*` owns Update check, current-model availability and bounded one-click import through the existing user catalog. No new provider adapter is introduced.

A008-0149 adds `packages/client` as the independently installable `@a008/client` SDK over `@a008/protocol`. Cookie, bearer and engine credential adapters plus V1 session/HTTP and V2 session clients live there. Bundled GUI session/HTTP modules consume that package; `gui/src/session/use-gui-session.ts` remains the React adapter. `scripts/verify-client-package.mjs` packs and installs the client outside A008. Root `file:packages/protocol` makes `@a008/protocol` resolvable to in-repo tests.

A008-0148 adds persistent user-configured stdio MCP servers to the existing user catalog. `gui/src/settings/mcp-servers*.ts*` owns the Parameters → MCP editor and host client; `src/gui-host/provider-routes.ts` owns configuration validation/projection; `packages/protocol/src/{http-schemas,http-operations,routes}.ts` owns the V1 HTTP contract; and `src/gui-host/{server,local-acp-bridge,v2-session}.ts` supplies enabled definitions only at new `EngineHost` session construction. `ModelToolSession` remains the existing process, catalog, approval, cancellation and budget owner; settings does not spawn processes and changed configuration does not mutate active sessions.

A008-0142 adds `src/core/chat-content.ts` as the provider-neutral committed-content helper (string compatibility, typed `generated_image` parts, in-place pending/completed/failed/cancelled updates). `ChatSession`/`EngineHost` own the shared reserve→resolve lifecycle; `ModelToolSession` exposes bounded `generate_image`; V1 `image/generate` and snapshot `chatContentSchema` live in `packages/protocol/src`. The GUI reconstructs image turns from the host snapshot rather than a renderer-local image array. Provider jobs and the source store remain the durable media boundary; ACME does not generate images.

A008-0141 adds the renderer-local Oldscool CRT presentation to the existing theme owner: `gui/src/brand/{theme,themes,a008}.ts*` owns identity, complete semantic tokens, static pointer-inert scanlines and chrome/control phosphor bloom; `gui/src/memory/memory.css` adds Oldscool-only bloom for primary Memory buttons. `gui/src/app.tsx` renders the inert overlay, while `gui/index.html` applies the persisted identity before React mounts. No host/runtime/session/provider/memory or sandboxed Code Canvas preview behavior changes.

A008-0137 refines that existing read-only SVG presentation in `gui/src/memory/{memory-graph,memory-graph-shape,memory-graph-layout,memory.css}.tsx`: kind-specific neon forms and colours, directed arrows, selected stored-relation labels and parallel-topology width now make the bounded stored graph easier to inspect. Focus preserves the whole graph as dark dashed context while framing/emphasizing the selected neighbourhood. Arrow width is only the count of parallel displayed stored links in the same direction; it is never evidence strength or another memory semantic.

A008-0140 adds `test/A008-0140-stage4-restart-closure.test.ts` as the real-process restart/partial-memory closure proof, and extends V2 discovery plus `gui/src/settings/runtime-capabilities*.ts*` with the explicit `session.restart-uncertainty`/Stage-4-complete signal. No restart persistence or second recovery owner is introduced; `serverInstanceId`, the existing receipt registry and the existing resume owner provide the bounded semantics being proven.

A008-0139 extends the existing `src/gui-host/v2-session.ts`/`v2-websocket.ts` owners with detached-session lease state, opaque resume capability, `session/resume` dispatch and hard-termination on revoke. Shared protocol changes remain in `packages/protocol/src/{v2-auth,v2-session}.ts` with generated V2 resume/session/info schemas. `test/A008-0139-stage4-reconnect-resume.test.ts` owns deterministic lease/identity/expiry/no-replay coverage; `test/v2-auth.test.ts` owns real-host disconnect/resume, second-writer/foreign-principal/explicit-close and stale-approval regressions. At the A008-0139 boundary the Runtime capability UI reported the 45-second lease with only restart uncertainty pending; A008-0140 now closes that final Stage-4 gap.

A008-0138 adds `src/gui-host/v2-command-receipts.ts` as the bounded process-local receipt owner used by the existing V2 session/WebSocket boundary. `packages/protocol/src/{v2-auth,v2-session}.ts` and generated V2 schemas/OpenAPI expose command IDs, receipt metadata, command conflict/unknown/capacity outcomes and authenticated receipt lookup. `test/A008-0138-stage4-command-receipts.test.ts` owns deterministic digest/retention/capacity/principal-isolation coverage; `test/v2-auth.test.ts` owns real-host retry, conflict, tool-permission dedupe and HTTP lookup coverage. At the A008-0138 boundary `gui/src/settings/runtime-capabilities*.ts*` presented the implemented receipt slice with reconnect/restart still pending; A008-0139/0140 subsequently close those Stage-4 gaps.

A008-0136 exposes recent capability through the existing GUI/host owners. `packages/protocol/src/{routes,http-schemas,http-operations}.ts` adds the typed read-only `GET /v1/catalog/zero-cost` contract and generated HTTP OpenAPI entry; `src/gui-host/server.ts` projects `ZERO_COST_MODEL_ROUTES` without mutation. `gui/src/settings/zero-cost-radar*.ts*` owns the discovery-only Parameters view. `gui/src/settings/runtime-capabilities*.ts*` reads public `/v2/info` and renders the implemented Stage-4 foundation without migrating bundled chat away from V1. `src/gui-host/v2-auth.ts` advertises only the Stage-4 features already delivered by A008-0132.

A008-0134 adds `src/providers/zero-cost-model-catalog.ts`: a typed, importable, data-only snapshot of currently verified zero-cost/free-tier provider-model routes. It carries access/lifecycle/quota/privacy/provenance metadata and optional existing A008 profile IDs; it has no runtime imports and does not register or route models.

A008-0133 adds `gpt-5.6-terra` beside Luna in `src/core/model-registry.ts` and the existing generation-control/runtime composition. Terra is additive, resolves through `executionProvider=openai` and is automatically composed into the native embedded OpenAI Responses route; Luna remains the existing default.

A008-0131 advances the default embedded runtime to registry `acme-engine@0.1.5`. `src/providers/acme/acme-model-runtime.ts` now composes A008-owned OpenAI profiles under ACME's native `openAi` route, so Luna/Terra text, tools, semantic JSON and invocation-local vision use `/v1/responses`; NVIDIA remains Chat Completions and KIE remains a compatible route. The direct `OpenAiChatTransport` stays a reference/debug Chat Completions path.

A008-0130 keeps image acquisition inside the existing source-store boundary. `gui/src/composer/composer.tsx` and `gui/src/upload/` unify paste, picker, drag/drop and explicit absolute local path into one active `PromptImageAttachment`; `src/gui-host/server.ts` owns bounded local-path import through `POST /v1/upload`, and `packages/protocol/src/host-parser.ts` preserves the optional attachment through V1 parsing.

A008-0127 establishes `src/providers/acme/embedded-acme-chat-transport.ts` as the default in-process `ChatTransport`; A008-0131 advances the current registry dependency to `acme-engine@0.1.5`. `src/core/execution-provider.ts` still owns `executionProvider` resolution and ACME provider hints. `src/runtime/chat-dispatch.ts` and `local-runtime-config.ts` default to embedded ACME, preserve direct NVIDIA/kie/OpenAI dispatch behind `A008_CHAT_TRANSPORT=direct`, and preserve the remote `acme-model-runtime/2` transport behind `A008_CHAT_TRANSPORT=acme`. No memory/knowledge/orchestration module imports ACME types.

Standalone GUI authentication remains inside the existing host boundary: `src/gui-host/pin-auth.ts` adds an optional six-digit browser gate, random cookie session and failed-attempt throttle without adding a renderer dependency or second credential owner. `gui/src/session/engine-access.ts` also owns the bundled renderer's exact-match recovery from an expired standalone PIN cookie back to the existing login gate; native engine capability auth remains separate.

# File Structure

`src/platform/{types,sqlite-schema,platform-store,index}.ts` owns durable local
platform records; `docs/platform/STORE.md` documents the internal storage API.
`test/platform-store.test.ts` verifies SQLite transaction/lease/recovery boundaries.

`docs/platform/CONVERSATION_SEED.md` documents the trusted internal history
option across EngineHost, ACP composition and LocalMemoryRuntime (A008-0163).

A008-0162 adds `packages/protocol/src/platform-v3.ts`, generated
`packages/protocol/schemas/platform-v3*` artifacts and
`docs/platform/PROTOCOL.md` for the additive platform wire contracts.
A008-0165 adds `packages/client/src/platform-v3.ts` and the implemented
`docs/platform/CLIENT.md` SDK. A008-0164 adds `src/platform/coordinator.ts`,
`src/platform/runtime-adapter.ts`, `src/platform/local-config.ts`,
`src/gui-host/platform-v3-http.ts` and `docs/platform/BACKEND.md`.
`src/gui-host/server.ts` opts the host in. `src/platform/platform-store.ts`
adds read-only `lookupRunReceipt`. `test/platform-host.test.ts` and
`test/fixtures/platform-host-process.ts` prove the real host, including
child-process restart. A008-0168 adds `src/platform/admin-cli.ts`,
`test/platform-admin-cli.test.ts` and `docs/platform/ADMIN.md`. Root
`package.json` adds `platform-admin` and registers that test in `test:core`.
A008-0167 adds `gui/src/platform/` and `docs/platform/GUI.md`. `gui/src/app.tsx`
adds the Platform page beside the existing navigation. No protocol, host, or
V1 chat owner changes in that task.

`test/helpers.ts` defaults `A008_CATALOG_PATH` inside `isolatedMemoryEnv` to a
missing temporary catalog so shared host fixtures do not load the operator
model/MCP catalog. `test/A008-0149-client-v2-host.test.ts` asserts that
default, override precedence, and the real-host V2 prompt (A008-0166).

`docs/A008_Platform-devplan.md` is the stage and milestone plan. The spec,
ADR 0048 and the A008-0160 program remain the authority; the plan does not
close a stage by itself.

`docs/PLATFORM_V3_CONTRACT.md` owns the accepted first durable-work contract
under ADR 0048. `docs/tasks/A008-0160_platform-implementation-program.md` owns
the implementation dependency graph; child charters freeze each delivery.

`docs/A008_PLATFORM_SPEC.md` is the proposed distributed platform specification,
created by A008-0156 and updated to v1.2 by A008-0159. Sections 21.1 and 27
define model-aware verification budgets; TASK_WORKFLOW owns the adopted working
defaults and template_CURRENT_TASK records resolved task allocations.
Section 7.1 separates
Execution Verification Evidence from semantic evidence and memory ingestion.
It includes durable parallel
runs, multi-project/client ownership, devices, isolation, migration and the
established Docs-First multi-agent workflow. Section 8.1–8.7 integrates the four
add-on contracts; source baselines and product integration gates distinguish
practice from newly proposed implementation. Accepted API/ACME/memory contracts
are not superseded and no new runtime behavior is claimed.

A008-0155 adds `gui/src/projects/project-sidebar.tsx` and `project-sidebar.css`
for the theme-aware project/chat tree and details dialog. Existing project routes,
SDK/protocol owners and `src/runtime/conversation-state-store.ts` own metadata,
summary projection, saved chats and selection. The synthetic real-host/production
GUI preview is `gui/test/project-sidebar-preview.mjs`; regression tests extend
the existing project GUI, HTTP contract and local runtime suites.

`docs/A008_SYSTEM_ARCHITECTURE.md` owns the target logical architecture for local/hosted A008 with embedded `@acme-engine/model-runtime` and the A008/ACME/provider ownership boundary.

A008-0111 extends the existing `src/bootstrap/` registry/service/validator and `src/gui-host/project-routes.ts` with read-only adoption of an already-existing root. `packages/protocol/src/{routes,http-schemas,http-operations}.ts` owns the additive `POST /v1/projects/register` contract and regenerated OpenAPI. `gui/src/projects/` owns the separate New/Add existing modes. No new persistence owner or project-tree metadata file is introduced; registration writes only the existing external projects registry.

A008-0106 adds `docs/CLIENT_API_V2.md`, the accepted protocol/lifecycle target,
and `docs/adr/0041-client-api-v2-and-ownership.md`, its decision/authority record.

A008-0105 extends `packages/protocol/src` with `http-schemas.ts`, operation/schema
mapping and OpenAPI derivation in `http-operations.ts`, and pure compatibility
parsers in `http-parsers.ts`, `upload-parser.ts`, `shell-parser.ts`. Generated
`schemas/http.openapi.json` and 52 pre-extraction cases in
`fixtures/v1-http-compatibility.json` ship with the package. The existing schema
generator/package proof now includes HTTP. `test/http-contract.test.ts` verifies
baseline parity, artifact references/coverage and all real-host HTTP operations.

A008-0103 records the frozen API program in `docs/tasks/` and ADR 0040. Its first
child A008-0104 adds `packages/protocol/`: pure TypeScript schema/type/parser
source, five generated JSON schemas, 90 legacy compatibility fixtures, package
README/license and an independent build. Existing host/core/GUI wire modules
adapt that shared source. `test/protocol-contract.test.ts` checks fixtures,
schema drift, source boundaries and route inventory; existing host tests check
real output against the schemas. `scripts/generate-protocol-schemas.mjs` derives
artifacts; `scripts/verify-protocol-package.mjs` verifies an independently installed
consumer. `docs/HOST_PROTOCOL_V1_INVENTORY.md` maps every HTTP/WS operation to its
current auth/context/owner. The engine bundler includes the compiled protocol.

A008-0101 adds `src/memory/knowledge/sqlite-rows.ts`, the shared schema-4 row
serialization and keyed delta writer used by the existing SQLite store/context.
`scripts/benchmark-knowledge-persistence.mjs` compares bulk and incremental
reinforcement on temporary synthetic WAL databases after a root build. It uses
no provider or user data. Regression coverage stays in the existing
`test/knowledge-model/sqlite-store.test.ts`; evidence is indexed under `docs/evidence/`.

A008-0085 adds `scripts/check-semantic-extraction.mjs`: a dry-run-by-default
synthetic extraction check through the existing built generator/transport/stager.
Live mode requires an explicit flag, selected model and resolved verification budget;
it opens no memory store. Instruction and diagnostic fixes stay in the existing
`src/orchestration/semantic-json-model.ts`; no new runtime/API/schema owner.

A008-0084 adds `gui/src/memory/memory-graph-layout.ts` for deterministic cluster
and label geometry. `gui/test/memory-map-preview.mjs` and its TSX fixture expose
an isolated synthetic preview only when the test runner is started;
`gui/test/README.md` records browser checks. The existing MemoryPage/SVG/inspector
remain the presentation owners; no runtime, schema, API or package change.

A008-0083 repairs semantic options/instructions in the existing runtime and
semantic JSON owner. Its charter, archive and handoff use the existing task
collections; no new runtime module, package or data schema is introduced.

A008-0079 adds `docs/backlog/instruction-plane-and-memory-lifecycle.md`, now
frozen under `docs/adr/0035-frozen-instruction-and-memory-target.md`. Its body
remains the one reviewed requirement owner. A008-0080's L1 charter is in
`docs/tasks/A008-0080_coherent-instruction.md`; current behavior is in SYSTEMDOC.

A008-0080's L1 uses the existing `src/core/chat-invocation.ts` as the final
instruction owner, with explicit/global configuration and contextual components.
Existing runtime factories, memory orchestration and CLI preserve base provenance.
No new runtime module, dependency, memory schema or settings schema is introduced.

A008-0078 adds the core product contract to the existing brief and the necessity
gate to the workflow and task template. Adoption authority is
`docs/adr/0034-product-contract-and-necessity-gate.md`; completion and integration
evidence use the existing finished-task and handoff collections.

A008-0077 adds `src/gui-host/frame-policy.ts` and `browser-frame.ts`, plus
`GET /v1/browser/frame-check`. Sites that forbid iframes are not framed; the
Browser pane offers Open in the system browser.

A008-0076 adds a transparent 4D starfield canvas behind the empty conversation
only (`gui/src/chat/starfield.tsx`). It unmounts when the transcript has turns.

A008-0075 lets the empty-chat shortcut dock hide and restore from a Shortcuts
control; the choice is stored in localStorage. Keyboard shortcuts stay active.

A008-0074 adds `gui/src/brand/a008-ascii.ts` and `ascii-logo.tsx`: the owner
ASCII mark on the empty conversation, above the start cards.

A008-0087 adds `src/providers/openai/openai-chat-transport.ts`, the built-in
`gpt-5.6-luna` profile, OpenAI dispatch, write-only OpenAI provider settings and
OpenAI-only semantic/retrieval composition. Design decision:
[ADR 0036](adr/0036-openai-gpt-56-luna-provider.md).

A008-0073 adds `src/providers/kie/` (`kie-models.ts`, `kie-chat-transport.ts`,
`kie-jobs.ts`), `src/runtime/chat-dispatch.ts`, host `GET /v1/catalog/kie`, and
Provider settings for a write-only kie key plus `chatProvider`/`imageProvider`.
Design decision: [ADR 0033](adr/0033-kie-provider.md).

A008-0071 adds `src/providers/nvidia/nvidia-image-transport.ts`,
`nvidia-catalog.ts`, `src/core/user-catalog.ts`, `src/core/provider-secrets.ts`,
`src/gui-host/provider-routes.ts`, `gui/src/settings/nvidia-catalog-panel.tsx`,
`gui/src/images/`, and start-action cards. Design decision:
[ADR 0032](adr/0032-nvidia-catalog-and-image-generation.md).

A008-0070 adds `gui/src/help/`, `gui/src/browser/`, `gui/src/files/`, and
`gui/src/workbench/environment-panel.tsx` with git-status parsing. The Chat
workbench is the environment/sources card; Help hosts the tool catalog; Tools
keeps Terminal/Files/Browser/Upload. The memory graph is a clustered radial
layout. Design decision: [ADR 0031](adr/0031-workbench-context-and-memory-map.md).

A008-0069 adds `gui/src/brand/workspace.css`, loaded after shared tokens and
feature styles by `main.tsx`. `app.tsx` owns sidebar/panel visibility and
parameter focus restoration; chat/composer retain their feature ownership.
Design decision: [ADR 0030](adr/0030-focused-standalone-workspace.md).

A008-0068 adds `src/tools/repository-tools.ts` (native file/Git definitions and
execution), `gui/src/tools/repository-pane.tsx`, `repository.css` and
`repository.test.ts` (catalog, workspace, shortcuts and activity). A008-0145
keeps the same owner but makes the aggregate tool-summary disclosure state stable
across sequential running/completed snapshots and covers the state rule in
`repository.test.ts`. Additional
native and standalone integration checks live in `test/model-tools.test.ts`.
The runbook is [GUI_REPOSITORY_TOOLS.md](GUI_REPOSITORY_TOOLS.md).

A008-0067 adds `src/engine/{server,engine-host}.ts`, the manifest-backed shared
project/session composition; `src/tools/{model-tools,acp-tools}.ts` implement
validated native/MCP calls and ACP approvals. `scripts/package-engine.mjs` builds
the portable directory; `scripts/verify-engine-package.mjs` tests an extracted
copy through the external client's actual native host. `test/engine-host.test.ts`,
`test/model-tools.test.ts` and `test/fixtures/tool-mcp.ts` cover these boundaries.
Renderer session authentication and approvals live in `gui/src/session/engine-access.ts`
and `tool-permission-dialog.tsx`. Runbooks: [ENGINE.md](ENGINE.md) and
[RUNTIME_SETTINGS.md](RUNTIME_SETTINGS.md). Package output and evidence binaries
are outside the repository. The separate companion frontend source stays external.

```text
A008/
|- AGENTS.md                         entry point and safety rules
|- README.md                         public project overview
|- LICENSE                           Apache License 2.0 for A008-owned content
|- .gitignore                        secret, build, provenance, and input bounds
|- .env.example                      non-secret local credential template
|- package.json                      Node package, scripts, exports, CLI metadata
|- package-lock.json                 exact npm dependency graph
|- tsconfig.json                     strict ESM TypeScript build
|- gui/                              A008-owned product UI (ADR 0019)
|  |- package.json                   Vite/React GUI package
|  |- index.html                     Vite entry document
|  |- vite.config.ts                 dev server and /health + /v1 proxy (ws enabled)
|  |- src/
|  |  |- main.tsx                    renderer bootstrap
|  |  |- app.tsx                     shell layout (operator-owned)
|  |  |- projects/                   New/Add existing/Open/Recent project UI (A008-0094/A008-0111)
|  |  |- highlight/                  highlight.js wrapper for chat/Canvas code
|  |  |- memory/                     A008-0064 read-only memory diagnostics
|  |  |  |- memory-page.tsx          three views, filters, refresh and pagination
|  |  |  |- memory-client.ts        validated host inspection client
|  |  |  |- memory-overview.tsx      actual inventory and domain counts
|  |  |  |- memory-graph.tsx         stable SVG graph, focus camera and zoom
|  |  |  |- memory-graph-layout.ts  spaced domain clusters and selective labels
|  |  |  |- memory-inspector.tsx     escaped record details
|  |  |  |- memory.css              responsive layout using existing tokens
|  |  |  `- memory.test.ts           client, DOM and graph checks
|  |  |- help/                       A008-0070 tool catalog and shortcuts
|  |  |- workbench/                  tab host plus environment/sources card
|  |  |- browser/                    A008-0070 sandboxed URL pane
|  |  |- files/                      A008-0070 tracked-file list
|  |  |- session/                    A008-0033 WebSocket session client
|  |  |  |- protocol.ts              host protocol v1 frames and URL resolution
|  |  |  |- gui-session-client.ts    socket lifecycle, controls and committed snapshots
|  |  |  |- session-controls.ts     renderer control types and metadata/snapshot validation
|  |  |  `- use-gui-session.ts       React hook exposing GuiSession
|  |  |- artifact/                   A008-0091 transient Code Canvas
|  |  |  |- code-artifact.ts             fenced HTML parser, 256 KiB bound and preview policy
|  |  |  |- code-artifact-panel.tsx       renderer-local Code/Preview editor surface
|  |  |  |- code-artifact.css             desktop/mobile Canvas composition
|  |  |  |- code-artifact.test.ts         parser/CSP/sandbox regressions
|  |  |  `- code-artifact-panel.test.ts   rendered sandbox/credential-boundary regression
|  |  |- chat/                       A008-0034 transcript
|  |  |  |- empty-shortcuts.tsx      workbench shortcut chips and hide/show dock
|  |  |  |- starfield.tsx            empty-chat 4D starfield layer
|  |  |  |- starfield-engine.ts      4D rotate/project and canvas loop
|  |  |  |- chat-pane.tsx            user/answer/thought channels plus explicit HTML Canvas action
|  |  |  |- chat-history.ts          pure turn-commit reducer
|  |  |  |- chat-transcript.ts       transcript model
|  |  |  `- capture-prompt.ts        user-text observation shim
|  |  |- composer/                   A008-0035 slash composer
|  |  |- terminal/                   A008-0036 terminal pane
|  |  |- settings/                   A008-0037 settings; A008-0145 explicit Semantic controls
|  |  |  |- parameters-panel.tsx     chat Model plus separate global Semantic/runtime pages
|  |  |  |- global-settings-form.tsx persistent instructions/budgets and semantic model/effort
|  |  |  |- runtime-preferences.ts   shared V1 runtime-preference types/guards
|  |  |  |- parameters.css          parameter and session-control styling
|  |  |  |- appearance-panel.tsx     A008-0093 App theme picker
|  |  |  |- nvidia-catalog.ts        NVIDIA/kie/OpenAI provider-settings client
|  |  |  `- nvidia-catalog-panel.tsx Provider keys, NVIDIA Build, kie market, OpenAI
|  |  |- brand/                      A008-0037 identity; A008-0093 theme tokens
|  |  |  |- themes.css               Neutral, Deep Space and Oldscool semantic token values
|  |  |  |- theme.ts                 theme identity and root attribute
|  |  |  |- theme-storage.ts         renderer-local appearance preference
|  |  |  |- a008-ascii.ts            A008-0074 owner ASCII source
|  |  |  `- ascii-logo.tsx           empty-chat decorative mark
|  |  `- upload/                     A008-0045 upload client and pane
|  `- test/                          A008-0039 shared GUI test runner
|     |- loader.mjs                  registers the resolver for node --test
|     |- resolve.mjs                 .ts/.tsx resolution, esbuild, CSS stubbing
|     `- node-test-env.d.ts          the one ambient Node declaration for tests
|- src/
|  |- index.ts                       public core/provider exports
|  |- bootstrap/                     project create/register/open registry (A008-0094/A008-0111)
|  |- gui-host/                      A008-0032 HTTP/WS ACP bridge (product GUI)
|  |  |- server.ts                   HTTP routes, static GUI, upgrade handling
|  |  |- acp-bridge.ts               A008-acp stdio subprocess bridge
|  |  |- protocol.ts                 host protocol v1 frames and defaults
|  |  |- websocket.ts                minimal dependency-free WebSocket server
|  |  |- origin.ts                   same-origin/loopback guard
|  |  |- pin-auth.ts                  optional six-digit standalone browser gate
|  |  |- source-store.ts             A008-0044 content-addressed blob store
|  |  |- provider-routes.ts          catalog, provider settings, image generate
|  |  |- frame-policy.ts             CSP/XFO framing allow check
|  |  |- browser-frame.ts            host probe for Browser pane iframe
|  |  `- redact.ts                   credential and authorization redaction
|  |- ingest/                        A008-0042 source extraction (ADR 0020)
|  |  |- types.ts                    SourceExtractor, ExtractedSource, ImageDescriber
|  |  |- errors.ts                   named unsupported/invalid/description errors
|  |  |- media-type.ts               magic-byte sniffing and strict UTF-8 decode
|  |  |- text-extractor.ts           verbatim text; appears_in
|  |  |- pdf-extractor.ts            A008-0056 pdf.js text layer, lazily imported
|  |  |- docx-extractor.ts           A008-0056 Word part; appears_in
|  |  |- zip.ts                      A008-0056 ZIP central directory over node:zlib
|  |  |- ooxml.ts                    A008-0056 WordprocessingML text scanner
|  |  |- image-extractor.ts          model description; derived_from
|  |  |- nvidia-image-describer.ts   vision payload, injectable endpoint/fetch
|  |  `- registry.ts                 first extractor that claims the type
|  |- cli.ts                         terminal composition root
|  |- cli/
|  |  `- slash.ts                    interactive /command parser
|  |- tools/
|  |  `- terminal.ts                 native shell runner for /shell
|  |- acp/
|  |  |- A008-acp-agent.ts           injectable ACP session/event bridge
|  |  |- prompt-content.ts           baseline ACP prompt normalization
|  |  `- server.ts                   stdio ACP executable composition root
|  |- core/
|  |  |- chat-invocation.ts          ephemeral context, history window, and exact request budget
|  |  |- chat-content.ts             multimodal committed-content helpers and generated-image identity
|  |  |- types.ts                    provider-neutral chat contracts
|  |  |- errors.ts                   typed error taxonomy
|  |  |- model-registry.ts           verified model profiles and lookup
|  |  |- execution-provider.ts       openai/nvidia/kie execution route vs vendor provider
|  |  |- generation-controls.ts     capabilities, complete parameter sets and validation
|  |  |- session-control.ts         shared control/snapshot contract
|  |  |- user-catalog.ts            ~/.a008/catalog.json chat/image provider settings
|  |  |- provider-secrets.ts        write-only NVIDIA/kie/OpenAI keys in ~/.a008/secrets.json
|  |  `- chat-session.ts             transactional in-memory conversation
|  |- identity/
|  |  |- types.ts                    branded IDs and ACP binding repository port
|  |  |- errors.ts                   runtime identity error taxonomy
|  |  |- runtime-id.ts               canonical v1 parser and UUIDv4 factory
|  |  `- in-memory-binding-repository.ts  atomic ACP binding reference adapter
|  |- memory/
|  |  |- types.ts                    memory state, policy, repository, and projection ports
|  |  |- errors.ts                   deterministic memory error taxonomy
|  |  |- coding-agent-policy.ts      no-decay exact-match reference policy
|  |  |- serialization.ts            stable projection JSON and UTF-8 measurement
|  |  |- in-memory-repository.ts     atomic transaction-serialized reference store
|  |  |- memory-engine.ts            reconciliation, discovery, history, and projection service
|  |  |- retrieval-types.ts          planner, candidate-store, scoring, and evidence contracts
|  |  |- deterministic-retrieval-planner.ts  bounded provider-free message classifier/planner
|  |  |- hybrid-retrieval-policy.ts  explicit channel weights, limits, and thresholds
|  |  |- hybrid-memory-reader.ts     deduplicated scoring and read-only projection funnel
|  |  |- sqlite-memory-repository.ts durable local canon, audit, FTS5, and retrieval indexes
|  |  `- knowledge/
|  |     |- types.ts                 ontology, slots, clocks, INTERPRET proposals
|  |     |- errors.ts                knowledge-model input/proposal errors
|  |     |- ids.ts                   branded artifact and entity identifiers
|  |     |- clocks.ts                Instant/Interval unknown round-trip
|  |     |- registry.ts              in-memory entity and slot registries
|  |     |- interpret.ts             INTERPRET: proposes only, writes nothing
|  |     |- state-types.ts           bindings, intervals, transitions
|  |     |- state.ts                 current state and history
|  |     |- reconcile.ts             deterministic slot RECONCILE
|  |     |- update.ts                atomic interval UPDATE
|  |     |- evidence-types.ts        utterance, claim, event, provenance
|  |     |- evidence.ts              evidence store
|  |     |- ingest.ts                INGEST: artifact and raw utterance
|  |     |- accept.ts                ACCEPT: claim status only
|  |     |- payload.ts               sectioned projection payload
|  |     |- lifecycle-types.ts       evidence-only memory lifecycle
|  |     |- lifecycle.ts             REINFORCE/WEAKEN/DECAY/REACTIVATE
|  |     |- read-types.ts            intents, scope, retrieved records
|  |     |- define.ts                DEFINE semantic scope and intents
|  |     |- retrieve.ts              RETRIEVE; direct match ignores lifecycle
|  |     |- expand.ts                EXPAND depth 1; dormant filter
|  |     |- filter.ts                FILTER applicability and budget
|  |     |- compose.ts               COMPOSE grouping and order
|  |     |- project.ts               PROJECT: typed payload, writes nothing
|  |     |- read.ts                  DEFINE..PROJECT coordinator
|  |     |- sqlite-schema.ts         knowledge SQLite DDL, separate families
|  |     |- sqlite-store.ts          interval/evidence/lifecycle persist + v0 migrate
|  |     |- sqlite-context.ts        persisting KnowledgeReadContext
|  |     |- labels.ts                stored tags/domains + the index that finds them
|  |     |- live-reader.ts           live DEFINE..PROJECT MemoryReadPort
|  |     |- inspection.ts            A008-0064 provider-free inventory and graph
|  |     |- projection-items.ts      every surface reaches the model; rank, dedupe, budget (ADR 0023)
|  |     |- labels.ts               stored tags and domains, and the index that finds them
|  |     |- current-scope.ts         accumulating discussion scope (ADR 0024)
|  |     |- live-commit.ts           live INGEST/ACCEPT/RECONCILE/UPDATE
|  |     `- index.ts                 knowledge-tree barrel
|  |- orchestration/
|  |  |- memory-prompt-composer.ts   ID-free materialized memory/user envelope
|  |  |- memory-aware-chat-session.ts verified read-before-one-chat-call coordinator
|  |  |- post-output-knowledge-intake.ts reasoning-free bounded proposal staging
|  |  |- post-output-memory-coordinator.ts sequential batch/checkpoint/repair ownership
|  |  |- relation-candidate-source.ts bounded indexed current-candidate materialization
|  |  |- relation-gated-memory-commit.ts ID-free guarded five-way write coordinator
|  |  |- semantic-operation.ts          optional shared cancellation context
|  |  `- semantic-json-model.ts         stateless strict-JSON transport owner and adapters
|  |- benchmark/
|  |  `- memory-loop.ts              fake-provider/actual-SQLite two-turn proof
|  |- providers/
|  |  |- nvidia/
|  |  |  |- nvidia-chat-transport.ts  NVIDIA fetch adapter and response mapping
|  |  |  |- nvidia-image-transport.ts NIM image generate
|  |  |  |- nvidia-catalog.ts         NVIDIA Build model list
|  |  |  |- reasoning-normalizer.ts   SSE channel-transition reasoning isolation
|  |  |  `- sse.ts                    chunk-safe SSE data parser
|  |  |- kie/
|  |  |  |- kie-models.ts             curated market ids and chat URL helper
|  |  |  |- kie-chat-transport.ts     OpenAI-compatible kie chat
|  |  |  `- kie-jobs.ts               createTask + recordInfo image poll
|  |  |- openai/
|  |  |  `- openai-chat-transport.ts  GPT-5.6 Luna Chat Completions + tools/SSE
|  |  `- acme/
|  |     |- acme-model-runtime.ts            shared request/result/error/evidence mapping
|  |     |- embedded-acme-chat-transport.ts  default in-process acme-engine ChatTransport
|  |     |- acme-sse.ts                      remote SSE event-name + data parser
|  |     `- acme-chat-transport.ts           explicit remote acme-model-runtime/2 compatibility transport
|  `- runtime/
|     |- nvidia-session.ts            NVIDIA credential and direct transport owner
|     |- chat-dispatch.ts             embedded default plus explicit direct/remote selection
|     |- local-runtime-config.ts      SQLite, identity, debug and chat-transport mode settings
|     |- debug-trace.ts               opt-in secret-safe JSONL observer
|     |- user-assertion-gate.ts       runtime-owned new-memory activation
|     |- conversation-state-store.ts  project-scoped durable current workspace conversation
|     `- local-memory-runtime.ts      CLI/ACP memory composition root and workspace hydration
|- test/                              fake/local chat, ACP, memory, retrieval, identity, and orchestration tests
|  |- chat-dispatch.test.ts           NVIDIA vs kie vs OpenAI chat routing plus ACME opt-in
|  |- acme-chat-transport.test.ts    ACME protocol, failure evidence, no-fallback, boundary
|  |- acme-execution-parity.test.ts  direct-vs-ACME chat, tools, semantic JSON and knowledge
|  |- openai-chat-transport.test.ts  OpenAI payload, SSE, tool calls and errors
|  |- kie-chat-transport.test.ts      kie OpenAI-compatible chat JSON/SSE
|  |- kie-jobs.test.ts                Market createTask/recordInfo image poll
|  |- gui-host.test.ts                host routes, upload, WS bridge, credential gate
|  |- session-controls.test.ts        model parameters, lifecycle and real host/ACP payload proof
|  |- memory-inspection.test.ts       inventory, nonmutation, bounds, HTTP/ACP proof
|  |- ingest-source.test.ts           sniffing, extraction, and provenance
|  |- document-extraction.test.ts    PDF, Word, ZIP and OOXML readers
|  |- core-suite-membership.test.ts  test:core names every test file, and only real ones
|  |- knowledge-labels.test.ts       stored tags/domains, the label channel, schema 2 migration
|  |- knowledge-projection.test.ts   every matching surface reaches the model, ranked and budgeted
|  |- knowledge-labels.test.ts       stored labels, the label channel, statement slots as sets
|  |- current-scope.test.ts          scope accumulation, reset, ceiling, and the owner's sequence
|  |- knowledge-labels.test.ts       stored tags/domains, the label channel, schema 2 migration
|  |- knowledge-projection.test.ts   every matching surface reaches the model, ranked and budgeted
|  |- knowledge-labels.test.ts       stored labels, the label channel, statement slots as sets
|  |- current-scope.test.ts          scope accumulation, reset, ceiling, and the owner's sequence
|  |- runtime-source-ingest.test.ts   locator containment and ingest passthrough
|  |- gui-host/
|  |  `- fake-acp.ts                  spawnable ACP stdio stand-in
|  |- fixtures/
|  |  |- session-control-provider.ts  loopback-only synthetic session proof server
|  |  |- documents.ts                built PDF and ZIP/DOCX fixtures, no binaries
|  |  |- fake-nvidia-server.ts        loopback runtime-proof SSE fixture
|  |  |- nvidia-live-reasoning-leak.json  live Nemotron channel-leak characterization
|  |  `- nvidia-live-relation-alias.json  live classifier relation-vs-type payload
|  |- knowledge-model/
|  |  |- semantic-addressing.test.ts S3 INTERPRET and slot addressing
|  |  |- state-history.test.ts     S1/S2/S8/S10 state and history
|  |  |- evidence.test.ts          S4/S5/S9 utterance, ACCEPT, payload
|  |  |- scenarios.test.ts         full S1–S10 in-memory and SQLite
|  |  `- sqlite-store.test.ts      unknown boundaries and v0 migration
|  `- fake-nvidia-server.test.ts      fixture success and auth rejection
`- docs/
   |- AGENT_CANVAS_INTEGRATION.md     Custom ACP operator boundary and runbook
   |- SEMANTIC_MEMORY.md              implemented v0 memory contract and limits
   |- HYBRID_MEMORY_READ_PATH.md      implemented SQLite hybrid read-path contract
   |- MEMORY_AWARE_CHAT_ORCHESTRATION.md  implemented bounded application read path
   |- MEMORY_LOOP_BENCHMARK.md        deterministic read/chat/commit/reread proof
   |- POST_OUTPUT_KNOWLEDGE_INTAKE.md implemented reasoning and proposal-staging boundary
   |- POST_OUTPUT_MEMORY_COORDINATOR.md implemented sequential partial-outcome boundary
   |- RELATION_GATED_MEMORY_COMMIT.md implemented candidate/relation/write/index boundary
   |- SEMANTIC_JSON_MODEL_CALLS.md      implemented stateless semantic call boundary
   |- LOCAL_MEMORY_SURFACES.md        implemented CLI/ACP memory composition
   |- DEBUG_TRACE.md                  implemented opt-in secret-safe diagnostics
   |- RUNTIME_IDENTITY.md             implemented v0 IDs and ACP binding limits
   |- CURRENT_TASK.md                empty template on `main`; workers restore it before push
   |- template_CURRENT_TASK.md       clean task form with necessity arguments
   |- TASK_WORKFLOW.md               lifecycle, necessity gate, freeze and routing
   |- PROJECT_BRIEF.md               core product contract, direction and decisions
   |- CONTRIBUTING.md                contribution and source-intake rules
   |- CURRENT_STATUS.md              observed current reality
   |- SYSTEMDOC.md                   implemented durable system
   |- MULTIAGENT.md                  isolated worker and operator policy
   |- THIRD_PARTY.md                 direct dependency provenance and licenses
   |- JOURNAL.md                     append-only work waves
   |- FILESTRUCTURE.md               this repository map
   |- TASK_IDS.md                    task address allocation
   |- CURRENT_MEMORY_MODEL.md        owner-approved current knowledge/state/memory/context target
   |- KNOWLEDGE_MEMORY_MODEL.md      prior knowledge constitution; historical where superseded by current model
   |- KNOWLEDGE_MODEL_GAP_ANALYSIS.md v0-vs-model violations and sequence
   |- tasks/                         frozen program and child charters; operator delegates from here
   |- handoffs/                      worker integration handoffs
   |- evidence/                      indexed safe verification records/artifacts
   |- _legacy/
   |  `- README.md                   tracked boundary for ignored raw provenance
   |- adr/                           durable decisions, indexed
   |- backlog/                       non-activated in-scope proposals, indexed
   |- concepts_sandbox/              non-authority ideas, indexed
   |- paused/                        frozen blocked tasks, indexed
   `- finished/                      immutable task archive by naming convention
```

The local bootstrap bundle, protocol baseline/extraction, raw legacy tree, and
multi-agent add-on source package remain ignored reference inputs. The OpenHands
clone and related prior-work repositories live outside this repository. None
becomes A008 authority merely by existing locally.

The configured external worker-clone root is `C:\code\A008-workers`. It is a
sibling of this repository and is not part of A008's tracked file tree. The
A008-0004 through A008-0015 writing worktrees use task-specific directories
there; A008-0015 is
`C:\code\A008-workers\A008-0015_committed-memory-loop`.
A008-0005 runtime state and browser helpers remain external evidence under the
worker root and are not tracked product structure.

## Addressing

A cited record keeps its path. Status lives in content, never filenames.
Collections declare index or naming-convention discoverability in their README.
Do not cite disposable material from immutable records; restate the needed fact
at a stable owned path first.

## L2 evidence lifecycle owners

- `src/core/memory-lifecycle-policy.ts`: validated creation policies in runtime preferences.
- `src/memory/knowledge/lifecycle.ts` and `lifecycle-types.ts`: baselines, evaluation, maintenance and occurrence receipts.
- `src/memory/knowledge/knowledge-transaction.ts`: shared snapshot/rollback for the existing context.
- `src/memory/knowledge/sqlite-context.ts`, `sqlite-store.ts`, `sqlite-schema.ts`: atomic namespace persistence, schema 3/4 upgrade and independent claim/association receipts.
- `test/knowledge-model/lifecycle-v1.test.ts`: fixed-clock, source proof, concurrency, migration and recovery acceptance fixtures.

## L3 association lifecycle owners

- `src/memory/knowledge/association-lifecycle.ts`: independent identity, policy baselines, pure evaluation, receipts and audit validation.
- `src/memory/knowledge/association-commit.ts`: exact runtime handles and source proof in the existing semantic/atomic commit.
- `src/memory/knowledge/expand.ts`: RelationIndex metadata and one-hop edge/endpoint eligibility; `inspection.ts` exposes outgoing detail.
- `src/memory/knowledge/live-reader.ts`, `read.ts`, `read-types.ts`: explicit runtime applicability scope, preserved read contracts.
- Existing SQLite/context/snapshot and runtime preference owners persist schema/settings 4 and preserve legacy records.
- `test/knowledge-model/association-lifecycle.test.ts`: A25-A30, source independence, migration/restart/concurrency and backup restoration.

## A008-0122 entity/topology contract owners

- `src/memory/knowledge/entity-references.ts`: structural claim↔entity membership, deliberately separate from `RelationIndex` and L3 lifecycle.
- `src/memory/knowledge/registry.ts`: deterministic lexical entity identity plus preferred display label; co-mentioned entities remain distinct.
- `src/memory/knowledge/live-commit.ts`: current-batch entity materialization, structured slot-owner selection, structural references, and user-vs-assistant dialogue provenance.
- `src/memory/knowledge/{sqlite-schema,sqlite-store,sqlite-rows,sqlite-context}.ts`: schema 5 persistence for structural claim/entity membership; no legacy backfill.
- `src/memory/knowledge/inspection.ts` and `packages/protocol/src/http-schemas.ts`: `entity_ref` graph topology plus stored/effective/primary effective domain projection.
- `src/prompt-contracts/KNOWLEDGE_EXTRACTOR_INSTRUCTION.ts`: dialogue extractor contract for same-turn retrieved baseline + user message + final provider response; returns new knowledge, state updates, relation updates and reinforcement references.
- `src/prompt-contracts/KNOWLEDGE_RELATION_SHARED_INSTRUCTION.ts`: shared self-contained relation and association semantics composed by the single and batch classifier prompts.
- `src/orchestration/relation-gated-memory-commit.ts`: structured proposition serialization for proposals/candidates and the shared classifier transport contracts.
- `test/A008-0122-memory-contract-repair.test.ts`: distinct identity, structural topology, current-batch handles, structured owner/comparison, assistant provenance, SQLite reload and prompt-parity regressions.

## Product paths

- `src/orchestration/instruction-template.ts`: strict allowlisted `{{...}}` expansion for global system Instructions using model/runtime-owned facts only.

`src/core/` is provider- and UI-neutral. Provider adapters live under
`src/providers/`; `src/runtime/` composes environment-owned adapters,
identity/SQLite/debug configuration, and the local memory application root.
CLI and `src/acp/server.ts` are separate I/O composition surfaces; neither owns
a second provider implementation. `src/memory/` is provider- and UI-neutral,
with a locally configured SQLite boundary. `src/orchestration/` owns the
exported verified-context read-before-chat, strict runtime Instructions template
rendering, reasoning-free post-output staging, stateless semantic JSON calls,
sequential post-output coordination, and relation-gated write/index boundaries.
Live CLI/ACP construct those services
only through `createLocalMemoryRuntime`.
`src/benchmark/` contains deterministic local architecture
proofs, not production runtime composition. `src/identity/` owns
opaque runtime routing types and an in-memory binding reference; only canonical
ACP-session generation is integrated today.

`src/ingest/` is provider- and UI-neutral apart from one NVIDIA-backed image
describer behind a port; it decides nothing about storage or transport, and its
extractors own the provenance they claim (ADR 0020 D5). `zip.ts` and `ooxml.ts`
are readers, not libraries: they exist so Word support costs no dependency
(ADR 0020 D11), and `media-type.ts` uses the first of them to tell the OOXML
families apart rather than reporting every ZIP as a document. `pdf-extractor.ts`
is the only file that reaches `pdfjs-dist`, and it imports it inside `extract()`
so no other code path loads it.

`src/gui-host/` and `gui/` are the two halves of the product GUI path in
ADR 0019 D2. `src/gui-host/` is a third I/O composition surface beside CLI and
ACP; like them it owns no second provider implementation and reaches the core
only through `A008-acp`. `gui/` is a separate npm package with its own
`tsconfig.json` and dependency graph, so the root build never compiles renderer
code. Each `gui/src/` feature directory has a single owning task per ADR 0019
D7; `gui/src/app.tsx`, `gui/index.html`, and `gui/vite.config.ts` are shell
files the operator owns. GUI unit tests live beside their modules as
`*.test.ts`. `gui/test/` holds the shared Node test runner for the whole GUI
tree — one loader, one resolver, and the single ambient declaration of the Node
modules those tests import — and `npm --prefix gui run test` discovers every
`gui/src/**/*.test.ts` through it. Root `npm test` runs `test:core` and then
`test:gui`, so it is the full gate.

Compiled `dist/` (root and `gui/`), dependencies,
`.env.local`, and raw legacy input are ignored and are not repository structure.

A008-0107 adds `src/engine/project-runtime-registry.ts` for canonical runtime
ownership and explicit existing-data attachment, with regression evidence in
`test/project-runtime-registry.test.ts`. EngineHost supports caller-owned registry
borrowing. The charter is `docs/tasks/A008-0107_shared-project-runtime-registry.md`.

A008-0108 adds `src/runtime/runtime-ownership.ts`, with actual subprocess checks
in `test/runtime-ownership.test.ts` and `test/fixtures/runtime-owner-process.ts`.

A008-0109 adds `src/gui-host/local-acp-bridge.ts` and
`test/local-acp-bridge.test.ts`. EngineHost supports panel-free sessions over a
fixed project resolver. The shared runtime lease lives under `src/runtime/` and
also covers direct local runtime factories used by CLI/ACP.

A008-0110 adds `packages/protocol/src/v2-auth.ts` and generated V2 auth schemas/
OpenAPI; `src/gui-host/{device-registry,device-cli,v2-auth}.ts` implements local
credentials and ticket/discovery routes. `test/v2-auth.test.ts` verifies actual
CLI and HTTP boundaries. `docs/CLIENT_AUTH.md` documents available behavior.

A008-0112 adds `packages/protocol/src/v2-session.ts` plus generated V2 session schemas, and `src/gui-host/{v2-session,v2-websocket}.ts` for authenticated `a008.v2` session admission/dispatch over the existing runtime registry/EngineHost. The dependency-free `websocket.ts` accepts a dynamic message bound so pre-auth and authenticated limits can differ. `test/v2-auth.test.ts` owns real-host V2 admission, authority, revoke/expiry, tool permission and control regressions.

A008-0132 extends the same V2 owner and shared protocol with stable turn/message IDs, per-session monotonic event sequence, `serverInstanceId`, ordered snapshot capture/drain and explicit terminal outcomes. Generated `v2-session-event.schema.json` joins the existing V2 schemas. `test/A008-0132-stage4-turn-recovery.test.ts` owns the focused Stage-4 no-gap snapshot, terminal settlement, message-ID lifecycle, stale-event discard and multi-project/session isolation regressions; `test/v2-auth.test.ts` continues to cover real-host authority and permission/cancel behavior.

A008-0177 adds `src/runtime/project-workspace-store.ts`, the local SQLite and literal-Git owner for shared/worktree project session metadata and clean-only discard. `test/project-workspace-store.test.ts` uses a temporary Git repository to verify isolation lifecycle behavior. A008-0178 adds `src/gui-host/workspace-routes.ts` as the host-owned external workspace-root setting and session view adapter; V1 workspace routes and `packages/client` expose it to the `gui/src/projects/project-sidebar.tsx` project-details surface. Merge/PR controls remain unavailable and worktree selection does not bind chat cwd.
