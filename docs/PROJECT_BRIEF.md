# Project Brief

Status: Approved product direction. Current accepted decisions refine the
original bootstrap proof described below; new behavior needs bounded authority.

## Core Product Contract

Adopted for implementation review by
[ADR 0034](adr/0034-product-contract-and-necessity-gate.md). This section owns
the short current product contract; the cited A008 decisions own its detailed
constraints and exceptions. PC identifiers are stable and are not reused for
different meanings. Current availability and gaps belong in CURRENT_STATUS.

A008 is one AI client with a shared engine, supported CLI/GUI and external
client surfaces, and optional persistent semantic memory.

- **PC-01 — One shared engine.** Supported clients reach the same owned chat,
  provider, session and memory boundaries. A GUI or integration does not create
  a competing chat engine or provider owner. See ADR 0001, 0019, 0028 and 0029.
- **PC-02 — Contextual retrieval.** With memory enabled, retrieve project-scoped
  knowledge using stored labels, classified domains and related signals, and
  the conversation's accumulating domain scope. Matching must not require a
  literal word shared by question and record when a semantic scope signal
  matches. Scope updates, approved limits and degraded reads follow ADR 0024
  D1-D6; this summary does not promise persistence of in-session scope.
- **PC-03 — Additive provider context.** Matching admitted state, history,
  events, utterances, claims, artifacts and provenance can coexist. One surface
  must not suppress another merely by having a match. Preserve the explicit
  ranking, narrow deduplication and reported budget rules of ADR 0023 D1-D4.
- **PC-04 — Durable knowledge with runtime authority.** After a completed turn,
  derive proposals from the original message and final answer, reconcile through
  the accepted knowledge model and persist results for later retrieval. Model
  proposals are not canonical state. Reasoning never becomes durable chat or
  knowledge; ADR 0028's ephemeral tool-transcript exception remains narrow.
  See ADR 0018, 0013 and 0028 and the knowledge constitution.
- **PC-05 — Explicit execution and credential boundaries.** Model-initiated
  tools require structured calls and the established approval/cancellation
  boundary. Retrieved text and command-shaped answers cannot grant execution.
  Provider credentials remain outside the renderer. See ADR 0019 D6, 0028,
  0029, 0032 and 0033.
- **PC-06 — Supported user controls and content.** Expose supported session and
  model controls, memory inspection, source intake and image generation through
  their existing runtime/host/provider owners. Canonical committed conversation
  content may be multimodal, including typed image references, under ADR 0045;
  media persistence and semantic-memory provenance remain separately owned.
  Preserve source provenance and explicit unsupported outcomes; a listed
  capability alone does not implement or authorize it. See ADR 0020, 0025-0027,
  0030-0033 and 0044-0047.

- **PC-07 — A008 Platform.** Owner-approved direction is one canonical backend
  with durable scoped conversations/runs independent of client lifetime and
  semantic-memory enablement, parallel projects, thin clients, explicit execution
  targets and established Docs-First multi-agent coordination. Implement through
  A008-0160 and ADR 0048 with versioned contracts, safe migration, authorization,
  recovery and stage-specific verification. Preserve PC-01 through PC-06;
  platform adoption does not change cognition or memory semantics.

Apply the [Necessity Gate](TASK_WORKFLOW.md#necessity-gate) to each substantive
change. Cite the exact PC clause and the accepted detailed constraint needed
for that change. This compact contract neither erases existing exceptions nor
approves hypothetical capabilities. Hold an affected change when authority
conflicts; resolve the decision instead of silently selecting convenient text.

The bootstrap proof and its phase-specific exclusions below record the original
bounded scope. Later accepted ADRs define the current supported product; the
brief's historical proof is not a reason to reverse those decisions.

## Purpose

Build a full-featured AI client that combines the useful behavior of the legacy
NVIDIA CLI with a modern GUI/client derived from OpenHands Agent Canvas and an
add-on model for capabilities such as semantic memory.

## Approved product direction

- ADR 0047 adopts the owner's themed project-sidebar workflow: registered
  projects expose multiple saved chats through the existing host/runtime and
  SQLite conversation owner. It supersedes ADR 0046's single-current-chat limit
  while retaining ephemeral session authority, project isolation and existing
  reset/model-change semantics for the selected chat.

- ADR 0045 withdraws the inherited text-only committed-chat restriction. A008's canonical conversation model may carry provider-neutral typed multimodal content, including generated-image references, while raw media remains in the source store and image content does not automatically become semantic knowledge. Existing string messages remain a compatibility form during migration.

- ADR 0043 accepts ACME as a Stage-3.5 execution-substrate candidate under one immutable boundary: **the ACME integration replaces A008's provider execution path, not any part of the A008 cognitive or memory architecture.** A008 owns why, what and when to execute; ACME may own how an already-authorized execution is carried out. Default adoption requires Stage-3.5 parity/reliability evidence and is not pre-decided.

- ADR 0041 resolves the frozen API program's V2, ownership, authentication and
  recovery decisions. CLIENT_API_V2.md specifies the target; verified availability
  remains in CURRENT_STATUS. Existing v1/ACP and knowledge bindings stay protected.

- ADR 0040 adopts the frozen seven-stage client API program. Existing v1/ACP
  compatibility and project data remain obligations; implementation proceeds
  through bounded children. Acceptance does not claim V2 availability.

- ADR 0035 freezes the owner-reviewed instruction/memory target, including
  P1–P6, at its recorded body hash. Its exact amendments refine PC-01/02/04/05/06;
  L1, L2 and L3 remain separately bounded implementation slices. Acceptance
  does not claim implementation; CURRENT_STATUS records actual availability.

- ADR 0029/0030: the owner also selects A008's standalone GUI for repository
  work, with a focused neutral workspace inspired by their Codex screenshot.
  External clients continue to consume the same shared engine contract.

- One shared application core serves both CLI and GUI rather than maintaining
  two independent chat implementations.
- The legacy CLI is behavioral evidence for provider/model configuration,
  streaming, error handling, and terminal interaction; its monolithic source is
  not the target architecture.
- OpenHands Agent Canvas is the candidate GUI/shell source. Its existing backend
  contracts and repository boundaries must be respected rather than bypassed
  with direct browser-to-provider calls.
- Semantic memory is an optional backend capability to be created from the
  owner's Context-First Knowledge Architecture. A008-0006 establishes the first
  A008-owned contract and deterministic in-memory reference engine. A008-0009
  adds project-namespaced SQLite persistence and a bounded hybrid read path; no
  external implementation baseline was adopted. Runtime owns state; model
  invocations receive bounded, task-specific, semantically closed projections.
- Development uses the docs-first workflow and may use isolated multi-agent
  waves after tasks, ownership, worktrees, and approvals are explicit.

## First product proof

A008-0003 establishes the provider-neutral shared chat core, secure NVIDIA
adapter, one verified model profile, and thin CLI. A008-0004 establishes the
standalone Agent Canvas -> Agent Server -> custom ACP boundary and a launchable
bridge to that same core. A008-0005 completes the first product proof by sending
one message from a running Agent Canvas instance and visibly rendering the
deterministic loopback response through the bridge.

The proof deliberately excludes live model inference, tool execution, automatic
fallback, semantic retrieval, and production persistence. A008-0006 adds the
first project-owned semantic-memory contract and in-memory reference engine
without reopening provider ownership or the demonstrated GUI boundary. Runtime
integration, automatic semantic analysis, identity lifecycle/mapping, privacy
policy, and durable persistence remain later bounded slices. A008-0007
establishes typed runtime identities and an ACP binding port; actual Agent
Server conversation intake, durable mapping, lifecycle, and memory orchestration
remain deferred. A008-0009 establishes the first durable local memory adapter
and provider-neutral candidate funnel without connecting it to chat or defining
the automatic post-output write loop. A008-0010 establishes the exported
provider-neutral application read path: complete verified runtime context,
read-only memory, bounded recent dialogue, and the original message become one
budgeted request through the existing chat/provider owner. Live surface intake
and the post-output write loop remain separate. A008-0011 makes reasoning an
explicit display-only channel and establishes bounded post-output staging from
only original message plus final answer. Staging remains untrusted and performs
no relation decision or memory write. A008-0012 adds the provider-neutral
write-side boundary: bounded current-candidate materialization, ID-free explicit
five-way classification, revision-guarded canonical reconciliation, and
observable retrieval-index completion/repair. It still has no provider-backed
classifier and is not automatically invoked by a live surface. A008-0013 joins
staging and per-proposal commit behind an exported sequential coordinator with
explicit partial-failure, resume, and repair barriers. Its checkpoints remain
in-memory caller state; no live or background owner invokes it. A008-0014
implements concrete model-backed analyzer and relation-classifier adapters
through one injected, stateless, strict-JSON owner over the existing chat
transport. Semantic calls remain outside `ChatSession`, discard reasoning, and
are not yet composed by a live surface. A008-0015 upgrades the deterministic
architecture proof: an active SQLite item is projected into turn one, extended
through the full post-output pipeline, and projected at revision two into turn
two through one shared fake transport. It does not authorize automatic
activation of a brand-new untrusted draft. A008-0016 connects that loop to
local CLI and A008 ACP, adds a narrow user-assertion activation gate, and
introduces opt-in secret-safe provider tracing.

## Goals

- Preserve useful legacy behavior through tested contracts.
- Reuse OpenHands at a deliberate, license-compliant boundary.
- Keep provider, UI, agent execution, and memory replaceable behind versioned
  interfaces.
- Make persistent state queryable while keeping model context bounded by task.
- Support local development first and leave a path to a packaged desktop client.

## Non-goals for the bootstrap phase

- Shipping or claiming a working client.
- Treating a copied OpenHands frontend as the whole A008 architecture.
- Copying the raw legacy directory into product source.
- Calling a long prompt, transcript replay, or opaque ID list semantic memory.
- Making the optional multi-agent process layer part of the application runtime.

## Open decisions

1. Closed by ADR 0019: the product GUI is A008-owned `gui/` plus `src/gui-host/`.
   Standalone Agent Canvas + Agent Server remains an operator ACP path only.
2. Durable retry, background repair ownership, and production failure UX
   beyond the local CLI/ACP composition that now injects the existing
   transport/model/budgets and awaits in-process post-output settlement.
3. Production sidecar versus in-process memory topology and the server-scale
   persistence adapter. SQLite is the implemented single-process local adapter;
   PostgreSQL/Supabase remains a replaceable option when server requirements are
   demonstrated.
4. Desktop packaging target, supported platforms, and sandbox policy.
5. Durable lifecycle and external intake for the v0 project, conversation,
   runtime-task, agent, and ACP-session identity contract.
6. Telemetry default, consent, retention, export, and deletion policy.
