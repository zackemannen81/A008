# A008-0150 — Normalize strict-provider null sentinels for optional MCP arguments

Task ID: A008-0150
Parent Task: None
Status: Complete
Owner: Rickard (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 2026-09-21

## Task Summary

OpenAI strict tool schemas require every property to be required. ACME correctly
lowers an originally optional MCP property to nullable-required form for that
provider, but OpenAI can consequently return `null` as the omission sentinel.
A008 had validated that value directly against the original MCP schema and
rejected the otherwise valid call before approval or MCP execution.

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

- [x] `{ "restore": null, "url": "https://example.com" }` executes against
      an original MCP schema in which `restore` is optional and non-nullable, with
      `restore` absent at MCP execution.
- [x] Original required and nullable semantics remain enforced.
- [x] Focused regression and root typecheck pass without live provider calls.
- [x] Completed charter, handoff and relevant current documentation are present;
      `docs/CURRENT_TASK.md` is restored to the template before push.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3ab94ec`

| Change                                                                        | Clause and accepted constraint                                                                                                                                                          | Outcome; consequence if omitted                                                                                                                                    | Smallest sufficient change                                                                                                                                                  | Planned check                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Normalize strict-provider optional-field null sentinels before MCP validation | PC-05 — structured model tool calls retain the established approval/cancellation boundary; malformed calls never execute. `SYSTEMDOC.md` states validation precedes approval/execution. | A provider-valid omission representation is rejected locally before the approved MCP tool can run, even though the original optional argument is absent in intent. | Inspect only the original top-level object property and remove only its `null` sentinel before existing Ajv validation; leave all other values/schema validation unchanged. | Focused unit regressions for optional non-nullable removal, required-null rejection and nullable preservation; root typecheck. |

### Minimum Verification Gates

- [x] Focused `model-tools` regression coverage passes.
- [x] Root `npm run typecheck` passes.
- [x] `git diff --check` passes.
- [x] Review actual diff against the frozen PC-05 necessity argument and scope.

## References

- `src/tools/model-tools.ts`
- `test/model-tools.test.ts`
- `test/fixtures/tool-mcp.ts`
- `docs/PROJECT_BRIEF.md` PC-05
- `docs/SYSTEMDOC.md` Application runtime / model-tool validation boundary
- Operator-provided reproduction: OpenAI strict nullable-required lowering for
  originally optional MCP fields.

## Checklist

- [x] Confirm the provider-to-local-validation failure boundary and existing tests.
- [x] Add narrow original-schema sentinel normalization and regression tests.
- [x] Run required validation gates.
- [x] Update observed-state/system documentation.
- [x] Review scope/necessity, archive the complete charter and write handoff.

## Decisions and Notes

- Original MCP schema remains authoritative for execution validation.
- `null` is not broadly coerced; preservation is required when the original
  property is required or declares null as valid.
- The normalization applies only to direct properties of the MCP argument object,
  matching the provider's nullable-required object-property lowering.
- `schemaAcceptsNull` recognizes direct `type`, `const`, `enum`, `anyOf`,
  `oneOf`, and `allOf` null representations. No provider schema is modified.

## Charter Amendment Log

- none

## Verification

- PASS — `npm run typecheck`.
- PASS — `npm run build`.
- PASS — `node --test dist/test/model-tools.test.js`: 12 passed, 0 failed.
  This includes a real stdio MCP fixture: an OpenAI-style
  `{ "url": "https://example.com", "restore": null }` call reaches the MCP
  server as `{ "url": "https://example.com" }`.
- PASS — focused normalization regression proves optional non-nullable removal
  while a required `null` and explicitly nullable `null` remain unchanged.
- PASS — changed-file Prettier check and `git diff --check`.
- NOT GREEN, unrelated/reproducible — `npm test`: 711 passed, 1 failed, 0 skips
  (712 total). `test/runtime-preferences.test.ts`,
  `real host/ACP controls save, repair overflow, enforce ownership and timeout,
and persist across restart`, expected `prompt/ok` but received `error`.
  Re-running only `node --test dist/test/runtime-preferences.test.js` reproduced
  the same one failure (13 passed, 1 failed). This task does not touch runtime
  preferences, GUI host control, ACP control, or their dependencies.
- NOT GREEN, pre-existing repository-wide formatting — `npm run format:check`
  reports 67 unrelated files. The seven files changed by this task pass a
  targeted Prettier check.
- No live or paid provider call.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator appends on merge.
- [x] `docs/FILESTRUCTURE.md` — no structural change.
- [x] ADRs and collection indexes — not needed.

## Handoff and Follow-ups

- Current state: Complete; ready for review/PR.
- Next recommended step: diagnose the existing `runtime-preferences` real
  host/ACP failure in a separately chartered task if a fully green suite is
  required.
- Blockers: None for this bounded hotfix; full-suite baseline is not green due
  to the recorded unrelated failure.
- Child tasks: None.
- Resume condition: Review the PR against this immutable archive.
- Open questions: None.
