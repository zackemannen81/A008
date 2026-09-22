# Platform V3 protocol contract

Status: schema contract only (A008-0162)

`@a008/protocol` exports the accepted first-slice Platform V3 DTOs from
`packages/protocol/src/platform-v3.ts`. Its generated JSON Schema and OpenAPI
artifacts live under `packages/protocol/schemas/platform-v3*.json` and are
regenerated with `npm run protocol:schemas`.

The public V3 types are prefixed `PlatformV3` and schemas/functions are
prefixed `platformV3`. The contract describes durable conversations, runs,
command receipts, body-free event notifications, bounded request/response
envelopes, and descriptive V3 route metadata. Every V3-owned object is strict:
unknown properties fail validation. Conversation message `content` deliberately
uses the existing `chatContentSchema`, preserving its established nested-content
acceptance semantics for compatibility.

This is not host wiring or an availability claim. Authentication, trusted
tenant/project/principal scope, SQLite persistence, idempotency, leasing,
execution, and HTTP status mapping remain with their later owners. A host must
not advertise `available: true` until it implements that contract.
