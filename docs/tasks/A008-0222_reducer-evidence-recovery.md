# A008-0222 — Recover bounded working context from saved tool evidence

Status: In Progress
Date: 2026-11-21
Authority: PC-LF-03, PC-LF-04, PC-LF-05, PC-LF-08 in docs/PROJECT_BRIEF.md; base d10c438
Owner: Rickard; Implementation: ChatGPT
Branch: fix/a008-0222-durable-reducer-fallback

## Observable failure
The user's Zac McKracken project repeatedly pauses reduction with REDUCTION_PAUSED / invalid state or provider response, despite hundreds of successful tool reads. The model output is returned with HTTP 200, but reducer validation rejects it and hides the validation reason. Resume then sometimes fails closed with CONTINUATION_UNCERTAIN because prior workspace evidence was unverified. Previous effects and checkpoint must not be replayed.

## Primary deliverable
A robust, inspectable reducer path that preserves observed evidence for every required source reference when an otherwise valid proposed state omits a source and can use a deterministic, byte-bounded source-backed projection if both model attempts fail. Keep previous verified state and honest failure status; never invent tool results. Surface precise validation diagnostics, with no model-content leakage. Preserve immutable source interactions and runtime recovery journal.

## In scope
- Deterministic sourceRef coverage repair for structurally validated model proposals.
- Bounded source-observed continuation fallback after exhausted invalid/length responses, never when source evidence unavailable.
- Regression tests for exhausted attempts, no replay, coverage, dishonest/missing references, source bounds, and abort.
- Documentation.

## Out of scope
- Changing provider output contracts, disabling budgets, weakening no-replay invariants or workspace verification, re-running prior tool effects, changing project files, live paid verification.

## Necessity gate
| Authority | Without fix | Smallest sound change | Verification |
| --- | --- | --- | --- |
| PC-LF-03 & PC-LF-04 | A model-provided summary missing IDs blocks independent continuation | Validate structured content, then fill only missing sources from actual completed interaction records | source coverage and invalid reference tests |
| PC-LF-05 & PC-LF-08 | Retry-only reduction cannot finish and repeated Resume risks duplication | bounded deterministic checkpoint from stored evidence for exhausted malformed/truncated model summaries; never invoke tools | crash/recovery regression |
| PC-LF-05 | Generic error hides actual failure and stalls troubleshooting | report sanitized validator failure reason | error tests |

## Verification
- [x] TypeScript build.
- [x] Reducer regression tests, existing durable continuation tests.
- [x] Other runtime/session safety tests.
- [ ] Live GUI integration after restart, if possible.

## Safety
Before change: database backed up using SQLite backup to C:/Users/zakri/.a008/backups/platform-before-reducer-fix-20261121.sqlite (220622848 bytes).
No user project edit; no live provider calls; no publishing.
