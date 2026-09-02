# Task A008-0043 — Runtime source-ingest surface and ACP method

Status: Ready
Owner: operator-delegated
Parent: A008-0041
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0043-runtime-source-ingest`

## Goal

The ACP process can be asked to ingest a stored source by locator, and does so
through `ingest()` with the provenance the extractor chose.

## Primary deliverable

`LocalMemoryRuntime.ingestSource(...)` and the `_a008/source/ingest` ACP method
from ADR 0020 D4.

## In scope

- `src/runtime/local-memory-runtime.ts` and `src/runtime/local-runtime-config.ts`
  (the `A008_SOURCE_STORE_PATH` setting)
- `src/acp/A008-acp-agent.ts` and `src/acp/server.ts`
- New cases in the existing `test/acp-agent.test.ts`, plus
  `test/runtime-source-ingest.test.ts`
- `package.json` only to append a new test file to `test:core`

## Out of scope

- `src/ingest/**` — owned by A008-0042; consume its port, do not edit it
- `src/gui-host/**` and `gui/**` — owned by siblings
- The analyze/classify/commit coordinator. Wave 1 stores evidence only
  (ADR 0020 D7). Do not call `PostOutputMemoryCoordinator` from this path.
- Chunking. One source produces one utterance.

## Definition of done

- `A008_SOURCE_STORE_PATH` is resolved and rejected when it lands inside the
  A008 repository, exactly as `A008_MEMORY_SQLITE_PATH` is.
- A locator that escapes the store root is rejected before any file is read.
- `ingestSource` reads the stored bytes, calls the extraction registry, and
  passes the resulting `content`, `speaker`, `relation` and `contentKind`
  straight through to `ingest()`.
- `_a008/source/ingest` is registered through the SDK's custom-method overload
  and returns the shape in ADR 0020 D4.
- A client that never calls the method sees no change; the `initialize` contract
  is unaffected.

## Minimum verification gates

- [ ] A test that a locator containing `..`, an absolute path, or a symlink
      target outside the root is rejected **before** any read, proven by a store
      root containing a file the test asserts was never opened.
- [ ] A test that a text source ingests with `relation: "appears_in"` and the
      artifact's locator preserved.
- [ ] A test that the extractor's chosen `speaker` and `relation` reach the
      stored provenance record unaltered, driven by a fake extractor returning
      `derived_from`.
- [ ] A test that an unsupported media type surfaces the named error and writes
      no artifact, utterance, or provenance.
- [ ] A test that the existing `initialize` contract is unchanged.
- [ ] `npm run typecheck` clean and `npm test` green.

## References

- [`../adr/0020-source-upload-ingest.md`](../adr/0020-source-upload-ingest.md) D1, D2, D4, D5, D7
- `src/acp/server.ts` — the `session/close` registration added by A008-0038 is
  the pattern for a custom method
- `src/runtime/local-runtime-config.ts` — `resolvedSqlitePath` is the pattern for
  the store-root check
