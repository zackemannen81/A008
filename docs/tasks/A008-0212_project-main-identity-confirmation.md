# A008-0212 — Durable project-main identity and host-verified confirmation

Task ID: A008-0212
Parent Task: A008-0211
Status: In Progress
Owner: Rickard (operator); A008 (implementation)
Created: 2026-10-05
Last updated: 2026-10-05
Charter frozen at: 2026-10-05

## Task Summary

A008-0211 requires destructive project/chat actions to be initiated from the project's durable main chat and then explicitly confirmed in a host-owned native OS dialog. Current durable sessions and authenticated callers do not provide a host-verifiable main-vs-parallel chat role or host-to-dialog broker channel. This prerequisite defines and implements the minimum durable identity and one-use authorization boundary without trusting renderer claims.

## Task Charter

### Goal

Give the host an authoritative, durable way to distinguish a project's root/main chat from parallel worktree chats, and route a fresh exact-target destructive request from that main chat to an explicit user Yes in the host-owned native OS dialog.

### Primary Deliverable

A versioned host/protocol/store contract for project root-chat identity plus an authenticated, expiring, single-use, target-bound native-dialog confirmation capability that cannot be minted by model output, renderer assertions, arbitrary HTTP clients or parallel chats.

### In Scope

- Define one root/main durable conversation role per project, distinct from parallel worktree sessions; enforce uniqueness and project binding in persistent state.
- Define role authority as host-owned state, not caller-supplied `isMain`, selected-chat labels, workspace path inference, or order of creation.
- Define a challenge/approve/cancel flow where the host verifies that a destructive request originates from the project's durable main-chat role, then binds a native-dialog request to that authenticated origin, client/session, exact action and exact target. Require an explicit OS-dialog Yes event and consume capability at most once before the protected operation.
- Use finite expiry, request/target binding, replay rejection, wrong-role rejection and fail-closed behavior. Do not accept model-produced text or parallel-client affirmative responses as consent; only the native OS dialog response can confirm.
- Evaluate an Electron main-process native OS dialog as a confirmation surface and establish a host-to-broker channel unavailable to renderer/direct HTTP callers; the dialog must not be considered sufficient without authenticated host request/target binding.
- Define stable shared schema and error behavior for unauthorized, expired, reused and mismatched confirmations.
- Add deterministic migration/store/host/protocol/client tests for uniqueness, binding, expiry, cancellation, replay and direct-call rejection; update owning docs and handoff.

### Out of Scope

- Implementing project Explorer launch, root-chat UI/CWD execution, parallel chat deletion, worktree removal, or project unlink; these are A008-0211 behavior.
- General-purpose permission/confirmation framework for unrelated actions.
- Treating authentication of an A008 user alone as proof that a confirmation came from the main-chat context.
- Trusting renderer-supplied role/target assertions or adding security guarantees without an authenticated host boundary.

### Definition of Done

- Each registered project can have exactly one durable root/main identity and any number of parallel worktree identities; invalid duplicates/mappings fail closed and migration is tested.
- The host verifies a destructive request from the project's durable main-chat identity and routes it through the trusted native dialog broker. It binds the explicit OS-dialog Yes to one fresh exact action/target, expires it, consumes it once, and rejects a request from another role/client, stale, cancelled, replayed, mismatched or direct operation.
- No model output or caller-provided role field can mint or satisfy confirmation.
- Protocol schemas/types and error outcomes are explicit and tested across host/client surfaces used by A008-0211.
- Tests include hostile direct requests and concurrent/replayed consumption; typecheck/build and `git diff --check` pass, with unavailable checks recorded.
- `SYSTEMDOC.md`, `CURRENT_STATUS.md`, task index and handoff describe precisely what the host can verify and any limitations; no stronger claim than evidence supports.

### Trust-boundary decision and blocker

Inspection on `origin/main` at `e407cfa` confirms the current host can authenticate a V2 device principal with project/capability grants and durable API calls, but does not bind a request to a trusted GUI conversation context. Durable conversations are project/workspace-bound with no host-owned root/main-vs-parallel role. A renderer-supplied role or confirmation token would be forgeable by the same authorized API client and does not satisfy this charter.

Rickard approved using a host-owned native OS dialog as A008-0211's explicit user-confirmation surface, replacing the Yes control being rendered in the main chat; the host must still prove the destructive request came from the project's durable main chat before showing it. This decision amends the parent confirmation location only; it does not amend the independent A008-0210 gate. The native OS dialog is an approved direction, not an existing or proven trust boundary. Electron currently has a `dialog` API in its main process, but its packaged renderer has no preload/IPC bridge; the GUI host runs as a separate process and can reuse an already-running host. No authenticated out-of-band channel from that host to Electron main is present. Sending an approval result or bearer capability through renderer/ordinary HTTP would remain forgeable or replayable by an authorized direct client.

The smallest credible implementation must establish durable project-bound root/main role and an out-of-band host-to-native-dialog request/result channel. The host must mint and consume a short-lived, exact-action/target, single-use challenge; only the native broker may return the user's explicit Yes, and direct host/renderer callers must not be able to forge that result. Any host without the trusted broker must fail closed. Verify the channel against standalone and reused-host modes before implementing destructive routes. A008-0211 remains blocked on this prerequisite. Do not claim security until tested.

## Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-LF-05 (durable main/parallel identities), PC-LF-07 (host/local state authority), PC-LF-09 (clients control sessions; UI/client identity does not itself authorize effects).
Contract revision: `e407cfa` (claim and reviewed product contract on `origin/main`).

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Durable root/main role | PC-LF-05/07 | Host cannot tell the main chat from parallel chats; requested main-only actions cannot be enforced | Persist explicit project-bound role with uniqueness and no inference | Migration/constraint tests and forged-role host request |
| One-use confirmation | PC-LF-07/09 | Stale/replayed/parallel/direct request could perform a destructive action | Host-verified main-chat request plus host-owned native dialog broker issuing/consuming short-lived one-use exact action/target capability | Broker spoof/cancel/expiry/replay/wrong target/wrong role/concurrency tests |

### Minimum Verification Gates

- [ ] Reviewed threat model and confirmation-context origin; demonstrate no renderer-only trust assumption.
- [ ] Store/schema migration and role uniqueness/binding tests.
- [ ] Host/protocol/client tests for explicit Yes, exact target, expiry, cancellation, replay, direct access and concurrent one-use consumption.
- [ ] Root/GUI typechecks as applicable, focused regressions and `git diff --check`.
- [ ] Handoff records limitations and confirms no A008-0211 deletion feature was implemented here.

### Verification Budget

- Live verification purpose / required provider behavior: not required.
- Budget owner / parent allocation: A008-0211; child A008-0212 uses parent aggregate budget.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md`; local deterministic verification only.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.
- max_input_tokens_per_call / max_output_tokens_per_call: not applicable.
- live_call_timeout_seconds: not applicable.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 SEK / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: local work only.

## References

- `docs/PROJECT_BRIEF.md` — approved PC-LF-05/07/09 contract, revision `e407cfa` on `origin/main`.
- `docs/tasks/A008-0211_project-actions-and-session-lifecycle.md` — parent program.
- `docs/paused/A008-0210_remove-delete-project-chats.md` — observed blocker; do not change its frozen scope.
- `docs/TASK_WORKFLOW.md` — necessity gate and task workflow.
- `src/platform/platform-store.ts`, `src/gui-host/server.ts`, protocol/client auth contracts — inspect before implementation.

### Checklist

- [x] Claim child identity A008-0212 under parent A008-0211.
- [x] Define host-owned identity and exact one-use confirmation requirements.
- [x] Inspect Electron native-dialog capabilities and existing host/auth/storage boundaries; establish the remaining gap.
- [ ] Implement durable role and a broker channel unavailable to renderer/direct API callers; fail closed without trusted broker.
- [ ] Add migration, hostile host, concurrency/replay and protocol tests.
- [ ] Update owning docs, index and handoff.
- [ ] Run all gates and report limitations.

## Decisions and Notes

- A008 authenticated-client identity alone is not proof of main-chat context.
- Operator approved a native OS confirmation surface as the direction to investigate. Approval does not certify the existing Electron dialog as a secure broker; renderer/HTTP must not carry authoritative approval claims.
- Electron main and GUI host are separate processes; the host may be reused independently of Electron. Implement and verify an out-of-band host-to-native-broker channel, durable host-owned project/main role, exact-target one-use challenge consumption and fail-closed behavior before declaring the boundary secure.
- Do not add a renderer-generated bearer token and call it secure. If no broker channel can be established for all supported host modes, pause and report the exact remaining blocker.
- Child completion is a prerequisite, not authorization to implement unrelated A008-0211 features early.

## Charter Amendment Log

- 2026-10-05 — Rickard approved the host-owned native OS confirmation surface for destructive actions in A008-0211: a verified main-chat request is confirmed with an exact-target OS-dialog Yes. This changes the parent charter's confirmation UI location but does not weaken its request-origin, binding, expiry, one-use or fail-closed requirements. A008-0210's separate frozen main-chat UI gate is unchanged.

## Verification

- [ ] Review actual implementation against threat model and frozen necessity arguments.
- [ ] Record exact test/typecheck/build results.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md` — blocker recorded.
- [x] `docs/SYSTEMDOC.md` — implementation boundary recorded.
- [x] `docs/tasks/README.md` — child status/handoff indexed.
- [x] `docs/handoffs/A008-0212.md` — investigation findings and next gate.
- [ ] `docs/finished/A008-0212_project-main-identity-confirmation.md`

## Handoff and Follow-ups

- Current state: A008-0212 is in progress; trust-boundary investigation and documentation handoff completed, but prerequisite not implemented or verified and A008-0211 must remain blocked.
- Next recommended step: design and test the host-owned native OS confirmation broker, add durable root/main role, and prove authenticated out-of-band request/result binding (or stop if that channel cannot be made available to reused/standalone hosts).
- Blockers: host-to-native-broker context and channel is not currently available; ordinary HTTP/renderer approval cannot be trusted.
- Child tasks: none.
- Resume condition: a tested out-of-band broker proves project/main-role, exact target/action binding, fresh explicit Yes, expiry, one-use consumption and rejection of renderer/direct HTTP forgery.
- Open questions: can the current Electron/standalone/reused-host deployment establish an authenticated broker endpoint without exposing approval authority to same-origin GUI clients?

## Finalize When Complete

- Archive this task under `docs/finished/` and restore empty current-task template before push.
