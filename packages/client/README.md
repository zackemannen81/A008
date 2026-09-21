# @a008/client

Platform-independent A008 HTTP/WebSocket client. Host, memory, tools and
providers stay on the server. This package does not import Node, React, the
A008 runtime or GUI modules. Zod is consumed through `@a008/protocol`.

Inject `fetch`, a WebSocket constructor and a credential adapter.

```ts
import {
  bearerCredentials,
  createV2SessionClient,
  cookieCredentials,
  createGuiSessionClient,
} from "@a008/client";

const v2 = createV2SessionClient({
  origin: "https://a008.example",
  projectId: "A008_v1_project_...",
  credentials: bearerCredentials(deviceSecret),
  fetch,
  webSocket: WebSocket,
});
await v2.connect();
await v2.prompt("Hello");
```

The bundled web GUI uses `createGuiSessionClient` (V1 session adapter) so
PIN-disabled standalone hosts, engine-panel capabilities, prompt attachments
and in-session image generation keep working. Independent consumers use the
V2 adapter. The SDK never auto-resubmits a mutation after `COMMAND_UNKNOWN`
or `SESSION_EXPIRED`.

```sh
npm run build:protocol
npm run build:client
npm pack ./packages/client
npm run verify:client
```

Cookie adapter: `credentials: same-origin`, no secret in JavaScript.
Bearer adapter: `Authorization` header, never a URL query.
Engine adapter: existing panel capability on HTTP Bearer and V1 socket `access`.
