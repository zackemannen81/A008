# V2 authentication foundation

A008-0110 implements public GET /v2/info and authenticated POST /v2/auth/ticket.
Only auth.tickets is advertised. V2 WebSocket dispatch, business operations and
live-socket revocation are not implemented yet; this is not a usable V2 chat API.
V1 and fixed-session ACP panels retain their existing authentication behavior.

## Owner-local device management

Build with npm run build. Run npm run device -- grant --name Phone --project
PROJECT_ID --capability session to grant a credential. Repeat --project and
--capability for explicit scope; --days accepts 1 through 30, default 30.
Grant prints JSON containing the credential once. Keep it in the client secure
store; never put it in a URL, repository, provider prompt or shared log.
Use npm run device -- list for metadata and npm run device -- revoke DEVICE_ID
to revoke. These commands run locally; no HTTP grant/revoke route is exposed.

In an extracted portable engine, use its bundled Node executable with
`dist/src/gui-host/device-cli.js` followed by the same arguments. The npm commands
above apply to the source checkout.

The default registry is ~/.a008/devices.sqlite, overridden by A008_DEVICES_PATH
outside the repository. Only SHA-256 credential hashes, names, project allow-lists,
capabilities and timestamps are persisted. SQLite transactions protect concurrent
grants. Read operations do not create storage. Each authentication/current-principal
lookup observes expiry and external CLI revocation. No real grants were created
by implementation verification; all proof uses temporary synthetic data.

## HTTP and ticket semantics

Device requests use Authorization: Bearer with the granted credential. Configured
PIN login cookies supply an owner-browser profile. A disabled PIN never grants
anonymous V2 authority. An explicit invalid Bearer credential does not fall back
to a cookie. Existing Origin checks apply, including requests without Origin.
Discovery reveals protocol, server instance, profiles, features and limits only.

Ticket JSON contains projectId and optionally sessionId. Issuance requires session
capability and an existing registered authorized project. Session-bound issuance
currently fails closed because the V2 session owner is not wired yet. A ticket
expires after 30 seconds or the device expiry, whichever comes first. Consumption
is one use and rechecks credential/project authority. Capacity is 128 outstanding
tickets per principal and 4096 per host; expired entries are removed on issue.
Responses use Cache-Control: no-store and structured errors without credential or
host-path details. First-frame WebSocket authentication is a subsequent task.

Schemas and the generated OpenAPI description live in packages/protocol/schemas
(v2-*.schema.json and v2-auth.openapi.json). They derive from the shared v2-auth.ts.
The independently installed package proof compiles and executes the V2 contract.
