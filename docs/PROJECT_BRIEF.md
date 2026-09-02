# Project Brief

Status: Approved direction for bootstrap. Detailed application architecture is
still open and requires bounded decisions.

## Purpose

Build a full-featured AI client that combines the useful behavior of the legacy
NVIDIA CLI with a modern GUI/client derived from OpenHands Agent Canvas and an
add-on model for capabilities such as semantic memory.

## Approved product direction

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

1. Whether a later product phase keeps standalone Agent Canvas or consumes its
   library exports after the ACP proof.
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
