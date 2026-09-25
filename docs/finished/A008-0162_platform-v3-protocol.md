# A008-0162 — Platform V3 protocol contracts

Task ID: A008-0162
Parent Task: A008-0160
Status: Complete
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after main claim d4ebfa6
Completed: 2026-09-22
Branch: codex/a008-0162-platform-v3-protocol
Reviewed contract baseline: 86466edd4ec5e119e42d22a2d669d83078b90b47
Revalidated contract baseline: 5f417b1

## Goal and deliverable

Deliver strict exported Zod schemas/types and route metadata for
`PLATFORM_V3_CONTRACT`, generated artifacts, package documentation and an
independent package-consumer proof. This is protocol-library work only and does
not claim V3 host availability.

## Delivered scope

- `packages/protocol/src/platform-v3.ts` owns V3 durable resource, request,
  response, error and route metadata schemas.
- `packages/protocol/src/index.ts` exports that owner.
- `packages/protocol/schemas/platform-v3*.json` are generated JSON Schema and
  descriptive OpenAPI artifacts.
- The generator, isolated tarball proof, focused protocol-contract tests,
  package README and `docs/platform/PROTOCOL.md` document and verify the
  contract.

No core, host, store, root package manifest or V1/V2 behavior changed. V3-owned
objects reject unknown fields. Conversation content reuses the existing
`chatContentSchema` exactly, including its established nested-content
unknown-key behavior, as clarified in the accepted contract.

## Necessity and limits

This delivery implements PC-07, PC-01 and PC-05 under ADR 0048 so later platform
work has one strict shared wire contract for durable scoped work. Without it,
storage and host owners would have no shared checked representation. It adds no
service, runtime provider behavior, memory semantics or client authority.

## Verification

- PASS (local): `npm run build`
- PASS (local): `npm run typecheck`
- PASS (fixture): `node --test dist/test/protocol-contract.test.js` — 8/8
- PASS (local package): `npm run verify:protocol` — packed protocol and packed
  Zod installed offline outside A008; independent TypeScript consumer compiled
  and ran.
- PASS (review): existing V1/V2 generated artifacts unchanged; generated V3
  artifacts match their schema owner.
- Not run: live provider verification; the frozen task budget is 0 SEK and 0
  calls.

## Handoff

See `docs/handoffs/A008-0162.md` for exact head, checks, public exports and
proposed canonical documentation deltas. The task is complete only as the
protocol prerequisite; host/store integration retains separate acceptance.
