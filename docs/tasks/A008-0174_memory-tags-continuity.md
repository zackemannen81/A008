# A008-0174 — Semantic tags and scoped follow-up retrieval

Task ID: A008-0174
Parent Task: None
Status: Complete
Owner: Codex (operator/worker)
Created: 2026-09-24
Last updated: 2026-09-24
Charter frozen at: 2026-09-24T05:37:00Z

## Task Summary

Owner live verification after A008-0173 shows all eleven proposals omitted tags.
An indirect colour-change follow-up skipped retrieval; its extractor had no
baseline and invented a separate entity/property instead of updating the known
file slot. Repair the contextual classification boundary, keeping runtime state
ownership and the accepted memory model intact.

## Task Charter

### Goal

Produce useful stored tags and preserve contextual retrieval of existing state
for indirect follow-up work in an ongoing conversation.

### Primary Deliverable

Corrected classification/extraction contracts and bounded existing conversation
scope input, verified through production reader/intake/SQLite boundaries.

### In Scope

- Dialogue tag classification: useful specific concepts when classifiable,
  distinct from domains/entities, no generic padding or invented fallback tags.
- Existing accumulating conversation-domain scope as bounded input to the
  retrieval classifier, allowing follow-up questions/changes to retrieve the
  current state needed for reference resolution and later extraction.
- Extractor use of its actual same-turn baseline for referent/slot continuity,
  sparse retained labels and independent reinforcement; no extra chat transcript.
- Regression/live checks for tags, scoped follow-ups, current/history and
  reinforcement, plus no-retrieval social turns and conversation isolation.
- Owning behavior docs, task records, archive and structured handoff.

### Out of Scope

- Reclassifying or rewriting the owner's existing database, automatic backfill.
- New memory architecture, aliases/guessing, permanent conversation scope,
  semantic identity derived from hashes, new state/concurrency policy.
- Broader historical-intent fixes, domain weighting, associative/lifecycle tuning.
- GUI/platform/ACME changes, unrelated baseline test/lint defects, push or merge.

### Definition of Done

Useful tags produced by actual extraction persist and are available to retrieval.
An explicit named-file turn followed by indirect questions/changes retrieves the
applicable known state; changed value retains the existing address with prior
value in history. Genuine reuse can reinforce without duplicating knowledge.
Social turns can still skip retrieval, unrelated conversations have no shared
scope, and ambiguity is not permission to invent a canonical target.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, PC-02/03/04, at af13c15.
Accepted constraints: CURRENT_MEMORY_MODEL sections 27–30,46–48; ADR 0024 D1–D6.
Current owner instruction authorizes correction of the live-discovered gaps.

| Change | Authority | Need / omission | Smallest sufficient approach | Verification |
| --- | --- | --- | --- | --- |
| Semantic tags | PC-02/04, owner tag failure | Empty tag vocabulary prevents specific tag retrieval | Repair existing extractor classification wording; preserve storage owner | Live non-empty useful tags, local persistence/retrieval |
| Follow-up continuity | PC-02/03/04, ADR 0024 | Skipping retrieval loses known file/slot identity from extraction | Pass bounded existing conversation domains to scope classifier; clarify follow-up and baseline rules | Indirect update/reuse with same address, history, isolation and social skip |
| Docs and checks | PC-02/04, TASK_WORKFLOW | Prior explicit-name fixtures missed real behavior | Focused regressions + bounded actual-model workflow | Local/live provenance, complete core run with baseline failures identified |

### Minimum Verification Gates

- [x] Root build/typecheck.
- [x] Focused tag projection/intake and scoped reader regressions.
- [x] Real local SQLite new/changed/reinforced knowledge and reopen checks.
- [x] Bounded live provider verification of tags and indirect follow-up behavior.
- [x] Full core + membership, record independently established baseline failures.
- [x] Necessity/prompt/diff review, docs, archive, handoff, template restoration.

### Verification Budget

Inherited TASK_WORKFLOW live-verification-budget at af13c15. Serialized task-owned
budget: 10 SEK, 10 physical attempts including retries, input 16384 tokens and
output 4096 tokens per call, timeout 120 seconds. Approved existing OpenAI
`gpt-5.6-luna` via A008 embedded ACME and reviewed existing secret source only.
Input also limited by 16384 serialized UTF-8 bytes in the harness. No tools.
Price checked this session 2026-09-24: official model page
https://developers.openai.com/api/docs/models/gpt-5.6-luna, standard USD 0.20 input
and 1.20 output per million tokens; cached discount not assumed. Conservative
accounting allowance 20 SEK/USD (not market FX), reserve 0.25 SEK per attempt,
maximum 2.50 SEK across ten attempts. Unknown outcomes retain reservations.
Final usage: 10 physical attempts (call allowance exhausted), 13,312 input /
666 output tokens, estimated USD 0.0034616 / 0.069232 SEK using the stated
conservative accounting allowance. All observed usage is known; 2.50 SEK total
reservations released. No parallel worker allocations or further calls.

## References

- A008-0173 commit af13c15, local unmerged dependency retained on this branch.
- Identity claimed on local main in 636e897; brought to branch in 2547404.
- Private owner log C:\log\a008-log.txt, especially lines 147–195; no payloads
  or credentials to be copied into repository artifacts.

## Checklist

- [x] Read authority, diagnose log, claim identity and freeze Ready.
- [x] Implement within scope, verify, document and hand off.

## Decisions and Notes

No need for a new state owner or reconciliation policy: the log's wrong target
was selected before commit. Source-only ingestion prompts are reviewed but only
changed if the same in-scope defect exists. Frozen semantics remain unchanged.

## Charter Amendment Log

None.

## Verification

Root/client/protocol compilation passes. Focused regressions + membership:
132/132 pass. Final full core: 770/771 pass; the one Luna/default-model
temperature failure matches the untouched baseline documented in A008-0173.
Targeted lint reports only the same pre-existing non-null assertion.

Actual Luna probes generated tags and retrieved indirect follow-up state.
After clarifying actual property reuse, reinforcement applied; an indirect
orange-yellow update preserved the original semantic address. Real SQLite
reopen retained one current value, prior teal history and useful tags, reachable
by tag-only retrieval. Social classification still skipped retrieval.
Local fixture coverage verifies conversation isolation and bounded scope input.

Two harness field errors were corrected and an initial missed reinforcement
was recorded; these were resumed bounded probes, not an uninterrupted GUI run.
All provenance, accounting, artifacts and limitations are in
docs/handoffs/A008-0174.md. Final necessity and diff review pass.

## Documentation Updates

CURRENT_MEMORY_MODEL, SYSTEMDOC, CURRENT_STATUS, task index/archive/handoff.
FILESTRUCTURE only if new paths; journal belongs to integration operator.

## Handoff and Follow-ups

Complete locally, pending integration with A008-0173. No push/PR/merge.
Restart host for the rebuilt code; no owner database backfill or repair.
Baseline core/Luna-default and lint failures remain independent follow-ups.
See docs/handoffs/A008-0174.md.
