# A008-0066 — Editable runtime budgets and global instructions

Task ID: A008-0066
Parent Task: None
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-07
Last updated: 2026-09-07
Charter frozen at: 2026-09-07, after main claim `1b4df81`

## Task Summary

The owner hit `18953/16384 utf8-bytes` despite increasing generated tokens.
Live projection allows 32768 bytes but the whole request allows only 16384.
The owner requests editable budgets and global persistent instructions across
all A008 projects and models, such as the assistant name Agent 008.

## Task Charter

### Goal

Make local runtime limits and enduring user instructions explicit, editable and
persistent through the diagnostic GUI and shared CLI/ACP composition.

### Primary Deliverable

A global settings surface with validated budgets and an instruction editor,
backed by atomic local persistence and verified actual invocation behavior.

### In Scope

- Inventory active chat, retrieval, staging, semantic generation and timeout
  budgets; central defaults, runtime wiring, GUI editability and useful errors.
- Global user-written instructions loaded deterministically for each chat turn;
  survive model changes, resets, new projects and process restarts.
- Additive session-control contract, stale-write handling and settings validation.
- Preserve committed dialogue, additive memory retrieval and extraction boundaries.
- Tests, synthetic host/ACP and desktop/mobile browser proof; owning docs and ADR.

### Out of Scope

- Automatic promotion of chat, retrieved memory or uploaded documents to trusted
  instructions; memory editing, durable transcript storage or model-quality claims.
- Spend accounting, exact provider tokenization, changing endpoint-enforced limits,
  removing transport/file safety limits, external product-client changes.
- Paid/live provider tests, push, deployment or publication.

### Definition of Done

- GUI changes reach the next actual invocation, including an existing session,
  without requiring a source edit or losing conversation/draft.
- The reported byte-budget failure is reproduced and resolved by a saved setting.
- Global instructions reach chat across models/projects/restarts, are absent from
  semantic system prompts and do not become synthetic committed conversation turns.
- Invalid/stale settings preserve the last saved version; actual limits and units
  are visible. Active operations use a stable settings snapshot.
- Archive, handoff, verification and owning docs exist; CURRENT_TASK restored.

### Minimum Verification Gates

- [ ] Root and GUI typechecks/build; complete npm test.
- [ ] Persistence, validation, stale-write, budget and instruction-boundary tests.
- [ ] Real host -> spawned ACP -> loopback provider proof with payload assertions.
- [ ] Desktop/mobile browser save/reopen, budget repair and instruction editor proof.
- [ ] Docs links/fences, staged secret boundary and git diff --check.

## Checklist

- [x] Read authority, inspect live limits and instruction composition, claim on main.
- [ ] Implement settings contract, persistence and runtime snapshot wiring.
- [ ] Implement global GUI settings and actionable budget feedback.
- [ ] Verify, document, archive and hand off.

## Decisions and Notes

- No delegation. Owner concept files remain untouched.
- User explicitly selected global A008 scope for persistent instructions.
- Existing model generation parameters remain session-owned. Global runtime
  preferences are stored outside the repository, independently of project memory.

## Charter Amendment Log

- None.

## Verification

Pending implementation.

## Handoff and Follow-ups

Pending verification. No push or live provider call authorized.
