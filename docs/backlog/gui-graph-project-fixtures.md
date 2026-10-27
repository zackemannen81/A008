# GUI fixture mismatches observed during reducer recovery verification

Status: Proposed
Observed: 2026-10-27, A008-0218

Full GUI suite: 233/235 pass. Failures are `graph clusters neighbour records by
primary domain around a hub` and `Projects wizard renders New, Recent and
continuity controls`. The graph/project implementation and their test files are
unchanged in 0218. Reducer resume changes app.tsx and durable-chat-client.ts only;
real-host resume behavior is tested separately. No full-green GUI claim is made.

Outcome: reconcile these assertions with approved graph and project UI behavior,
without changing runtime recovery or weakening tests. Not active: unrelated to
completed-round persistence or reducer pause. Verify the two cases and full GUI
suite when this bounded fixture repair is activated.
