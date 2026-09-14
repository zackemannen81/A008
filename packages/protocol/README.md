# @a008/protocol

Shared A008 **v1** WebSocket/session wire contract. Host, core wire adapters and
web client consume this owner. It has no runtime, filesystem, provider, React or
browser-global imports. Zod 4.5.4 is its only runtime dependency.

This package is private and can be built and installed as a local tarball. Version
1.0.0 identifies this package; it does not introduce protocol negotiation or V2.

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

## Scope beyond this package

`src/routes.ts` inventories every current HTTP operation with its context/owner.
It does not route requests or advertise authorization capabilities. The complete
auth/context inventory is in `docs/HOST_PROTOCOL_V1_INVENTORY.md` in the A008
repository; `docs/HOST_PROTOCOL.md` specifies v1 behavior. Full HTTP payload
schemas for memory, projects, providers, uploads, shell and browser checks remain
with their existing owners pending the next stage-1 child of A008-0103.

No V2, new auth, project isolation, event ordering, replay, idempotency or native
platform support guarantee is introduced by this extraction.

## License

A008-owned package content is Apache-2.0 (included `LICENSE`). Zod retains its MIT
license. Portable engine builds include its notice for the bundled web client.
