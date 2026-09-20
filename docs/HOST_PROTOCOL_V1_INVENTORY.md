# Existing host v1 surface inventory

Status: Observed implementation — A008-0104/A008-0105, 2026-09-14

This inventories the current dispatch surface, including its implicit ownership.
It does not promise the isolation or auth design planned by ADR 0040.
[HOST_PROTOCOL.md](HOST_PROTOCOL.md) owns the external behavior;
[the protocol package](../packages/protocol/README.md) owns shared session wire
shapes. `v1HttpRoutes` is a descriptive machine-readable index checked against
the dispatcher by `test/protocol-contract.test.ts`.

## Authentication and context

All `/v1/*` operations, including the WebSocket upgrade, pass the same host gate:
standalone PIN cookie when enabled, or the configured engine access token. With
neither configured, standalone v1 has no credential gate. Engine token input is
`Authorization: Bearer ...` or the existing `access` query; the panel client takes
it from its URL fragment. This is current v1 behavior, not new mobile auth.

The existing origin guard applies to the dispatcher, login and WS upgrade.
Static root/index PIN-page handling occurs before that dispatcher. No new CORS
policy, per-operation capability model or user/tenant roles are provided here.
Health/static assets carry no session state; the PIN login route exists only when
the PIN gate is enabled. Other method/path combinations follow the existing
405/404 behavior. WS upgrade uses `/v1/session`; ordinary HTTP GET does not open
a session.

Standalone project open/bootstrap/register replaces the host's global workspace and
closes its bridge; it does not select a project scoped to the requesting device.
Existing-project registration validates an already-existing root and mutates only
the external A008 project registry; it does not bootstrap that project tree.
An engine panel normally borrows one fixed ACP session, as specified in
[ENGINE.md](ENGINE.md). The shared router also exposes its host operations there;
their presence does not make them isolated project/session operations. This is a
concrete input to the subsequent ownership/auth stages.

## HTTP operations

Every `/v1/` row uses the gate above. Owners below are under `src/gui-host/` unless
qualified; `server.ts` owns dispatch and response envelopes.

| Method/path | Context and effect | Current payload/behavior owner |
| --- | --- | --- |
| GET `/health` | Public host health | `server.ts` |
| POST `/auth/login` | PIN exchange, cookie issuance, throttling | `server.ts`, `pin-auth.ts` |
| GET `/v1/models` | Host model catalog/defaults/capabilities | `provider-routes.ts`; shared `modelsResponseSchema` |
| GET `/v1/memory` | Inspection query against current bridge; fixed session in panel mode | `src/memory/knowledge/inspection.ts`, `acp-bridge.ts`, engine bridge |
| GET `/v1/browser/frame-check` | Host network probe for `url`, using embedder origin | `browser-frame.ts` |
| GET `/v1/catalog/kie` | Host curated provider catalog | `provider-routes.ts` |
| GET `/v1/catalog/nvidia` | Host catalog including upstream lookup | `provider-routes.ts` |
| POST `/v1/catalog/nvidia` | Add host catalog entry | `provider-routes.ts` |
| DELETE `/v1/catalog/nvidia` | Remove host catalog `id` | `provider-routes.ts` |
| GET `/v1/provider-settings` | Host configuration/status; credential values withheld | `provider-routes.ts` |
| POST `/v1/provider-settings` | Host configuration and write-only provider credentials | `provider-routes.ts` |
| POST `/v1/images` | Host provider job, output into host source store | `provider-routes.ts`, provider transport |
| GET `/v1/blobs/{sha256}/{name}` | Host source store bytes | `source-store.ts`, `server.ts` |
| GET `/v1/projects` | Host project registry | `project-routes.ts` |
| GET `/v1/projects/browse` | List absolute host filesystem `path` | `project-routes.ts` |
| POST `/v1/projects/preview` | Preview project creation | `project-routes.ts` |
| POST `/v1/projects/bootstrap` | Create/register project, then global workspace switch | `project-routes.ts`, `server.ts` |
| POST `/v1/projects/register` | Register an existing project root without project-tree writes, then global workspace switch | `project-routes.ts`, `server.ts` |
| POST `/v1/projects/open` | Open registered project, global workspace switch | `project-routes.ts`, `server.ts` |
| POST `/v1/shell` | Explicit user command at current host cwd | `server.ts`, `src/tools/terminal.ts` |
| POST `/v1/upload` | Binary source, filename header, host source store plus current bridge ingest | `server.ts`, `source-store.ts`, ACP source ingest |
| GET/HEAD static path | Host assets when configured; root/index login page if PIN needed | `server.ts` |

A008-0105 maps all rows to shared request/response contracts in
`packages/protocol/src/http-operations.ts`; generated
[OpenAPI](../packages/protocol/schemas/http.openapi.json) describes their payloads.
The table's owners retain runtime behavior and policy. Binary upload/blob/static
boundaries have no invented JSON envelope. Existing v1 client tolerance remains
in the shared compatibility parsers and current casting adapters.

## WebSocket operations

Commands are correlated by `requestId`; subsequent session commands require a
session owned by the socket. Resume requires the existing resume capability.
Frame shape does not replace these runtime checks.

| Client command | Context/effect | Reply/events |
| --- | --- | --- |
| `session/new` | Create in current standalone workspace or attach borrowed engine session | `session/new/ok`, optional snapshot |
| `session/resume` | Claim detached host lease using sessionId/resumeToken | `session/resume/ok`, optional snapshot |
| `prompt` | Run in owned session | `thought`, `answer`, `tool`, `tool/permission`, `prompt/ok` |
| `image/generate` | Reserve a pending generated-image conversation item and start the shared host image pipeline | `image/generate/ok` with snapshot; later `session/activity` resolves the same item |
| `cancel` | Cancel owned active work | Existing completion/error behavior; no dedicated cancel acknowledgment |
| `tool/permission` | Resolve matching pending permission once; engine approval remains ACP-owned | No dedicated acknowledgment |
| `session/control` | Inspect/reset/undo/close/model/configure/configureRuntime in owned session | `session/control/ok` with snapshot |

`error` reports request/session IDs when available. `session/activity` carries
observed borrowed-session activity, optional text/snapshot. These, plus the named
reply/event types above including `image/generate/ok`, are the current server
frame types. Snapshot `messages[].content` may be a string or typed content
parts. Message shapes, model metadata, snapshots and controls share
`packages/protocol/src`; `server.ts`, ACP and core still own execution,
authorization and state.

Disconnect still cancels active standalone work; an existing detached lease may
be resumed for 45 seconds by default. Process restart loses it. No turn IDs,
event sequence, durable replay or idempotency guarantee is added by A008-0104.

## Remaining stage-1 work

A008-0105 completes the inventoried HTTP transport extraction, with 52 frozen
legacy parser cases and a real-host test covering all operations, auth/error
paths and binary responses. The package now describes both HTTP and WS. The
stage-1 V2 decision proposal still precedes the ownership/auth implementations;
the program also requires recovery, SDK/web, independent Expo and release gates.
