# Platform V3 client

Status: Independent SDK implemented (A008-0165). V3 host wiring is not implemented.

`@a008/client` exports `createPlatformV3Client`, a thin client over the strict
V3 DTO owner in `@a008/protocol`. It uses injected `fetch`, origin and the
existing cookie/bearer credential adapters. Every request is checked before
network I/O and every response is parsed before it is returned.

The client exposes `info`, conversation reads/creation, run reads/creation/
cancellation, and bounded event reads. It safely encodes path identifiers and
rejects blank and traversal-like segments. A mutation has exactly one HTTP
attempt; the client never generates or replaces `commandId`, retries ambiguous
work, polls in the background, falls back, or turns client disposal into server
run cancellation. `PlatformV3ClientError` retains validated server code/message
and status, and marks transport or malformed responses as typed client errors.

This is not V3 host wiring, a storage/client-side state owner, authentication
policy, provider execution, or a claim of V3 availability. The operator must
separately verify this same SDK against an implemented host.
