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

## Platform V3

`createPlatformV3Client` is the thin HTTP client for the accepted Platform V3
resource contract. It takes the same injected `fetch`, `origin` and credential
adapter as the existing HTTP helpers. It validates request bodies before network
I/O and validates every response before returning it. It performs one attempt
per operation: callers retain `commandId` and explicitly reissue an identical
`createRun` only when they choose to recover a durable receipt.

```ts
import { bearerCredentials, createPlatformV3Client } from "@a008/client";

const platform = createPlatformV3Client({
  origin: "https://a008.example",
  credentials: bearerCredentials(deviceSecret),
  fetch,
});
const { run } = await platform.createRun("conversation_1", {
  commandId: "caller_generated_command_1",
  expectedRevision: 0,
  model: "model_1",
  text: "Hello",
});
```

`PlatformV3ClientError` exposes a typed `code`, optional HTTP `status`, and
message. Transport and malformed-response failures are not returned as success.
The SDK has no hidden polling, retry, cancellation-on-disposal or server-run
ownership. V3 schema availability does not imply a V3 host is available.

`createHttpClient` also exposes `listSidebarProjects`, `updateProject` (display
name/pin) and `changeProjectChat` (`new` or `open` with a conversation ID). These
use the authenticated V1 standalone workspace routes. After changing the selected
chat, reconnect the GUI session to hydrate that chat; these calls never submit a
model prompt or replay execution.

```sh
npm run build:protocol
npm run build:client
npm pack ./packages/client
npm run verify:client
```

Cookie adapter: `credentials: same-origin`, no secret in JavaScript.
Bearer adapter: `Authorization` header, never a URL query.
Engine adapter: existing panel capability on HTTP Bearer and V1 socket `access`.
