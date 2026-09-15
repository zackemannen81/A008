# Current Task

Task ID: A008-0117
Parent Task: A008-0114
Status: Complete
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `3532bcd`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0043-acme-execution-boundary.md`
- `docs/finished/A008-0116_batch-relation-classification.md`

## Task Summary

Live retrieval is now routed through ACME, but observed queries show two precision defects: a greeting can retrieve an old utterance solely because it also starts with “hej”, and a specific neon-text question can over-project project-wide context. Tighten the semantic retrieval contract and place a real necessity gate before knowledge retrieval while preserving fail-open lexical behavior when the semantic classifier is unavailable.

## Task Charter

### Goal

Make retrieval skip memory when memory cannot materially help, and keep semantic scope labels narrowly tied to information needed to answer the current message.

### Primary Deliverable

A validated retrieval decision plus bounded scope classification that remains A008-owned and is executed through the selected ChatTransport/ACME route.

### In Scope

- Add an explicit retrieval-necessity decision to the semantic scope contract.
- Skip knowledge retrieval/projection for successful `retrieve=false` classifications.
- Keep lexical fallback when the classifier is absent or fails.
- Tighten prompt semantics and bound direct/related labels.
- Expose whether semantic retrieval was used, skipped, or degraded.
- Regression tests for greeting collision, relevant retrieval, classifier failure and ACME route.

### Out of Scope

- Changing canonical memory schemas or write/extraction semantics.
- Provider/model compatibility beyond what is required to prove retrieval routing.
- ACME protocol changes.
- GO decision or Stage 4 implementation.

### Definition of Done

- `hej` with a tempting stored utterance projects no memory when classifier returns `retrieve=false`.
- Relevant project question still retrieves appropriate stored knowledge.
- Classifier failure retains deterministic lexical fallback.
- Retrieval semantic request traverses ACME when ACME is selected.
- Core/typecheck/diff checks pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd`

The smallest sufficient change is a read-path necessity decision plus narrow labels. No canonical write or ACME execution policy changes are required.

## Verification

- `npm run typecheck` PASS.
- `npm run test:core` PASS: 632/632.
- `git diff --check` PASS.
- Greeting collision fixture: `retrieve=false` projects zero context.
- Longer lexical questions require more than one generic shared word.
- Classifier failure reports `degraded` and preserves lexical fallback.
- Existing ACME parity suite still proves `retrieval_scope` traverses `AcmeChatTransport`.
