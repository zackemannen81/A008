# A008-0216 — Runtime working-context projection

Task ID: A008-0216
Parent Task: A008-0213
Status: Complete
Owner: Rickard / Codex
Created: 2026-10-25
Charter frozen at: 2026-10-25

## Goal and primary deliverable

Repair model context so it represents current work rather than accumulating raw
execution history. Deliver a bounded runtime projection with label-only knowledge,
conditional qualifications, simple demand-loaded tool schemas and compact completed
work, preserving Responses tool cycles and conservative recovery.

## Scope

- One model-facing knowledge representation; internal identity/evidence mapping
  remains authoritative for reinforcement and state updates.
- Bounded recent dialogue as currentScope for retrieval classification and worker.
- Names and short descriptions for discovery, full unchanged schemas only on selection.
- Incremental compaction of completed rounds, separate raw recovery/evidence data.
- Deterministic request/wire, invalid-selection, budget, cancellation and recovery tests.
- Owning documentation, archive and handoff.

## Out of scope

Memory model/storage migrations, retrieval ranking or vocabulary policy changes,
reinforcement/decay changes, incremental semantic intake (0215 milestone 2),
new provider routes, deployment and automatic replay of external effects.

## Necessity gate

Contract revision: 757628f5afc11feb3cb4a51e2ece79b022ab4cf1.

| Authority | Observable need / omission | Smallest sufficient change | Verification |
| --- | --- | --- | --- |
| PC-LF-03; ADR 0061 | Extractor still receives long identities/full values; worker and extractor diverge | Shared allowlist, positional references mapped internally | Payload parity and identity/reinforcement tests |
| PC-LF-03/04 | Every tool schema and completed raw round repeatedly consume worker input | Runtime catalog and selection; reuse continuation reducer at completed boundaries | Large-catalog request fixtures and bounded multi-round tests |
| PC-LF-05/07/08; ADR 0057/0062 | Projection must not orphan tool outputs or repeat effects after recovery | Preserve complete recent rounds, existing used-ID/fence/checkpoint authority | Responses serialization, checkpoint/recovery and no-replay regression suites |

## Definition of done / minimum gates

- Default model-facing items contain label, with history/provenance only when relevant;
  internal identifiers and full stored records are not default representations.
- Retrieval sees the clean current message and bounded recent context. No database
  inventory or new ranking policy is introduced.
- Initial runtime requests offer the compact catalog and selection mechanism, not
  the full schema set. Selection preserves exact schemas/strictness and validation.
- Completed raw work is compacted incrementally while the recent complete tool
  cycle and recovery execution state remain intact. Compaction failure stops safely.
- Focused tests, root typecheck/build and git diff --check pass; real local wire
  fixtures distinguish application JSON from provider body. No unsupported live claims.
- Update owning docs, archive and handoff; restore current-task template before push.

## Authorization and budget

Owner approved priority implementation and normal task routing on 2026-10-25.
Identity was claimed and published on main in f71a897. Implementation is on
codex/a008-0216-runtime-context. No live provider calls planned or authorized by
this charter: 0 calls, 0 SEK. Local fixtures use dummy credentials only.

## Checklist / verification

- [x] Compare source and accepted direction; update base to current remote main.
- [x] Claim identity on main and preserve paused 0213 record.
- [x] Implement bounded runtime projection and tool discovery.
- [x] Verify model item parity and internal identity preservation.
- [x] Verify repeated rounds, provider wire semantics and recovery/no replay.
- [x] Run root gates, review necessity against final diff, update docs and handoff.

## Notes

Main contained a completed 0213 archive but a stale active 0213 record. Preserve
both; do not rewrite the immutable completed record. This child addresses the
owner's current priority and does not absorb 0215's resilience/intake programme.

## Final verification and necessity review

All delivered changes implement PC-LF-03/04 and preserve PC-LF-05/07/08 with
ADR 0061/0057/0062. No memory schema, ranking, decay, new provider, retry/replay
policy or semantic-intake pipeline was added. Supporting request augmentation,
selection receipts and effect-free artifact classification are necessary to preserve
native Responses and checkpoint semantics under the new projection.

Root build/typecheck and diff check PASS. Combined focused/expanded local suites:
290/290 PASS; actual process recovery/negative paths: 5/5 PASS, including 110 rounds
and process replacement with no replay. Native streamed/nonstreamed wire fixtures
preserve opaque reasoning and exact call bindings with exact byte measurement.
Only local fixtures: 0 live calls, 0 SEK. See docs/handoffs/A008-0216.md for checks,
measurements, exclusions and integration instructions. Journal awaits merge.
