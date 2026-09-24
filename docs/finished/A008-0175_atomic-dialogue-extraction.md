# A008-0175 — Restore atomic dialogue extraction

Task ID: A008-0175
Parent Task: None
Status: Complete
Owner: Codex (operator/worker)
Created: 2026-09-24
Last updated: 2026-09-24
Charter frozen at: 2026-09-24T07:41:00Z

## Task Charter

### Goal
Restore useful atomic extraction from completed project reports while preserving
strict four-bucket output, source qualifications and existing state ownership.

### Primary Deliverable
A coherent dialogue extractor prompt with bounded local and actual-model checks.

### In Scope
- Repair contradictory empty-result output and overbroad eligibility guidance.
- Keep useful atomicity guidance: independently mutable facts become separate
  propositions; resolvable properties/relations use existing binding shapes.
- Retain owner's checkpoint label ranges (1–4 domains, 1–16 tags) as useful
  selection bounds, not padding quotas; classify each proposition's own subject.
- Verify new report extraction, state/history, reuse, legitimate empty output,
  qualifications and parser compatibility; update owning documentation.

### Out of Scope
New memory schemas, identity/reconciliation algorithms, persistent scope,
owner database repair/backfill, live disclosure of private project reports,
source-only ingestion redesign, UI, ACME, unrelated baseline failures, push/merge.

### Definition of Done
Synthetic project reports produce nonempty atomic knowledge with independently
addressable stated properties and useful labels. Narration-only input may return
four empty arrays with no prose. Questions do not become accomplished changes;
qualifications survive. Existing baseline state update/reinforcement stays valid.
Local build/focused tests and bounded live verification have recorded provenance.

### Necessity Gate
Contract revision: efbc1f4; PC-02 contextual retrieval, PC-03 additive provider context,
PC-04 durable knowledge with runtime authority; CURRENT_MEMORY_MODEL §§25–30,46–48.
Owner authorizes repairing their prompt and permits rollback to checkpoint.

| Change | Observable need / omission | Smallest sufficient approach | Verification |
| --- | --- | --- | --- |
| Eligibility/output | Real report with empty baseline returned four empty arrays; final instruction also allows incompatible prose | Coherent positive extraction rule, narrow narration exclusion, strict JSON | Actual-model report + empty/conditional probes, existing strict parser tests |
| Atomicity/state shapes | Earlier 13 claims bundled facts; only two bindings | Reinforce existing one-address contract, avoid generic predicates for resolved properties | Live independent attributes and existing SQLite commit/read |
| Per-artifact labels | Owner deliberately expanded ranges | Preserve ranges and classify subject rather than report-wide label | Live labels and local contract checks |

### Minimum Verification Gates
- [x] Root build.
- [x] Focused semantic/intake/labels/SQLite regressions and membership.
- [x] Live synthetic report, atomic bindings, qualifications, empty/reuse/update.
- [x] Full core run; identify unchanged baseline failures.
- [x] Necessity/diff review, owning docs, immutable archive, handoff and template.

### Verification Budget
Separate bounded repair task; defaults at efbc1f4 TASK_WORKFLOW:
10 SEK, 10 physical attempts total, 16384 input / 4096 output tokens per call,
120 second timeout. Existing approved OpenAI gpt-5.6-luna via embedded ACME and
reviewed default secret provider; no tools. No owner report sent externally.
Harness input additionally capped at 16384 UTF-8 bytes.
Same-day previously checked official model price:
https://developers.openai.com/api/docs/models/gpt-5.6-luna
USD 0.20 input / 1.20 output per million; no cache discounts assumed.
Conservative 20 SEK/USD allowance, 0.25 SEK reservation per physical attempt,
maximum 2.50 SEK. Unknown outcomes retain reservations.
Final accounting: 10 physical attempts, 22,934 input / 3,925 output tokens.
Estimated USD 0.0092968 / 0.185936 SEK with stated allowance; all usage known.
Reservations (2.50 SEK total) released. Remaining calls 0, monetary 9.814064 SEK.
No workers or parallel allocations. No further live calls.

## Decisions and Notes
Owner checkpoint efbc1f4 and uncommitted prompt were inspected. Original
uncommitted prompt preserved outside repo at %TEMP%/a008-0175-owner-prompt.ts.
No broad rollback: keep useful owner changes and existing continuity rules.
Latest owner trace f0884488-c3ba-4cf5-81da-c949ee8e5541 returned valid empty
arrays, not a parsing failure. Private input/log remains outside repository.
Claim: local main 6432d2b, carried to branch as d6909db.

## Verification
See docs/handoffs/A008-0175.md: root build and 132/132 focused/membership pass;
full core 770/771 with unchanged baseline failure. Live probes cover atomic
report, labels, SQLite update/history/reopen, reuse, valid empty output and
qualifications. Probe failures/iterations and limits are preserved in handoff.

## Documentation Updates
CURRENT_MEMORY_MODEL, SYSTEMDOC, CURRENT_STATUS, tasks index, archive, handoff.
Journal belongs to integration operator; FILESTRUCTURE only if a new code path.

## Handoff
Complete locally; no push/merge. Current branch retains A008-0173/0174 and
owner checkpoint. See docs/handoffs/A008-0175.md. No user data migration.
