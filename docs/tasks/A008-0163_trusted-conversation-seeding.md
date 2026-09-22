# A008-0163 — Trusted platform conversation seeding

Task ID: A008-0163
Parent Task: A008-0160
Status: Ready
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after main allocation 41516d3
Branch: codex/a008-0163-conversation-seeding
Clone: C:/code/A008-workers/A008-0163-conversation-seeding

## Goal / Primary deliverable

A trusted internal option seeds a new existing EngineHost/ACP/local-runtime
session from backend-owned committed conversation identity and history. This
lets P1 resume conversations through the existing cognition/provider pipeline
without a duplicate engine or writing the legacy workspace conversation store.

## Scope

src/runtime/local-memory-runtime.ts; src/acp/A008-acp-agent.ts;
src/acp/server.ts; src/engine/engine-host.ts; existing
test/local-memory-runtime.test.ts, test/acp-agent.test.ts, test/engine-host.test.ts.
Task-local record/current-task/archive/handoff; docs/platform/CONVERSATION_SEED.md.
No root package.json or other workers' files. Global docs/indexes are operator
scope; provide exact proposed deltas in the handoff.

## Frozen contract

Internal option conversationSeed: { conversationId: string, messages:
readonly ChatMessage[] }, passed only by trusted backend composition as
EngineHost.newSession's options through ACP creation options to LocalMemoryRuntime.
Use parseRuntimeId for the conversation ID; keep existing A008 semantic identity.
Validate/copy messages with existing chat-content contract. Only committed
user/assistant messages; no system/tool/thought injection. Reject incompatible
workspaceConversation + conversationSeed before state changes. Seed is not an
ACP/WebSocket request field, and cannot be set through untrusted client payload.

Model is selected through existing initialModel/options.model; seeding does not
change selection behavior for other sessions. Seeded sessions never restore,
select, overwrite or persist legacy workspace conversations. Existing controls
and V1/V2 default semantics remain unchanged. Later platform coordinator owns
durable acceptance/results. No history replay through extraction/reinforcement:
seed supplies context; only a genuinely new turn uses existing post-output rules.

## Out of scope

Platform storage/protocol/HTTP/coordinator, memory semantic changes, new model
routing, history migration, tools approval changes, dependency changes, live calls.

## Dependencies and necessity

ADR 0048 / PC-07 durable conversations through PC-01 shared engine and PC-04
existing semantic owner. Baseline reviewed contract 86466ed (main claim 41516d3).
Existing openSession only restores the workspace store; omission would force
P1 to duplicate the chat engine or replay old history as new turns.
Smallest change is a validated internal seed threaded through existing owners.

## Exit and minimum gates

- Trusted seed identity/history reaches existing runtime and next model input.
- Same text generated once per new turn; seed does not trigger provider/semantic
  calls, memory writes or reinforcement. Copy isolation against caller mutation.
- Wrong-kind/invalid IDs, system/tool roles and invalid content rejected safely.
- workspace + seed rejected without legacy writes; normal workspace/generic
  sessions retain behavior. Two seeded conversations remain isolated.
- Root build/typecheck; focused local-runtime, ACP-agent and engine-host suites;
  diff hygiene. Label fixture/local implementation verification.
- Archive completed charter, restore CURRENT_TASK template exactly, commit,
  push, open/attach PR. Worker never merges.
- Handoff: exact head/base/PR, tests/counts, limitations, internal API and proposed
  global documentation deltas. Send no full transcript.

## Verification budget

0 SEK, 0 live-product-provider calls. In-process deterministic transport verifies
the internal ownership/dataflow; no external provider behavior claim.

## Progress / verification

Ready; update progress and results without redefining goal/scope/gates.
