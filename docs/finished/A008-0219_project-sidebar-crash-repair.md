# A008-0219 — project sidebar crash repair

Task ID: A008-0219
Status: Complete
Owner: ChatGPT (operator/implementer)
Created: 2026-11-03

## Goal and scope
Restore project-list availability when a persisted continuation-recovery error or an individual project/conversation/run lookup fails. No data migrations, provider calls, or changes to recovery decisions.

## Necessity gate
- Contract: PC-LF-01 (local project management) and PC-LF-05 (durable project sessions), current `docs/PROJECT_BRIEF.md`; PC-LF-09 (recovery safeguards).
- Observed failure: `PlatformStore.rejectContinuationRecovery` persists `CONTINUATION_UNCERTAIN`, but `platformV3RunSchema` rejected that error code. V3 GET run/view could therefore return HTTP 500. One failed `getRun` or project list request rejected the entire `DurableChatClient.sidebar()` via `Promise.all`.
- Minimum repair: include the already-persisted code in the V3 error-code contract and derive each project's conversation list independently, omitting unavailable optional run status rather than discarding all projects.
- Verify: strict persisted-run schema regression, GUI mock with failed run and failed project conversation list, protocol/schema generation, root/client/GUI builds. Live-provider testing not needed: 0 calls / 0 SEK.

## Verification
- `npm run protocol:schemas`: completed, schema artifacts updated.
- `npm run build:client`: pass.
- `npm --prefix gui run build`: pass.
- `node --experimental-strip-types --import ./test/loader.mjs --test src/session/durable-chat-client.test.ts` from gui: 7/7 passed.
- `node --test dist/test/protocol-contract.test.js`: new persisted-run regression passed, protocol artifacts passed; two unrelated pre-existing test fixtures failed (v1 route inventory and V3 conversation fixture missing workspaceId).
- No SQLite project, chat or run records were modified; no provider calls were made.

## Integration
A008-0216 (bounded runtime context), 0217 (direct Luna wire mapping), 0218 (durable reducer recovery) are already committed on the development branch and retain their own archives and test evidence. Integrate with local `main` at the user's request, preserving unrelated work.
