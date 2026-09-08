# Extraction JSON contract and regression

Task ID: A008-0085
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

AGENTS.md and ordered documents; ADR 0012/0018/0035 and the existing semantic
JSON, knowledge intake and source-support contracts.

## Task Summary

After the A008-0083 parameter repair, the owner reports another extraction
failure: 1892 characters of malformed JSON, finishReason=stop, with a greeting
proposed as knowledge. The extractor contains a pseudocode support example.
The current raw trace is capped before the failing request; the exact selected
model and full response are not yet confirmed. Prompt clarity and model quality
must be distinguished in both implementation and evidence.

## Task Charter

### Goal

Correct the extraction response contract and establish honest regression evidence
for this reported failure without admitting guessed or non-JSON content.

### Primary Deliverable

Valid JSON examples and clear durable-knowledge selection in the existing
instruction, actionable model/operation diagnostics and a bounded live check.

### In Scope

- Existing fixed extraction instruction: canonical example syntax, types and
  greeting-only versus mixed durable-fact guidance; preserve source fidelity.
- Remove corresponding pseudocode from the relation instruction's support shape.
- Identify model and operation in existing semantic response-failure diagnostics.
- Offline parser, example/staging, one-call, source support and no-write tests.
- Prepare a synthetic live check through the existing generator/transport, run
  only after explicit live-provider authority. Record output validity separately
  from semantic correctness; a passing sample is not a universal guarantee.
- Owning docs, archive, handoff and already-authorized main integration.

### Out of Scope

- JSON repair, fragment extraction, retries, background work or extra production calls.
- Model switching, unsupported provider parameters or changing provider defaults.
- Runtime greeting blacklists, fabricated propositions/support or silent failure.
- Changes to retrieval, lifecycle, schemas, memory-map design or user databases.
- Changes to frozen L1-L3 target, owner CSS, credentials/settings, log rotation,
  app restart or provider-side structured-output implementation without evidence.

### Definition of Done

- Every response example is actual parseable JSON and survives existing staging
  with valid severity and exact support offsets when appropriate.
- The instruction separates ordinary social exchange from reusable facts and
  keeps facts in mixed messages; no runtime lexical filter is added.
- Both reported malformed output shapes remain strict failures in one call.
- A capped trace no longer hides which model/operation rejected its response.
- Typecheck, relevant/full core and GUI regressions pass. Live checks require
  explicit authority; record results or an honest pending handoff if unavailable.
- Necessity review and owning docs are truthful; completed work is archived and
  integrated only with the stated verification limits and restored CURRENT_TASK.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: a01bfaa558161178d977e34c1882ba3f15ffacd7

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Extraction output/meaning contract | PC-04; ADR 0012, source fidelity and accepted L2 support | Models receive valid output shapes and a clear durable-fact criterion; current pseudocode and completeness pressure permit malformed social summaries | Canonical serialized examples and typed prose in the existing fixed instruction | Examples through strict parser/stager; greeting/mixed/source fixtures; authorized live sample |
| Actionable failure evidence | PC-04; ADR 0012 D6 | An operator can identify the actual failed model/semantic job even with a capped raw trace | Add model/operation to the existing invalid-response diagnostic, retaining bounds and failure semantics | Exact malformed payload fixture, cancellation/provider-error separation and unchanged write outcome |
| Verification and continuity | PC-04/05; docs-first evidence discipline and provider authority | Avoid claiming another prompt edit solves model compliance without evidence | Existing tests plus explicit opt-in synthetic generator check; no real store, extra production call or new dependency | Typecheck/core/GUI, live report if authorized, final scope/immutable review |

### Minimum Verification Gates

- [x] Parseable response examples, valid support offsets and rejection regressions.
- [x] Typecheck, core, membership and GUI regressions.
- [x] Prepare bounded live check; execute only with explicit authority and record its limits.
- [x] Final necessity, frozen charter/spec, unrelated CSS and documentation checks.

## References

- [Semantic boundary](../adr/0012-stateless-semantic-json-model-calls.md)
- [Product contract](../PROJECT_BRIEF.md)
- [Previous repair](../handoffs/A008-0083.md)

## Checklist

- [x] Inspect the reported failure, current prompt and trace boundary; claim identity.
- [x] Correct instruction examples and add model/operation diagnostics.
- [x] Verify offline and prepare the exact synthetic live request set.
- [x] Record live authority/results or pending verification; complete continuity work.

## Decisions and Notes

- A008-0083 changed relation instructions, not this extraction instruction. Its
  fake-provider successes never established live compliance; the new failure is
  evidence that extraction needs its own correction and evaluation.
- NVIDIA's hosted Kimi and Nemotron parameter references do not document a
  response_format field. Model-weight/self-hosted structured-output support is
  insufficient evidence to send it to this endpoint. No such field is introduced.
- Raw logs remain local; no private model payload is committed.

## Charter Amendment Log

- none

## Verification

- Typecheck/build passed; core 528/528, GUI 118/118 and membership 4/4 pass,
  with no skipped tests. Script syntax and credential-free dry-run pass.
- Fictional output examples are strict-parsed and staged, with zero/one/one
  admitted proposals and exact original message/source support spans.
- Reported malformed relation and greeting-shaped extraction responses remain
  invalid_response in one call. Model/operation are present in the diagnostic;
  no private reasoning is appended. Provider/rate-limit/cancellation errors keep
  their original identity.
- Real isolated runtime integration preserves the delivered chat answer and
  records staging_failed with zero stored records and no classifier/retry call.
- Prepared live cases: Swedish greeting-only, mixed language preference and a
  SQLite source fact; maximum three calls, 16384 output tokens each, no DB writes.
- Live execution is pending explicit authority and confirmation of the selected
  model. The raw trace reaches its size cap before this failure; no full response
  or exact generation cause is claimed from the available excerpt.
- Final necessity review: each changed group maps to the frozen PC-04/05 gate;
  no retry, JSON repair, model switch, provider parameter, dependency or new
  production call was added. The prepared checker is an opt-in verification
  tool, not a production route. No full live-correctness claim is made.
- Frozen charter/target, unrelated GUI/logo CSS, prior archives/ADRs, dependency
  files and documentation links were checked; CURRENT_TASK is restored from
  its template before the implementation commit. Operator integration evidence
  is recorded separately in the append-only journal.

## Documentation Updates

Updated CURRENT_STATUS, SYSTEMDOC, SEMANTIC_JSON_MODEL_CALLS and FILESTRUCTURE.
Completed task archived under the same task filename in finished; handoff
[A008-0085](../handoffs/A008-0085.md) records the exact pending live procedure.
The operator appends the journal on main integration.

## Handoff and Follow-ups

The authorized instruction/diagnostic correction is complete with offline
verification. Live model compliance remains unverified: the owner has been asked
for the failing model and explicit authority for at most three synthetic calls.
No live call has been made, and no unanswered question is treated as approval.
After that answer, follow the exact check in the handoff and record results as
new evidence; never revise this archive to imply it had live evidence at closure.
This pending check does not block the bounded correction's integration under the
frozen Definition of Done. App restart and real-store review remain owner actions.
