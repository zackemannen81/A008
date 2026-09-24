# A008-0173 — Faithful retrieved metadata and new-property memory intake

Task ID: A008-0173
Parent Task: None
Status: Complete
Owner: Codex (operator/worker), owner-claimed branch
Created: 2026-09-24
Last updated: 2026-09-24
Charter frozen at: 2026-09-24T04:49:42Z

## Task Summary

The owner's live two-turn check saved an initial project description but lost a
new property of a known file. The extractor returned only reinforcement, while
the retrieved baseline incorrectly labelled old records with the current
query's tags. Repair that bounded read/extract/commit boundary without replacing
the memory model. The owner claimed this identity on main and supplied branch
`mrwhite81/a008-0173_secure-current-memory-model-bevaviour`.

## Task Charter

### Goal

Preserve retrieved record metadata and retain a newly asserted property of a
known entity as structured knowledge, independently of legitimate reinforcement.

### Primary Deliverable

A corrected projection/extraction boundary with regression verification through
the existing intake, semantic commit, SQLite persistence and subsequent retrieval.

### In Scope

- Preserve stored record labels in provider/extractor context; never substitute
  retrieval query tags or query entities for a record's own metadata.
- Review relevant `src/prompt-contracts` and minimally align retrieval, dialogue
  extraction, relation classification and worker context with the accepted model.
- Distinguish known entity/topic from known property/value; preserve new
  structured attributes and same-address changes alongside genuine reinforcement.
- Validate copied optional reinforcement addresses against the same retrieved
  item; protect source fidelity and existing identity boundaries.
- Regression checks for new property, actual restatement, subsequent state
  change/history, metadata isolation, no invented addresses and SQLite reload.
- Update owning documentation and provide a bounded handoff.

### Out of Scope

- New memory architecture, semantic identity scheme, database schema or migration.
- Commit-order concurrency redesign, historical-intent classifier expansion,
  attention/domain profiles, associative reactivation policy or lifecycle changes.
- UI redesign, platform implementation, ACME/provider changes, user database
  repair/reclassification, user log/payload publication or new provider services.

### Definition of Done

- Query metadata cannot masquerade as stored knowledge in a retrieved item.
- The known-file/new-property scenario is covered from extracted proposal through
  persisted current state and a later read; unchanged knowledge can still reinforce.
- Relevant prompt contracts consistently distinguish new properties, updates,
  reinforcement, retrieval hints and semantic identity.
- Focused checks and the core suite run; failures and live-verification limits
  are reported honestly. No unsupported claim that all memory semantics pass.
- Documentation, immutable archive and handoff exist; CURRENT_TASK is restored
  before final delivery/commit. Journal integration remains operator-owned.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: a4280b1bb58df9785a5a774930b76ecf0320581a

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Projection metadata | PC-02/03; CURRENT_MEMORY_MODEL §§27–30, 46–47; ADR 0023/0024 | Old knowledge must not acquire query-only labels; otherwise the extractor sees misleading baseline metadata | Use matched record metadata in existing projection adapter, with empty metadata when absent | Distinct stored/query tags across multiple records and surfaces; unchanged source data |
| New-property intake and prompt alignment | PC-04; CURRENT_MEMORY_MODEL §§46–47; owner live failure | An explicit new property of a known file must reach structured state instead of disappearing into reinforcement | Clarify existing prompts, preserve existing four buckets and validate copied metadata | Known entity/new slot, same slot/new value, true restatement, SQLite reopen and current/history retrieval |
| Verification and documentation | PC-02/04 and TASK_WORKFLOW | Establish actual repaired behavior and residual limits | Focused integration tests, core suite, bounded live extraction when approved route/pricing can be resolved | Fixture/local versus live provenance, diff review and handoff |

### Minimum Verification Gates

- [x] TypeScript build/typecheck.
- [x] Targeted projection, extractor, intake and SQLite read/write regressions.
- [x] Existing state/history, lifecycle, associations, labels and scope tests.
- [x] Core suite and suite-membership check; document unrelated failures.
- [x] Review relevant prompt contracts and final diff against necessity/scope.
- [x] Bounded live extraction if approved credentials and credible pricing are
  available; otherwise record the concrete missing prerequisite, without claiming
  fixture output proves model behavior.
- [x] Documentation references, diff hygiene, archive and structured handoff.

### Verification Budget

- Purpose: actual dialogue-extractor behavior for known entity/new property,
  changed value and unchanged knowledge; synthetic minimal inputs only.
- Owner: A008-0173, serialized dispatch; no child allocations.
- Inherited policy: TASK_WORKFLOW live-verification-budget at the contract revision.
- max_live_verification_cost: 10 SEK aggregate, a ceiling rather than a target.
- max_live_verification_calls: 10 physical attempts including retries.
- max_input_tokens_per_call / max_output_tokens_per_call: 16384 / 4096.
- live_call_timeout_seconds: 120.
- Approved route: existing OpenAI `gpt-5.6-luna` through the configured A008
  transport, as used in the owner's live check; existing environment/reviewed
  secret provider only. No credentials in task, source or command arguments.
- Price reference: OpenAI model page checked 2026-09-24,
  https://developers.openai.com/api/docs/models/gpt-5.6-luna:
  USD 0.20 input / 1.20 output per million tokens (uncached standard).
- Planning conversion allowance: 20 SEK/USD, deliberately conservative budget
  allowance rather than a claimed FX quote. Reserve 0.25 SEK per physical
  attempt, at most 2.50 SEK for all 10 attempts. Charge failures/unknown usage
  against that reservation. Input also bounded to 16384 serialized UTF-8 bytes;
  output bounded to 4096 tokens; no provider tools. Count at the fetch boundary.
- Initial accounting: 0 attempts, 0 SEK, no reservations or unknown charges.

## References

- `docs/CURRENT_MEMORY_MODEL.md`, `docs/TASK_WORKFLOW.md`.
- `docs/adr/0023-retrieval-is-additive.md`, `docs/adr/0024-retrieval-scope.md`.
- `docs/handoffs/A008-0171.md`, `docs/handoffs/A008-0172.md`.
- Owner-local `C:\log\a008-log.txt`, lines 27–61; private diagnostic input,
  not an artifact to copy or commit. Regression fixtures use minimal synthetic data.

## Checklist

- [x] Confirm owner-claimed identity, clean branch and current authority.
- [x] Apply necessity gate and freeze this charter as Ready before code changes.
- [x] Repair projection metadata and relevant prompt/intake contracts.
- [x] Verify and record results and remaining boundaries.
- [x] Update docs, archive, restore template and hand off.

## Decisions and Notes

- Existing 247-test baseline passed before this task. It did not establish the
  real extractor's new-property behavior; the owner's live trace exposed that gap.
- No new ADR is needed unless the repair requires a new architectural decision.

## Charter Amendment Log

- None.

## Verification

- Root/client/protocol builds pass; final focused + membership: 89/89 pass.
- Full core: 769/770; unchanged failure reproduced on untouched a4280b1.
- Live Luna: six physical calls, all four scenarios pass; estimated USD 0.0023622.
- Targeted ESLint retains one unchanged baseline non-null assertion.
- Details, local artifact references and limitations: docs/handoffs/A008-0173.md.

## Documentation Updates

- CURRENT_MEMORY_MODEL and SYSTEMDOC: precise projection/extraction behavior.
- CURRENT_STATUS: verified branch outcome, not a premature merge claim.
- FILESTRUCTURE and task index only where needed; journal on integration.

## Handoff and Follow-ups

- Current state: Complete on task branch; charter frozen as Ready before implementation.
- Next action: operator integration review; no PR or merge performed.
- Known separate follow-ups: commit-order semantics and historical-intent gap
  reported during the prior baseline audit; neither is silently absorbed here.
