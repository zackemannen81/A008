# A008-0162 — Platform V3 protocol contracts

Task ID: A008-0162
Parent Task: A008-0160
Status: Complete
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after main claim d4ebfa6; execute only after ADR 0048 integration
Branch: codex/a008-0162-platform-v3-protocol
Clone: C:/code/A008-workers/A008-0162-platform-v3-protocol

## Required context

Read this charter first; then AGENTS required authority and ADR 0048,
PLATFORM_V3_CONTRACT, platform spec §§5–10 and §§21/27 relevant to this task.
Prioritize these bounded sources. Do not load unrelated worker histories.
Current memory owner remains unchanged. Expand context if correctness needs it.

## Goal and primary deliverable

Strict exported Zod schemas/types and route metadata for PLATFORM_V3_CONTRACT, generated schema artifact(s), package documentation and independent package-consumer proof. Protocol library only; do not claim host V3 availability.

## Scope

packages/protocol/src/platform-v3.ts; packages/protocol/src/index.ts (new export only); packages/protocol/schemas/platform-v3*.json; packages/protocol/README.md; scripts/generate-protocol-schemas.mjs; scripts/verify-protocol-package.mjs; test/protocol-contract.test.ts; docs/platform/PROTOCOL.md.
Also own this task record, local CURRENT_TASK during work, unique archive
docs/finished/A008-0162_platform-v3-protocol.md and handoff docs/handoffs/A008-0162.md.

## Out of scope

Other workers' paths, global status/systemdoc/map/indexes (operator integrates
proposed deltas in same PR before merge), memory semantics, runtime provider/tool
execution, V1/V2 changes, dependency upgrades, live calls, merging main.

## Dependencies

ADR 0048 and frozen PLATFORM_V3_CONTRACT merged. No dependency on the other
first-wave worker implementation; communicate only contract mismatches/blockers.
Operator owns cross-surface integration and tests after both PRs meet their gates.

## Definition of done and minimum gates

Valid frozen examples and malformed/extra-authority fields; unsafe integers/empty IDs/oversized text; chat-content parity; round-trip JSON schema generation and drift detection; root typecheck/build, existing protocol-contract tests, npm run verify:protocol, V1/V2 generated artifacts unchanged except justified additive metadata.
Commit all authorized work, push branch, open PR against main, attach PR using
Codex artifact tool, provide structured handoff; never merge. Restore CURRENT_TASK
byte-for-byte from template before final commit/push. Archive completed charter.
No runtime/HTTP feature claim from this isolated delivery.

## Necessity Gate

Contract: PROJECT_BRIEF PC-07 (durable background platform), PC-01 (shared owners),
PC-05 (explicit authority); accepted ADR 0048. Pin contract commit to the actual
merged P0 baseline before starting; no permission needed for that bookkeeping.
Without this delivery P1 cannot safely persist or expose durable scoped work.
Smallest sufficient approach: existing TypeScript/SQLite/Zod stack, bounded first
contract, no new service or alternate engine.
Verification: exact failure/acceptance cases above, not merely schema happy paths.

## Verification budget

0 SEK, 0 live-provider calls; local implementation and fixtures suffice because
this task makes no provider-wire/capability claim. No credential inspection.
Worker authoring uses the user-authorized Codex worker model.

## Implementation notes

No src/platform or host/client implementation changes. No root package.json/lockfile changes. Reuse existing chatContentSchema. Generated platform artifact separate from existing V1/V2 artifacts. Public types all PlatformV3* and schemas platformV3*; no imports of core/host/node/provider/memory into protocol. Model/status enums exact frozen contract.
Install dependencies in this isolated clone if needed; no credentials/user data
copied from canonical checkout. Use existing lockfiles. Report environment blockers.
Other paths require operator coordination before edits.

## Handoff contract

Report task/branch/base/head/PR, exact commands and pass/fail counts, observable
acceptance outcomes and fixture/local/live classification, changed paths, known
limitations, public method/export signatures needed by dependent work, and exact
proposed canonical documentation deltas. Never send full transcript/context.
A completed process is not task acceptance.

## Verification

- PASS (local): `npm run build` after regeneration.
- PASS (local): `npm run typecheck`.
- PASS (fixture): `node --test dist/test/protocol-contract.test.js` — 8/8.
- PASS (local package): `npm run verify:protocol` — packed protocol and packed
  Zod installed offline into a temporary consumer; independent TypeScript
  consumer compiled and ran.
- PASS (review): V1/V2 generated artifacts have no diff; generated V3 artifacts
  are separate `platform-v3*` files and match their schema owner.
- PASS (revalidation): rebased onto `5f417b1`; its accepted clarification
  confirms strict V3-owned envelopes while retaining exact chat-content parity.
- Not run: live-provider verification, by the frozen zero-call/zero-SEK budget.

## Progress

Complete. The protocol package now exports strict V3 resource/request/response
schemas, generated JSON Schema/OpenAPI artifacts and route metadata. It does not
add host routes, storage, authentication, provider execution or a V3 availability
claim. The archive and handoff record final integration details.
