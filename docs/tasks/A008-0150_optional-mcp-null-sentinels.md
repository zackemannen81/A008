# A008-0150 — Normalize strict-provider null sentinels for optional MCP arguments

Task ID: A008-0150
Parent Task: None
Status: Ready
Owner: Rickard (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 2026-09-21

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`

## Task Summary

OpenAI strict tool schemas require every property to be required. ACME correctly
lowers an originally optional MCP property to nullable-required form for that
provider, but OpenAI can consequently return `null` as the omission sentinel.
A008 currently validates it directly against the original MCP schema and rejects
the otherwise valid call before approval or MCP execution.

## Task Charter

### Goal

Allow strict-provider omission sentinels to reach optional MCP parameters as
absence while retaining original MCP-schema validation as the execution authority.

### Primary Deliverable

A `ModelToolSession` pre-validation normalization that removes `null` only from
originally optional, non-nullable object properties, plus focused regression
coverage.

### In Scope

- Inspect the original offered tool JSON Schema at `ModelToolSession` validation.
- Remove an own `null` argument only when that property is not in the original
  object schema's `required` array and its original schema does not accept null.
- Validate the resulting arguments through the existing Ajv validator before
  approval/execution.
- Cover removal, required-null rejection, and explicitly nullable preservation.
- Update current behavior/status documentation and archive/handoff records.

### Out of Scope

- Changes to ACME lowering, provider requests, MCP server schemas, or OpenAI
  strict-schema rules.
- General JSON Schema transformation or coercion beyond the described top-level
  MCP omission sentinel.
- Altering approval, cancellation, tool budgets, MCP transports, or execution.

### Definition of Done

- An argument object such as `{ "restore": null, "url": "https://example.com" }`
  executes against an original MCP schema in which `restore` is optional and
  non-nullable, with `restore` absent at MCP execution.
- Original required and nullable semantics remain enforced.
- Focused regression and root typecheck pass without live provider calls.
- Completed charter, handoff and relevant current documentation are present;
  `docs/CURRENT_TASK.md` is restored to the template before push.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3ab94ec`

| Change                                                                        | Clause and accepted constraint                                                                                                                                                          | Outcome; consequence if omitted                                                                                                                                    | Smallest sufficient change                                                                                                                                                  | Planned check                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Normalize strict-provider optional-field null sentinels before MCP validation | PC-05 — structured model tool calls retain the established approval/cancellation boundary; malformed calls never execute. `SYSTEMDOC.md` states validation precedes approval/execution. | A provider-valid omission representation is rejected locally before the approved MCP tool can run, even though the original optional argument is absent in intent. | Inspect only the original top-level object property and remove only its `null` sentinel before existing Ajv validation; leave all other values/schema validation unchanged. | Focused unit regressions for optional non-nullable removal, required-null rejection and nullable preservation; root typecheck. |

### Minimum Verification Gates

- [ ] Focused `model-tools` regression coverage passes.
- [ ] Root `npm run typecheck` passes.
- [ ] `git diff --check` passes.
- [ ] Review actual diff against the frozen PC-05 necessity argument and scope.

## References

- `src/tools/model-tools.ts`
- `test/model-tools.test.ts`
- `docs/PROJECT_BRIEF.md` PC-05
- `docs/SYSTEMDOC.md` Application runtime / model-tool validation boundary
- Operator-provided reproduction: OpenAI strict nullable-required lowering for
  originally optional MCP fields.

## Checklist

- [x] Confirm the provider-to-local-validation failure boundary and existing tests.
- [ ] Add narrow original-schema sentinel normalization and regression tests.
- [ ] Run required validation gates.
- [ ] Update observed-state/system documentation as warranted.
- [ ] Review scope/necessity, archive the complete charter and write handoff.

## Decisions and Notes

- Original MCP schema remains authoritative for execution validation.
- `null` is not broadly coerced; preservation is required when the original
  property is required or declares null as valid.
- The normalization applies only to direct properties of the MCP argument object,
  matching the provider's nullable-required object-property lowering.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator appends on merge.
- [ ] `docs/FILESTRUCTURE.md` — no structural change expected.
- [ ] ADRs and collection indexes — not needed.

## Handoff and Follow-ups

- Current state: Ready for narrow implementation.
- Next recommended step: implement and verify the original-schema normalization.
- Blockers: None.
- Child tasks: None.
- Resume condition: Continue from this frozen charter on this branch.
- Open questions: None.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry on merge.
