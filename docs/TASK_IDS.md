# Task ID Register

Floor: A008-0001

This register allocates task identities. It records that an identity is taken,
never whether work is active or complete. Task state belongs in
`docs/CURRENT_TASK.md` and `docs/finished/`.

## How to claim

1. Choose one above the highest identity in this register and
   `docs/finished/`.
2. Append one row at the end. Never sort or insert between existing rows.
3. Commit the claim to `main` before changing a Draft charter to Ready.

## Claims

| Task ID | Title | Owner | Claimed | Work |
| --- | --- | --- | --- | --- |
| A008-0001 | bootstrap canonical docs-first repository state | mrWhite81 and felixnissen | 2026-09-01 | repository bootstrap |
| A008-0002 | configure multi-agent worker clone root | mrWhite81 and felixnissen | 2026-09-01 | repository configuration |
| A008-0003 | secure provider-neutral chat core and CLI | mrWhite81 and felixnissen | 2026-09-01 | first product implementation |
| A008-0004 | prove Agent Canvas shared-chat boundary | mrWhite81 and felixnissen | 2026-09-01 | first GUI integration |
| A008-0005 | verify Agent Canvas runtime through A008 ACP | mrWhite81 and felixnissen | 2026-09-01 | first visible GUI proof |
| A008-0006 | define semantic-memory core contract and reference engine | mrWhite81 and felixnissen | 2026-09-01 | first memory implementation |
| A008-0007 | define runtime identity and ACP binding contract | mrWhite81 and felixnissen | 2026-09-01 | first cross-surface identity |
| A008-0008 | repair post-identity current truth | mrWhite81 and felixnissen | 2026-09-01 | documentation consistency repair |
| A008-0009 | implement SQLite hybrid memory read path | mrWhite81 and felixnissen | 2026-09-01 | bounded retrieval and durable local memory |
| A008-0010 | compose verified memory-aware chat turn | mrWhite81 and felixnissen | 2026-09-01 | application read-path orchestration |
| A008-0011 | define safe post-output knowledge intake | mrWhite81 and felixnissen | 2026-09-01 | bounded knowledge proposals and reasoning exclusion |
| A008-0012 | implement explicit relation-gated memory commit | mrWhite81 and felixnissen | 2026-09-01 | candidate comparison, reconciliation, and retrieval indexing |
| A008-0013 | orchestrate staged post-output memory batch | mrWhite81 and felixnissen | 2026-09-01 | explicit per-proposal processing and partial outcomes |
| A008-0014 | own stateless semantic JSON model calls | mrWhite81 and felixnissen | 2026-09-01 | analyzer/classifier transport composition and cancellation |
| A008-0015 | prove committed two-turn semantic memory loop | mrWhite81 and felixnissen | 2026-09-01 | deterministic read-answer-commit-reread architecture benchmark |
| A008-0016 | wire memory-aware local test surfaces and secure provider tracing | mrWhite81 and felixnissen | 2026-09-01 | CLI/ACP live memory composition and opt-in diagnostics |
| A008-0017 | enable live write-path reconciliation reinforcement | mrWhite81 and felixnissen | 2026-09-01 | restatement/extend score boost and threshold reactivation |
| A008-0018 | isolate provider reasoning from knowledge and semantic calls | mrWhite81 and felixnissen | 2026-09-01 | NVIDIA stream normalization, semantic non-thinking profile, trace/failure repair |
| A008-0019 | bind write-path source message and repair current truth | mrWhite81 and felixnissen | 2026-09-01 | explicit user-assertion context, HTTP operation traces, live status docs |
| A008-0020 | normalize live relation-classifier type aliases | mrWhite81 and felixnissen | 2026-09-01 | accept relation/type aliases without inventing relations |
| A008-0021 | close knowledge-model gap to 100% | Grok (operator / boss) | 2026-09-02 | parent program; sole main merger |
| A008-0022 | adopt knowledge and memory model | Grok (operator / boss) | 2026-09-02 | ADR 0018 and charter freeze |
| A008-0023 | repair direct-match retrieval eligibility | A008-worker01 | 2026-09-02 | M1 v0 read-path defect repair |
| A008-0024 | introduce semantic addressing | A008-worker02 | 2026-09-02 | M3 new knowledge ontology and INTERPRET |
| A008-0025 | split state from history | unassigned | 2026-09-02 | M4 bindings, intervals, RECONCILE, UPDATE |
| A008-0026 | first-class evidence and acceptance | unassigned | 2026-09-02 | M5 utterance, claim, ACCEPT, typed payload |
| A008-0027 | evidence lifecycle and retrieval intents | unassigned | 2026-09-02 | M6 lifecycle on evidence; history surface |
| A008-0028 | knowledge storage redesign | unassigned | 2026-09-02 | M7 SQLite after in-memory S1Ã¢â‚¬â€œS10 |
| A008-0029 | CLI slash commands and native terminal tool | Grok (operator) | 2026-09-02 | interactive /commands and /shell; reject LangChain community |
| A008-0030 | A008-owned GUI program | Grok (operator / boss) | 2026-09-02 | parent; sole main merger |
| A008-0031 | adopt A008 GUI boundary | Grok (operator / boss) | 2026-09-02 | ADR 0019 and gui stub shell |
| A008-0032 | GUI host ACP WebSocket bridge | A008-worker01 | 2026-09-02 | src/gui-host spawn A008-acp |
| A008-0033 | GUI session client | A008-worker02 | 2026-09-02 | gui/src/session |
| A008-0034 | GUI chat transcript | A008-worker03 | 2026-09-02 | gui/src/chat |
| A008-0035 | GUI composer and slash commands | A008-worker04 | 2026-09-02 | gui/src/composer |
| A008-0036 | GUI terminal pane | A008-worker05 | 2026-09-02 | gui/src/terminal |
| A008-0037 | GUI settings and brand | A008-worker06 | 2026-09-02 | gui/src/settings and gui/src/brand |
| A008-0038 | release ACP sessions on renderer disconnect | operator-delegated | 2026-09-02 | ACP session_close and GUI host session lifecycle |
| A008-0039 | one command for the GUI module tests | operator-delegated | 2026-09-02 | shared gui test runner and script wiring |
| A008-0040 | caller-named INGEST provenance relation | operator | 2026-09-02 | ingest relation parameter; two orphaned test files into the gate |
| A008-0041 | source upload ingest program | Operator | 2026-09-02 | parent; ADR 0020; sole main merger |
| A008-0042 | source extraction port and text extractor | operator-delegated | 2026-09-02 | src/ingest |
| A008-0043 | runtime source-ingest surface and ACP method | operator-delegated | 2026-09-02 | src/runtime and src/acp |
| A008-0044 | GUI host upload route and blob store | operator-delegated | 2026-09-02 | src/gui-host |
| A008-0045 | GUI upload module | operator-delegated | 2026-09-02 | gui/src/upload |
| A008-0046 | Memory staging budget increase | mrWhite81 | 2026-09-02 | src/runtime |
| A008-0047 | post-output analyzer instruction rewrite | operator | 2026-09-03 | src/orchestration analyzer prompt |
| A008-0048 | GUI chat transcript auto-scroll | operator | 2026-09-03 | gui shell layout and chat pane |
| A008-0049 | source knowledge extraction (upload wave 2) | operator | 2026-09-03 | orchestration staging shape, runtime, ACP |
| A008-0050 | per-item analyzer resilience | operator | 2026-09-03 | staging validation and diagnostic |
| A008-0051 | provider timeout and chat generation overrides | operator | 2026-09-03 | runtime configuration |
| A008-0052 | workspace shell and design tokens | operator | 2026-09-03 | gui brand and app shell (ADR 0021) |
| A008-0053 | host protocol as an integration contract | operator | 2026-09-04 | HOST_PROTOCOL doc and named-origin allowlist |
| A008-0054 | model profile modalities and registry additions | operator | 2026-09-04 | core model registry |
| A008-0055 | correct the omni profile and add four verified models | operator | 2026-09-04 | core model registry |
| A008-0056 | document extraction for PDF and DOCX | operator | 2026-09-04 | src/ingest document extractors and the ZIP sniffer |
| A008-0057 | core suite membership check | operator | 2026-09-04 | test:core list guard |
| A008-0058 | additive knowledge projection | operator | 2026-09-04 | live-reader payload items |
| A008-0059 | accept the confidence models emit | operator | 2026-09-05 | staging proposal validation |
| A008-0060 | stored tags and domains on knowledge records | operator | 2026-09-05 | knowledge storage, write path, retrieve/filter |
| A008-0061 | diagnose and recover a non-JSON semantic response | operator | 2026-09-05 | semantic JSON parsing |
| A008-0062 | statements are a set; a failed proposal does not take the batch | operator | 2026-09-05 | slot cardinality and commit-loop resilience |
| A008-0063 | retrieval scope classification and current_scope | operator | 2026-09-05 | scope model call, accumulating scope, read wiring |
| A008-0064 | GUI memory diagnostics: overview, relationship graph, knowledge manager | Codex (operator) | 2026-09-06 | read-only runtime inspection, host contract and gui memory views |
| A008-0065 | GUI session commands and model parameters | Codex (operator) | 2026-09-06 | CLI parity, session controls, generation settings and host contract |
| A008-0066 | editable runtime budgets and global instructions | Codex (operator) | 2026-09-07 | persistent runtime preferences, GUI controls and prompt composition |
| A008-0067 | complete engine distribution and client panel integration | Codex (operator) | 2026-09-07 | engine lifecycle, shared sessions, bundled surfaces, model tools and external adapter |
| A008-0068 | standalone GUI repository tools | Codex (operator) | 2026-09-07 | native file tools, Git, visible tool catalog and standalone GUI verification |
| A008-0069 | focused standalone GUI workspace | Codex (operator) | 2026-09-07 | neutral shell, sidebar navigation, optional tools panel and integrated composer |
| A008-0070 | workbench context, help catalog and readable memory map | Grok (operator) | 2026-09-07 | environment/sources workbench, Help tab, empty-chat shortcuts, clustered memory graph |
| A008-0071 | NVIDIA Build catalog, image generation and start/file surfaces | Grok (operator) | 2026-09-08 | browse/add preview models, chat image generation, provider settings, start cards, file panel |
| A008-0073 | kie.ai provider for chat and image jobs | Grok (operator) | 2026-09-08 | KIE_API_KEY, OpenAI-compatible chat, async image jobs, Provider settings |
| A008-0074 | empty-chat ASCII logo | Grok (operator) | 2026-09-08 | centre the owner ASCII mark on the empty conversation |
| A008-0075 | hideable shortcut dock | Grok (operator) | 2026-09-08 | Hide/show the empty-chat shortcut chips; keep keyboard shortcuts |
| A008-0076 | empty-chat 4D starfield | Grok (operator) | 2026-09-08 | transparent starfield behind the empty conversation only |
| A008-0077 | browser iframe frame-ancestors fallback | Grok (operator) | 2026-09-08 | detect sites that refuse framing; open in system browser instead |
| A008-0078 | core product contract and necessity gate | Codex (operator) | 2026-09-08 | docs-first implementation authority and task template |
| A008-0079 | instruction plane and memory lifecycle specification | Codex (operator) | 2026-09-08 | bounded requirements, proposed policy defaults and acceptance cases |
| A008-0080 | frozen specification and coherent chat instruction | Codex (operator) | 2026-09-08 | adopt reviewed target and implement bounded L1 instruction composition |
| A008-0081 | L2 evidence lifecycle | Codex (operator) | 2026-09-08 | accepted P1-P5: lazy decay, exact evidence reinforcement and transactional migration |
| A008-0082 | L3 independent association lifecycle | Codex (operator) | 2026-09-08 | accepted P6: exact semantic edges, independent receipts and one-hop eligibility |
| A008-0083 | semantic request compatibility and JSON response contract | Codex (operator) | 2026-09-08 | fix observed Kimi parameter rejection; preserve strict semantic validation |
| A008-0084 | readable memory relationship map | Codex (operator) | 2026-09-08 | stable spaced domain clusters, selective labels and existing read-only inspection |
| A008-0085 | extraction JSON contract and live regression | Codex (operator) | 2026-09-08 | remove prompt pseudocode, distinguish durable facts from greetings and identify failing model/operation |
| A008-0086 | standalone GUI allow-all tool approval | Codex (operator) | 2026-09-08 | session-scoped third permission choice; no protocol expansion |
| A008-0087 | OpenAI GPT-5.6 Luna provider | Codex (operator) | 2026-09-09 | OpenAI chat-completions transport, secure key handling, model controls and provider-isolated semantic calls |
| A008-0090 | A008-integrerad kod-canvas | Rickard (operator) | 2026-09-09 | chat-driven lokal HTML/Canvas-rendering ÃƒÂ¶ver befintlig GUI/session/approval-grÃƒÂ¤ns |
| A008-0091 | session code artifact and isolated HTML/Canvas preview | Codex (operator) | 2026-09-09 | transient in-chat code content, local editor/preview, repository writes remain explicit approved tools |
| A008-0092 | mobile WebSocket recovery | Codex (operator) | 2026-09-09 | host heartbeat, bounded reconnect and short authenticated ACP-session resume grace |
| A008-0093 | global app theme system | Grok (operator) | 2026-09-11 | persistent semantic Neutral and Deep Space GUI themes |
| A008-0094 | project bootstrap | Grok (operator) | 2026-09-11 | host-owned new-project wizard, docs-first starter and project-scoped global memory |
| A008-0095 | A008 Tool usage and representation in chat  | mrWhite, A008 (operator) | 2026-09-11 | Slice 1 |
| A008-0096 | A008 Memory-engine behaviour changes  | mrWhite, A008 (operator) | 2026-09-11 | Slice 2 |
| A008-0097 | A008 Agentic tool usage behaviour and display changes  | mrWhite, A008 (operator) | 2026-09-11 | Agentic Tools |
| A008-0098 | recover expired standalone GUI PIN sessions | Codex (operator) | 2026-09-14 | central GUI auth recovery for expired PIN cookie |
| A008-0099 | preserve standalone host authentication on shell and upload | Codex (operator) | 2026-09-14 | fix omitted PIN cookies causing connect/project reload loops |
| A008-0100 | discard ended GUI session after close failure | Codex (operator) | 2026-09-14 | unblock project switching after host replaces the ACP process |
| A008-0101 | incremental SQLite knowledge persistence | Codex (operator) | 2026-09-14 | write only changed knowledge rows while preserving atomic L2/L3 lifecycle semantics |
| A008-0102 | host-client API boundary plan | Codex (operator) | 2026-09-14 | inspect current HTTP/WS and propose staged contract, SDK and client-boundary migration |
| A008-0103 | stable client API program | Codex (operator) | 2026-09-14 | owner-approved frozen seven-stage host/client boundary program |
| A008-0104 | shared v1 protocol contract | Codex (operator) | 2026-09-14 | inventory current HTTP/WS, consolidate wire contract and verify existing consumers without behavior changes |
| A008-0105 | shared v1 HTTP contracts | Codex (operator) | 2026-09-14 | consolidate remaining HTTP payload contracts, preserve v1 compatibility and verify real responses |
| A008-0106 | client API decisions | Codex (operator) | 2026-09-14 | decide V2, runtime/session ownership, auth and recovery within the frozen program |
| A008-0107 | shared project runtime registry | Codex (operator) | 2026-09-14 | extract engine owner, explicit existing-data attachment and alias/lifetime tests |
| A008-0108 | cross-process runtime registry ownership | Codex (operator) | 2026-09-15 | exclude competing registry processes and release ownership after exit/crash |
| A008-0109 | shared standalone session facade | Codex (operator) | 2026-09-15 | route standalone sessions through shared runtime ownership and cover legacy runtime process claims |
| A008-0110 | V2 authentication foundation | Codex (operator) | 2026-09-15 | shared auth schemas, owner-local device grants, scoped expiring credentials and one-use tickets |
| A008-0111 | register and open existing projects | Codex (operator) | 2026-09-15 | host-owned existing-project adoption without project-tree mutation |
| A008-0112 | V2 session transport and authority | Codex (operator) | 2026-09-15 | first-frame WS auth, project/session business dispatch, capability and live-revocation gates |
| A008-0113 | README current-state refresh | Codex (operator) | 2026-09-15 | align public README with implemented Stage 1-3 API, current runtime/memory/providers and verified usage |
| A008-0114 | ACME execution substrate evaluation (Stage 3.5) | Grok (delegated) | 2026-09-15 | execution-adapter parity, failure-evidence proof and go/no-go before Stage 4 |
| A008-0115 | Luna semantic control compatibility | Codex (operator) | 2026-09-15 | omit unsupported Luna temperature on semantic retrieval and memory extraction |
| A008-0116 | batch relation classification | Codex (operator) | 2026-09-15 | replace per-proposal semantic relation calls with one bounded batch classification |
| A008-0117 | retrieval precision and necessity gate | Codex (operator) | 2026-09-15 | semantic retrieval necessity, narrow labels and ACME route evidence |
| A008-0118 | ACME runtime/2 consumer and control-parity GO | Grok (operator) | 2026-09-15 | consume acme-model-runtime/2, explicit executionProvider, aligned control contracts, Stage 3.5 GO |
| A008-0119 | preserve valid final answers and V2 runtime diagnostics | ChatGPT (operator hotfix) | 2026-09-16 | reasoning-normalizer false positive and safe V2 error detail |
| A008-0120 | re-factoring prompts | mrwhite81 (operator) | 2026-09-16 | prompts in /src/prompt-contracts |
| A008-0121 | harden post-output knowledge extraction eligibility | ChatGPT (operator) | 2026-09-16 | durable-claim filtering, entity hygiene and prompt regressions |
| A008-0122 | repair entity graph and relation/provenance contracts | Brittan (sucessor) | 2026-09-17 | identity, topology, relation semantics and graph/provenance projection |
| A008-0123 | Visual improvement on the memory-map graph | mrWhite81 (sucessor) | 2026-09-17 | gui/src/memory |
| A008-0124 | native vision input and model capability metadata | ChatGPT (operator) | 2026-09-17 | expose verified model specs in UI and route uploaded images as native vision input before Stage 4 |
| A008-0125 | Code prettier and lint | mrWhite (operator) | 2026-09-17 | Cleaning up |
| A008-0126 | post-0120 operator journal and handoff hygiene | ChatGPT (operator) | 2026-09-18 | restore missing 0122/0124 operator records and clear stale 0124 current-task state before embedded-ACME migration |
| A008-0127 | embedded ACME model-runtime migration | ChatGPT (operator) | 2026-09-18 | replace default HTTP sidecar execution with in-process acme-engine while preserving A008 ownership of model selection, memory, prompts and tools |
| A008-0128 | embedded OpenAI output-token wire compatibility | ChatGPT (operator) | 2026-09-18 | consume acme-engine 0.1.4 and select max_completion_tokens for embedded OpenAI Chat Completions profiles |
| A008-0129 | Luna function-tools reasoning compatibility | ChatGPT (operator) | 2026-09-18 | force effective reasoning_effort none for GPT-5.6 Luna Chat Completions turns that include function tools |
| A008-0130 | unified attachments | ChatGPT (operator) | 2026-09-18 | Unified prompt attachments: clipboard paste, file picker, drag/drop och local filepath â†’ same source locator pipeline.|
| A008-0131 | native OpenAI Responses routing for Luna | ChatGPT (operator) | 2026-09-18 | consume acme-engine 0.1.5 and route OpenAI/Luna through native Responses while leaving NVIDIA/KIE compatible routes unchanged |
| A008-0132 | Stage 4 turn identity and ordered snapshot foundation | ChatGPT (operator) | 2026-09-18 | first bounded Stage-4 child: application turn/message identity, monotonic session events, authoritative snapshot boundary and explicit terminal turn outcomes |
| A008-0133 | OpenAI GPT-5.6 Terra selectable profile | ChatGPT (operator) | 2026-09-19 | add Terra beside Luna through the existing OpenAI/Responses model-selection path without changing defaults |
| A008-0134 | validated zero-cost model catalog | ChatGPT (operator) | 2026-09-19 | verify currently available zero-cost/free-tier model routes and add a data-only importable source catalog without changing routing |
| A008-0135 | docs-first reality sync | ChatGPT (operator) | 2026-09-19 | reconcile README and current governing docs with merged runtime/product reality |
| A008-0136 | GUI capability sync and ZeroCostRadar | ChatGPT (operator) | 2026-09-19 | expose Stage-4 discovery/current capability and validated zero-cost model catalog in the bundled GUI without changing routing |
| A008-0137 | neon memory-map topology presentation | Rickard (operator) | 2026-09-19 | improve the existing read-only memory graph topology presentation without changing memory semantics |
| A008-0138 | Stage 4 command receipts and bounded idempotency | ChatGPT (operator) | 2026-09-19 | stable command IDs, canonical payload digests, bounded process-local receipts and duplicate-mutation suppression |
| A008-0139 | Stage 4 reconnect/resume lease | ChatGPT (operator) | 2026-09-19 | detached-session lease, scoped resume capability, authoritative resume snapshot and stale-approval handling |
| A008-0140 | Stage 4 restart uncertainty and closure proof | ChatGPT (operator) | 2026-09-19 | restart/unknown-outcome semantics and final Stage-4 race/compatibility closure gate |
| A008-0141 | *Oldscool CRT scanlines and phosphor bloom | A008 | 2026-09-19 | New Oldscool theme. |
| A008-0142 | In-sequence image generation and model-triggered image tool | A008 | 2026-09-20 | ordered image-generation transcript placeholders, in-place resolution and shared manual/model tool pipeline |
| A008-0143 | Atomic knowledge state ownership and reinforcement semantics | A008 (operator) | 2026-09-20 | current state as SSOT, atomic history transition, temporal ownership and non-skippable semantic reinforcement |
| A008-0144 | Canonical knowledge, memory and contextual-attraction model | A008 (operator) | 2026-09-20 | supersede residual 0143 admission semantics, adopt CURRENT_MEMORY_MODEL and add signed retrieval attraction |
| A008-0145 | explicit chat/semantic model controls and stable tool summary | ChatGPT (operator) | 2026-09-20 | provider routing, reasoning summary, max-output defaults and chat tool-summary stability |
| A008-0146 | README current-state synchronization after Stage 4 closure | Rickard (operator) | 2026-09-20 | docs-only README alignment with completed Stage 4 and subsequent user-visible updates |
| A008-0147 | project conversation session restore | ChatGPT (operator) | 2026-09-21 | reopen a registered project into its existing canonical conversation history instead of an empty chat |
| A008-0148 | user-configured MCP servers and Settings surface | Rickard (operator) | 2026-09-21 | product/GUI configuration and lifecycle for existing MCP tool support |
| A008-0149 | Stage 5 independent client SDK and bundled web migration | Grok (operator) | 2026-09-21 | platform-independent @a008/client, credential adapters, GUI consumes SDK |
| A008-0150 | normalize strict-provider null sentinels for optional MCP arguments | Rickard (operator) | 2026-09-21 | restore OpenAI strict-schema nullable-required optional MCP fields before local validation |
| A008-0151 | ZeroCostRadar live refresh and model import | ChatGPT (operator) | 2026-09-21 | explicit live discovery refresh plus bounded import for already-executable routes |
| A008-0152 | ZeroCostRadar provider execution support | ChatGPT (operator) | 2026-09-21 | explicit host-owned execution and credentials for currently discovery-only zero-cost providers |
| A008-0153 | catalog-backed runtime model registry | ChatGPT (operator) | 2026-09-22 | make user-catalog models first-class runtime/session profiles instead of UI-only extras |
| A008-0154 | MCP health probe and isolated session lifecycle | Grok (operator) | 2026-09-22 | ephemeral stdio health probe, session-catalog indicator, and runtime-owned MCP session scope |
| A008-0155 | themed project sidebar | Codex (operator) | 2026-09-22 | owner-requested project navigation and project details following the active app theme |
| A008-0156 | distributed platform specification | Codex (operator) | 2026-09-22 | complete the owner's platform draft with background-run, multiproject, ownership, recovery and migration contracts; documentation only |
| A008-0157 | platform specification with established multi-agent workflow | Codex (operator) | 2026-09-22 | integrate the four optional add-on contracts and productize the owner's practiced Docs-First multi-agent workflow; documentation only |
| A008-0158 | execution verification evidence boundary | Codex (operator) | 2026-09-22 | reserve execution verification evidence for runtime verification and separate it from A008 semantic evidence, cognition and memory; specification only |
| A008-0159 | model-aware live verification budgets | Codex (operator) | 2026-09-22 | replace blanket paid-call escalation with bounded delegated verification authority, model-aware cost estimates and shared task limits; documentation only |
| A008-0160 | platform implementation program | Codex (operator) | 2026-09-22 | adopt platform direction, own dependency graph, bounded delegation, verified PR integration and release gates |
| A008-0161 | platform durable work store | Codex (operator) | 2026-09-22 | local scoped SQLite conversations, runs, receipts, outbox and fenced recovery under the platform contract |
| A008-0162 | platform V3 protocol contracts | Codex (operator) | 2026-09-22 | separately versioned durable-work wire schemas and independent protocol verification without changing V1/V2 |
| A008-0163 | trusted platform conversation seeding | Codex (operator) | 2026-09-22 | seed existing shared runtime sessions from backend-owned committed history without writing the legacy workspace store |
| A008-0164 | platform local backend integration | Codex (operator) | 2026-09-22 | compose durable store, trusted runtime and authenticated V3 HTTP with background scheduling and real process recovery proof |
| A008-0165 | platform independent V3 client | Codex (operator) | 2026-09-22 | thin authenticated SDK for V3 conversations/runs/events with explicit command identity and no automatic mutation retry |
| A008-0166 | host fixture catalog isolation | Codex (operator) | 2026-09-22 | isolate local test catalog from user MCP configuration and restore reproducible V2 SDK verification |
| A008-0167 | bundled platform conversation surface | Grok (operator) | 2026-09-22 | additive GUI for opted-in V3 conversations and text runs without replacing V1 chat or migrating history |
| A008-0168 | platform admin CLI | Grok (operator) | 2026-09-22 | local inspect and cancel commands over the existing V3 client, without a reconciliation API |
| A008-0169 | retrieved-context knowledge extraction contract | ChatGPT (operator/worker) | 2026-09-23 | inject exact retrieved knowledge, user message and provider response into extraction; explicit reinforcement/state/relation candidates |
| A008-0170 | instruction inline template | ChatGPT (operator/worker) | 2026-09-23 | render strict A008-owned runtime fields inside system Instructions without leaking them into user content |
| A008-0171 | librarian prompt contract simplification | ChatGPT (operator/worker) | 2026-09-23 | align dialogue retrieval/extraction/relation prompts with current-state librarian model |
| A008-0172 | restore durable knowledge domain classification | ChatGPT (operator/worker) | 2026-09-24 | prevent Librarian sparsity guidance from collapsing classifiable knowledge into unlabeled retrieval records |
| A008-0173 | secure current memory-model bevaviour| mrWhite & Codex (operator&worker) | 2026-09-24 | fix verify validate baseline memory function secure |
| A008-0174 | restore semantic tags and scoped follow-up retrieval | Codex (operator/worker) | 2026-09-24 | repair missing extracted tags and continuity of existing state addresses across indirect follow-up turns |
| A008-0175 | restore atomic dialogue extraction | Codex (operator/worker) | 2026-09-24 | repair empty project-report extraction and atomic state-bearing claims while retaining owner label ranges |
