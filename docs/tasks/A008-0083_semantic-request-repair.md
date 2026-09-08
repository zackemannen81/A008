# Semantic request compatibility and JSON response contract

Task ID: A008-0083
Parent Task: None
Status: Ready
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

AGENTS.md and its ordered documentation; ADR 0012, 0026 and 0035.

## Task Summary

The owner requested repair of observed memory staging and commit failures.
Nine recorded HTTP 400 responses reject Kimi K3 top_p=1 as immutable; an
independent reported relation response is malformed JSON. The exact malformed
response is absent from the available capped trace; its generation cause is open.

## Task Charter

### Goal

Restore compatible semantic requests and clarify the relation response contract
while preserving strict runtime admission of model proposals.

### Primary Deliverable

Capability-aware semantic sampling and a precise output-only relation contract,
with offline regressions for the reported failures.

### In Scope

- Existing runtime capability owner and stateless semantic generator options.
- Relation classification instruction, canonical examples and strict rejection.
- Offline transport/runtime regressions and existing core/GUI compatibility.
- Owning documentation, archive, handoff and authorized main integration.

### Out of Scope

- JSON fragment extraction, repair, retries or additional model calls.
- Provider replacement, universal structured-output parameters or new dependencies.
- Changes to L1-L3 semantics, frozen specification, user settings/databases or logo CSS.
- Live/paid calls, application restart, releases and memory map design (A008-0084).

### Definition of Done

- Kimi semantic requests omit fixed top P; supported models retain existing defaults.
- The relation prompt explicitly separates input envelope from output decision.
- The reported malformed response remains rejected with no salvaged decision.
- Typecheck, core and GUI regressions pass; live model quality is not inferred.
- Final necessity review, durable docs, archive and handoff are complete;
  CURRENT_TASK is restored and the authorized change is integrated on main.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: aa71f8160ec1b76fab4a1023632ca86c5c71bd3a

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Semantic parameter compatibility | PC-01/04; ADR 0012, ADR 0026 verified endpoint controls | Memory intake can reach Kimi instead of failing before generation on immutable top P | Reuse runtime capabilities and preserve explicit null omission in the generator | Offline runtime requests for all model profiles and transport serialization |
| Relation response clarity | PC-04/05; ADR 0012 strict parse and runtime authority | A classifier has an unambiguous decision output; malformed input-envelope echoes still cannot become writes | Concrete valid output examples and explicit no-envelope rule in the existing instruction; no recovery mechanism | Canonical response succeeds; reported malformed response is rejected with one call |
| Evidence and continuity | PC-04; docs-first evidence discipline | Next actor can distinguish a proven request repair from unverified live model behavior | Existing docs, regression suite and handoff | Typecheck/core/GUI, final diff and immutable baseline review |

### Minimum Verification Gates

- [ ] Capability omission and strict malformed-response regression tests.
- [ ] Typecheck, core, GUI and membership suites.
- [ ] Final necessity, frozen target and unrelated CSS preservation review.

## References

- [Semantic boundary](../adr/0012-stateless-semantic-json-model-calls.md)
- [Endpoint controls](../adr/0026-gui-session-controls.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority, inspect trace summaries and claim identity on main.
- [ ] Implement bounded repair and regression tests.
- [ ] Verify, document, archive and integrate.

## Decisions and Notes

- Raw local traces contain private data; only aggregate error facts are recorded.
- HTTP 400 is a request validation error. A separate older HTTP 429 was observed.
- User authorization to fix and integrate persists; no new approval is required.

## Charter Amendment Log

- none

## Verification

Pending.

## Documentation Updates

Pending CURRENT_STATUS, SYSTEMDOC, JOURNAL and FILESTRUCTURE review.

## Handoff and Follow-ups

- Next: A008-0084, independently authorized graph presentation work.
- Live endpoint and semantic quality verification remains with the owner.
