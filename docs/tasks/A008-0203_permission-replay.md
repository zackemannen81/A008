# A008-0203 — Suppress completed GUI permission replay

Task ID: A008-0203
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-30
Charter frozen at: 2026-09-30 after main allocation

## Task Charter
### Goal
Prevent old GUI activity from resending a permission decision already accepted
by the host and flashing "This permission is no longer pending".
### Primary Deliverable
Run/permission-scoped confirmation memory in DurableChatClient, filtering stale
permission presentation and resubmission while retaining in-flight coalescing.
### In Scope
Remember successful allow/reject decisions for the client lifetime. Apply the
same filtering to live observer and refresh. Preserve memory across chat switches.
Test delayed stale observations, new permission/run identities and failed requests.
### Out of Scope
Host permission semantics, automatic approval policy, cross-client exactly-once
guarantees, ACME/MCP policy changes, publication and unrelated test fixes.
### Definition of Done
- Successful decisions are never resent for the same run/permission in this client.
- Stale observations do not redisplay resolved permission prompts.
- New permissions and different run IDs are unaffected; unsuccessful requests
  remain visible/retryable and are not treated as approved.
- Concurrent coalescing, chat switching and streaming remain intact.
- Verification, docs/handoff/archive and template restoration complete.
### Necessity Gate
Contract: docs/PROJECT_BRIEF.md at 921fa53; PC-LF-04/09 and ADR 0059.

| Change | Authority | Need / omission | Minimal approach | Verification |
| --- | --- | --- | --- | --- |
| Completed-decision suppression | PC-LF-04/09, ADR 0059 | Old observations resend accepted decisions and flash conflicts | Client-owned run/permission keys only after HTTP success; common filter | Stale replay, reject, failure, new ID/run, chat-switch regressions |

### Minimum Verification Gates
- [x] GUI regressions/full suite and root/GUI typecheck/build as needed.
- [x] Final necessity review, docs, archive and template equality.
### Verification Budget
Local deterministic fixtures only; 0 live calls / 0 SEK. TASK_WORKFLOW at 921fa53.

## Checklist
- [x] Read authority, allocate, review and freeze.
- [x] Implement and verify.
- [x] Document and finalize.
## Decisions and Notes
Keep host 409 checks. This does not claim success for failed/ambiguous HTTP
requests or for another client's decisions; no blanket suppression of errors.
## Verification
Focused observation suite 8/8 PASS; full GUI suite 225/225 PASS.
Root build/typecheck and GUI production build/typecheck PASS. No live calls,
0 SEK. Commands and limits in handoff; no browser visual check.
Final necessity review: only client confirmation memory and stale prompt/POST
filtering added, within PC-LF-04/09 and frozen scope. No host policy change.
## Documentation Updates
SYSTEMDOC, CURRENT_STATUS, JOURNAL, task/archive/handoff indexes.
## Handoff and Follow-ups
[Handoff](../handoffs/A008-0203.md), [archive](../finished/A008-0203_permission-replay.md).
Complete locally. No new blocker or follow-up; cross-client/reload behavior is
explicitly outside the guarantee. No push/merge.
