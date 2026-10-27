# ADR 0064 — Durable reducer boundaries and resumable failure

Status: Accepted
Date: 2026-10-27
Decision owner: Rickard (explicit implementation approval)
Task: A008-0218

PC-LF-03/04/05/07/08/09 require completed execution to outlive model-context
projection failures. Refines ADR 0063: reduction failure stops new work but leaves
a durable, explicitly resumable run instead of terminal failure. ADR 0057's lease,
workspace verification and effect fences continue to govern recovery.

Persist complete raw rounds and prior validated state before reduction, even when
pressure-based compaction is disabled. Pending reduction is execution evidence,
not a validated summary and not semantic memory. Recovery consumes saved results;
it never executes the saved calls. Incomplete/unknown effects require reconciliation.

Atomic adoption checks run, source revision, reducer version, projection generation
and live lease. Stale results cannot replace later boundaries. Keep bounded state
size independent of bounded generation budget. Retry malformed/truncated reduction
at most twice per attempt; only confirmed truncation permits a larger output cap.
Persist retry accounting before dispatch so process replacement cannot reset it.
Exhaustion pauses durably and requires explicit resume; no automatic retry loop.

Strict structured Responses output is used on supported direct OpenAI routes;
local schema/source validation remains mandatory. Other routes retain explicit
JSON instructions with the same validator and failure policy. No tool retries,
provider fallback or knowledge-policy changes are authorized by this decision.

The GUI offers resume for reducer pauses; unknown effects retain effect review.
Verification must cover stale adoption, malformed/truncated output, restart at
persistence boundaries and unchanged completed effect counts.
