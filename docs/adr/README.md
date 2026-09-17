# Decision Records

Discoverability: index. Every member is listed below.
Member state: required. Every member declares a `Status:` line.

Accepted records keep their path. Superseded decisions remain and link to their
replacement.

## Records

- [0044-native-vision-input.md](0044-native-vision-input.md) — Accepted; invocation-local native image input over existing upload locators while committed chat remains text-only; capability-gated direct/ACME execution and model metadata projection.

- [0043-acme-execution-boundary.md](0043-acme-execution-boundary.md) — Accepted; immutable non-cognitive ACME execution boundary plus Stage-3.5 evidence gate before default adoption.

- [0042-existing-project-registration.md](0042-existing-project-registration.md) — Accepted; host-owned registration/open of existing roots with no project-tree mutation or heuristic legacy-memory migration.

- [0040-stable-client-api-program.md](0040-stable-client-api-program.md) — Accepted; frozen client API target and sequential implementation.


- [0039-project-bootstrap.md](0039-project-bootstrap.md)
  — Accepted; host-owned project create/open registry, docs-first starter,
  lazy multi-agent policy, global memory with project namespace.

- [0038-global-app-theme-system.md](0038-global-app-theme-system.md)
  — Accepted; Neutral default plus selectable Deep Space; semantic tokens;
  renderer-local appearance preference. Amends ADR 0021 D2 and ADR 0030.

- [0037-mobile-websocket-recovery.md](0037-mobile-websocket-recovery.md)
  — Accepted; heartbeat, bounded reconnect and short capability-bound resume for standalone GUI sessions.

- [0036-openai-gpt-56-luna-provider.md](0036-openai-gpt-56-luna-provider.md)
  — Accepted; OpenAI GPT-5.6 Luna chat through the shared transport, write-only
  credential handling and OpenAI-only memory-aware runtime composition.

- [0035-frozen-instruction-and-memory-target.md](0035-frozen-instruction-and-memory-target.md)
  — Accepted; owner-reviewed specification and P1–P6 frozen; bounded L1 first.

- [0034-product-contract-and-necessity-gate.md](0034-product-contract-and-necessity-gate.md)
  — Accepted; current product contract and necessity gate for substantive changes,
  preserving A008's detailed product decisions and operator workflow.

- [0033-kie-provider.md](0033-kie-provider.md) —
  Accepted; kie.ai as a second chat/image provider. Amends 0032.

- [0032-nvidia-catalog-and-image-generation.md](0032-nvidia-catalog-and-image-generation.md) —
  Accepted; browse/add NVIDIA Build models, host image generation, write-only
  API key in Parameters. Amends 0019 D3/D4; does not change ADR 0020 D6.

- [0031-workbench-context-and-memory-map.md](0031-workbench-context-and-memory-map.md) —
  Accepted; Chat workbench is environment/sources context, tool help lives on
  Help, and the memory map is a domain-clustered radial graph. Amends ADR 0030.

- [0030-focused-standalone-workspace.md](0030-focused-standalone-workspace.md) —
  Accepted; focused standalone GUI with left navigation, centred chat and an
  optional workbench. Amends 0021 and 0022.

- [0028-engine-package-and-panels.md](0028-engine-package-and-panels.md) —
  Accepted; portable engine, shared sessions, bundled panels and approved tools.
- [0027-runtime-preferences-and-instructions.md](0027-runtime-preferences-and-instructions.md) —
  Accepted; global budgets and persistent user instructions.

- [0026-gui-session-controls.md](0026-gui-session-controls.md) — Accepted;
  CLI session parity and model-specific generation controls through host/ACP.

- [0025-memory-inspection-gui.md](0025-memory-inspection-gui.md) — Accepted;
  read-only GUI memory overview, relationship graph and knowledge inspection.

- [`0001-product-composition.md`](0001-product-composition.md) — Accepted;
  A008 combines a shared core, CLI, Agent Canvas-derived GUI, and optional
  add-ons including semantic memory.
- [`0002-license-and-source-boundaries.md`](0002-license-and-source-boundaries.md)
  — Accepted; Apache-2.0 for A008-owned content with preserved third-party
  license/provenance boundaries.
- [`0003-initial-runtime-and-provider-boundary.md`](0003-initial-runtime-and-provider-boundary.md)
  — Accepted; Node.js/TypeScript single package with provider-neutral core and
  NVIDIA behind an injected transport.
- [`0004-agent-canvas-acp-boundary.md`](0004-agent-canvas-acp-boundary.md) —
  Accepted (amended by ADR 0019); standalone Agent Canvas reaches the shared
  A008 chat core through Agent Server and a custom stdio ACP bridge. That
  path is operator compatibility, not the product GUI.
- [`0005-semantic-memory-v0-boundary.md`](0005-semantic-memory-v0-boundary.md) —
  Accepted (amended by ADR 0018); provider-neutral memory service, atomic
  persistence port, explicit reconciliation, and bounded materialized
  projections without model calls. Truth-versioning and activation-gated
  direct reads are withdrawn.
- [`0006-runtime-identity-v0.md`](0006-runtime-identity-v0.md) — Accepted;
  versioned typed runtime IDs and an atomic ACP binding port/reference without
  inventing unavailable external conversation mappings.
- [`0007-sqlite-hybrid-memory-read-path.md`](0007-sqlite-hybrid-memory-read-path.md)
  — Accepted (amended by ADR 0018); project-namespaced SQLite persistence and
  one bounded hybrid candidate funnel produce a read-only semantic-memory
  projection. Current-only hard filter and dormant-exclusion of exact hits
  are withdrawn.
- [`0008-memory-aware-chat-orchestration.md`](0008-memory-aware-chat-orchestration.md)
  — Accepted; verified runtime context, bounded memory/dialogue, and the
  original message compose one ephemeral request through the existing chat
  provider owner.
- [`0009-reasoning-and-post-output-intake.md`](0009-reasoning-and-post-output-intake.md)
  — Accepted; reasoning is display-only and post-output analysis can stage only
  bounded runtime-scoped semantic proposals without writing memory.
- [`0010-relation-gated-memory-commit.md`](0010-relation-gated-memory-commit.md)
  — Accepted (amended by ADR 0018); bounded ID-free candidate comparison,
  guarded reconciliation, and explicit retrieval-index repair form the first
  safe memory write boundary. Five-way supersede as truth versioning is
  withdrawn.
- [`0011-post-output-memory-coordinator.md`](0011-post-output-memory-coordinator.md)
  — Accepted; one staging call feeds sequential per-proposal commits with
  explicit partial failure, checkpoint resume, and index-repair barriers.
- [`0012-stateless-semantic-json-model-calls.md`](0012-stateless-semantic-json-model-calls.md)
  — Accepted; analyzer and classifier share one stateless, strict, budgeted
  semantic JSON owner over the existing chat transport without history or
  reasoning retention. Its D6 (A008-0061) splits the rejected fence/fragment
  pair: a fence wrapping the whole content is unwrapped, fragment extraction
  from prose stays rejected, and a parse failure now reports the finish reason
  and a bounded excerpt instead of naming the rule.
- [`0013-local-memory-surfaces-and-debug-trace.md`](0013-local-memory-surfaces-and-debug-trace.md)
  — Accepted; CLI and A008 ACP share one local memory composition root, a
  narrow user-assertion activation gate, and an opt-in secret-safe debug trace.
- [`0014-live-write-path-reinforcement.md`](0014-live-write-path-reinforcement.md)
  — Accepted (amended by ADR 0018); live CLI/ACP apply the engine
  restatement/extend score boost and keep retrieval non-mutating. Acceptance
  via keepAlive is withdrawn in favor of named ACCEPT.
- [`0015-reasoning-has-no-path-to-knowledge.md`](0015-reasoning-has-no-path-to-knowledge.md)
  — Accepted; NVIDIA channel leaks are normalized so reasoning cannot enter
  committed content, analyzer input, or canon; semantic calls are non-thinking.
- [`0016-write-path-source-message.md`](0016-write-path-source-message.md)
  — Accepted; user-assertion activation uses staged `sourceMessage`, overlapping
  turns are rejected, and restatement/extend boost remains origin-agnostic.
- [`0017-classifier-relation-type-alias.md`](0017-classifier-relation-type-alias.md)
  — Accepted; classifier JSON may name a canonical five-way relation as `type`
  or `relation`; unknown names still fail closed.
- [`0018-knowledge-and-memory-model.md`](0018-knowledge-and-memory-model.md)
  — Accepted; `KNOWLEDGE_MEMORY_MODEL.md` is constitution. Amends 0005, 0007,
  0010, and 0014. Dual-path new engine; do not grow `KnowledgeItem`; clocks
  on new types; INTERPRET proposes; RECONCILE is a slot state machine. Its D13 and D14
  (A008-0062) make `<entity>.statement` a set with the relation classifier as
  the judge of disagreement, and stop a deterministic commit refusal from
  discarding the rest of its batch.
- [`0019-a008-owned-gui.md`](0019-a008-owned-gui.md) — Accepted; product GUI
  is A008-owned `gui/` plus `src/gui-host/` ACP WebSocket bridge. Amends 0004.
  Canvas+Agent Server remains operator compatibility only.
- [`0020-source-upload-ingest.md`](0020-source-upload-ingest.md) — Accepted;
  uploads are stored by the GUI host and extracted in the ACP process over a
  locator. Amends 0019 D4 with POST /v1/upload. Extraction is a port; image
  description is its own port, not a ChatMessage change. Its D11 (A008-0056)
  supersedes the D8 bullet that held PDF and DOCX back: both are read now, PDF
  through pdfjs-dist and Word through a dependency-free ZIP/OOXML reader. Live
  vision stays unsupported pending an owner cost decision.
- [`0021-workspace-shell.md`](0021-workspace-shell.md) — Accepted; three-zone
  A008 shell and warm-neutral tokens. Its D5 programme is superseded by 0022.
  Reference inspected under a proprietary license; nothing adopted.
- [`0022-gui-is-a-test-surface.md`](0022-gui-is-a-test-surface.md) — Accepted;
  `gui/` is a live-test surface and the product client is external. Amends 0019
  D2, supersedes the 0021 D5 programme, and makes the host protocol an
  integration contract with a named-origin allowlist.
- [`0023-retrieval-is-additive.md`](0023-retrieval-is-additive.md) — Accepted; a
  surface may not suppress another surface. State, history, events, utterances,
  claims, artifacts and provenance coexist in one projection; ranking orders and
  never filters; deduplication is the single narrow exception; the byte budget
  is explicit and everything it cuts is reported. Records the finding that tags
  and domains are extracted but never stored, so tag matching downstream is
  inert.
- [`0024-retrieval-scope.md`](0024-retrieval-scope.md) — Accepted; one provider
  call places each message in domains and *related* domains before the read,
  seeded with the store's own vocabulary so both semantic calls share one
  taxonomy. `current_scope` accumulates domains — never tags — and resets only
  on an empty intersection, giving topic continuity without carrying old
  messages. Closes ADR 0023 D5. Its D5 records a ceiling that is not in the
  owner's specification, and why.
- [0027 — Runtime preferences and instructions](0027-runtime-preferences-and-instructions.md)
- [0028 — Engine package and panels](0028-engine-package-and-panels.md)
- [0029 — Standalone GUI repository tools](0029-standalone-gui-repository-tools.md)

- [0041-client-api-v2-and-ownership.md](0041-client-api-v2-and-ownership.md) - Accepted; V2/ownership/auth/recovery implementation decisions.
