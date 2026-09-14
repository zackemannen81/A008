Standalone GUI authentication remains inside the existing host boundary: `src/gui-host/pin-auth.ts` adds an optional six-digit browser gate, random cookie session and failed-attempt throttle without adding a renderer dependency or second credential owner. `gui/src/session/engine-access.ts` also owns the bundled renderer's exact-match recovery from an expired standalone PIN cookie back to the existing login gate; native engine capability auth remains separate.

# File Structure

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
Live mode requires an explicit flag, selected model and separate task authority;
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
`repository.test.ts` (catalog, workspace, shortcuts and activity). Additional
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
|  |  |- settings/                   A008-0037 settings
|  |  |  |- parameters-panel.tsx     A008-0065 model-aware generation dialog
|  |  |  |- parameters.css          parameter and session-control styling
|  |  |  |- appearance-panel.tsx     A008-0093 App theme picker
|  |  |  |- nvidia-catalog.ts        NVIDIA/kie/OpenAI provider-settings client
|  |  |  `- nvidia-catalog-panel.tsx Provider keys, NVIDIA Build, kie market, OpenAI
|  |  |- brand/                      A008-0037 identity; A008-0093 theme tokens
|  |  |  |- themes.css               Neutral and Deep Space semantic token values
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
|  |  |- types.ts                    provider-neutral chat contracts
|  |  |- errors.ts                   typed error taxonomy
|  |  |- model-registry.ts           verified model profiles and lookup
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
|  |  `- openai/
|  |     `- openai-chat-transport.ts  GPT-5.6 Luna Chat Completions + tools/SSE
|  `- runtime/
|     |- nvidia-session.ts            NVIDIA credential and transport owner
|     |- chat-dispatch.ts            NVIDIA vs kie vs OpenAI chat transport selection
|     |- local-runtime-config.ts      SQLite, identity, and debug settings
|     |- debug-trace.ts               opt-in secret-safe JSONL observer
|     |- user-assertion-gate.ts       runtime-owned new-memory activation
|     `- local-memory-runtime.ts      CLI/ACP memory composition root
|- test/                              fake/local chat, ACP, memory, retrieval, identity, and orchestration tests
|  |- chat-dispatch.test.ts           NVIDIA vs kie vs OpenAI chat routing
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
   |- KNOWLEDGE_MEMORY_MODEL.md      accepted knowledge constitution (ADR 0018)
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

## Product paths

`src/core/` is provider- and UI-neutral. Provider adapters live under
`src/providers/`; `src/runtime/` composes environment-owned adapters,
identity/SQLite/debug configuration, and the local memory application root.
CLI and `src/acp/server.ts` are separate I/O composition surfaces; neither owns
a second provider implementation. `src/memory/` is provider- and UI-neutral,
with a locally configured SQLite boundary. `src/orchestration/` owns the
exported verified-context read-before-chat, reasoning-free post-output staging,
stateless semantic JSON calls, sequential post-output coordination, and
relation-gated write/index boundaries. Live CLI/ACP construct those services
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
