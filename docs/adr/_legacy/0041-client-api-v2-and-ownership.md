# ADR 0041 - Client API V2 and ownership

Status: Accepted
Date: 2026-09-14
Task: A008-0106
Refines: ADR 0040, PC-01/04/05/06

## Authority and scope

The owner explicitly delegated the remaining decisions/implementation within the
frozen A008-0103 program and authorized push/PR/merge after every completed task.
This decision resolves the stage-1 proposal and prerequisites for stages 2-4.
[CLIENT_API_V2.md](../CLIENT_API_V2.md) records the chosen wire/lifecycle design;
it is an accepted target until the owning implementation tasks verify it.

One owner, one backend and multiple client types remain the target. Existing v1
and ACP/panels remain supported. No PostgreSQL, durable chat, offline sync,
background run survival or simultaneous writers to one session is introduced.

## Decisions

1. Extract the engine's canonical-project runtime registry into a reusable owner.
   A host/session facade borrows runtimes from that owner; UI selection never
   changes the runtime of an existing V2 session. A runtime is retained until
   host shutdown; session close releases session/tools only. Concurrent creation,
   shutdown and canonical path aliases must not create duplicate owners.
2. A project binding contains canonical cwd, project ID, SQLite namespace/file
   and optional source store. A008's existing IDs remain identities. Registered
   standalone projects retain their explicit IDs and existing global-memory
   choice; the configured/default SQLite path is reused with that namespace.
   Existing engine projects retain their hashed data directory and sidecar ID.
   Explicit legacy attachment requires exact paths and existing identity. A
   conflicting binding fails before opening/writing stores; no automatic copy,
   move, merge or empty replacement is a migration strategy.
3. One in-process runtime owns each canonical binding. Multiple project namespaces
   can share the existing global SQLite file; the same namespace cannot be opened
   by competing runtime objects. Source-store sharing alone is not a second
   knowledge owner. This refines the plan's storage-owner wording for the current
   global namespace design. Cross-process ownership must also be excluded before
   V2 and a separate standalone/ACP process can write the same namespace. Existing
   v1-only deployment behavior is preserved until the compatible facade is active.
4. V2 is additive under `/v2`, WebSocket subprotocol `a008.v2`. V1 keeps its current
   paths, payload/error tolerance, PIN handling and reconnect semantics. Client
   packages provide explicit V1 and V2 adapters; the UI does not implement either
   wire parser. Legacy ACP panels use the V1 adapter until V2 panel attachment is
   separately supported; their ACP-owned permissions/lifetime remain intact.
5. Separate connection, session, turn, command and server-instance identities.
   V2 permits one attached writer and one active turn per session. A second writer
   receives conflict. Different projects/sessions can run independently. Detach
   cancels active work and denies pending permissions; a 45-second lease permits
   reconnect to the same process's surviving state. Explicit close and process
   restart invalidate resume authority. These are V2 initial policy choices,
   not a claim that a session is conceptually the same thing as a socket.
6. HTTP auth has configured browser-cookie, registered-device and legacy-panel
   profiles. V2 business operations require authentication even if V1 is running
   without a PIN. No provider key is an app credential. Owner-local device grant
   and revoke is the first registration mechanism; it produces expiring scoped
   random credentials, stores only hashes and returns secrets once. Native secure
   storage and actual remote edge access are required platform proof gates.
7. WebSocket authentication uses a scoped one-use HTTP-issued ticket in the first
   frame, not a long-lived credential in the URL. Existing Origin checks remain.
   Authorize HTTP and WS against the same principal, project and capability data.
   Revocation closes live sockets/cancels owned work and prevents later approvals.
8. Snapshot/event ordering, bounded command receipts and explicit terminal outcomes
   follow CLIENT_API_V2.md. Do not store or replay thought streams. A failed/unknown
   post-output memory outcome is distinct from successful answer completion.
   Neither reconnect nor a retry may replay a completed model/tool turn merely
   to retry persistence.

## Consequences and required evidence

The current extraction is reusable and v1 compatibility remains testable. V2 can
later replace its storage/lifetime policies without conflating client transport
and runtime ownership. Future durability/multiple-writer decisions will still
require implementation and migration; this ADR makes no zero-rework promise.

Before stage 2 closes, prove two clients/projects are isolated, alias/concurrent
open/shutdown are safe, wrong project/session pairs fail and existing knowledge
survives attachment/restart. Before V2 publication, prove authentication,
capability isolation, revocation, expired/reused tickets, message limits, snapshot
ordering, command retries and approvals through real host boundaries. Before
native support is claimed, run the independent installed SDK client on the
actual target platform and external address; web simulation alone is insufficient.
