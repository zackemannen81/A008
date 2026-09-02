# Task ID Register

Floor: A007-0001

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
| A007-0001 | bootstrap canonical docs-first repository state | mrWhite81 and felixnissen | 2026-09-01 | repository bootstrap |
| A007-0002 | configure multi-agent worker clone root | mrWhite81 and felixnissen | 2026-09-01 | repository configuration |
| A007-0003 | secure provider-neutral chat core and CLI | mrWhite81 and felixnissen | 2026-09-01 | first product implementation |
| A007-0004 | prove Agent Canvas shared-chat boundary | mrWhite81 and felixnissen | 2026-09-01 | first GUI integration |
| A007-0005 | verify Agent Canvas runtime through a007 ACP | mrWhite81 and felixnissen | 2026-09-01 | first visible GUI proof |
| A007-0006 | define semantic-memory core contract and reference engine | mrWhite81 and felixnissen | 2026-09-01 | first memory implementation |
| A007-0007 | define runtime identity and ACP binding contract | mrWhite81 and felixnissen | 2026-09-01 | first cross-surface identity |
| A007-0008 | repair post-identity current truth | mrWhite81 and felixnissen | 2026-09-01 | documentation consistency repair |
| A007-0009 | implement SQLite hybrid memory read path | mrWhite81 and felixnissen | 2026-09-01 | bounded retrieval and durable local memory |
| A007-0010 | compose verified memory-aware chat turn | mrWhite81 and felixnissen | 2026-09-01 | application read-path orchestration |
| A007-0011 | define safe post-output knowledge intake | mrWhite81 and felixnissen | 2026-09-01 | bounded knowledge proposals and reasoning exclusion |
| A007-0012 | implement explicit relation-gated memory commit | mrWhite81 and felixnissen | 2026-09-01 | candidate comparison, reconciliation, and retrieval indexing |
| A007-0013 | orchestrate staged post-output memory batch | mrWhite81 and felixnissen | 2026-09-01 | explicit per-proposal processing and partial outcomes |
| A007-0014 | own stateless semantic JSON model calls | mrWhite81 and felixnissen | 2026-09-01 | analyzer/classifier transport composition and cancellation |
| A007-0015 | prove committed two-turn semantic memory loop | mrWhite81 and felixnissen | 2026-09-01 | deterministic read-answer-commit-reread architecture benchmark |
| A007-0016 | wire memory-aware local test surfaces and secure provider tracing | mrWhite81 and felixnissen | 2026-09-01 | CLI/ACP live memory composition and opt-in diagnostics |
| A007-0017 | enable live write-path reconciliation reinforcement | mrWhite81 and felixnissen | 2026-09-01 | restatement/extend score boost and threshold reactivation |
| A007-0018 | isolate provider reasoning from knowledge and semantic calls | mrWhite81 and felixnissen | 2026-09-01 | NVIDIA stream normalization, semantic non-thinking profile, trace/failure repair |
| A007-0019 | bind write-path source message and repair current truth | mrWhite81 and felixnissen | 2026-09-01 | explicit user-assertion context, HTTP operation traces, live status docs |
| A007-0020 | normalize live relation-classifier type aliases | mrWhite81 and felixnissen | 2026-09-01 | accept relation/type aliases without inventing relations |
