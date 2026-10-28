# A008-0218 — Durable reducer pause and recovery

Task ID: A008-0218
Parent Task: None
Status: Complete
Owner: Codex (operator/implementer)
Created: 2026-10-27
Charter frozen at: 2026-10-27

## Goal
Completed execution survives reducer failure and process replacement without replaying completed tools.
## Primary Deliverable
Durable pre-reduction boundaries, revision-bound atomic projection adoption and explicit resumable reducer pause through the existing host.
## In Scope
Preserve completed raw rounds independently of reduction; reuse recovery fences and leases; compare source and projection generations; bound reducer attempts/output and distinguish truncation; structured Responses output where supported; explicit GUI resume of the same run; owning ADR/docs and fault-injection tests.
## Out of Scope
Exactly-once arbitrary external effects, automatic replay of tools, semantic-memory changes, new scheduler, cross-provider fallback, remote publication.
## Definition of Done
Invalid JSON, truncation and exhausted reducer attempts preserve completed rounds and leave a durable resume path. Process loss during reduction resumes the same run with consumed tool IDs intact. Stale candidates/leases cannot overwrite newer state. Unknown effects remain reconciliation-only. Fixed state-size bounds remain; budget growth is bounded and only for confirmed truncation. GUI distinguishes paused reduction from unknown effects. Relevant build/typecheck/core/store/process/GUI tests pass; archive and handoff exist.
## Necessity Gate
Contract revision: 6993278 (docs/PROJECT_BRIEF.md)
| Change | Clause / constraint | Observable need and omission | Smallest approach | Verification |
| --- | --- | --- | --- | --- |
| Durable pending reduction and atomic adoption | PC-LF-05/07/08/09; ADR 0057 effect fences; owner-approved refinement of ADR 0063 | Completed work currently loses resumability on malformed reduction | Extend existing checkpoint/recovery ownership with pending raw rounds and revision guards | SQLite and process-failure tests, stale revision and no-replay checks |
| Bounded structured reducer | PC-LF-03/04 | Plain text JSON can truncate/fail and abort turn | Shared validated reducer, schema when supported, at most two attempts with finite caps | Invalid/truncated/schema/source/budget fixtures |
| Explicit pause/resume | PC-LF-09 | User needs to resume preserved work without creating another run | Existing host/coordinator with bounded resume command and GUI action | HTTP/GUI same-run tests |
## Verification Budget
Local fault injection is primary. No live calls planned: 0 calls / 0 SEK; no live model quality/acceptance claim. Synthetic installed-ACME HTTP verifies wire format.
## Checklist
- [x] Read authority and inspect current failure/recovery path; claim identity on local main.
- [x] Record owner-approved ADR refinement before dependent code.
- [x] Implement durable boundary and revision guards.
- [x] Implement reducer and explicit resume path.
- [x] Run gates, update owners, archive and hand off.
## Notes
Owner explicitly approved the discussed direction and implementation. No repeat approval needed for ADR 0063 refinement. Previous 0217 fix preserved in separate local commit. No push/deployment authorized.

## Implementation notes

- Reused existing checkpoint/recovery tables and raw terminal activity; no schema migration or second scheduler.
- Pending reduction metadata binds runtime run, source revision, reducer format version, generation, attempt count, selected tools and current effect fence. Ready adoption requires matching pending revision and unchanged workspace evidence.
- Resume appends a new generation and clears only the reducer attempt allowance; it is revision-guarded and uses the existing coordinator's workspace/lease checks.
- Product GUI sessions advertise actual durable-owner availability across private IPC. Standalone child callers retain their existing optional-owner behavior.
- Fixed state byte ceiling is independent of generated token ceiling. Initial reducer allowance is half the configured hard output ceiling; a confirmed length finish permits the full ceiling for the second attempt. No input-size-proportional growth.
- Structured output verified against installed ACME using synthetic Responses HTTP. Other routes retain bounded local JSON/source validation.
- Ordinary CLI/ACP and callers without checkpoint owner do not gain durable recovery. Unknown external effects still require reconciliation.
- Verification in progress: targeted core/store/wire tests pass; real malformed-response and killed-reducer host cases pass with one creation; 110-round replacement test passed. Full suites being run against a frozen build.
- Broader pre-existing fixture failures routed to existing HTTP/semantic backlog plus GUI graph/project fixture entry. No unrelated fixes absorbed.

## Owner-reported context regression follow-up (2026-10-28)

Read-only inspection of the reported run established that projections existed,
but useful code details became generic inspection summaries and reads repeated.
The reducer input omitted the current user objective. No private payload or
source material is included in repository evidence. The run had already succeeded;
no live session, user settings or stored checkpoint was modified.

Within the bounded reducer's existing PC-LF-03 scope, pass the current question
to reduction, require concrete relevant findings and distinguish missing evidence
from completed inspection. Worker guidance treats the projection as prior work,
uses loaded schemas without reselection, and answers when evidence suffices.
State size, raw-tail count, schema, effect policy and retry bounds are unchanged.
This is a prompt/data-flow repair, not a deterministic semantic quality guarantee.
Synthetic regression verifies question delivery and concrete findings carried over
three reductions and schema selection; it does not prove live Luna behavior.

## Final verification and delivery — 2026-10-28

- Root build/typecheck, GUI build, client build and protocol/client packed-consumer
  checks passed during implementation. Protocol artifacts regenerated.
- Final follow-up: root build PASS; working-context/continuation/pressure/recovery
  38/38 PASS; installed ACME/client SDK/child-process selected tests 25/25 PASS
  (known legacy SDK workspace fixture excluded).
- Frozen full host run before prompt follow-up: 17/20 PASS, including 110 rounds
  with process replacement, workspace negative paths, and both new reducer cases.
  All three failures reproduced independently at pre-0218 commit 5d9b441.
- After prompt follow-up: killed reducer PASS; malformed reducer timed out once
  during concurrent baseline verification, then passed isolated (16.7 seconds).
  That timeout is retained as a verification limitation, not silently discarded.
- Full GUI 233/235; unchanged graph/project fixture failures are in backlog.
  Existing HTTP/protocol inventories, SDK workspace fixtures and semantic model
  fixture mismatches remain separately routed; no full-suite-green claim.
- No live calls, 0 SEK. Real provider summary quality, latency and repetition
  after the prompt repair remain unverified. No stored user state was rewritten.
- Final necessity review: same PC-LF-03/04/05/07/08/09 outcomes, finite bounds,
  unchanged effect authority; no new scheduler, schema migration or semantic memory.
- Local delivery only; no push, merge or publication. Journal append belongs to
  integration on main. CURRENT_TASK restored; handoff A008-0218.md.
