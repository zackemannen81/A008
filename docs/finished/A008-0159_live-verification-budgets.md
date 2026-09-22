# Current Task

Task ID: A008-0159
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 2026-09-22 after main allocation 67c6a72 and necessity review

## Read First

AGENTS and ordered authority docs; platform specification sections 21 and 27;
task template, CONTRIBUTING and MULTIAGENT budget/credential boundaries.

## Task Summary

The owner adopts delegated live-verification authority within an approved budget
and requires limits sensitive to actual model pricing, including free routes.

## Task Charter

### Goal

Replace blanket paid/live-call escalation with bounded verification authority.

### Primary Deliverable

Consistent repository governance, task budget template and platform v1.2.

### In Scope

AGENTS, TASK_WORKFLOW, CONTRIBUTING, MULTIAGENT, task template, platform proposal,
status/navigation and documentation closure. Define model-aware estimates,
shared budgets, bounded free calls and honest verification attribution.

### Out of Scope

Runtime budget enforcement, provider/model price changes, live calls, credentials,
product tests, semantic-memory changes, external repositories, push or merge.

### Definition of Done

- In-scope live verification on approved routes needs no per-call approval inside budget.
- Finite cost, call, input/output and time limits; model-specific pricing and unknown cost handling.
- Workers/retries/resume share authority and reservations; no automatic paid fallback.
- User-supplied section 27 wording retained; tests label fake/local/live origin.
- Documentation checks, immutable archive, handoff and exact template restoration.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: ab52af16b658ed61427b24c2333b2fa9fa51b3b5

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Delegated verification budgets | PC-01 shared provider owners; PC-05 explicit execution/credential boundaries; owner's current governance authorization | Permit meaningful real-integration verification without owner escalation for every small expense; retain bounded spend/effects | One owning workflow policy, inherited template and aligned entry points/proposal; no runtime feature | Cheap/expensive/free/unknown-price scenarios, concurrent reservations and restart accounting; conflict search, document checks and doc-only diff |

### Minimum Verification Gates

- [x] Policy scenarios and owner scope/necessity review.
- [x] Active governance consistency; historical records remain immutable.
- [x] Markdown links/fences/tables/IDs; closure checks exact template equality.
- [x] Documentation-only diff, whitespace/secret review; archive and handoff prepared.

### Verification Budget

Live verification: not needed for this Markdown-only task.
max_live_verification_cost: 0 SEK
No live-provider calls are made by this task.

## References

Owner's replacement section 27 and model-dependent price examples.
Source baseline dc7c3ae. Price examples are not a verified pricing catalog.

## Checklist

- [x] Inspect authority and allocate task on main.
- [x] Update policy, template and proposal.
- [x] Verify and close.

## Decisions and Notes

Use 10 SEK as the inherited workflow default discussed with the owner, with
conservative finite call/token/time defaults. Values are policy, not a claim of
existing automatic enforcement. No pricing lookup is needed because no provider
price is asserted and no live execution is performed.

Consistency search found stale current-status/map wording and a live extraction
recipe still requiring separate authority. Update only those entry-point rules;
the recipe retains its actual 16384-output ceiling and explicitly requires a
matching task-approved limit. No semantic behavior or script parameter changes.

## Charter Amendment Log

- none

## Verification

Document checks pass: 28 top-level sections, 17 requirements and 17/17 acceptance
coverage, 40 unique scenarios, 16 decisions, 18 local links/anchors across the
six primary changed documents, balanced fences/tables and one valid JSON example.
Two Mermaid blocks unchanged, reviewed as text only. No runtime tests or live calls.

Policy scenario review (illustrative SEK reservations, not actual model pricing):
- Cheap 0.05 SEK attempt within all caps: authorized without owner escalation.
- 11 SEK reservation against 10 SEK remaining: no dispatch; resize if the same
  verification remains credible, otherwise obtain increased budget.
- Confirmed free route: zero money reservation, finite attempts/tokens/deadline.
- Unknown price: no zero-price assumption; bounded provider cap or exception.
- Two workers requiring 6 SEK each against 10 SEK: disjoint allocations or
  serialized reservation prevent concurrent 12 SEK commitment.
- Timeout/missing usage/replacement: reservation and attempts survive; no reset.
- Fake and cheaper-model results cannot certify the external target model.
- Existing extraction recipe's 16384-token ceiling is documented honestly and
  cannot silently inherit the smaller default 4096-token allowance.

Consistency searches covered current authority and navigation; historical
archives/ADRs/frozen task records remain unchanged. Current workflow supersedes
generic inherited escalation while preserving explicit narrower restrictions.
Scope/necessity/secret review and git diff --check pass. No model price asserted,
no product/runtime/memory/schema/dependency changes. Final closure checks exact
template restoration and archive/handoff links.

## Documentation Updates

Workflow and entry points, template, platform, status/map, archive/handoff indexes.
SYSTEMDOC and memory unchanged; journal belongs to main integration.

## Handoff and Follow-ups

Runtime enforcement remains a separately scoped implementation.
