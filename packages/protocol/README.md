# @a008/protocol

Shared A008 v1 HTTP/WebSocket contract plus the implemented V2 authentication and session wire schemas. Host, core wire adapters and web/client consumers use this owner. It has no runtime, filesystem, provider, React or
browser-global imports. Zod 4.5.4 is its only runtime dependency.

This package is private and can be built and installed as a local tarball. Version
1.0.0 identifies this private package build; V1 compatibility remains frozen while exported V2 schemas describe the separately negotiated `a008.v2` surface.

```sh
npm run build:protocol
npm pack ./packages/protocol
npm run verify:protocol
```

Install the resulting tarball in a separate application to use the public entry:

```ts
import {
  encodeClientMessage, parseServerMessage, type ClientMessage,
} from "@a008/protocol";

const command: ClientMessage = { type: "session/new", requestId: "example-1" };
const outgoing = encodeClientMessage(command);
const incoming = parseServerMessage(JSON.parse(receivedText));
```

The caller supplies transport, authentication and `receivedText`. This is a
contract package, not a connection/recovery SDK. Repository consumers import the
same source directly; root TypeScript emits `dist/packages/protocol/src`, while
the independent package build emits `packages/protocol/dist`. The engine bundler
includes the former and the installed-package verification uses the latter.

## Contract ownership and compatibility

- `src/schemas.ts` owns wire shapes and inferred TypeScript types for commands,
  replies, events, snapshots, session parameters, model metadata and runtime
  preferences. Core adapters specialize runtime types without adding transport
  dependencies to this package. Runtime policy remains with the core.
- `src/host-parser.ts` and `src/client-parser.ts` own the existing v1 acceptance,
  serialization, error text and normalization behavior. Use these entry points
  when matching existing clients/hosts. Errors are not newly standardized codes.
- `schemas/` contains generated JSON Schema 2020-12 descriptions. Regenerate with
  `npm run protocol:schemas` at repository root; tests reject drift from the owner.
  `clientMessage` describes valid commands and `serverMessage` describes normalized
  replies accepted by the client. `hostServerMessage` requires the resume token
  emitted by the current host; the reader still accepts older new-session replies
  without one. Unknown server event types are ignored by `parseServerMessage`.
- JSON Schema is structural. Runtime preference budget keys must also match the
  unique declared fields, integer bounds and settings/default values. The shared
  validator enforces those cross-field rules; exported JSON Schema cannot express
  them. Provider limits and configure mutations are validated by existing core
  policy, not by this transport package.
- Additive object keys are accepted. `parseSessionSnapshot` and the boolean guards
  validate while preserving the original object, including extension fields.
  Calling a Zod object's `.parse()` directly returns its normalized shape and may
  strip unknown keys; it is not a lossless forwarding operation.
- Old tolerance is deliberate: command identifiers reject whitespace-only values;
  some reply identifiers only require a nonempty string. The error parser drops
  malformed optional IDs. Empty permission IDs are syntactically accepted but
  still need to match a pending permission. None of these properties grants
  permission or changes session ownership.

`fixtures/v1-compatibility.json` captures 90 synthetic pre-extraction cases:
43 host inputs and 47 client inputs, with normalized outputs or exact errors.
Tests additionally validate real host WebSocket frames and `/v1/models` responses.
`npm run verify:protocol` packs the package and its dependency, installs both offline
outside A008, compiles a separate TypeScript consumer and executes it.

## HTTP contract (A008-0105)

`src/http-schemas.ts` owns the HTTP DTOs and schemas. `src/http-operations.ts`
binds all 22 inventory rows (23 methods including static GET/HEAD) to bodies,
queries, path/header parameters and responses. Its pure `v1OpenApiDocument()`
derives `schemas/http.openapi.json` from the same schemas; regenerate with
`npm run protocol:schemas`. This artifact uses
[OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html); it adds no served endpoint.

The installed package exports `httpContractSchemas`, `v1HttpOperations` and
`validateV1HttpResponse(method, canonicalPath, status, payload)`. The last helper
validates JSON responses using an inventory path without query parameters;
binary/static content must be checked as bytes/headers. The OpenAPI asset path is
descriptive: the router also serves root and nested assets. Upload input is raw
octet-stream, and image blobs are bytes. HEAD has no body even on errors.

Request schemas describe transport envelopes, not guaranteed successful
execution. Bootstrap defaults, path checks, project ID checks, provider limits
and credential/storage validation stay with their existing owners. V1 bootstrap
accepts omitted optional groups; provider settings ignore wrongly typed optional
fields. Raw input schemas describe that tolerance separately from typed writer
DTOs (`ProjectBootstrapConfig`, `ProviderSettingsUpdate`). Memory HTTP integers
are decoded from digit strings by the host, duplicate/unknown query keys fail,
and its existing owner normalizes labels and supplies defaults.

`parseMemorySnapshot`, `parseUploadedSource`, `parseShellHostResult` and
`parseFrameCheck` preserve the old client behavior, with 52 captured synthetic
baseline cases. Memory returns the original object; upload/shell construct their
normalized results. Frame checks retain their optimistic fallback. Project,
catalog, provider and image clients that previously cast responses still do so;
this extraction does not start rejecting their previously tolerated input.
The shared strict output schemas describe supported producer output, including
the current model list's `added` flag; the older model reader retains its tolerance. Graph edge
membership additionally requires the shared memory validator; structural JSON
Schema cannot express membership in the returned node set.

Every HTTP operation is exercised against a real loopback host with fake provider
responses and temporary files. Successes and representative auth/origin, content,
input and ingestion-failure paths are checked. Provider policy and original error
messages remain covered by existing tests. No provider credentials enter fixtures.

## Scope beyond this package

`src/routes.ts` inventories every current HTTP operation with its context/owner.
It does not route requests or advertise authorization capabilities. The complete
auth/context inventory is in `docs/HOST_PROTOCOL_V1_INVENTORY.md` in the A008
repository; `docs/HOST_PROTOCOL.md` specifies v1 behavior. HTTP payload contracts
now live here; their runtime behavior remains with the existing owners. Auth
profiles depend on host configuration, so the OpenAPI alternatives include both
unauthenticated standalone mode and configured cookie/engine-token access.

V2 authentication/session schemas are now exported, but event ordering, replay/reconnect, idempotency and native platform support remain outside the protocol package guarantee until their owning stages land.

## License

A008-owned package content is Apache-2.0 (included `LICENSE`). Zod retains its MIT
license. Portable engine builds include its notice for the bundled web client.

A008-0110 exports V2 authentication/discovery/error schemas and generated auth OpenAPI. A008-0112 adds V2 session client/server frame schemas for first-frame ticket authentication, commands/results/signals and structured errors. `/v2/session` availability is a host behavior; this package supplies transport-independent shapes only. Existing v1 exports remain compatible.
