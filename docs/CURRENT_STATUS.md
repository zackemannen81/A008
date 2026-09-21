# Current Status

Reality as of 2026-09-21. This document records observed state; intended design
belongs in `docs/PROJECT_BRIEF.md`.

A008-0151 turns Parameters → Zero Cost from a bundled read-only snapshot into an explicit live-discovery/import surface without moving provider authority into the renderer. Ordinary `GET /v1/catalog/zero-cost` remains the offline-safe A008-0134 snapshot. Explicit `POST /v1/catalog/zero-cost` fetches the published ZeroCostRadar A008 feed, validates the complete typed payload and matching verification date, and fails closed without replacing the visible catalog on upstream/network/schema failure. The GUI exposes Update check and per-route add state. Routes already present in `/v1/models` show as available; add is enabled only for routes that the current runtime can truthfully execute through the existing NVIDIA Chat Completions path. Import reuses the existing host-owned user catalog, is idempotent by model id, reloads `/v1/models` immediately, and never changes active/default provider, model, routing or paid fallback. OpenRouter/OpenCode/Groq/Google discovery remains non-runnable until a separately authorized provider-support task implements those execution paths. The machine-readable feed is published by the canonical ZeroCostRadar deployment source as `data/a008-model-routes.json` and was verified live through the public Netlify asset URL. Full repository verification passes 714/714 core + 4/4 membership + 189/189 GUI = 907 tests with zero failures/skips; root typecheck, GUI production build, packed protocol/client verification and `git diff --check` pass. Verification also exposed and repaired an existing non-hermetic runtime-preferences fixture that had been reading the operator's real user catalog/MCP definitions; it now uses an isolated catalog path. No live model inference or paid call was made.

A008-0150 restores OpenAI strict-tool omission sentinels at the provider-to-MCP
validation boundary. Before existing original-schema Ajv validation,
`ModelToolSession` removes a top-level `null` only when the original MCP object
property is optional and non-nullable. Required properties and properties whose
original schema permits null retain their value and continue through the same
fail-closed validation. The normalized object is the only value offered for
approval/MCP execution; ACME strict-schema lowering, provider behavior and MCP
schemas remain unchanged. Focused ModelToolSession/MCP fixture tests pass 12/12,
as do root typecheck/build and diff hygiene. No live/paid provider call.

A008-0149 ships `@a008/client`, the Stage-5 independent HTTP/WebSocket SDK, and migrates bundled GUI session/HTTP I/O onto it. Injected fetch, WebSocket and cookie/bearer/engine credential adapters keep secrets out of React. The bundled GUI keeps current chat behavior through the V1 session adapter (PIN-disabled standalone, engine-panel capability, prompt attachments and in-session image generation). Independent consumers use the V2 adapter, which authenticates with a one-use ticket, applies snapshots/events and refuses to auto-resubmit mutations after `COMMAND_UNKNOWN`/`SESSION_EXPIRED`. New V2 HTTP business routes are not added. Verification: packed client+protocol install outside A008; 711 core, 4 membership and 187 GUI tests pass with 0 failures/skips; root/GUI typecheck, GUI production build, `verify:protocol`, `verify:client` and `git diff --check` pass. No live/paid provider call.

A008-0148 makes the existing stdio-only MCP capability configurable from bundled
GUI Parameters → MCP. The existing user catalog persists validated named command,
argument, non-secret environment and enabled-state definitions; empty configuration
preserves no-MCP behavior. Authenticated V1 configuration routes and both bundled
V1/V2 new-session construction paths resolve the same enabled definitions and pass
them through the existing `EngineHost` → `ModelToolSession` owner. The renderer
never spawns MCP processes. Changed configuration applies only to subsequently
constructed sessions; active sessions retain their catalog and the UI states that
requirement. Approval, cancellation, timeout and tool/catalog budget behavior
remain in `ModelToolSession`; remote transports, session restoration and hot reload
are not introduced. Verification: root/GUI typecheck, 703 core, 4 membership and
187 GUI tests pass with 0 failures/skips; real-host HTTP coverage includes valid
and malformed MCP configuration, and diff hygiene passes.

A008-0144 is now the frozen successor memory-model task. `docs/CURRENT_MEMORY_MODEL.md` records the owner-approved target for claims/evidence, single-HEAD Current State, provenance/support, lifecycle/salience, retrieval/context construction and signed association attraction. A008-0143 is superseded before merge because its synthetic-state and atomic-HEAD fixes remain useful predecessor work but its residual `user-assertion-v1` state-admission boundary is too narrow. No A008-0144 runtime behavior is claimed yet; PR #83 must not merge standalone.

## What exists

A008-0147 makes the standalone workspace's current project conversation durable without making ACP/V2 transport sessions durable. One project-namespaced row in the existing SQLite owner stores the canonical conversation identity, selected chat model and committed multimodal messages. Opening project A, switching to B and reopening A reconstructs A's transcript; host restart does the same under a new ephemeral session ID. Reset, undo, model-change and generated-image terminal transitions write through at the canonical runtime/session boundary. Completed source-store image locators survive restore. A stale persisted `pending` image becomes terminal `cancelled` on restore and never replays a chargeable provider job. Generic EngineHost/ACP/V2 sessions remain fresh and independent. ADR 0046 supersedes ADR 0041's blanket no-durable-chat statement only for this standalone current-project conversation; process-local resume capabilities, command receipts, tool executions, thoughts and permissions remain non-durable. Verification after rebasing cleanly onto A008-0148/PR #87: 707/707 core, 4/4 membership and 187/187 GUI = 898 tests pass with 0 failures/skips; root typecheck, GUI production build, packed independent protocol verification and `git diff --check` pass. No live/paid provider call.

A008-0142 makes generated images first-class ordered conversation content. Manual `+` → Generate image and the structured model tool `generate_image` both reserve one host/session-owned `[IMAGE GENERATING]` item immediately, then resolve that same item in place to a source-store locator, a positional failure, or an explicit cancellation. Later text can continue around a pending image; completion order cannot reorder or duplicate items. String `ChatMessage.content` remains a compatibility form. Provider invocation sees only bounded image labels, never locators or temporary URLs. Image parts do not automatically become semantic knowledge. V1 session state is process-local: a new host process does not replay a lost image job. ACME remains the model-execution substrate and does not own media generation. Verification: 701/701 core, 4/4 membership and 186/186 GUI tests pass with 0 failures/skips; root and GUI typechecks, GUI production build, `verify:protocol` and `git diff --check` pass. No live/paid provider call.

A008-0145 makes chat and semantic model control explicit instead of inferring semantic routing from configured credentials. Parameters now has a separate global Semantic surface whose selected model is used by retrieval-scope classification, post-output extraction, relation classification and source-knowledge extraction; its reasoning effort is independently configurable and semantic output defaults to 128,000 tokens while every call remains capped by the selected model capability. Existing settings without the additive semantic field migrate to one explicit initial choice; after that, API-key presence authorizes routes but never chooses the semantic model. OpenAI Luna/Terra chat profiles now default to their verified 128,000-token output maximum. Embedded OpenAI Responses requests with streamed reasoning request the provider-supported reasoning summary and emit it only through the transient Thought channel; raw chain-of-thought is neither requested nor persisted. Tool activity disclosure no longer derives its open state from each running/completed transition, eliminating repeated expand/collapse flashes between sequential tool calls while preserving user control. V1 runtime-preference snapshots keep the new semantic field additive so older replies remain accepted. Verification: 684/684 core, 4/4 membership and 180/180 GUI tests pass with 0 failures/skips; root and GUI typechecks, schema regeneration and focused protocol/provider tests pass.

A008-0143 corrects live knowledge state ownership so each resolved semantic address has one current HEAD binding. A later valid value atomically closes the prior binding into history and opens the new one; claims/utterances/provenance remain evidence and discovery surfaces rather than competing current truth. Pure current-state reads default to `current_state` only and may use historical evidence to discover an address, but project that address's HEAD; explicit attribution/history can still read the underlying evidence. Unstructured propositions no longer mint sentence-hash/`statement` semantic addresses and remain evidence only. Automatic reinforcement is now occurrence-based after semantic admission and is no longer vetoed by missing/ambiguous quote/span attachment; durable occurrence/evidence receipts keep it exactly-once. The internal `SlotClaim` reconciliation shadow mirrors acceptance/conflict status and validity interval instead of acting as a second truth store. Focused regressions cover `Bertil -> Rickard`, `Draft -> In Progress`, closed past state, future evidence, direct-vs-fuzzy lifecycle eligibility and unstructured evidence. Existing already-corrupted stores are deliberately not rewritten by this task; any repair/backfill requires a separately reviewed migration. Final repository verification on the task branch passes 688 core + 4 membership + 178 GUI tests with zero failures/skips after restoring the GUI lockfile dependencies; diff hygiene passes.

A008-0140 closes A008-0103 Stage 4. Real OS-process restart proof shows each new GUI-host process gets a new `serverInstanceId`; process-local command receipts and resume authority do not survive restart. A command that was demonstrably running before process death becomes `COMMAND_UNKNOWN` on the new instance, the old session-bound ticket/resume capability becomes `SESSION_EXPIRED`, and A008 never auto-resubmits the lost mutation or invents a terminal success/failure. A second real-host proof delivers a successful answer while deliberately breaking post-output semantic extraction; the terminal event remains `answerStatus=completed` with independent `memoryStatus=staging_failed`. The combined Stage-4 closure matrix (A008-0132/0138/0139/0140 plus real V2 authority/tool/cancel tests) passes 31/31. Final repository verification passes 683 core + 4 membership + 178 GUI = 865 tests, 0 failures/skips; packed independent protocol consumer, root/GUI typecheck, GUI production build and diff hygiene pass. Public discovery advertises `session.restart-uncertainty`; the Runtime panel now reports `STAGE 4 COMPLETE`. Stage 5 SDK + web migration is the next A008-0103 gate.

A008-0141 adds Oldscool as a third renderer-local app theme. Parameters → Appearance persists `oldscool` under the existing `a008.preferences.appearance.theme` value and applies it before React loads. Oldscool uses dark olive-black surfaces, warm amber/cream text and borders, phosphor-green controls, a static pointer-inert CRT scanline layer, and restrained phosphor bloom on selected chrome and primary controls. All effects are scoped to `html[data-a008-theme="oldscool"]`; Neutral and Deep Space retain their existing presentation. The effect does not alter sessions, models, memory, tools, providers, host/API behavior or the sandboxed Code Canvas preview. Verification: 177 GUI tests passed with 0 failures/skips; GUI typecheck, production build and diff hygiene passed. The build retains only the existing Zod annotation and >500 kB bundle warnings.

A008-0139 implements the third Stage-4 slice: bounded same-process V2 reconnect/resume. A transport loss now detaches the owned V2 session instead of destroying it, but only after active work is interrupted and pending tool permissions are denied. The session receives an opaque 256-bit resume capability on `session/new`; it is never included in ordinary snapshots, command receipts, URLs or provider/model payloads. A detached session survives for a 45-second host-owned lease and can be reattached exactly once by the same authorized principal/project/session through `session/resume`, which returns an authoritative A008-0132 snapshot and resumes only from later events. Second writers, wrong principal/project/session/capability, explicit close and expired lease fail deterministically. Reconnect never regenerates answers, replays transient thought, reruns provider/tool work or resurrects a stale approval. Device revoke/expiry still hard-terminates the live session rather than granting resume authority. At the A008-0139 boundary discovery advertised `session.reconnect-resume` and `sessionResumeLeaseMs: 45000`, leaving only restart uncertainty as the remaining Stage-4 gap. Verification after rebasing onto integration main with A008-0141: 681 core + 4 membership + 177 GUI = 862 tests, 0 failures/skips; focused reconnect/V2 18/18; packed independent protocol consumer, root/GUI typecheck and diff hygiene pass. A008-0140 subsequently closes the restart-uncertainty gate and Stage 4.

A008-0138 implements the second Stage-4 slice: bounded process-local command receipts and mutation idempotency for V2. Mutating session commands carry a stable application `commandId` distinct from request/turn/session/execution identity; the host binds `(principal, commandId)` to a canonical digest of action/project/session/payload before side effects. Same-ID/same-payload retries observe the existing running or terminal receipt without repeating provider/tool/approval work; changed content returns `COMMAND_CONFLICT`. Receipts retain only bounded metadata/digest-derived identity, not prompt/tool payloads, remain authorized to the originating principal/project, expire five minutes after settlement, and are capped at 1,024 entries per principal without evicting running or unexpired work. Unknown/expired lookup returns `COMMAND_UNKNOWN` through authenticated `GET /v2/projects/{projectId}/commands/{commandId}`. `session/inspect` and `session/control` with `control.action=inspect` remain read-only and require no command ID. Discovery advertises `session.command-receipts` and `session.command-idempotency` plus their limits. At the A008-0138 boundary reconnect/resume lease and restart uncertainty were the remaining Stage-4 gaps; A008-0139 now closes the reconnect/resume slice. Verification: 677 core + 4 membership + 176 GUI = 857 tests, 0 failures/skips; focused receipt/V2 19/19; root/GUI typecheck, build, packed independent protocol consumer and diff hygiene pass.

A008-0137 refines the existing read-only Memory Relationship Map presentation without changing memory semantics or runtime authority. Kind-specific neon forms/colours, directed arrows, selected stored-relation labels and parallel displayed-link width make the bounded graph easier to inspect. Focus mode keeps unrelated graph context visible but subdued/dashed while emphasizing the selected neighbourhood. Visual width represents only duplicate displayed stored topology, never evidence strength, confidence, relevance or semantic similarity. Verification: GUI typecheck passed; 176 GUI tests passed with 0 failures/skips; GUI production build and diff hygiene passed.

A008-0136 exposes recent merged capability in the bundled GUI without changing runtime authority. `GET /v1/catalog/zero-cost` is a typed read-only projection of the A008-0134 catalog, and Parameters → Zero Cost renders all 26 validated routes with access/lifecycle/capability/quota/expiry/data-policy/source metadata while distinguishing existing A008 profiles from discovery-only candidates. It does not register a provider/model, mutate credentials, alter routing or authorize fallback. Parameters → Runtime reads public `GET /v2/info`; A008-0136 originally exposed the A008-0132 identity/order/snapshot/terminal foundation; A008-0138 later added command receipts/idempotency and A008-0139 added reconnect/resume. At that boundary only restart uncertainty remained; A008-0140 now closes it. Bundled chat remains on V1 until Stage 5; existing V1 45-second reconnect/resume is not presented as V2 recovery. The GUI provider copy names both Luna and Terra on the native embedded OpenAI Responses route. Verification at the A008-0136 boundary: 671 core + 4 membership + 175 GUI = 850 tests, 0 failures/skips; focused host/protocol/V2 58/58; root typecheck/build, production GUI build, packed independent protocol consumer and `git diff --check` pass.

A008-0132 completes the first Stage-4 child for V2 session recovery semantics. Accepted prompts receive stable application `turnId`; committed user/assistant messages receive stable `messageId`; events carry per-session monotonic `sequence` plus `serverInstanceId`; snapshots state the exact represented sequence and queue later events until delivery finishes; and each accepted turn emits one terminal outcome (`completed`, `cancelled`, `interrupted` or `failed`) with independently reported answer and memory status. Undo/reset preserve surviving message IDs and retire removed IDs. Sequences and turn identities remain isolated across projects/sessions and independent from ACME execution identity. At the A008-0132 boundary command receipts/idempotency, reconnect/resume/lease and restart uncertainty were still absent; A008-0138, A008-0139 and A008-0140 subsequently close those three remaining Stage-4 gaps. Final A008-0132 verification: 671 core + 4 membership + 171 GUI = 846 tests, 0 failures/skips; root typecheck/build and packed independent protocol-consumer verification pass.

A008-0134 adds `src/providers/zero-cost-model-catalog.ts`, a data-only snapshot of 26 provider/model routes whose zero-cost availability was revalidated against provider-owned current documentation on 2026-09-19. The catalog distinguishes hosted free endpoints, exact zero-price model slugs and provider free-tier quotas; records dynamic/preview/trial lifecycle, expiry and sensitive-data cautions; and includes source provenance. It does not register providers, change `ModelRegistry`, dispatch, ACME execution, credentials, defaults or fallback behavior. Six NVIDIA routes point at profiles already present in A008; every other entry remains catalog-only until separately authorized implementation.

A008-0131 is complete and routes embedded OpenAI through ACME's native Responses adapter on `acme-engine@0.1.5`; owner live smoke confirmed the route and markedly lower observed Luna latency. A008-0133 adds `gpt-5.6-terra` as a second shipped OpenAI profile beside `gpt-5.6-luna`, with text/image input, 128K output capability and the documented reasoning-effort set. Both profiles compose under `config.openAi` and use the same native Responses execution owner; Luna remains the existing default wherever it was already the default. NVIDIA remains on its Chat Completions route and KIE remains under compatible routes. The direct `OpenAiChatTransport` remains a reference Chat Completions path.

A008-0130 is merged and unifies product-GUI native-image acquisition around the existing source-store locator boundary. The composer can acquire one active image from clipboard paste, file picker, drag/drop or an explicit absolute local filepath; a new acquisition replaces the prior attachment. Browser-picked/pasted/dropped files still use raw-byte `POST /v1/upload`. Local-path import uses an additive `x-a008-local-path` mode on that same host endpoint: the host validates an absolute regular file, enforces the existing upload byte cap, sniffs actual media type and writes the same content-addressed source store. The renderer retains only locator/media-type/display-name metadata. The `+` menu is now a stacked popover so Attach image, Attach from path and Generate image no longer overlap. Owner smoke exposed and then verified the repair of a V1 prompt-parser defect: `packages/protocol/src/host-parser.ts` now preserves the optional `attachment`, `CLIENT_MESSAGE_KEYS` advertises it, and paste, file attach and explicit-path acquisition all reached Luna as native image input. Root and GUI typechecks, GUI production build and diff hygiene passed; focused/full automated suites were not rerun for that task and are not claimed.

A008-0129 restored Luna function-tools compatibility while embedded OpenAI still used Chat Completions. A008-0131 supersedes that workaround on the ACME-mapped path by returning embedded OpenAI to native Responses, where the provider-neutral ACME request preserves the selected reasoning effort. The direct OpenAI Chat Completions adapter retains the A008-0129 effective `reasoning_effort: "none"` guard for Luna tool requests.

A008-0128 fixed the temporary embedded OpenAI Chat Completions route on registry `acme-engine@0.1.4` by selecting `max_completion_tokens`. That route is historical after A008-0131: embedded OpenAI now uses native Responses on `acme-engine@0.1.5`; NVIDIA/KIE behavior remains unchanged.

A008-0127 established the default in-process model-execution substrate; A008-0131 updates the current registry dependency to `acme-engine@0.1.5` and restores embedded OpenAI to the native Responses adapter. `EmbeddedAcmeChatTransport` derives NVIDIA/OpenAI/OpenAI-compatible routes from A008-owned model metadata, user catalog and credentials, then calls `createAcmeModelRuntime().execute()` without a separately started ACME process or sidecar URL/token/profile environment. Catalog changes rebuild the embedded composition for later calls. `A008_CHAT_TRANSPORT=direct` preserves direct provider dispatch for reference/debug work and `A008_CHAT_TRANSPORT=acme` preserves the remote `acme-model-runtime/2` sidecar as an explicit compatibility/deployment mode. A008 still owns cognition, memory, prompts, tools, model selection and provider strategy; ACME executes and providers compute. A live Nemotron text turn passed through `transport=embedded-acme` with `sidecar_url=none`. Native image mapping, capability gating and text-only durable history pass offline. Two bounded live Kimi image attempts exercised embedded ACME: the first produced no provider response and was operator-terminated after roughly 185 seconds; the second surfaced structured ACME `TIMEOUT` after roughly 94 seconds with model-execution evidence. Those A008-0127 attempts did not establish a stable NVIDIA/Kimi vision endpoint. Later A008-0130/0131 owner smoke does establish the current OpenAI/Luna native-vision route through embedded ACME Responses; A008-0124 remains Superseded. Verification: core 657/657, membership 4/4, GUI 165/165, protocol packed-consumer proof, root/GUI typecheck, GUI production build, format and diff checks. The new embedded transport is lint-clean; the repository-wide lint command still reports 110 pre-existing errors outside this task.

A008-0122 repairs the analyzer→entity→claim topology contract. Extracted `entities[]` now resolve as distinct referents instead of aliases on the first item; deterministic lexical identity reuses slug-equivalent labels such as `React`/`react` while preserving a preferred display label. Claims persist structural claim↔entity membership in schema 5, projected as `entity_ref` links with no L3 association lifecycle. Current-batch entities receive stable opaque handles before relation classification, and structured propositions reach both new proposals and stored candidates; single and batch relation prompts are built from the same explicit relation/association rules. Inspection now distinguishes `storedDomains`, derived `effectiveDomains`, and deterministic `primaryEffectiveDomain` without mutating entity labels. Dialogue proposals without runtime-verified support in the original user message are attributed to an assistant utterance and cannot be accepted as user assertions. Existing development stores need no migration/backfill and may be recreated. Verification: 644/644 core tests, focused 0122 regressions, typecheck/build, and final diff hygiene.

A008-0118 makes A008 a consumer of `acme-model-runtime/2`. `AcmeChatTransport` maps the full generation-control set (`temperature`, `topP`, `maxOutputTokens`, `stop`, `reasoningBudget`, `enableThinking`, `reasoningEffort`, `seed`) and sends an explicit `executionProvider` as ACME `providerHint`. Vendor `provider` stays distinct: Kimi remains `moonshotai` and executes via NVIDIA. Profile defaults no longer contradict `generationCapabilities` (Kimi does not default `enableThinking`; Muse/Laguna/DeepSeek omit the field rather than sending `false`). Unsupported supplied controls fail before execute. Endpoints are unchanged. Image/audio/video stay on direct transports; owner-verified image generation still works on those paths. Owner-observed live chat through ACME v2 (`acme-0180-local-a008`) passed Luna, Nemotron 3.5 Lightning, Kimi K3, DeepSeek V4 Pro, Muse Glimmer, Laguna XS and KIE/Gemini. The owner client loop (chat → tool → continuation → retrieval → answer → extraction → one batch relation → commit → next-turn retrieval) passed on two models. Stage 3.5 is **GO**. ACME is the accepted text/chat execution substrate when `A008_CHAT_TRANSPORT=acme`. Direct chat transports remain reference composition. Stage 4 may start and must keep application identities distinct from ACME `modelExecutionId`. Owner GUI screenshots are in [the evidence record](evidence/A008-0118_acme-runtime-v2-go.md): Muse retrieves `oldschool` neon-text knowledge, Luna and DeepSeek still generate images, and Code Canvas preview still works. Offline verification: 636 core, 4 membership, 162 GUI; typecheck; `verify:protocol`; production GUI build; `git diff --check`.

A008-0117 adds retrieval necessity and precision. A successful semantic `retrieve=false` decision skips the knowledge read entirely, so greetings and self-contained social turns no longer collide lexically with old utterances. Successful scope output is bounded to narrow direct/related labels, and longer direct lexical matches require two independent content-token signals so a generic word such as `demo` cannot pull project-wide history. Classifier failure remains fail-open as deterministic retrieval and is observable as `degraded`; intentional skips report `skipped`. Verification: 632/632 core plus typecheck/diff-check. The A008-0114 adoption decision remains **NO-GO** pending full supported model/provider generation-control parity and the owner manual end-to-end test.

A008-0116 makes the post-output model cost constant with proposal count: one `knowledge_analysis` call followed by one batch `relation_classification` call, then sequential A008-owned commits. Batch decisions use temporary candidate/proposal handles only; later proposals may target earlier proposals, while future/unknown handles fail before persistence. The active ACME parity proof observes `retrieval_scope` separately, then exactly one extraction and one relation batch call. Core verification is 630/630. A008-0115 also restores Luna semantic retrieval/extraction by omitting Luna's unsupported temperature control. The A008-0114 adoption decision remains **NO-GO** pending retrieval-quality review, full supported model/provider control parity, and the owner's final manual end-to-end test.

A008-0114 completed the first Stage 3.5 evaluation against frozen `acme-model-runtime/1` and recorded **NO-GO** because that wire could not carry A008 thinking/reasoning/topP/seed controls. A008-0118 upgrades the same adapter to `acme-model-runtime/2`, closes that mapping gap, and records **GO** after live chat matrix and owner client-loop evidence. Selection remains `A008_CHAT_TRANSPORT=acme`. Stage 4 may start.

A008-0112 completes A008-0103 Stage 3. `/v2/session` now accepts the `a008.v2` WebSocket subprotocol and requires a scoped one-use ticket in the first frame within five seconds. Pre-auth messages are capped at 4 KiB and authenticated input at 1 MiB. Each socket is bound to one authenticated principal/project and at most one attached session; `session/new`, `session/inspect`, `session/prompt`, `session/cancel`, `session/control` and `tool/permission` dispatch through the existing shared `ProjectRuntimeRegistry`/`EngineHost` owner. Device existence, project scope, `session` capability and expiry are rechecked per operation. Revocation or expiry closes the live socket, cancels owned work and denies pending approvals. Shared V2 session schemas ship in `@a008/protocol`; configured provider credentials remain redacted from V2 output. Real-host tests cover admission bounds, ticket reuse, project/principal/session isolation, second-writer/concurrent-new fencing, tool approval, cancel/control, revoke and expiry. Final verification: 602 core + 4 membership + 162 GUI tests passed before closure hardening; focused V2/host tests pass after the final wire-schema/redaction hardening; installed protocol and portable-engine V2 discovery proofs pass. A008-0132 now supplies the first Stage-4 slice: sequence/snapshot ordering, stable application turn/message identity and terminal turn outcomes. Reconnect/resume lease, command idempotency receipts and restart uncertainty remain unimplemented.

A008-0111 adds host-owned registration of already-existing project directories. Projects now separates `New project` from `Add existing`: the latter accepts a display name, an existing absolute root and an explicit global-memory choice, generates a canonical project identity, records it in the existing registry and switches through the same shared workspace/runtime owner. Registration does not write inside the selected project: no Git init, Docs-First creation, multi-agent policy, worker roots or content rewrite. Duplicate, missing, file and relative roots fail closed. Existing Docs-First markers may be observed read-only. Global memory uses the newly registered project namespace; legacy/unregistered memory is deliberately not guessed, merged or migrated. V1 adds typed `POST /v1/projects/register`, bringing the shared inventory to 22 rows / 23 HTTP methods. Verification: 593 core, 4 membership and 162 GUI tests pass; the independent installed protocol consumer and production GUI build pass; no provider call or running-host restart. See ADR 0042.

A008-0110 adds V2 authentication foundation: public discovery, authenticated scoped
one-use tickets, local device grant/list/revoke and hashed expiring credentials.
PIN-disabled V1 hosts do not grant anonymous V2 access. Real host/CLI checks cover
scope, Origin, expiry/revocation and ticket reuse/capacity. `auth.tickets` is joined by `session.websocket`; A008-0112 supplies authenticated session dispatch and live-socket revoke/expiry enforcement. See [CLIENT_AUTH.md](CLIENT_AUTH.md). No owner credentials or live grants were used.

A008-0109 moves the default standalone host to a fixed-project in-process adapter
over EngineHost session/tools/permissions and ProjectRuntimeRegistry. Bridges
close only their sessions; injected registry borrowers retain other sessions and
project memory. V1 workspace switching still closes its prior conversations.
Registered IDs, configured SQLite/source paths, lazy v1 initialization and
memory-off behavior are preserved. CLI/direct ACP factories now honor the same
process leases. V2 session/business/auth integration and recovery remain future implementation.

A008-0108 adds cross-process namespace leases for registry-backed engines, with
serialized sidecar initialization and automatic OS release after exit/crash.
Real child-process checks verify conflict-before-factory, canonical aliases,
simultaneous first open and independent namespaces in one SQLite file. A008-0109 extends this guard to standalone/direct CLI/ACP composition.
The V2 gate remains open until its transport/auth implementation is verified.

A008-0107 extracts ProjectRuntimeRegistry and makes EngineHost borrow or own it.
Canonical workspace aliases reuse one runtime; explicit existing attachments
validate project identity, SQLite namespace and source paths. Same-process
competing workspace/namespace owners fail before runtime creation. Multiple
project namespaces can still share one SQLite file. Borrowers close their own
sessions; the registry refuses disposal while sessions remain. Engine layout and
v1/ACP panels are unchanged. Standalone facade migration and legacy process
coverage are delivered by A008-0109; no V2 availability is implied.

A008-0106 accepts ADR 0041 and CLIENT_API_V2.md for the next implementation stages.
Stage 1 is complete: v1 contracts/inventory and the V2 decision gate are covered.
The shared project/session facade is implemented by A008-0107 through A008-0109.
V2 endpoints, device auth and recovery guarantees remain accepted targets.

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
switch to Deep Space or Oldscool immediately without reload, a new session, a
provider call or memory/tool changes. Deep Space uses blue-black/navy with
restrained electric-blue interaction; Oldscool uses dark CRT surfaces,
phosphor-green controls and warm retro highlights. Theme identity is
renderer-local
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
| Repository | Git repository with docs-first task history through A008-0134 merged on `main`; A008-0132 delivers the first Stage-4 identity/order/snapshot/terminal foundation while later Stage-4 recovery/idempotency slices remain unimplemented. |
| Docs-first control state | A008-owned entry point, workflow, brief, status, system document, journal, file map, task register, decisions, backlog, and multi-agent policy are established by A008-0001. |
| Legacy CLI provenance | Local untracked Node.js ES-module client under `docs/_legacy/agenten007/`; Axios, readline, NVIDIA chat-completions, four model profiles, streamed/non-streamed responses, tool-call aggregation, settings, history, and fallback behavior were observed. `node --check test.js` passed. |
| OpenHands source | Clean external `C:\code\OpenHands` clone on `main` at `744e8652f254613045b779eb148bf4f741177975`; Agent Canvas 1.16.0 dependencies are installed and its application build passed without source changes. Agent Server 1.44.1 was supplied by `uvx`; MIT source boundary remains external. |
| Memory architecture input | The owner supplied a Context-First Knowledge Architecture document. A008-0006 adopted bounded invariants into an A008-owned decision and implementation without adopting an external code baseline. The ACME repository itself remains external and is not an A008 source baseline; later A008-0127/0131 explicitly adopted the bounded published `acme-engine@0.1.5` package as the default model-execution dependency. |
| Bootstrap bundle | Generated input/prompt/charter/summary manifest verified: all four SHA-256 entries match. The bundle remains ignored intake material. |
| Multi-agent add-on | Local ignored Apache-2.0 reference package exists. Its process server was not installed or configured for A008. |
| Worker-clone root | `C:\code\A008-workers` is the configured sibling root. A008-0004 through A008-0015 use isolated Git worktrees; A008-0005 runtime state/evidence helpers are external siblings. No cleanup of those task paths is authorized or claimed. |
| Runtime package | Private Node.js/TypeScript ESM application. Node.js `>=24.0.0 <25`, matching the current published `acme-engine@0.1.5` engine contract; npm lockfile, TypeScript build/typecheck, public core exports, and CLI binary metadata exist. |
| Chat core | Provider-neutral messages, typed tool definitions/calls/results, generation options, separate reasoning/content deltas, usage, model profiles and transactional `ChatSession`. Failed turns do not mutate history. Reasoning is never committed; only a current tool invocation may replay its associated reasoning ephemerally (ADR 0028). |
| NVIDIA adapter | Native-fetch adapter for `POST /v1/chat/completions`, injected endpoint/fetch/timeout, streaming SSE and non-streaming JSON, reasoning/content deltas, live channel-leak normalization, cancellation, timeout, and typed HTTP/network errors. It reads no environment itself. |
| kie.ai adapter | A008-0073. OpenAI-compatible chat at `https://api.kie.ai/<model>/v1/chat/completions` (`KieChatTransport`) and async Market image jobs (`KieJobTransport`: createTask, poll recordInfo, download first `resultUrls` entry). Curated market list in Parameters. Video/music and Claude/GPT native APIs are listed or documented, not wired. |
| OpenAI adapter | A008-0087. Direct/reference `OpenAiChatTransport` calls `https://api.openai.com/v1/chat/completions`, maps A008 tools to function calls, assembles streamed tool fragments/content, supports cancellation/timeout and typed HTTP errors, and never reads the environment itself. A008-0088/0129 retain the effective `reasoning_effort: none` guard for Luna function-tool requests on that direct Chat Completions path. Since A008-0131, default embedded OpenAI instead routes through ACME's native Responses adapter on `acme-engine@0.1.5`, preserving the selected provider-neutral reasoning effort. A008-0145 requests `reasoning.summary=auto` only for streamed Responses calls whose reasoning effort is not `none`; ACME's reasoning-summary delta is surfaced through A008's transient Thought channel and never committed to chat or memory. |
| Model registry | Eight built-in profiles. Six NVIDIA-hosted profiles were verified against the vendor's Build-tab API sample on 2026-09-04. OpenAI `gpt-5.6-luna` was verified on 2026-09-09 and `gpt-5.6-terra` on 2026-09-19; both declare text/image input, execute through OpenAI, use the native embedded Responses route, and default chat output to their verified 128,000-token maximum. The NVIDIA profiles are `nvidia/nemotron-3.5-lightning-30b-a3b` (default, text), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (text, image, video, audio), `moonshotai/kimi-k3` (text, image), `deepseek-ai/deepseek-v4-pro-0813`, `meta/muse-glimmer-30b` and `poolside/laguna-xs-2.1` (text). `ModelProfile` carries `inputModalities`, `verifiedOn` and `executionProvider`; vendor `provider` is not the execution route. Kimi, Muse, Laguna and DeepSeek omit unsupported `enableThinking` from defaults. The suite fails on a profile without a date. A008 keeps durable `ChatMessage.content` text-only per ADR 0020 D6, while invocation-local `imageAttachments` may accompany the active user turn when the selected profile declares image input; those bytes never enter committed chat history. |
| CLI | `models`, `chat`, `--help`, and interactive `/help` `/exit` `/quit` `/reset` `/clear` `/undo` `/history` `/model` `/status` `/cwd` `/tools` `/shell` `/!`. Chat uses the shared local memory runtime; model/help paths require no credential. Terminal access is native `/shell` in cwd, not LangChain. Optional `--debug-trace` / `--debug-trace-file` share the environment parser. |
| Shared provider composition | Live CLI/ACP without an injected transport use `createConfiguredChatTransport`, which now defaults to `EmbeddedAcmeChatTransport` over `acme-engine@0.1.5`. A008 supplies its own chat-model metadata plus the separately persisted semantic-model choice, user catalog, provider credentials/endpoints and generation controls to the in-process ACME runtime; provider-key presence authorizes a route but does not select the semantic model. No sidecar process or ACME URL/token/profile environment is required. `A008_CHAT_TRANSPORT=direct` explicitly selects the existing NVIDIA/kie.ai/OpenAI dispatch transports. `A008_CHAT_TRANSPORT=acme` explicitly selects the remote `AcmeChatTransport` compatibility path and requires its runtime URL. No ACME dispatch falls back to a second provider path. `createLocalMemoryRuntime` injects the selected transport into both answer and semantic calls. Core remains environment-neutral. |
| ACME execution adapter | A008-0127 adds default `EmbeddedAcmeChatTransport` behind the existing `ChatTransport` boundary and reuses A008-0118 request/result/error mapping against `createAcmeModelRuntime().execute()`. `executionProvider` remains the source of ACME provider routing; A008's registry/catalog remains authoritative. Tool continuation, streaming callbacks, generation controls, typed errors and `modelExecutionId` evidence are preserved. Invocation-local image parts set ACME `requiredCapabilities.vision=true`; text-only models fail before provider dispatch and durable history stays text-only. A008-0131 configures embedded OpenAI through ACME's native Responses adapter on 0.1.5; NVIDIA stays on Chat Completions and compatible routes remain explicit. The old remote `AcmeChatTransport` remains an explicit compatibility mode. |
| Agent Canvas ACP bridge | `A008-acp` implements stable ACP v1 over stdio with initialize, canonical `A008_v1_acp_session_<UUIDv4>` in-memory sessions, the verified model option, text/resource-link prompts, thought/answer streaming, cancellation, and the shared local memory runtime. Agent Server is expected to own the process. |
| Agent Canvas runtime proof | Real Canvas 1.16.0 and Agent Server 1.44.1 processes on Windows configured the compiled A008 Custom ACP command, sent a browser prompt, reached the existing adapter at a loopback fake SSE endpoint, rendered `A008-CANVAS-LOOPBACK-OK`, and finished the conversation. Safe evidence and screenshot are tracked under `docs/evidence/`. |
| A008 GUI role | ADR 0029/0030 support standalone repository work and a focused A008-owned interface. The external client remains supported through the shared host contract. ADR 0022's earlier design restriction is superseded for this surface. |
| A008 GUI program | A008-0030 Complete. ADR 0019 wave 1 landed all six children (A008-0032..A008-0037) on `main`. The product GUI is `gui/` plus `src/gui-host/`; Canvas + Agent Server remains an operator ACP path and is not the product. |
| A008 GUI host | `src/gui-host/` is a Node process that serves the built `gui/dist`, answers `GET /health`, `GET /v1/models`, and `POST /v1/shell` through the existing `runTerminalCommand`, and bridges `WS /v1/session` to an `A008-acp` stdio subprocess using the ADR 0019 D4 frame schema. It reads `NVIDIA_API_KEY`, `KIE_API_KEY`, `OPENAI_API_KEY`, optional `~/.a008/secrets.json` copies, and memory settings from process environment; redacts credential values and the `authorization` token from outbound text; rejects any cross-origin request that is neither same-origin nor loopback on every route and on the WebSocket upgrade; and requires `application/json` on `POST /v1/shell`. It also answers `POST /v1/upload`, which writes the original bytes to a content-addressed store outside the repository and asks the ACP process to ingest the resulting locator. ADR 0032/0033 let the host call NVIDIA catalog/image endpoints and kie.ai job endpoints; chat completions still run in ACP. The renderer never reads a key. Standalone mode now accepts optional `A008_GUI_PIN` with exactly six digits: root serves a PIN gate until login, a successful login issues a random `HttpOnly`/`SameSite=Strict` session cookie, every `/v1/*` route and the WebSocket require it, and five failed attempts trigger a 60-second lockout. `GET /health` stays public. `npm run gui-host` starts it; `npm run gui` builds the GUI first and then starts it. A008-0092 adds 25-second protocol heartbeats plus a 45-second in-memory detached-session resume grace using an opaque 32-byte capability; expiry/explicit close/host shutdown release or invalidate it. |
| A008 memory diagnostics | A008-0064 adds Memory Overview, Memory Relationship Map Graph and Memory Knowledge Manager to the existing diagnostic GUI. GET /v1/memory reaches read-only memory/inspect in the chat ACP runtime; no model call, second store or mutation. Actual totals, dormant evidence, state/history, search, filters, pagination, stored links and escaped details are visible. Refresh is explicit and the graph is capped at 80 nodes/240 links. Browser proof covers desktop/mobile, empty/unavailable states and chat/draft preservation. See docs/evidence/A008-0064_memory-gui-proof.md. |
| A008 GUI session controls | A008-0065 implements all CLI interactive commands and aliases through real ACP session controls. Parameters → Model owns per-session chat reasoning/sampling/generated-token/stream/seed/stop controls; A008-0145 adds Parameters → Semantic as a separate global runtime preference for semantic model and reasoning effort. Semantic output defaults to 128,000 tokens and remains capability-capped. Null omits optional request fields. V1 accepts older runtime-preference snapshots without the additive semantic field and the GUI reports that an older host cannot edit the new setting. Snapshot history replaces display-only placeholders. Mobile Chat/Memory/Tools and modal keyboard behavior are browser-verified; see `docs/evidence/A008-0065_session-controls-proof.md`. |
| A008 GUI client | `gui/` is a Vite/React/TypeScript app with A008 branding and no OpenHands imports. `useGuiSession` speaks host protocol v1 over one WebSocket and exposes status, sessionId, model, separate thought and answer buffers, error, `connect`, `prompt`, and `cancel`. Standalone tool permission UI offers Reject, Allow once and session-scoped Allow all; Allow all auto-approves later permission frames through the existing boolean response and resets on reconnect. The chat pane renders user, answer, and thought as distinct DOM channels; fenced code is syntax-highlighted with highlight.js; each assistant turn shows only the tool calls from that turn. A008-0145 makes the aggregate tool disclosure state user-owned for the duration of a tool cycle, so transient `running → completed → running` snapshots no longer force repeated close/open flashes. Empty chat shows the owner ASCII mark over a transparent 4D starfield, a rule, the heading and start cards. The composer carries the A008-0029 slash set; the terminal pane calls `POST /v1/shell`; settings and brand own the shell chrome. No provider call, credential, or telemetry ships in the renderer. After established transport loss it auto-reconnects with 0.5/1/2/5-second bounded backoff and attempts same-session resume; pending operations are rejected rather than replayed, and Allow all resets. |
| A008 session Code Canvas | A008-0091 adds a renderer-local HTML artifact beside the existing conversation. Completed assistant `html`/`htm` fences render as highlighted code and can be opened explicitly in Code Canvas; one current artifact can be edited locally (highlighted overlay editor) and previewed through a unique-origin `srcdoc` iframe sandboxed with only `allow-scripts`. The preview document is not highlighted. The injected CSP denies network connections/subresources, frames, workers, forms, objects and base URLs; no provider credential, ACP object, shell, filesystem handle, new host route or model tool enters the preview. A later model HTML version replaces an untouched artifact; local edits are preserved until the user chooses Use model update. Reset/new conversation clears the transient artifact. Repository persistence remains the existing `create_file`/`edit_file`/Git flow and therefore keeps its approval boundary. |
| A008 source upload ingest | `POST /v1/upload` stores an uploaded original under `A008_SOURCE_STORE_PATH` as `source:<sha256>/<sanitised-name>` and sends only that locator to the ACP process over `_a008/source/ingest`. `src/ingest/` decides the media type from magic bytes, extracts text, and sets its own provenance: text lifted from a document is `appears_in` and spoken by the uploader, a model's description of an image is `derived_from` and spoken by the model. `LocalMemoryRuntime.ingestSource` proves locator containment lexically and again through `realpath` before reading, then passes the extractor's content, speaker, relation and content kind straight to `ingest()`. An ingested source can additionally run the analyze/classify/commit coordinator, opt-in per call and off by default because one source can mean well over a hundred sequential provider calls. A source batch is origin-marked: it carries its locator as `sourceMessage` rather than its content, the commit path reuses the utterance `ingestSource` already created instead of re-ingesting it as a user turn, and `user-assertion-v1` acceptance is refused on origin alone. Uploading a document is not asserting its contents, and a document contains every proposition extracted from it, so both layers exist to stop an uploaded file being committed as user-stated fact. Three extractors run by default because none makes a provider call: UTF-8 text and Markdown, PDF through a lazily imported `pdfjs-dist`, and Word through a ZIP and OOXML reader built on Node's own `zlib` with no dependency. All three set `appears_in` and the uploader as speaker. Every OOXML format is a ZIP, so the sniffer reads the archive's part names to tell Word from a spreadsheet, a presentation or a plain archive, rather than reporting every ZIP as a document. A PDF with no text layer, an empty Word part and a corrupt archive are refused by name instead of stored as an empty success. `gui/src/upload/` is the renderer client. |
| A008 upload runtime proof | A real GUI host process, a real `A008-acp` subprocess, the real local memory runtime and the real extraction registry completed an upload: a text document stored, extracted and ingested as an artifact; the same bytes deduplicated to one blob; a PDF named `.txt` identified as a PDF; a traversal filename contained; a cross-origin upload refused; and the credential absent from every response body. Re-run and extended by A008-0056 with a real PDF and a real Word document each extracted end to end to distinct artifacts, and a spreadsheet stored under its own media type without extraction. 17 of 17 checks. Sixteen of seventeen documents in the owner's own folder extracted read-only on the same day; the seventeenth is a scan with no font object at all and is refused by name. Recorded in `docs/evidence/A008-0041_upload-ingest-proof.md` and `docs/evidence/A008-0056_document-extraction-proof.md`. |
| A008 GUI runtime proof | A real GUI host process, a real `A008-acp` subprocess, the real local memory runtime, and a loopback fake SSE endpoint completed one session: `session/new`, two `thought` frames, one `answer` frame, `prompt/ok`. The credential sentinel reached the provider server-side and appeared in no observed frame or body. Recorded in `docs/evidence/A008-0030_gui-runtime-proof.md`. |
| Knowledge-model program | A008-0021 is Complete (`docs/finished/A008-0021_close-knowledge-model-gap.md`). ADR 0018 D9 holds: S1–S10 pass in-memory and against SQLite with identical payloads; live CLI/ACP use `src/memory/knowledge/` without V3/V4/V7; `KnowledgeItem` is compatibility only. `docs/CURRENT_TASK.md` on `main` is the empty template. |
| Semantic-memory core | Exported provider-neutral contracts, `SemanticMemory`, explicit five-way reconciliation, active+dormant discovery, exact-budget projection, and separate audit/history exist. This is the v0 surface the gap analysis measures; it is not the accepted model. A project-namespaced SQLite adapter durably stores canon/audit and indexes exact entities, FTS5 lexical content, tags, domains, and optional vectors. A deterministic planner and hybrid reader deduplicate/score bounded candidates, keep three thresholds distinct, and project selected active canon without mutation. The reader is consumed by the exported orchestration surface below, not directly by CLI/ACP/Canvas. |
| Memory-aware orchestration | Exported `MemoryAwareChatSession` validates project/conversation/task/agent context, reads hybrid memory once, strips routing/control fields into a deterministic user-level envelope, sends at most two prior dialogue messages through one existing `ChatSession` transport call, applies an exact serialized-message budget, and commits only original user/assistant history. CLI and A008 ACP construct it through `createLocalMemoryRuntime`. |
| Post-output staging | Exported `PostOutputKnowledgeIntake` gives an analyzer only normalized original message and final answer, never reasoning or control state. The default ceiling is 128 proposals per answer, raised from 8 by A008-0046 after owner testing showed an ordinary factual text yielding 49. A008-0145 raises the global semantic output budget default to 128,000 tokens; every semantic request still takes the lower of that budget and the explicitly selected semantic model's supported output limit, because a truncated JSON array fails the strict parse and discards the whole batch. The analyzer instruction (A008-0047) asks for completeness rather than a summary. Support evidence is an exact quote from the original source; runtime computes UTF-16 spans and ignores model offsets. It validates and exact-budgets semantic drafts, applies runtime-owned scopes and conservative defaults, and returns untrusted proposal batches without repository access, relation decisions, or memory writes. |
| Relation-gated memory commit | Exported `IndexedRelationCandidateSource` and `RelationGatedMemoryCommit` process one staged proposal through one bounded current-candidate search, an exact-budget semantic envelope with invocation-local handles, validated five-way output, all-candidate revision guards, the existing canonical reconcile owner, and explicit `updated`/`not_required`/`pending_repair` index state. Classifier JSON may name a canonical relation as `type` or `relation`; unknown labels fail closed with the returned value. Live CLI/ACP construct a model-backed classifier and invoke the coordinator after each delivered answer. |
| Post-output memory coordination | Exported `PostOutputMemoryCoordinator` stages once, processes proposals sequentially, distinguishes stage/commit/index-repair outcomes, and validates in-memory checkpoints for retry or repair-then-resume without replaying earlier completed work. Local CLI/ACP invoke it after each delivered answer and attempt one index repair. |
| Stateless semantic model calls | Exported `ChatTransportSemanticJsonGenerator` makes exact-budget, non-streaming, history-free strict-JSON calls through one injected existing `ChatTransport`. Exported analyzer/classifier adapters share it; reasoning/usage/finish metadata are discarded, and cancellation propagates through the coordinator. A008-0145 makes semantic model identity and reasoning effort explicit global runtime preferences shared by retrieval scope, post-output extraction, relation classification and source extraction; credential presence never selects a model. Local composition injects the existing transport. |
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

A008-0109 verification: 587 core, 4 membership and 161 GUI tests pass; final
ACP/engine/bridge checks, builds, installed protocol and portable engine proof
pass. No running-host restart; the active service may still run the earlier build.

A008-0110 verification: 591 core, 4 membership and 161 GUI tests pass; builds,
installed protocol and portable engine proof pass. GUI: 533.97 kB main chunk,
161.63 kB gzip, with existing warnings. Work stops at this completed task at the
owner's request; next implementation is recorded in handoffs/A008-0110.md.

Integration: A008-0106 through A008-0110 are merged via PRs #47 through #51.
Latest implementation merge: 138bf30. Execution stopped at owner request after
A008-0110; CURRENT_TASK is restored and no subsequent child is active.
