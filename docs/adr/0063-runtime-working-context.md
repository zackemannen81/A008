# ADR 0063 — Runtime working-context projection

Status: Accepted
Date: 2026-10-25
Decision owner: Rickard
Task: A008-0216

## Decision

PC-LF-03/04 and the owner's priority instruction require model context to project
current work. ADR 0061's label-only representation applies to worker and extractor;
knowledge IDs, evidence and semantic addresses remain internal. The extractor
references retrieved items by one-based position, resolved before existing
reinforcement/state-update validation. History/provenance remain conditional on
the existing retrieval result; no ranking, decay or storage change.

The product CLI/ACP/GUI runtime offers a tool-name/short-description catalog and
one metadata-selection tool. Selection atomically replaces the loaded schema set;
selected schemas retain exact parameters and strictness. Unloaded tools cannot
execute. Selection does not grant permissions and has no external effect; it is
recorded in existing raw evidence so checkpoint validation remains complete.
Selection counts against the existing tool-call budget.

Completed rounds are reduced incrementally, even when pressure-based durable
checkpointing is disabled. At most the newest complete round remains raw (zero
when explicitly configured). The worker view contains statements rather than
internal source IDs. Reducer validation retains source-reference coverage
internally. The reducer sees public tool observations, never opaque reasoning
tokens; failed/oversized/invalid compaction stops instead of growing input.
Existing opt-in exact-wire pressure/checkpoint and effect fences retain their
authority. Projection alone does not enable durable recovery on disabled routes.

Recent dialogue is represented as bounded excerpts of up to two completed turns,
explicitly identified as untrusted excerpts rather than verified semantic facts.
It is separate from the clean current message and available to retrieval
classification. Durable dialogue is not rewritten.

Native Responses uses complete manually supplied context rather than an implicit
server-side history chain: exact function-call items and opaque reasoning items
are retained with the recent complete round. Requests use store=false and request
encrypted reasoning continuation. No previous_response_id is combined with a
compacted replacement history. Checkpoint evidence and consumed call IDs remain
execution authority; summaries never authorize replay. ACME continues to own
model execution; A008's existing wire augmentation carries the opaque items.

## Verification and limits

Local fixtures cover a 106-tool catalog, ten effects with bounded worker context,
invalid selections, oversized schemas, cancelled/invalid reduction, label parity,
internal identity resolution and actual embedded ACME Responses serialization.
Process recovery and negative paths verify the existing fences.
No live provider latency, token-cost saving or KIE acceptance claim follows from
local fixtures. Reducing completed rounds adds bounded model work and is not an
incremental semantic-memory-intake pipeline.
