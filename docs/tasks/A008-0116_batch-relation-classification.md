# A008-0116 — Batch relation classification

Task ID: A008-0116
Parent Task: A008-0115
Status: In Progress
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
- `docs/finished/A008-0115_luna-semantic-control-compatibility.md`

## Task Summary

Post-output memory currently performs one `knowledge_analysis` model call and then one `relation_classification` model call per extracted proposal. A large extraction therefore scales as `1 + N` semantic calls. This task preserves A008-owned candidate selection, relation validation, reconciliation and persistence while batching relation classification into one semantic call.

## Task Charter

### Goal

Make a normal post-output write cycle use exactly two semantic model calls regardless of proposal count: one extraction call and one bounded batch relation-classification call.

### Primary Deliverable

A validated batch relation-classification path that prepares all proposal candidate sets locally, performs one classifier request, and applies the returned decisions through the existing guarded sequential commit path.

### In Scope

- Batch relation-classifier input/output with stable temporary proposal and candidate handles.
- Local candidate materialization for every staged proposal before the batch classifier call.
- Allow later proposals to reference only earlier proposals in the same batch via temporary proposal handles.
- Sequential reconciliation/commit using validated batch decisions and existing revision guards.
- ACME-path verification proving `knowledge_analysis` and one batch `relation_classification` both traverse the selected ACME transport.
- Preserve recovery/checkpoint semantics; retries may reclassify after a transient failure.

### Out of Scope

- Retrieval prompt/ranking/necessity tuning.
- Changes to extraction semantics, memory lifecycle policy, strength/decay/reinforcement, canonical schemas or ACME execution semantics.
- Moving candidate lookup, relation validation, reconcile or persistence into ACME/provider code.

### Definition of Done

- A successful turn with N > 1 staged proposals emits one `knowledge_analysis` semantic call and one `relation_classification` semantic call.
- Every batch decision is validated against handles offered for that proposal; future proposal handles are invalid.
- Existing stored candidates and earlier same-batch proposals can be relation targets without exposing canonical IDs to the model.
- Guarded sequential commits preserve canonical-state authority in A008.
- Targeted tests, TypeScript checks and `git diff --check` pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Batch relation classification | PC-04 + ADR 0043 | Durable knowledge still reconciles through the accepted model while avoiding `1 + N` provider scaling. Without it, a 50-proposal extraction can trigger 51 semantic calls. | Keep extraction and all canonical operations unchanged; batch only the relation-model decision step after local candidate materialization. | Multi-proposal fixture asserts one extraction + one relation call and equivalent guarded commits. |
| Preserve ACME execution boundary | PC-01, PC-04 + ADR 0043 | Semantic calls must use the selected execution transport while A008 remains cognitive owner. | Verify both semantic requests flow through `AcmeChatTransport`; keep lookup/reconcile/persistence local. | ACME parity fixture inspects operation order and request count. |

### Minimum Verification Gates

- [ ] Multi-proposal post-output cycle uses exactly two semantic model calls.
- [ ] Batch handle validation rejects unknown/future/cross-proposal handles.
- [ ] Existing-candidate relation decisions still reconcile correctly.
- [ ] Earlier same-batch proposal handles resolve after earlier commits.
- [ ] ACME route observes `knowledge_analysis`, then one `relation_classification`.
- [ ] Existing relation-gated commit tests remain green.
- [ ] `npm run typecheck` passes.
- [ ] `git diff --check` passes.

## Decisions and Notes

- Classification batching changes call granularity only; model decisions remain untrusted until A008 validates handles and applies reconciliation guards.
- Candidate lookup remains local and may run N times; only provider/model calls become constant.
- Intra-batch targets are restricted to earlier proposals so commit order remains deterministic and no topological scheduler is introduced.

## Verification

Pending implementation.
