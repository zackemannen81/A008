# A008-0176 — Resolved extraction and structured restatement

Task ID: A008-0176
Parent Task: None
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-24
Charter frozen at: 2026-09-24T11:16:00Z

## Task Charter

### Goal
Extract independent, resolved facts from completed reports and retain their
explicit structure through commit instead of losing state-bearing knowledge.

### Primary Deliverable
A verified dialogue prompt and bounded correction to structured claim reuse.

### In Scope
- Iterate the existing extractor on the owner-supplied oldschool report using
  the approved Luna route with reasoning none; preserve input outside Git.
- Require existing binding shapes for resolved properties, atomic ownership,
  distinct entities and faithful qualifications; preserve labels and buckets.
- Prevent restatement reuse from discarding newly supplied semantic structure.
- Local regressions, isolated SQLite replay/reopen, live evidence and owning docs.

### Out of Scope
New schema or architecture, generic semantic resolution, source-only extraction,
owner database repair/backfill, client restart, provider changes, push or merge.

### Definition of Done
The report's independently mutable properties retain bindings, labels and
qualified meaning; collective file labels do not become synthetic entities.
An unstructured claim cannot swallow an explicit binding during restatement;
ordinary same-slot reuse stays idempotent. Current/history survives SQLite reopen.
Document observed live quality and limitations rather than promising determinism.

### Necessity Gate
Contract revision: 71059bb; PC-04 durable knowledge with runtime authority,
PC-02 contextual retrieval; CURRENT_MEMORY_MODEL sections 2,4,25-28,46-48.
Owner explicitly requests iterative repair and supplies the live test report.

| Change | Observable need / omission | Smallest sufficient approach | Verification |
| --- | --- | --- | --- |
| Prompt | Completed facts lack bindings and multiple file subjects are fused | Clarify required resolved shapes and atomic referents in existing prompt | Same report before/after on Luna none; inspect staged facts/labels |
| Commit reuse | Structured relations return early as restatements of free text | Guard canonical reuse so new structured information reaches existing reconciliation | Controlled restatement cases, same-slot reuse and isolated SQLite reopen |

### Minimum Verification Gates
- Root build and focused intake/semantic/commit/SQLite/prompt regressions.
- Live before/after report using actual strict analyzer/intake; inspect coverage,
  identity, qualifications, tags/domains and output completeness.
- Isolated persistence/read/history verification; no owner data mutation.
- Diff/necessity review, owning docs, immutable archive, handoff, template restore.

### Verification Budget
Owner raises monetary limit to 25 SEK on 2026-09-24. Other defaults at 71059bb:
10 physical calls, 16384 input tokens, 4096 output tokens, 120 seconds per call.
Separate task; no worker allocations. Existing approved OpenAI gpt-5.6-luna,
reasoning none, embedded ACME, reviewed default secret provider. No tools.
User expressly supplies oldschool text for this verification; raw payloads stay
in temporary artifacts outside Git. No other private logs sent to providers.
Price checked 2026-09-24 against official model page:
https://developers.openai.com/api/docs/models/gpt-5.6-luna
USD 0.20 input / 1.20 output per million. Conservative input estimate includes 1.25x cache-write surcharge.
Conservative allowance 20 SEK/USD, reserve 0.25 SEK per attempt; unknown usage
retains reservation. Fixed English test input is additionally bounded to 24000 serialized bytes;
conservative 2 bytes/token estimate plus 512 framing tokens is below 16384.
Initial accounting: 0 attempts, 0 spend, 0 reservations; 25 SEK / 10 calls left.

## Decisions and Notes
Identity claimed on local main d751ffd and carried as e49ad7c. Branch retains
0173-0175 and owner checkpoint. Owner prompt backed up outside repository.
No ADR: preserve existing runtime authority and storage model.

## Verification
Pending.

## Handoff
Pending. Journal is the integrating operator's responsibility.
