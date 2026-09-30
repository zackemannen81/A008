# ADR 0059 — Durable GUI live observation

Status: Accepted
Date: 2026-09-30
Decision owner: Rickard (restore live GUI streaming and visible user messages)
Task: A008-0201

## Decision and authority

PC-LF-05/07/08/09 and ADR 0055 keep durable history and execution in the host.
The GUI must observe live output without controlling background run lifetime.

The existing authenticated GUI activity endpoint supports optional
`afterLive=<liveRevision>`. An opaque host-lifetime revision identifies the
current live snapshot, including transient thought changes. If unchanged, the
request waits for an activity notification or at most 25 seconds; otherwise it
returns immediately. The response is the current cumulative snapshot, not a
delta to append. An observer reconnects by reading current state and waiting
from that revision. Durable event cursors and persistence remain independent.

Waiters are removed on disconnect/timeout. Project/principal authorization is
checked before waiting and again before delivery. Closing a wait never cancels
a run or session process. Existing regular view polling remains for lifecycle
status and reconnect fallback; live text no longer waits for its fixed interval.
Private thoughts remain ephemeral and are not added to durable activity events.

GUI message composition uses the durable transcript as authoritative. A live
process snapshot may contribute a suffix only when its messages contain the
whole durable prefix, compared by role/content. It may not remove a newly
accepted user message. Outgoing text is displayed optimistically, marked as
uncommitted, and reconciled using the accepted run identity rather than text
equality. Identical consecutive submissions therefore remain distinct. Failed
submission retains visible attempted text/error without automatic run retry.
Selection epochs and abortable observers reject stale cross-chat responses.

## Consequences

This is event-driven long polling through the existing HTTP credential/client
boundary, not an additional execution scheduler or synthetic token animation.
Network/provider batching can still combine updates. Each response carries a
cumulative snapshot, favoring straightforward recovery over delta bookkeeping.
LiveRevision is additive and optional; older clients keep polling and responses
without the field do not start the new wait loop. Public durable event semantics,
workspaces, effect fencing and provider adapters remain unchanged.

The task verifies real provider-stream fixtures through the installed ACME
package, child process, host and two GUI clients, with ordinary polling delayed
to 60 seconds. No live-provider cadence or persistent thought history is promised.
