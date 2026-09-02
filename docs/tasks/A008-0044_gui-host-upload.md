# Task A008-0044 — GUI host upload route and blob store

Status: Ready
Owner: operator-delegated
Parent: A008-0041
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0044-gui-host-upload`

## Goal

`POST /v1/upload` accepts a file, stores the original outside the repository
under a content-addressed locator, and asks the ACP process to ingest it.

## Primary deliverable

The route from ADR 0020 D3, a blob store, and a bridge method that sends
`_a008/source/ingest`.

## In scope

- `src/gui-host/**`
- New cases in the existing `test/gui-host.test.ts`, and
  `test/gui-host/` helpers
- `package.json` only if a new test file is added

## Out of scope

- `src/ingest/**`, `src/runtime/**`, `src/acp/**`, `gui/**` — owned by siblings
- Extraction itself. The host stores bytes and sends a locator; it never reads
  file content and never makes a provider call (ADR 0020 D1).
- Multipart form parsing. The body is raw bytes with the filename in a header,
  per ADR 0020 D3.

## Definition of done

- `POST /v1/upload` writes the original to the configured store and returns
  `{ locator, sha256, bytes, mediaType, extracted, artifactId? }`.
- The byte cap is enforced while reading, not after, so an oversized upload is
  refused without buffering it whole.
- The origin guard rejects a cross-origin caller exactly as `POST /v1/shell`
  does.
- The declared filename is sanitised and never decides the media type or escapes
  the store directory.
- The same bytes uploaded twice produce the same locator and do not duplicate
  the stored blob.
- `AcpBridge` gains a method that sends `_a008/source/ingest` and returns its
  result.

## Minimum verification gates

- [ ] A test that an oversized body is refused and nothing is written.
- [ ] A test that a filename containing `..`, a path separator, or a null byte
      cannot place a file outside the store directory.
- [ ] A test that a cross-origin `POST /v1/upload` is refused with 403.
- [ ] A test that the same bytes twice yield one stored blob and one locator.
- [ ] A test that the bridge sends `_a008/source/ingest` with the locator and
      surfaces its result, driven by the existing injected-bridge fake.
- [ ] A test that no response body and no frame contains `NVIDIA_API_KEY` or an
      authorization header, using the existing `assertWireClean` helper.
- [ ] `npm run typecheck` clean and `npm test` green.

## References

- [`../adr/0020-source-upload-ingest.md`](../adr/0020-source-upload-ingest.md) D1, D2, D3, D4
- [`../adr/0019-a008-owned-gui.md`](../adr/0019-a008-owned-gui.md) D3, D6
- `src/gui-host/origin.ts` and the `POST /v1/shell` handler are the pattern
