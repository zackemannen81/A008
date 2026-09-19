# A008 client API V2 target

Status: Accepted target - ADR 0041; implementation is tracked in A008-0103
Date: 2026-09-14

This records decisions for the implementation sequence. It is not a claim that
these endpoints or guarantees exist yet. Current v1 remains in
[HOST_PROTOCOL.md](HOST_PROTOCOL.md). The frozen program is
[A008-0103](tasks/A008-0103_stable-client-api-program.md).

## Project and runtime binding

The server resolves public project IDs through its configured project registry.
Clients never select arbitrary storage paths. A binding owns canonical cwd,
public/runtime project ID, memory mode and exact SQLite/source-store paths.
Canonicalization resolves symlinks/junctions and normalizes Windows path case.
Read existing sidecars/registry entries before creating anything; conflicting
IDs, paths or live owners return `PROJECT_BINDING_CONFLICT`. Missing/unreadable
configured existing storage fails explicitly rather than creating empty state.
New-project creation is the only normal path that allocates new storage/identity.

Standalone registered projects use their stored project ID and global-memory
flag. They keep the current configured/default global SQLite file, with the
project ID selecting its namespace; disabled memory remains process-local.
Engine projects retain their existing hash-of-canonical-cwd data layout and
sidecar identity. The existing explicit legacy attachment overrides that layout
only for its named cwd. An existing project with competing standalone and engine
bindings requires an explicit selected attachment, never heuristic merging.

The shared registry owns runtime creation/disposal. A session records its binding
once. Different sessions in one project share that runtime, while their chats,
controls, tool sessions and permission queues remain independent. V1 workspace
switches affect only its compatibility sessions. Before enabling combined V1/V2
ownership, route overlapping bindings through the shared owner or reject the
conflict; never silently run a second cached writer over the same namespace.

The registry's public API supports exact explicit attachments and current engine
binding resolution separately. Unknown project IDs are not treated as paths.
Shutdown fences new work, awaits initialization and active cancellation, closes
sessions/tools and disposes each runtime once.

## Transport and identities

Use `/v2` and WebSocket `/v2/session` with subprotocol `a008.v2`. A fresh random
`serverInstanceId` identifies each host process. `GET /v2/info` is public but
returns only protocol/version, auth profiles, feature availability and limits;
it contains no project/session/credential data. Unsupported protocol versions
fail before business operations; never fall back silently to changed V1 meaning.

Identifiers are opaque strings. `projectId` retains A008's existing identity;
`connectionId`, `sessionId`, `turnId`, `commandId` and `requestId` serve different
purposes. A request ID correlates one attempt; command ID deduplicates a mutation
across attempts. Turn ID identifies execution, not a network request or message.
Every authenticated reply identifies its server instance. IDs alone never grant
access. Cross-project session references fail before invoking the runtime.

After authentication one socket is bound to one project and at most one attached
session. Use additional sockets for separate active sessions. Commands carry
`type: command`, `requestId`, `action`, applicable `projectId`/`sessionId`, and
an action-specific payload; mutating commands also require `commandId`.
Actions: `session/new`, `session/resume`, `session/inspect`, `session/prompt`,
`session/cancel`, `session/control`, `tool/permission`. Unknown actions fail.
Control actions reuse supported core controls and their runtime policy.

Replies are `result` or `error`, correlated by request ID and command ID when
provided. Errors carry `{ code, message, retryable }` and no stack/secrets; use
codes for control flow. Stable initial codes include `INVALID_REQUEST`,
`UNAUTHENTICATED`, `FORBIDDEN`, `UNSUPPORTED_VERSION`, `PROJECT_NOT_FOUND`,
`PROJECT_BINDING_CONFLICT`, `SESSION_NOT_FOUND`, `SESSION_CONFLICT`,
`SESSION_EXPIRED`, `BUSY`, `STALE_REVISION`, `COMMAND_CONFLICT`,
`COMMAND_UNKNOWN`, `CAPACITY_EXCEEDED`, `SNAPSHOT_TOO_LARGE`, `RUNTIME_FAILED`.
Retryable never grants automatic mutation replay with an unknown outcome.

## HTTP scope mapping

| V2 operation group | Context and initial capability |
| --- | --- |
| `/v2/info` | Public discovery, no host data |
| POST `/v2/auth/ticket` | Authenticated principal; selected authorized project/session |
| GET `/v2/projects` | Principal's allowed projects; names and IDs |
| GET `/v2/models` | Authenticated model metadata |
| GET `/v2/projects/{projectId}/sessions/{sessionId}` | Owned session snapshot; `session` |
| GET `/v2/projects/{projectId}/commands/{commandId}` | Principal-owned bounded receipt; originating command capability |
| GET `/v2/projects/{projectId}/memory` | Project binding; `memory` |
| POST `/v2/projects/{projectId}/upload` | Project source store plus ingest; `upload` |
| POST `/v2/projects/{projectId}/images` and GET its `/blobs/{sha256}/{name}` | Project output store; `images` or authorized source read |
| POST `/v2/projects/{projectId}/shell` | Bound cwd; `shell` |
| `/v2/projects/browse`, `/preview`, `/bootstrap` | Host administration; `projects:admin`; creation returns a binding, not global selection |
| `/v2/catalog/*`, `/v2/provider-settings` | Existing provider administration; `providers:admin` |
| GET `/v2/browser/frame-check` | Existing host network probe; `browser:probe` |

Source retrieval may also use `upload` scope for its own project. Model reads
do not require provider administration. Settings remain with the existing global
owner and optimistic revision; changing them does not secretly change project
ownership. Session controls require attached-writer authority. Existing GUI
functions remain available through V2 capabilities or explicit V1/panel adapters.

Public V2 DTOs contain project identity, model/parameters, committed messages with
IDs, active turn, supported controls and allowed tool metadata. Host absolute
cwd/storage paths are omitted for ordinary device grants; administrative browser
views may request workspace metadata through their explicit rights. Snapshot
adapters never change memory content, record IDs or runtime ownership.

## Authentication and approval

The configured browser PIN cookie remains an owner browser profile. Existing
V1 panel capabilities retain their fixed-session ACP meaning and are not generic
device accounts. Initial V2 native registration is owner-local grant/revoke tooling:
random 32-byte secret, unique device principal, explicit project allow-list and
capabilities, 30-day expiry by default, stored SHA-256 hash outside the repository.
Grant output exposes the secret once; only the client secure store keeps it.
No raw secret is placed in project settings, URLs, fixture logs or provider data.

Device HTTP uses Bearer authorization over HTTPS externally. A missing configured
V2 credential profile is a configuration error, never anonymous app authority.
Web same-origin cookies remain HttpOnly. Issuing a WS ticket checks Origin, auth,
project and optional session; tickets expire after 30 seconds, are single use and
are bound to principal/project/session scope. The first WS frame authenticates
with that ticket within five seconds; reject business frames before auth.
Apply current allowed-Origin policy, including its non-browser/no-Origin case;
Origin is not a replacement for the ticket. Cap pre-auth payload at 4 KiB.

Capabilities and expiry are rechecked per operation. Revocation denies new
requests, closes active device sockets, cancels their owned work and resolves
their pending permissions as denied. No Allow-all state survives reconnect.
Tool permission IDs are one-use and bound to principal/session/turn/tool call.
Stale, duplicate, cross-session and post-cancel approvals cannot execute tools.
User shell commands still require explicit shell capability; model text cannot
invoke that route or grant approval. Provider secrets are write-only admin input.

## Sessions, turns, events and snapshots

One attached writer and one active turn per session. Resume requires the same
authorized principal, matching project/session and an opaque resume capability
held in client memory. The server rejects an already attached session. Detach
aborts active work and denies pending permissions, then starts a 45-second lease.
Resume during that lease reattaches surviving state; expiry/close/restart destroys
resume authority. Removing an SDK instance disconnects; explicit Close closes.

Turn outcomes are `completed`, `cancelled`, `interrupted` or `failed`. An answer's
completion and post-output memory outcome are separate fields. Runtime adapters
report observed memory status, or `unreported` when unavailable; they must not
invent successful persistence. Cancellation does not undo completed side effects.
No reconnect operation automatically regenerates an answer or reruns a tool.

Events carry session ID, applicable turn ID and increasing `sequence`, scoped
to server instance/session. Event kinds cover turn start, answer/thought deltas,
tool activity, permission requests, state change and terminal outcome. Snapshots
carry the sequence they represent and stable committed-message IDs. Reset/undo
retire affected message IDs; do not renumber surviving messages into other ones.

Subscribe/capture/response/drain is one ordered server operation: install the
subscription, capture authoritative snapshot and sequence, send the snapshot,
then deliver only subsequent events. The client discards older events and uses
the snapshot as replacement state. No event may be lost between snapshot and
subscription. Thought streams are transient, excluded from snapshots, memory,
command receipts and durable/replay logs. This phase requires no event replay.

Limits are advertised: initial prompt text 64 KiB, authenticated input frame
1 MiB, snapshot/output frame 8 MiB. Enforce before expensive processing. An
oversized snapshot returns `SNAPSHOT_TOO_LARGE`, never silently truncated history.
Bound slow-client queues and disconnect on overflow with recovery instructions.
HTTP JSON/binary limits preserve existing route bounds until explicitly revised.

## Command receipts and uncertainty

Mutations use a stable command ID. The owner indexes `(principal, commandId)` with
a canonical payload digest including action/project/session. Identical attempts
observe the same running or terminal receipt; changed content returns conflict.
Do not repeat approval resolution or provider/tool calls. Receipt lookup is
authorized exactly like the originating operation. Replies must redact secrets;
credential mutation receipts never retain submitted secret values.

Initial completed receipt retention is five minutes, up to 1,024 entries per
principal. Never evict an unexpired or running receipt to accept another mutation;
return capacity exceeded instead. Retention starts at settlement; active work
remains identifiable until settled or process loss. Expired/unknown receipts
return `COMMAND_UNKNOWN`. Server restart changes instance ID. In either case the
SDK must surface uncertainty rather than inventing failure or auto-resubmitting.
These are bounded process-local guarantees, not durable exactly-once execution.

Implementation status: A008-0138 implements this receipt/idempotency slice for V2 session mutations. `session/inspect` and read-only `session/control { action: "inspect" }` do not require a command ID. Receipt lookup is authenticated at `GET /v2/projects/{projectId}/commands/{commandId}`. Reconnect/resume lease and restart uncertainty remain A008-0139/A008-0140 work.

## Implementation and release gates

Stages remain ordered: shared project/session owner; V2/auth; turn/recovery;
independent SDK and full web migration; minimal real Expo proof; compatibility
release. Each implementation freezes a bounded charter under A008-0103.

Verify independent projects, conflicting bindings, existing knowledge attachment,
shutdown races, wrong project/session, auth/revocation/ticket replay, duplicate
commands, snapshot/event interleaving, late events, cancellation during approval,
lease expiry, server restart and partial memory outcomes. Keep V1 and ACP panel
contract/package tests. Native proof must use an installed SDK without runtime/GUI
source imports and verify local plus actual external auth and background-return
behavior. Simulator/web evidence alone cannot claim physical native verification.

Freeze the first client fixture and run it against a compatible future backend
change before declaring the release gate complete. The final supported-version
matrix and deprecation conditions govern removal of V1; this document removes none.
