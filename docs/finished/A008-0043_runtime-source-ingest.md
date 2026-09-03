# Task A008-0043 — Runtime source-ingest surface and ACP method

Status: Complete
Owner: operator-delegated, finished by the operator
Parent: A008-0041
Created: 2026-09-02
Completed: 2026-09-03
Branch: `claude/A008-0043-runtime-source-ingest`
Base revision: 49468c4

## Goal

The ACP process can be asked to ingest a stored source by locator, and does so
through `ingest()` with the provenance the extractor chose.

## Change

- `src/runtime/local-runtime-config.ts` — `A008_SOURCE_STORE_PATH`, resolved and
  refused when it lands inside the A008 repository, exactly as
  `A008_MEMORY_SQLITE_PATH` is. Unset means source ingest is simply off.
- `src/runtime/local-memory-runtime.ts` — `ingestSource`. Resolves the locator,
  proves containment, reads the bytes, sniffs the real media type, calls the
  extractor registry, and passes the extractor's `content`, `speaker`,
  `relation` and `contentKind` straight through to `ingest()`.
- `src/acp/A008-acp-agent.ts` — `_a008/source/ingest` params validation and the
  handler. Session-free by design: an upload is not part of a conversation, and
  requiring a session would tie a stored source to whichever chat was open.
- `src/acp/server.ts` — registration through the SDK's custom-method overload,
  and the runtime wiring.

## Decisions worth recording

**The caller's media type is advisory.** `ingestSource` always sniffs the bytes,
exactly as the host does. A declared type is a hint, never a decision, so a
mislabelled upload cannot route itself to the wrong extractor.

**The locator, not the resolved path, is stored.** The artifact keeps
`source:<sha256>/<name>`, so the evidence graph carries a stable, portable
reference instead of a machine-local absolute path.

**Containment is two gates, and they catch different things.** A lexical check
on the locator shape runs first, before the filesystem is consulted at all. A
realpath comparison then runs, which is the only thing that catches a link
inside the store pointing out of it. Both are tested independently — see below.

**An agent without a runtime refuses the method.** `ingestSource` is wired only
in `server.ts`, so any other ACP client gets a method-not-found refusal rather
than a silent success.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Core suite | `npm run test:core` | 288 pass, 0 fail, 0 skipped |

288 accounts for the 279 baseline plus 9 new cases.

### Mutation checks on the security gates

| Mutation | Result |
| --- | --- |
| realpath comparison disabled | 286 pass, **1 fail** |
| lexical comparison disabled | 287 pass, **1 fail** |
| both reverted | 288 pass, 0 fail |

The lexical gate was **not** covered by the first version of these tests: every
traversal case it was meant to catch was also caught by the realpath check, so
disabling it changed nothing. A case was added whose traversal target does not
exist, which is what separates the two — the lexical gate rejects on the shape
of the locator, while realpath would instead complain that the file does not
resolve. Asserting the message is how the test tells which gate did the work.

The link-escape case uses a directory junction rather than a file symlink,
because a junction needs no elevation on Windows. The first version skipped
itself on this machine, which would have left the realpath gate unproven.

## Out of scope and not done

- No `PostOutputMemoryCoordinator` call. Wave 1 stores evidence only
  (ADR 0020 D7).
- No chunking. One source produces one utterance.
- No live provider call. The `derived_from` passthrough is driven by a fake
  extractor.
