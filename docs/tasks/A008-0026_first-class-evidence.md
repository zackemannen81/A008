# Current Task

Task ID: A008-0026
Parent Task: A008-0021
Status: Ready
Owner: unassigned (wave 2)
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §6, §9.3, §10.1 INGEST/ACCEPT, S4, S5, S9
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` V9, V13, M5

## Task Summary

Utterance, Claim, Provenance, and ACCEPT as a named process with identified
policy. Typed sectioned projection payload. Blocked until A008-0024 is merged.
May proceed in parallel with A008-0025 if write scopes stay
non-overlapping: this task owns evidence records, INGEST, ACCEPT, and
payload; A008-0025 owns bindings, RECONCILE, UPDATE.

## Task Charter

### Goal

Close V9 and V13: a source is not knowledge; the payload can distinguish
accepted state from attributed claims.

### Primary Deliverable

First-class evidence records, `user-assertion-v1` as one ACCEPT policy, and
the §9.3 payload. S4, S5, S9 pass.

### In Scope

- Evidence types and INGEST / ACCEPT in `src/memory/knowledge/`
- Typed payload composer (sections only; retrieval funnel is M6)
- Tests for S4, S5, S9 (prayer produces recitation, no claim)
- Handoff `docs/handoffs/A008-0026.md`

### Out of Scope

- SQLite
- Lifecycle decay (M6)
- Binding UPDATE (M4)
- Live provider
- Merging to `main`

### Definition of Done

S4, S5, S9 pass. ACCEPT is the only writer of `Claim.status`. User-assertion
policy does not write keepAlive or strength.

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Named S4, S5, S9 tests
- [ ] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D5, D8
- Depends on: A008-0024 merged
- Parallel-safe with A008-0025 if file ownership is split as above
- Branch: `grok/A008-0026-first-class-evidence`

## Checklist

- [ ] Wait for A008-0024 merge.
- [ ] Confirm file split with A008-0025 before writing.
- [ ] Implement INGEST, evidence records, ACCEPT, payload.
- [ ] Scenario tests.
- [ ] Verify, commit, push, PR, handoff.

## Decisions and Notes

- Recitation, quotation, and hypothetical never produce world claims.
- Prediction never opens a current-state binding.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.

## Documentation Updates

- [ ] `docs/handoffs/A008-0026.md`

## Handoff and Follow-ups

- Current state: Ready, blocked on A008-0024.
- Next recommended step: operator assigns a clone after M3 merge.
- Blockers: A008-0024.
- Open questions: none.

## Finalize When Complete

- Operator merges.
