# A008-0210 — Remove / delete project chats

Task ID: A008-0210
Parent Task: None
Status: Stopped, superseded by A008-0214
Owner: Rickard (operator); A008 (implementation)
Created: 2026-10-04
Last updated: 2026-10-05
Charter frozen at: 2026-10-05 (operator delegated after ID claim on main)

## Task Summary

Users can remove old durable chats from a project's sidebar without confusing that action with Discard, and no chat/history deletion can occur until the user explicitly clicks Yes in the main chat confirmation gate.

## Task Charter

### Goal

Provide a narrow, safe, explicit deletion lifecycle for durable project conversations, while preserving the hard boundary that only an affirmative user click in the main chat authorizes permanent deletion.

### Primary Deliverable

A sidebar Remove chat action and host-owned deletion path for durable project conversations, gated by a fresh, target-bound confirmation rendered in the main chat. Only the main chat's explicit Yes action can complete deletion.

### In Scope

- Add a Remove chat action for conversations in the durable project sidebar.
- Present the target project/chat identity and destructive consequence in the main chat confirmation UI; require an explicit Yes click there. No confirmation originating only in the target/parallel chat, model output, HTTP caller, stale prompt, cancel, dismiss, timeout, or chat-selection change authorizes deletion.
- Bind authorization to the exact target and one pending request; consume it once, fail closed, and reject direct host deletion without valid authorization.
- Delete the conversation and its persisted chat history/state atomically from the owning PlatformStore, scoped to the authenticated project. Refuse deletion while a run is active or its outcome is unresolved; do not cancel or replay work.
- Retain the associated Git workspace, files, branch and worktree metadata. Removing chat history is not Discard; do not remove or clean a workspace as a side effect.
- Refresh the project sidebar and move the GUI away from the removed chat if it was selected; preserve other conversations and project data.
- Add focused protocol/client/host/store/GUI tests and update owning documentation/handoff.

### Out of Scope

- Removing, discarding, cleaning, merging or changing ownership of Git workspaces.
- Deleting whole projects, semantic memory, global/legacy non-durable sessions, or arbitrary chat data outside the durable PlatformStore.
- Cancelling active runs, automatic approval, confirmation by model text, or confirmation from another/parallel chat/client.
- Undo, trash/archive, bulk deletion, new generic confirmation framework, or unrelated sidebar redesign.

### Definition of Done

- A user can initiate removal for a durable project chat from its sidebar entry.
- A confirmation naming the exact target is presented in the main chat; only clicking Yes there authorizes the single deletion. Cancel/dismiss/timeout/selection change, parallel/target-chat confirmation, stale confirmation, repeated Yes, or direct unauthorized HTTP requests leave data unchanged.
- The authenticated host verifies project/target association and authorization, atomically removes persisted conversation history and dependent durable records, and refuses active or unresolved runs without partial deletion.
- Successful removal makes the conversation disappear from that project's sidebar and durable conversation reads; other project data and the target's Git workspace/files remain unchanged.
- Existing Discard continues to mean clean-worktree removal only and does not remove conversation history.
- Focused tests, relevant regression tests, typechecks/builds available in this environment, and `git diff --check` pass; any unavailable gates are recorded accurately.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, task index, handoff and immutable finished task record describe the implemented behavior. Do not push or commit without separate authority.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-LF-05, PC-LF-07 and PC-LF-09
Contract revision: `277d089` (operator's A008-0210 claim on `origin/main`)

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Explicit durable chat removal | PC-LF-05/07: local storage owns durable session/history; lifecycle actions are explicit and GUI/clients control sessions under PC-LF-09 | Users cannot remove obsolete persisted project chats from the project list; the requested explicit history lifecycle remains unsupported | Add one target-scoped host store operation and one sidebar action; leave workspace, project, memory and legacy storage untouched | Store/host tests prove only selected project's target history disappears while workspace and neighboring data remain |
| Main-chat confirmation gate | PC-LF-09: clients observe/control sessions; existing execution authority remains host-owned and no disconnect/model text itself grants user consent | A target/parallel session or stale/untrusted request could authorize irreversible removal without the user's explicit main-chat approval | One expiring, single-use, exact-target confirmation bound to the main chat UI and host-side pending request; fail closed elsewhere | Tests cover explicit main-chat Yes, cancellation, timeout, selection change, wrong session/target, reuse and unauthorized host calls |
| Safe refusal and atomic cleanup | PC-LF-05/07: local durable state is authoritative; PC-LF-09: accepted work is not implicitly cancelled by navigation | Concurrent deletion could erase an active/unresolved turn or leave partial durable records | In one store transaction, require no active/unresolved run and remove only dependent records; do not stop runs or delete workspace | Transactional tests cover active/unresolved refusal, rollback and successful dependent-row cleanup |

### Minimum Verification Gates

- [ ] Store tests: exact scoped deletion, dependent durable data cleanup, transactional rollback, active/unresolved refusal, workspace retention.
- [ ] Protocol/client/host tests: target binding, explicit one-use main-chat approval, rejection of direct/untrusted/stale/wrong-target requests.
- [ ] GUI tests: Remove entry, confirmation appears in main chat, Yes performs one removal; cancel/dismiss/selection change and parallel approval do not.
- [ ] Relevant root and GUI typechecks/builds and regression tests.
- [ ] `git diff --check` and final necessity/scope review.

### Verification Budget

- Live verification purpose / required provider behavior: not required.
- Budget owner / parent allocation: A008-0210.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md`, local deterministic verification only.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.
- max_input_tokens_per_call / max_output_tokens_per_call: not applicable.
- live_call_timeout_seconds: not applicable.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 SEK / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: single local task.

## References

- `docs/PROJECT_BRIEF.md` — PC-LF-05/07/09 and explicit session lifecycle.
- `docs/backlog/remove-project-chat-with-main-chat-confirmation.md` — user-requested behavior.
- `src/platform/platform-store.ts` — durable conversation owner.
- `src/platform/coordinator.ts` — durable run ownership and nonterminal state.
- `src/gui-host/platform-v3-http.ts` and `src/gui-host/server.ts` — authenticated host routes.
- `gui/src/projects/project-sidebar.tsx` and `gui/src/app.tsx` — sidebar and main chat UI.

## Checklist

- [x] Confirm operator claim on `origin/main`; establish task branch and record frozen scope.
- [ ] Inspect durable store dependencies, workspace ownership and main-chat/client session identity.
- [ ] Implement host-owned target-bound confirmation and fail-closed deletion path.
- [ ] Add focused store, host/protocol/client and GUI tests.
- [ ] Update status/system documentation, task index, handoff and finished archive.
- [ ] Run gates; record exact outcomes and skipped checks.

## Decisions and Notes

- `Discard` remains a clean-worktree operation. Chat removal leaves workspace files, branch, worktree and workspace metadata untouched.
- Active or unresolved runs block deletion; the UI/host must not cancel accepted work to make deletion succeed.
- A confirmation is valid only for the exact pending request and target, in the main chat context, and is consumed once. If the existing architecture cannot distinguish the main chat from parallel sessions securely, stop and record that blocker rather than weakening the gate.
- Local implementation only; no commit or push is authorized by this charter.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` (operator-owned append on integration)
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/tasks/README.md`
- [ ] `docs/handoffs/A008-0210.md`
- [ ] `docs/finished/A008-0210_remove-delete-project-chats.md`

## Handoff and Follow-ups

- Current state: task charter created on isolated task branch; implementation not yet verified.
- Next recommended step: inspect session identity/authority and implement the scoped host-store/UI flow.
- Blockers: none established; main-chat identity and protocol design must be verified before writing.
- Child tasks: none.
- Resume condition: continue on this task branch with charter and tests.
- Open questions: none; if the existing architecture cannot distinguish the main chat from a parallel chat, pause rather than infer.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md` before push; do not push without explicit authorization.
