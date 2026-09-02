# ADR 0008 — Memory-aware chat orchestration

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A007 has one transactional provider-neutral `ChatSession`, typed runtime
identities, and a durable hybrid semantic-memory read path. They were
deliberately disconnected: current CLI and ACP requests do not supply a complete
verified project/conversation/task/agent context, and the existing chat session
replays all committed dialogue to its transport.

The first integration must prove invocation closure without inventing identity,
moving provider ownership, leaking retrieval/control data, replaying unbounded
history, or absorbing the separate post-output memory-write loop.

## Decision

- `MemoryAwareChatSession` is the provider-neutral application orchestration
  surface. One instance fixes parsed project, conversation, and agent identity.
  Each turn supplies a parsed runtime-task ID, original message, applicability
  scopes, and optional required knowledge IDs.
- The orchestrator reads at most the latest two committed raw user/assistant
  messages from `ChatSession` and supplies them to `HybridMemoryReader`.
  It performs no hidden summary or classification call.
- The memory reader runs exactly once before chat transport. Its returned plan
  and projection task must match the verified request envelope.
- `DeterministicMemoryPromptComposer` consumes only `ProjectionResult` and
  the original message. It creates one fixed system instruction and one stable
  JSON user envelope.
- The JSON envelope contains proposition, kind, tags, scope, and authority. It
  strips project/conversation/task/agent identity, knowledge IDs, the
  projection's serialized control form, retrieval plan/evidence, scores,
  lifecycle state, provenance, and audit.
- Exclusion applies to control-plane fields owned by the orchestrator. It does
  not redact identical text deliberately present inside a user message,
  persistent system prompt, prior dialogue, or canonical proposition.
- Retrieved context remains user-level reference data. The fixed system
  instruction tells the model to treat it as data rather than executable
  instructions. This is a trust-boundary reduction, not a claim that prompt
  injection is solved.
- `ChatSession.send` accepts an optional invocation plan. It can insert
  ephemeral system messages, provide a provider-visible user envelope, limit
  provider-visible committed dialogue, and enforce a hard measurement budget
  over stable JSON serialization of the exact outgoing message array.
- Direct callers that omit an invocation plan retain existing behavior.
- A memory-aware turn uses the same maximum of two prior dialogue messages for
  retrieval and provider context. Persistent system messages remain first,
  followed by the fixed ephemeral context contract, bounded dialogue, and the
  current JSON user envelope.
- Successful chat state commits only the normalized original user message and
  assistant completion. The memory envelope, fixed context instruction, and
  history truncation are ephemeral invocation data.
- Retrieval, identity, composition, or budget failure occurs before transport
  and commits no chat state. Provider/cancellation/invalid-response failures
  retain the existing rollback behavior. Hybrid reading remains non-mutating.
- One memory-aware session rejects overlapping turns and reset during an active
  turn, preventing two calls from composing against the same stale history.
- Completion and bounded memory result/evidence return as separate application
  data. Only composed messages cross the model boundary.
- CLI, ACP, Agent Server, and Canvas are not wired in this decision because
  they do not yet supply the verified application context.

## Alternatives considered

### Send `ProjectionResult.serialized` directly

Rejected. That representation contains runtime task and knowledge IDs and was
designed as a memory projection/audit boundary, not the final provider prompt.
The model needs materialized meaning, not routing handles.

### Put retrieved knowledge in a system message

Rejected. Canonical knowledge may contain user-derived text. Giving the data
system-message authority would confuse trust levels. Only the fixed handling
contract is system context; the retrieved data stays in the user envelope.

### Replay the complete conversation

Rejected. Persistent history and provider context are different concerns. Full
replay makes context grow with session lifetime and defeats the bounded-memory
architecture.

### Summarize history with another model call

Rejected. It creates a hidden second inference owner, adds failure/cost state,
and is unnecessary to prove deterministic bounded composition.

### Infer runtime identity from ACP working directory or session ID

Rejected. Paths and external/protocol handles do not establish a007 project,
conversation, task, and agent identity. Invented bindings would be false state.

## Consequences

- The repository now has a complete provider-neutral memory-aware turn that can
  be composed by a future CLI or ACP intake once verified identities exist.
- Provider-visible dialogue is bounded independently of locally committed chat
  history.
- The current UTF-8-byte measurer enforces the exact serialized message-array
  boundary. Exact model tokens and output headroom remain later injected policy.
- The fixed envelope is deterministic and testable, but model behavior over
  adversarial remembered text still requires defense-in-depth and evaluation.
- No response analysis or memory lifecycle write occurs. That closed-loop half
  remains an explicit later decision and task.
