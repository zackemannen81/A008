# A008-0126 — post-0120 operator journal and handoff hygiene

Task ID: A008-0126
Parent Task: None
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `aefda53`

## Task Summary

Repair missing ChatGPT-owned operator records after A008-0120 before the embedded-ACME migration begins.

## Task Charter

### Goal

Make the repository resumeable from docs alone by restoring missing journal/handoff state for ChatGPT-owned work from A008-0120 onward and clearing the stale A008-0124 current-task marker.

### Primary Deliverable

A bounded documentation-only repair covering the missing A008-0122 journal entry and A008-0124 journal/handoff/task-state records.

### In Scope

- Add the missing signed A008-0122 operator journal entry from its existing immutable handoff.
- Add an A008-0124 handoff describing delivered implementation, verification and the required live proof that did not complete.
- Add a signed A008-0124 journal entry.
- Mark A008-0124 Superseded rather than Complete because its frozen live sidecar smoke gate did not pass and the owner has chosen embedded ACME before Step 4.
- Clear the stale A008-0124 `CURRENT_TASK` state by restoring the canonical template on completion.
- Archive and hand off this documentation-only A008-0126 task.

### Out of Scope

- Product/runtime/schema changes.
- Rewriting A008-0120, A008-0123 or A008-0125 owner records.
- Re-running A008-0124 product tests or attempting another sidecar live smoke.
- Implementing the embedded-ACME migration or changing Step 4.

### Definition of Done

- A008-0122 has a truthful signed journal entry matching its existing handoff.
- A008-0124 has a truthful handoff and journal entry that distinguish integrated implementation from the uncompleted live sidecar proof.
- A008-0124 no longer appears active/Ready as if its original completion gate were still the chosen path.
- `docs/CURRENT_TASK.md` is byte-identical to the canonical template before final push.
- `git diff --check` passes.

### Necessity Gate

Documentation repair is required by `docs/TASK_WORKFLOW.md` completion/resume rules so the next architecture migration can begin without relying on private chat history or stale task state.

### Minimum Verification Gates

- [ ] Review 0121/0122 existing handoffs and 0124 implementation ancestry.
- [ ] Confirm 0120/0123/0125 are not modified.
- [ ] Confirm `CURRENT_TASK` equals the canonical template at completion.
- [ ] `git diff --check` passes.

## Checklist

- [ ] Repair A008-0122 journal.
- [ ] Write A008-0124 handoff and journal.
- [ ] Mark A008-0124 Superseded with a narrow status note.
- [ ] Archive A008-0126 and write its handoff.
- [ ] Restore `CURRENT_TASK` template and run docs hygiene checks.

## Verification

Documentation-only task; product test reruns are intentionally unnecessary because no product source, schema or generated artifact changes.

## Handoff and Follow-ups

The next separate task may charter the embedded `@acme-engine/model-runtime` migration before A008-0103 Step 4.

## Finalize When Complete

Archive this task, write `docs/handoffs/A008-0126.md`, restore the canonical current-task template and push the branch for review/merge.
