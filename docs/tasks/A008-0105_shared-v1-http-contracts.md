# A008-0105 - Shared v1 HTTP contracts

Task ID: A008-0105
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Charter frozen at: 2026-09-14

## Goal
Complete the existing HTTP payload contract ownership needed by independent
clients while preserving current v1 runtime policy and client tolerance.

## Primary deliverable
Shared HTTP request/response schemas and inferred DTOs in packages/protocol,
consumed through current host/core/GUI adapters, with generated descriptions,
compatibility fixtures and real HTTP response verification.

## In scope
All inventoried HTTP operations: health/login/errors, memory, projects, provider
settings/catalog/images, upload/blob, shell and browser checks. Describe binary
and static responses as such. Extract existing pure wire parsing where present;
preserve casting/tolerance where clients currently do not validate. Keep runtime
validation, normalization, filesystem/provider execution with existing owners.
Generated HTTP schema/operation artifacts and necessary package verification.

## Out of scope
V2/auth decisions, new endpoints/permissions, project/session ownership redesign,
SDK/transport migration, durable sessions, database changes, native UI, provider
calls, running-host restart, remote publication. Stage-1 V2 decision proposal and
later program stages remain separately chartered work.

## Definition of done and minimum gates
- Every HTTP operation maps to request/query/header/body and success/error
  contracts or an explicit binary/static boundary; no invented JSON wrapper.
- Shared DTO owner replaces duplicate host/client declarations for this surface.
- Existing pure parsers and current tolerant clients preserve their results,
  errors and additive-field behavior; frozen synthetic baseline cases pass.
- Real host HTTP success and representative failure paths validate against the
  shared contracts with fake providers, temporary data and no live user changes.
- Generated artifacts cannot drift; package remains platform independent and an
  independent installed consumer uses HTTP contracts successfully.
- Root build, full npm test, GUI typecheck/build and portable engine proof pass.
- Owning docs, archive/handoff, final necessity review, links/fences/diff and
  current-task template identity pass.

## Necessity Gate
Contract: PROJECT_BRIEF Core Product Contract at c3970d5; ADR 0040 and A008-0103.
Allocation on main: 247ef82. PC-01: supported clients reach the same owned engine
boundaries. PC-05: existing execution/credential controls stay authoritative.
PC-06: supported controls, memory/source intake and providers retain their owners.

| Change | Need and consequence of omission | Smallest sufficient approach | Check |
| --- | --- | --- | --- |
| HTTP wire owner | Inventory confirms duplicated/missing transport DTOs; external clients must copy GUI/internal shapes | Extend the existing pure package, retain runtime policy adapters | Type/build checks, real HTTP contracts, independent install |
| Compatibility parsing | Existing clients accept different additions/defaults/errors; replacing them wholesale changes v1 | Move pure existing parsers; characterize tolerated inputs, preserve non-validating adapters | Captured baseline and existing GUI/host tests |
| Operation/schema artifacts | A route list alone cannot describe payloads or binary semantics | Generated operation description from one shared schema registry | Drift/coverage checks, documented semantic constraints |

## Checklist
- [x] Freeze legacy cases before extraction.
- [x] Implement shared HTTP schemas, DTOs, adapters and operation descriptions.
- [x] Verify HTTP, clients, package and portable engine.
- [x] Update owning docs, archive/handoff and restore template.

## Decisions and verification
Program constraints revalidated on merged main c3970d5. The owner authorized
continuing the frozen sequence; future mobile durability is not added here.

- Captured 52 synthetic legacy memory/upload/shell/frame parser cases before
  extraction; shared parsers preserve exact normalized values/errors. Existing
  non-validating project/provider/image clients still cast responses unchanged.
- Shared HTTP owner supplies 35 schema components; the operation map covers all
  21 inventory rows / 22 HTTP methods. Pure generation produces OpenAPI 3.1.1;
  artifact drift and every internal reference are verified. All 35 components
  also compile under the locally available JSON Schema 2020-12 validator.
- Input envelopes deliberately preserve existing tolerance/defaults; stricter
  runtime policy still runs in its owner. Binary upload, blob and static/HEAD
  responses are represented without new JSON wrappers. Memory edge membership
  remains a shared semantic check beyond generated structural schemas.
- A real loopback host serves every inventoried operation using temporary paths,
  actual memory inspection and fake provider/terminal responses. Tests cover PIN
  denial/login, origin rejection, duplicate/unknown memory queries, malformed
  input/content type, project preview/create/open, model/catalog/settings routes,
  image/blob bytes, and both successful/failed upload extraction.
- `npm test`: 576 core + 4 membership + 161 GUI, zero failures/skips. Root build,
  GUI typecheck and production build pass. Main GUI JS 532.56 kB / 161.06 kB gzip;
  existing size/PURE-comment warnings remain.
- Independent protocol/dependency tarballs install offline outside A008; separate
  TypeScript consumer compiles/runs both WS and HTTP contracts and OpenAPI access.
- Portable engine built outside the repository passes the existing downstream
  compatibility fixture: discovery, ACP/shared panel/history, explicit approval,
  actual synthetic command/result, upload/memory, disconnect and graceful stop.
  The downstream clone was not changed and is not project authority.
- Final docs links/fences, generated artifacts, frozen plan body hash, archive
  identity, current-task template identity and `git diff --check` pass.

## Final necessity review and handoff

Actual changes satisfy the frozen three-row gate. HTTP DTO duplication is removed
through type adapters, with preserved runtime validators. Existing Zod is reused;
no dependency, endpoint, credential model, database or execution behavior added.
Generated OpenAPI documents the current configured auth alternatives; it does not
make optional auth a V2 decision or start rejecting previously tolerated replies.

No live provider calls, user data changes, running-host restart or remote
publication occurred. The stage-1 V2 proposal remains next, followed by accepted
ownership/auth decisions and their bounded implementations. Program stays active.
Archive: `docs/finished/A008-0105_shared-v1-http-contracts.md`.
Handoff: `docs/handoffs/A008-0105.md`. CURRENT_TASK restored to its empty template.
