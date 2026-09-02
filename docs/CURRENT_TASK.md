# Current Task

Task ID: A008-0026
Parent Task: A008-0021
Status: In Progress
Owner: A008-worker03
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

- New files only:
  - `src/memory/knowledge/evidence-types.ts`
  - `src/memory/knowledge/evidence.ts`
  - `src/memory/knowledge/ingest.ts`
  - `src/memory/knowledge/accept.ts`
  - `src/memory/knowledge/payload.ts`
  - `test/knowledge-model/evidence.test.ts`
  - `docs/handoffs/A008-0026.md`
- Branch copy of this charter into `docs/CURRENT_TASK.md`
- Payload composer only; retrieval funnel is M6.

### Out of Scope

- SQLite
- Lifecycle decay (M6)
- Binding UPDATE / RECONCILE (M4)
- `src/memory/knowledge/types.ts`, `interpret.ts`, `registry.ts`, `index.ts`,
  `package.json`
- Live provider
- Merging to `main`

### Definition of Done

S4, S5, S9 pass. ACCEPT is the only writer of `Claim.status`. User-assertion
policy does not write keepAlive or strength.

### Minimum Verification Gates

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Named S4, S5, S9 tests
- [x] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D5, D8
- Depends on: A008-0024 merged (done)
- Parallel-safe with A008-0025: this task owns evidence files listed above
- Worker clone: `C:\code\A008-workers\A008-worker03`
- Branch: `grok/A008-0026-first-class-evidence`

## Checklist

- [x] Wait for A008-0024 merge.
- [x] File split locked by operator: evidence-* vs state/reconcile/update.
- [x] Implement INGEST, evidence records, ACCEPT, payload.
- [x] Scenario tests.
- [ ] Verify, commit, push, PR, handoff.

## Decisions and Notes

- Recitation, quotation, and hypothetical never produce world claims.
- Prediction never opens a current-state binding.

## Charter Amendment Log

- none

## Verification

- [x] Isolated knowledge-tree typecheck of the new evidence files and
      `test/knowledge-model/evidence.test.ts`: exit 0.
- [x] `npm run typecheck`: exit 0.
- [x] `node --test dist/test/knowledge-model/evidence.test.js`: 12/12 pass,
      including named S4, S5, S9 tests.
- [x] `npm test`: 173/173 pass. The package.json test list is out of write
      scope, so the evidence file is run directly with `node --test` after
      `tsc`.
- [x] No live provider, `.env.local`, or OpenHands mutation.
- [x] Write scope honored: no edits to `types.ts`, `interpret.ts`,
      `registry.ts`, `clocks.ts`, `ids.ts`, `errors.ts`, `index.ts`,
      `package.json`, state/reconcile/update, hybrid-memory-reader,
      memory-engine, KnowledgeItem, or SQLite.

## Documentation Updates

- [ ] `docs/handoffs/A008-0026.md`

## Handoff and Follow-ups

- Current state: Implementation complete; PR and handoff next.
- Next recommended step: commit, push, open PR, write handoff. Operator merges.
- Blockers: none.
- Open questions: none.

## Finalize When Complete

- Operator merges.
