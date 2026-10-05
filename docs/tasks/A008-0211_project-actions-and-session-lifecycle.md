# A008-0211 — Project actions and session lifecycle

Task ID: A008-0211
Parent Task: None (program)
Status: In Progress
Owner: Rickard (operator); A008 (implementation)
Created: 2026-10-05
Last updated: 2026-10-05
Charter frozen at: 2026-10-05

## Task Summary

Deliver the four requested project actions under an explicit product contract: open the registered project root in Explorer; create/use its durable main chat in the original checkout without a worktree; delete a parallel chat together with its clean worktree; and unlink a project without deleting or modifying project files. A008-0212 is the required authorization/identity prerequisite.

## Task Charter

### Goal

Make the project root and parallel-chat lifecycle explicit, discoverable, and safe without conflating unlinking, chat deletion, and worktree discard.

### Primary Deliverable

Host-owned project actions and GUI controls for opening a project root, using a root-CWD main chat, deleting an eligible parallel chat with its clean Git worktree, and unregistering a project while preserving all files.

### In Scope

- Open the exact registered project root in the system file explorer; do not mutate it.
- Provide one durable project main chat whose CWD is the registered original checkout and which has no Git worktree/workspace allocation. Identify and display it distinctly from parallel chats.
- Keep parallel chats as isolated Git worktrees under the configured session root.
- Delete a parallel chat and its associated clean worktree/metadata after the host verifies that the request targets this project's durable main chat and the user explicitly approves the exact action/target in a host-owned native OS confirmation dialog. The native dialog is the confirmation surface; a renderer-supplied Yes or role is never authority. Refuse active/unresolved runs and dirty/unverifiable worktrees; never silently discard changes. Preserve the project's main chat.
- Unlink a project by removing only its project registration. Never recursively delete, edit, or clean the original checkout, worktrees, or files. Preserve chat/worktree records and physical paths; expose a safe re-registration path or a clear recovery limitation.
- Implement prerequisite A008-0212 before wiring destructive actions; use host-owned authorization, not renderer/caller-supplied role assertions.
- Add focused host/store/protocol/client/GUI tests and update owning docs.

### Out of Scope

- Deleting the original checkout, project files, Git repository, history, or semantic memory.
- Deleting the main/root chat while its project remains registered.
- Deleting dirty or unverifiable worktrees, cancelling runs, merge/push/publication, automatic fallback from root chat to a worktree or vice versa.
- Non-Git project support, arbitrary worktree cleanup, trash/undo, bulk actions, unrelated redesign, installer/setup changes.
- Changing A008-0210, which remains paused and scoped to chat-history removal while retaining its worktree.

### Definition of Done

- Explorer opens exactly the registered root for the selected project.
- Each registered project has one durable root/main chat; it runs in the original checkout without a Git worktree, and every parallel chat remains bound to its own worktree. Missing/invalid paths fail closed.
- A parallel chat can be deleted only together with its clean associated worktree after a fresh exact-target Yes in the host-owned native OS dialog, in response to a host-verified request from the project's durable main chat. Active/unresolved runs, dirty worktrees, stale/replayed/wrong-target approvals, or direct unauthorized calls leave state/files unchanged. Renderer-supplied role/Yes is never authority.
- The root/main chat cannot be deleted while the project is registered.
- Unlink removes the project registration only; the original directory, worktrees, files and retained durable records remain unchanged and re-registration behavior is documented/tested.
- Focused store/host/protocol/client/GUI tests, applicable typechecks/builds, and `git diff --check` pass; unavailable gates are reported honestly.
- `CURRENT_STATUS.md`, `SYSTEMDOC.md`, task indexes, handoff and immutable archive reflect shipped behavior; current-task template is restored before push.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-LF-05/06 (root/main vs parallel worktree modes), PC-LF-07 (local state authoritative), PC-LF-09 (clients observe/control; accepted work persists).
Contract revision: `e407cfa` (claim and reviewed product contract on `origin/main`).

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Open project root | PC-LF-01/09; host owns registered project identity and GUI is a control surface | User cannot navigate directly to the selected project's original files | One host-validated open-root action | Verify exact resolved path and no filesystem mutation |
| Root/main chat | PC-LF-05/06 | User-requested original-CWD chat is unsupported; silently using a worktree changes the requested semantics | Explicit durable root-chat role/mode with no workspace; preserve parallel worktrees | Store/runtime tests prove CWD and absence of worktree; missing root fails closed |
| Delete parallel chat + worktree | PC-LF-05/07/09 | Obsolete parallel chats/worktrees remain; conflating with history-only removal risks orphaned or lost work | One atomic host lifecycle action, only for clean worktree and terminal resolved chat | Tests cover target binding, clean/dirty, active/unresolved, one-use authorization and retained main chat |
| Unlink project | PC-LF-07/09 | Registered project cannot be removed without risking its local data | Remove registration only; no cascade cleanup | Assert project directory, worktrees, files and durable records unchanged |

### Minimum Verification Gates

## Minimum Verification Gates

- [ ] A008-0212 completed; its host-verifiable main-chat request identity and native-confirmation contract reviewed.
- [ ] Protocol/store/runtime tests for root/main identity, no-worktree CWD and worktree-session isolation.
- [ ] Destructive-action host tests for exact target, one-use authorization, direct-call rejection, active/unresolved and dirty-worktree refusal.
- [ ] Unlink tests prove no filesystem or chat/worktree cascade deletion; re-registration behavior verified.
- [ ] Explorer path validation/open action test or named platform review.
- [ ] Relevant root/GUI typechecks, focused and regression suites, `git diff --check`.

### Verification Budget

- Live verification purpose / required provider behavior: not required.
- Budget owner / parent allocation: A008-0211; child A008-0212 shares this aggregate budget.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md`; deterministic local tests only.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.
- max_input_tokens_per_call / max_output_tokens_per_call: not applicable.
- live_call_timeout_seconds: not applicable.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 SEK / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: no live calls.

## References

- `docs/PROJECT_BRIEF.md` — approved PC-LF-05/06/07/09 contract, revision `e407cfa` on `origin/main`.
- `docs/TASK_WORKFLOW.md` — necessity gate, child-task workflow and completion.
- `docs/tasks/A008-0212_project-main-identity-confirmation.md` — prerequisite.
- `docs/paused/A008-0210_remove-delete-project-chats.md` — separate paused task; do not absorb/amend.
- `src/platform/platform-store.ts`, `src/runtime/project-workspace-store.ts`, `src/gui-host/workspace-routes.ts`, `gui/src/projects/` — owners to inspect during implementation.

## Checklist

- [x] Allocate A008-0211 and prerequisite child A008-0212.
- [x] Amend product contract to distinguish root/main chat from isolated parallel worktrees.
- [x] Freeze explicit lifecycle and safety scope, including dirty/active refusal and non-destructive unlink.
- [ ] Complete A008-0212 and verify its host-verifiable authorization trust boundary before destructive actions.
- [ ] Implement four project actions and focused tests.
- [ ] Update system/status docs, handoff, indexes and immutable archive.
- [ ] Run all minimum gates and record exact results.

## Charter Amendment Log

- 2026-10-05 — Rickard approved an exact-target Yes in a host-owned native OS dialog for A008-0211 destructive actions, replacing the Yes control being rendered in the main chat. The host must first verify the request originated from this project's durable main-chat role, then bind, expire and consume the dialog result once. This decision amends only the confirmation surface; all other scope and safety gates remain unchanged. A008-0210's separate frozen gate is not amended.

- [ ] Review actual changes against necessity and frozen scope.
- [ ] Record checks and exact outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/PROJECT_BRIEF.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` (operator-owned on integration)
- [ ] `docs/tasks/README.md` and `docs/backlog/README.md`
- [ ] `docs/handoffs/A008-0211.md`
- [ ] `docs/finished/A008-0211_project-actions-and-session-lifecycle.md`

## Handoff and Follow-ups

- Current state: A008-0211 charter locally amended per Rickard's explicit confirmation-location decision; implementation not started.
- Next recommended step: implement A008-0212 and prove its host-to-native-dialog broker before any destructive project action.
- Blockers: durable main-chat identity and authenticated broker channel are not yet implemented or verified.
- Child tasks: A008-0212.
- Resume condition: A008-0212 DoD and tests pass; native-dialog Yes is bound to the host-verified main-chat request, exact target/action and one-use expiry.
- Open questions: broker availability in standalone and Electron-reused-host configurations.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md` before push; no push without task authority.
