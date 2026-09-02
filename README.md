![alt text](https://github.com/zackemannen81/a007/blob/main/a007hero.jpg?raw=true)
# a007

a007 is an early AI-client implementation built around one provider-neutral
chat core shared by terminal and GUI-facing surfaces. The current product slice
contains a tested CLI, NVIDIA adapter, custom ACP bridge for OpenHands Agent
Canvas, provider-neutral semantic-memory reference core, and typed runtime
identity/binding primitives. Semantic memory now also has a durable local
project-namespaced SQLite adapter and bounded hybrid read path. A real local
Canvas/Agent Server browser turn is verified against a loopback fake provider;
an exported memory-aware application session now composes verified identity,
bounded memory/dialogue, and one existing chat call. Provider reasoning is an
explicit display-only channel, and an exported post-output service can stage
bounded semantic proposals from only the user message and final answer. An
exported relation gate now compares one proposal with bounded materialized
current candidates, maps an ID-free five-way decision, and performs guarded
reconciliation plus explicit index repair. A provider-neutral coordinator now
stages once and processes multi-proposal results sequentially with explicit
partial-failure and repair checkpoints. Local CLI and a007 ACP now share that
memory-aware runtime, a narrow user-assertion activation gate, and opt-in
secret-safe debug tracing. Agent Server conversation binding and resume remain
deferred.

## What works now

- Transactional in-memory `ChatSession` with successful-turn commit and failed-
  turn rollback.
- Provider-neutral message, request, stream-delta, result, error, model, and
  transport contracts.
- NVIDIA's OpenAI-compatible chat-completions adapter using native fetch.
- Streaming SSE reasoning/content assembly and non-streaming JSON responses.
- Typed authentication, rate-limit, provider, server, timeout, cancellation,
  network, configuration, unknown-model, and invalid-response errors.
- One verified model profile: `nvidia/nemotron-3.5-lightning-30b-a3b`.
- Thin CLI for model listing and interactive memory-aware chat.
- Stable-v1 `a007-acp` stdio bridge that Agent Server can launch as a Custom
  Agent Canvas agent.
- Visible Agent Canvas round trip through that bridge and the same provider
  adapter using a deterministic loopback endpoint.
- Atomic in-memory semantic-state reference engine with explicit reconciliation,
  active/dormant discovery, current/history separation, and hard bounded context
  projection.
- Project-namespaced SQLite semantic-memory persistence plus a deterministic
  exact/entity, lexical, tag, domain, and optional-vector candidate funnel.
- Read-only selected projection with separate candidate/projection/activation
  thresholds and bounded debug evidence outside execution context.
- Provider-neutral `MemoryAwareChatSession` that strips routing/control fields,
  bounds provider-visible dialogue to at most two prior messages, enforces an
  exact serialized-message budget, and preserves one transport call.
- Provider-neutral `PostOutputKnowledgeIntake` that excludes reasoning and
  control data, assigns conservative runtime-owned fields, and stages bounded
  untrusted proposals without reconciling or persisting them.
- Provider-neutral `RelationGatedMemoryCommit` that performs one bounded
  current-candidate search, exposes only local handles and semantic fields to a
  relation classifier, guards every materialized revision, and reports index
  completion or a retryable repair document explicitly.
- Provider-neutral `PostOutputMemoryCoordinator` that stages once, commits
  proposals in order, stops on incomplete indexing, and resumes from explicit
  checkpoints without replaying earlier canonical work.
- Runnable fake-provider/actual-SQLite two-turn benchmark for repeated memory
  selection, reasoning isolation, bounded dialogue, and control-ID exclusion.
- Local CLI/ACP composition that streams answers first, then awaits post-output
  settlement against project-namespaced SQLite.
- Opt-in `off` / `safe` / `raw` JSONL debug traces that never record API keys
  or authorization headers.
- Versioned typed project/conversation/task/agent/ACP-session IDs plus an atomic
  in-memory ACP binding repository; default ACP sessions use the canonical ID.
- Fake-only automated coverage; tests make no live provider calls.

## Requirements

- Node.js 22.12 or newer.
- npm.
- `NVIDIA_API_KEY` only when using interactive NVIDIA chat.

## Install and verify

```powershell
npm ci
npm run typecheck
npm run build
npm test
npm run benchmark:memory-loop
```

## CLI

List models without loading a credential:

```powershell
npm run build
node .\dist\src\cli.js models
```

For local chat, copy `.env.example` to `.env.local`, set
`NVIDIA_API_KEY`, then run:

```powershell
npm run cli -- chat
```

Inside chat, `/reset` clears conversation turns while preserving the system
message and SQLite namespace, and `/exit` ends the session. See
`docs/LOCAL_MEMORY_SURFACES.md` and `docs/DEBUG_TRACE.md` for SQLite path,
identity, activation, and tracing settings. Default memory state is
`~/.a007/memory.sqlite`.

## Agent Canvas bridge

After building, configure Agent Canvas's Custom ACP command as:

```text
node C:/code/a007/dist/src/acp/server.js
```

Select `nvidia/nemotron-3.5-lightning-30b-a3b` and provide `NVIDIA_API_KEY`
through Agent Server's secret boundary. The bridge is protocol-tested and has a
visible local Canvas/browser result against a loopback fake endpoint. See
`docs/AGENT_CANVAS_INTEGRATION.md` for the exact boundary, Windows notes, and
limitations, and `docs/evidence/A007-0005_agent-canvas-runtime-proof.md` for the
safe proof record.

## Architecture boundary

```text
CLI ------------------------.
                             v
Agent Canvas -> Agent Server -> a007-acp -> createLocalMemoryRuntime
                                         -> one NVIDIA ChatTransport
                                         -> MemoryAwareChatSession
                                         -> post-output coordinator
                                         -> NvidiaChatTransport
                                         -> POST /v1/chat/completions

verified application context -> MemoryAwareChatSession
                             -> HybridMemoryReader -> SemanticMemory
                             -> bounded prompt envelope
                             -> ChatSession -> existing provider transport

original message + final answer -> PostOutputKnowledgeIntake
                                -> bounded staged proposals
                                -> PostOutputMemoryCoordinator
                                   -> RelationGatedMemoryCommit per proposal
                                   |- indexed current candidates
                                   |- ID-free five-way relation
                                   |- guarded SemanticMemory.reconcile
                                   `- updated / not_required / pending_repair

MemoryRepository -> SQLite local adapter / in-memory test adapter

future application context -> AcpIdentityBindingRepository
                           -> in-memory reference adapter
```

Core imports do not read environment variables or depend on terminal code. The
NVIDIA adapter receives the credential and an injectable fetch function at its
boundary. CLI and ACP share the same composition factory. See
`docs/SYSTEMDOC.md`, `docs/adr/0003-initial-runtime-and-provider-boundary.md`,
and `docs/adr/0004-agent-canvas-acp-boundary.md`.

The exported orchestration path now connects read-only memory to the existing
chat owner when its caller supplies complete verified identity. It sends one
deterministic user-level context envelope, never commits that envelope to chat
history. Reasoning remains display-only. The separate staging boundary accepts
only message and final answer and creates no provider call. The relation gate
processes one staged proposal through an injected classifier and explicit
runtime-owned write/index boundary; no live application constructs either
service or the coordinator yet. See
`docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`, `docs/SEMANTIC_MEMORY.md`,
`docs/HYBRID_MEMORY_READ_PATH.md`, `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`,
`docs/RELATION_GATED_MEMORY_COMMIT.md`,
`docs/POST_OUTPUT_MEMORY_COORDINATOR.md`,
`docs/adr/0008-memory-aware-chat-orchestration.md`,
`docs/adr/0009-reasoning-and-post-output-intake.md`,
`docs/adr/0010-relation-gated-memory-commit.md`, and
`docs/adr/0011-post-output-memory-coordinator.md`.

Runtime IDs and ACP binding records are control-plane handles, not model
knowledge. The current ACP request cannot supply a complete cross-component
binding, so only its session ID uses the new contract today. See
`docs/RUNTIME_IDENTITY.md` and `docs/adr/0006-runtime-identity-v0.md`.

## Provider references

- [NVIDIA NIM LLM API reference](https://docs.api.nvidia.com/nim/reference/llm-apis)
- [Nemotron 3.5 Lightning model page](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b)

## Security

The exposed legacy credential was revoked and rotated by the owner on
2026-09-01. Raw legacy source remains ignored and must not be executed or
committed. The replacement credential belongs only in ignored `.env.local` or a
reviewed secret provider. Automated tests never load it.

## Project workflow

Read `AGENTS.md`, then `docs/CURRENT_TASK.md` and the reading order it names.

## License

a007-owned repository contents are licensed under Apache License 2.0. Reused
third-party code retains its original license and notice requirements.
# A008
