# A008-0165 — Independent platform V3 client

Task ID: A008-0165
Parent Task: A008-0160
Status: Ready
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after allocation d6ec9d8
Branch: codex/a008-0165-platform-client
Clone: C:/code/A008-workers/A008-0165-platform-client

## Goal / Primary deliverable

A thin createPlatformV3Client in @a008/client implementing the frozen V3 HTTP
contract using injected fetch, origin and existing credential adapters.

## Dependencies

A008-0162 protocol PR must be accepted and merged before execution. Read its
docs/platform/PROTOCOL.md plus PLATFORM_V3_CONTRACT and ADR 0048. No dependency
on host availability: independently verify against deterministic fetch contract;
operator later runs same SDK against real host. Don't claim that gate here.

## Scope

packages/client/src/platform-v3.ts; packages/client/src/index.ts additive export;
packages/client/README.md; scripts/verify-client-package.mjs;
test/A008-0149-client-sdk.test.ts (new V3 cases);
docs/platform/CLIENT.md; this task record/current-task/unique archive/handoff.
No protocol/host/store changes, root package.json, dependencies or lockfiles.
Global docs/index deltas supplied to operator in handoff.

## Frozen behavior

Methods: info, listConversations(projectId), createConversation(projectId,{title}),
getConversation(conversationId), createRun(conversationId,{commandId,
expectedRevision,model,text}), getRun(runId), cancelRun(runId,{expectedRevision}),
events({projectId,after?,limit?}).
Use protocol schemas and existing requestJson/credential ownership.
Validate all requests before network and replies before exposing canonical state.
Encode each path segment safely; reject blank/invalid IDs and traversal-like
dot segments which URL normalization could move outside intended resource.
Pass cancellation signal optionally per call. No provider imports, credentials
in URL, implicit global fetch/window, runtime/cognition or UI dependency.

Every mutation performs at most one HTTP attempt; never auto-generate a new
commandId, retry or fall back after network/ambiguous failure. Caller retains
the explicit commandId and may explicitly reissue identical createRun to recover
its durable receipt. Surface typed status/code/message for server error;
transport/malformed reply must not be represented as accepted success.
Resource/event reads remain explicit; no hidden polling/retry timers or user
state owner is introduced. Client disposal isn't server-run cancellation.

## Necessity

PROJECT_BRIEF PC-07 thin clients and PC-01 shared owners; ADR 0048. Without this,
clients duplicate wire validation/auth or retry ambiguous work. Minimal existing
HTTP SDK adapter preserves provider/cognition ownership.

## Minimum gates / Done

- Valid wire request paths/bodies and response parsing for every operation.
- Cookie and bearer propagation; no credentials in URLs; malformed input no I/O.
- Duplicate-ID recovery only on explicit caller request; network error causes
  one attempt, no replay/cancel on client disposal.
- Foreign/malformed replies rejected, typed server errors, no Node/UI imports.
- Root/client typecheck/build, focused SDK tests, npm run verify:client and
  existing V1/V2 client regressions. No host/live-provider claim.
- Restore CURRENT_TASK template; archive, commit, push, open/attach PR; no merge.
- Handoff exact base/head/PR/commands/counts, public exports, limitations and
  proposed global documentation deltas. Operator integrates shared docs.

## Budget / authority

0 SEK, 0 live product-provider calls. Deterministic HTTP fixtures and local
packed consumer only. User authorizes worker commit/push/PR; operator merges.

## Progress / verification

Merged through PR #108 at 1cf318e. Operator rechecked `npm run verify:client`
and focused SDK tests 6/6 on that main. No worker archive or handoff was in the
merge. The V2 real-host regression stays with A008-0166. Frozen requirements
above are unchanged.
