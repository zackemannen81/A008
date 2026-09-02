# Task A008-0021 — Close knowledge-model gap to 100%

Status: Complete

Task ID: A008-0021
Parent Task: None
Owner: Grok (operator / boss)
Created: 2026-09-02
Completed: 2026-09-02
Charter frozen at: 2026-09-02

## Goal

Make A008's knowledge and memory implementation satisfy laws L1–L12 and
acceptance scenarios S1–S10, closing gap-analysis findings V1–V15, including
SQLite parity (M7) and live CLI/ACP composition without reintroducing V3, V4,
or V7.

## Children

| Task | Phase | PR | Merge |
| --- | --- | --- | --- |
| A008-0022 | M0 ADR 0018 | (main) | `55e38f4` |
| A008-0023 | M1 eligibility | #2 | `b0487eb` |
| A008-0024 | M3 addressing | #1 | `294c2a2` |
| A008-0025 | M4 state/history | #4 | `616e4ae` |
| A008-0026 | M5 evidence | #3 | `ea2f22b` |
| A008-0027 | M6 lifecycle/intents | #5 | after `6547581` |
| A008-0028 | M7 storage + live cutover | #6 | this closeout |

M2 was not a task (ADR 0018 D3).

## Definition of done (ADR 0018 D9)

- [x] V1–V15 closed in owning documents and the new engine.
- [x] S1–S10 pass against the in-memory knowledge engine (A008-0027).
- [x] S1–S10 pass against SQLite with identical results (A008-0028).
- [x] Live CLI/ACP uses the new engine without V3, V4, or V7 (A008-0028).
- [x] `docs/SEMANTIC_MEMORY.md` describes the accepted model as implemented;
  `KnowledgeItem` remains a compatibility surface.

## Verification

Operator treated code plus `docs/handoffs/` as evidence. Child suites were
not re-run on merge.

- A008-0027: 16/16 scenario tests; 189/189 full suite; PROJECT writes nothing.
- A008-0028: 210/210 full suite; in-memory and SQLite S1–S10 payloads match;
  typecheck exit 0; no live provider.

## Notes

`docs/CURRENT_TASK.md` on `main` stayed the empty template. Workers from
A008-0027 onward restored it before push.
