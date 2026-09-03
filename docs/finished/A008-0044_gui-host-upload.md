# Task A008-0044 — GUI host upload route and blob store

Status: Complete
Owner: operator-delegated, finished by the operator
Parent: A008-0041
Created: 2026-09-02
Completed: 2026-09-03
Branch: `claude/A008-0044-gui-host-upload`
Base revision: 49468c4

## Goal

`POST /v1/upload` accepts a file, stores the original outside the repository
under a content-addressed locator, and asks the ACP process to ingest it.

## Change

- `src/gui-host/source-store.ts` — filename sanitising, `source:<sha256>/<name>`
  locators, `blobPath` containment, content-addressed `writeBlob`, and
  `A008_SOURCE_STORE_PATH` resolution that refuses a root inside the repository.
- `src/gui-host/server.ts` — the route. Content type must be
  `application/octet-stream`; the byte cap is checked against the declared
  `Content-Length` before a byte is read and again per chunk; the media type is
  sniffed from the bytes; the blob is written; then the bridge is asked to
  ingest by locator.
- `src/gui-host/acp-bridge.ts` — `ingestSource`, sending `_a008/source/ingest`
  with the locator, media type and advisory filename. Never bytes.
- `test/gui-host/fake-acp.ts` — registers the extension method so the bridge can
  be exercised over a real stdio ACP subprocess even though the agent-side
  handler (A008-0043) is not on this branch.

## Decisions worth recording

**A stored blob outlives a failed ingestion.** If the ACP process cannot extract
the source, the route still returns 200 with `extracted: false`. The bytes are
durably stored and content-addressed, so extraction can be retried later; losing
the upload because the extractor was unavailable would be worse.

**Refusing an oversized stream tears the connection down.** That is deliberate —
the alternative is reading a body you have already decided to reject. The test
therefore accepts either a non-200 status or a transport failure, and asserts
what actually matters: nothing was written, and the host still serves.

**Windows reserved device names are disarmed, not blanked.** `con.txt` is as
invalid as `con` on Windows, so a reserved name gets a `_` prefix rather than
being sanitised to the placeholder, which keeps the locator stable and readable.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Core suite | `npm run test:core` | 287 pass, 0 fail |

287 accounts for the 279 baseline plus 8 new cases: the stored-locator contract,
deduplication, hostile filenames, the byte cap, the content-type requirement,
the cross-origin refusal, a stored blob surviving a failed ingestion, and the
bridge sending `_a008/source/ingest` over a real ACP subprocess.

### Mutation checks

| Mutation | Result |
| --- | --- |
| filename sanitising removed | 286 pass, **1 fail** |
| origin guard made unreachable | 284 pass, **3 fail** |
| both reverted | 287 pass, 0 fail |

## Out of scope and not done

- The host reads no file content and makes no provider call (ADR 0020 D1).
- No multipart parsing; the body is raw bytes with the filename in a header.
- The agent-side `_a008/source/ingest` handler is A008-0043's.
