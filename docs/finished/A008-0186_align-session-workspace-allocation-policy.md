# A008-0186 — Align Session/Workspace Allocation Policy

Task ID: A008-0186
Parent Task: A008-0185
Status: Complete
Owner: Rickard
Created: 2026-09-26
Last updated: 2026-09-26
Charter frozen at: 2026-09-26

## Task Summary

Resolved the approved A008-0185 policy blocker: a conversation may exist without a workspace, while writable execution receives one isolated workspace durably bound to that conversation.

## Task Charter

### Goal

Align the current product contract and accepted worktree architecture so no-workspace conversations and isolated writable worktrees are both explicit.

### Primary Deliverable

A bounded amendment to ADR 0053 and the project direction that distinguishes conversation creation from writable-workspace provisioning.

### In Scope

- Refine ADR 0053's topology and lifecycle semantics.
- Clarify PC-LF-05/PC-LF-06 application to writable execution.
- Record the blocker resolution and parent resume condition.

### Out of Scope

- Platform schema, runtime, GUI, or Git lifecycle implementation.
- Changing semantic-memory ownership.
- Changing A008-0185's frozen scope or definition of done.

### Definition of Done

- The current contract permits workspace-less conversations.
- Writable execution is explicitly isolated and durably bound to one conversation.
- The primary checkout is not an implicit writable fallback.
- A008-0185 can resume without policy conflict.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `0e05ea1`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Session/workspace policy alignment | PC-LF-05, PC-LF-06; ADR 0053 | A008-0185 cannot implement its ownership model without contradicting the product contract. | Amend the existing contract wording and ADR; no runtime changes. | Documentation consistency review. |

### Minimum Verification Gates

- [x] Review the amended contract/ADR against PC-LF-05 and PC-LF-06.
- [x] `git diff --check`.

### Verification Budget

- Live verification purpose / required provider behavior: Not needed.
- Budget owner / parent allocation: N/A.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.

## Checklist

- [x] Pause A008-0185 and register/publish child ID.
- [x] Freeze the child charter after verifying its DoD removes the policy conflict.
- [x] Amend the current policy owners.
- [x] Verify, archive, hand off, and resume A008-0185.

## Decisions and Notes

- No-workspace conversations are read/research/chat contexts.
- A conversation becomes writable only through explicit workspace provisioning.
- The primary checkout is operator/base context and cannot substitute for a failed writable provisioning attempt.

## Charter Amendment Log

- none

## Verification

- [x] Reviewed actual changes against the necessity argument and frozen scope.
- [x] Documentation review: PC-LF-05 permits workspace-less conversations; PC-LF-06 requires an isolated worktree for each writable conversation; ADR 0053 now uses the same distinction.
- [x] `git diff --check` passed.
- [x] No runtime behavior changed; no typecheck or provider verification applies.

## Documentation Updates

- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/adr/0053-Multi-Session-Worktree-Architecture.md`
- [x] `docs/paused/A008-0185_durable-conversation-workspace-ownership.md`
- [x] `docs/finished/A008-0186_align-session-workspace-allocation-policy.md`
- [x] `docs/handoffs/A008-0186.md`

## Handoff and Follow-ups

- Current state: Complete.
- Next recommended step: Resume A008-0185 from its frozen charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: met.
- Open questions: none.
