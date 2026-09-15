# V2 authentication and session transport

A008-0110 implements public `GET /v2/info`, authenticated `POST /v2/auth/ticket` and local device grants. A008-0112 adds the usable authenticated `WS /v2/session` transport. V1 and fixed-session ACP panels retain their existing authentication behavior. Stage 4 recovery/idempotency semantics are not implemented yet.

## Owner-local device management

Build with `npm run build`. Run `npm run device -- grant --name Phone --project PROJECT_ID --capability session` to grant a credential. Repeat `--project` and `--capability` for explicit scope; `--days` accepts 1 through 30, default 30. Grant prints JSON containing the credential once. Keep it in the client secure store; never put it in a URL, repository, provider prompt or shared log. Use `npm run device -- list` for metadata and `npm run device -- revoke DEVICE_ID` to revoke. These commands run locally; no HTTP grant/revoke route is exposed.

In an extracted portable engine, use its bundled Node executable with `dist/src/gui-host/device-cli.js` followed by the same arguments. The default registry is `~/.a008/devices.sqlite`, overridden by `A008_DEVICES_PATH` outside the repository. Only SHA-256 credential hashes, names, project allow-lists, capabilities and timestamps are persisted. Each current-principal lookup observes expiry and external CLI revocation.

## HTTP ticket semantics

Device requests use `Authorization: Bearer <credential>` over HTTPS externally. Configured PIN login cookies supply an owner-browser profile. A disabled PIN never grants anonymous V2 authority. An explicit invalid Bearer credential does not fall back to a cookie. Existing Origin checks apply. Discovery reveals protocol, server instance, auth profiles, features and limits only.

Ticket JSON contains `projectId` and optionally an owned `sessionId`. Issuance requires `session` capability and an existing registered authorized project; session-bound issuance requires that principal/project to own the named V2 session. A ticket expires after 30 seconds or the device expiry, whichever comes first. Consumption is one use and rechecks current authority. Capacity is 128 outstanding tickets per principal and 4096 per host. Responses use `Cache-Control: no-store` and structured errors without credential or host-path details.

## WebSocket admission and authority

Connect to `/v2/session` with WebSocket subprotocol `a008.v2`; credentials never appear in the URL. The first client frame must be `{ "type": "authenticate", "ticket": "..." }` within five seconds. Pre-auth messages are limited to 4096 bytes; authenticated input is limited to 1 MiB and output to 8 MiB. Business frames before authentication are refused.

After authentication one socket is bound to one principal/project and at most one attached session. Supported Stage-3 commands are `session/new`, `session/inspect`, `session/prompt`, `session/cancel`, `session/control` and `tool/permission`. Project scope, device existence/expiry and `session` capability are rechecked on every operation. Foreign principal/project/session references and a second writer fail before runtime work. Concurrent session creation on one socket is fenced.

Revocation or credential expiry closes the live socket, cancels owned active work and resolves pending tool permissions denied. Tool permission IDs are one-use and connection/session-bound. Outgoing V2 text passes the existing credential redactor. No reconnect/resume capability, event sequence/snapshot boundary, terminal turn outcome protocol or command-idempotency receipt is claimed until Stage 4.

Schemas live in `packages/protocol/src/v2-auth.ts` and `v2-session.ts`; generated JSON schemas/OpenAPI live under `packages/protocol/schemas`. `npm run verify:protocol` packs and installs the contract outside A008 and compiles/runs an independent TypeScript consumer.
