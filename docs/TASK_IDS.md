# Task ID Register

Floor: A008-0001

This register allocates task identities. It records that an identity is taken,
never whether work is active or complete. Task state belongs in
`docs/CURRENT_TASK.md` and `docs/finished/`.

## How to claim

1. Choose one above the highest identity in this register and
   `docs/finished/`.
2. Append one row at the end. Never sort or insert between existing rows.
3. Commit the claim to `main` before changing a Draft charter to Ready.

## Claims

| Task ID | Title | Owner | Claimed | Work |
| --- | --- | --- | --- | --- |
| A008-0001 | bootstrap canonical docs-first repository state | mrWhite81 and felixnissen | 2026-09-01 | repository bootstrap |
| A008-0002 | configure multi-agent worker clone root | mrWhite81 and felixnissen | 2026-09-01 | repository configuration |
| A008-0003 | secure provider-neutral chat core and CLI | mrWhite81 and felixnissen | 2026-09-01 | first product implementation |
| A008-0004 | prove Agent Canvas shared-chat boundary | mrWhite81 and felixnissen | 2026-09-01 | first GUI integration |
| A008-0005 | verify Agent Canvas runtime through A008 ACP | mrWhite81 and felixnissen | 2026-09-01 | first visible GUI proof |
| A008-0006 | define semantic-memory core contract and reference engine | mrWhite81 and felixnissen | 2026-09-01 | first memory implementation |
| A008-0007 | define runtime identity and ACP binding contract | mrWhite81 and felixnissen | 2026-09-01 | first cross-surface identity |
| A008-0008 | repair post-identity current truth | mrWhite81 and felixnissen | 2026-09-01 | documentation consistency repair |
| A008-0009 | implement SQLite hybrid memory read path | mrWhite81 and felixnissen | 2026-09-01 | bounded retrieval and durable local memory |
| A008-0010 | compose verified memory-aware chat turn | mrWhite81 and felixnissen | 2026-09-01 | application read-path orchestration |
| A008-0011 | define safe post-output knowledge intake | mrWhite81 and felixnissen | 2026-09-01 | bounded knowledge proposals and reasoning exclusion |
| A008-0012 | implement explicit relation-gated memory commit | mrWhite81 and felixnissen | 2026-09-01 | candidate comparison, reconciliation, and retrieval indexing |
| A008-0013 | orchestrate staged post-output memory batch | mrWhite81 and felixnissen | 2026-09-01 | explicit per-proposal processing and partial outcomes |
| A008-0014 | own stateless semantic JSON model calls | mrWhite81 and felixnissen | 2026-09-01 | analyzer/classifier transport composition and cancellation |
| A008-0015 | prove committed two-turn semantic memory loop | mrWhite81 and felixnissen | 2026-09-01 | deterministic read-answer-commit-reread architecture benchmark |
| A008-0016 | wire memory-aware local test surfaces and secure provider tracing | mrWhite81 and felixnissen | 2026-09-01 | CLI/ACP live memory composition and opt-in diagnostics |
| A008-0017 | enable live write-path reconciliation reinforcement | mrWhite81 and felixnissen | 2026-09-01 | restatement/extend score boost and threshold reactivation |
| A008-0018 | isolate provider reasoning from knowledge and semantic calls | mrWhite81 and felixnissen | 2026-09-01 | NVIDIA stream normalization, semantic non-thinking profile, trace/failure repair |
| A008-0019 | bind write-path source message and repair current truth | mrWhite81 and felixnissen | 2026-09-01 | explicit user-assertion context, HTTP operation traces, live status docs |
| A008-0020 | normalize live relation-classifier type aliases | mrWhite81 and felixnissen | 2026-09-01 | accept relation/type aliases without inventing relations |
| A008-0021 | close knowledge-model gap to 100% | Grok (operator / boss) | 2026-09-02 | parent program; sole main merger |
| A008-0022 | adopt knowledge and memory model | Grok (operator / boss) | 2026-09-02 | ADR 0018 and charter freeze |
| A008-0023 | repair direct-match retrieval eligibility | A008-worker01 | 2026-09-02 | M1 v0 read-path defect repair |
| A008-0024 | introduce semantic addressing | A008-worker02 | 2026-09-02 | M3 new knowledge ontology and INTERPRET |
| A008-0025 | split state from history | unassigned | 2026-09-02 | M4 bindings, intervals, RECONCILE, UPDATE |
| A008-0026 | first-class evidence and acceptance | unassigned | 2026-09-02 | M5 utterance, claim, ACCEPT, typed payload |
| A008-0027 | evidence lifecycle and retrieval intents | unassigned | 2026-09-02 | M6 lifecycle on evidence; history surface |
| A008-0028 | knowledge storage redesign | unassigned | 2026-09-02 | M7 SQLite after in-memory S1–S10 |
| A008-0029 | CLI slash commands and native terminal tool | Grok (operator) | 2026-09-02 | interactive /commands and /shell; reject LangChain community |
