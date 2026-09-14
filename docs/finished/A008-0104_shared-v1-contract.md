# A008-0104 — Shared v1 protocol foundation

Task ID: A008-0104
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Charter frozen at: 2026-09-14

## Goal
Give existing host/client session wire structures one independently usable owner
and characterize the complete HTTP/WS surface without changing v1 behavior.

## Primary deliverable
Pure protocol package used by host and GUI, schemas/fixtures, full route inventory
and real-consumer verification.

## In scope
WS envelopes, session/control/model/runtime-preference wire contracts; shared
validators/serialization and schema artifacts; old acceptance compatibility;
all HTTP route ownership/auth/context inventory; necessary build/package wiring.

## Out of scope
V2 behavior, workspace redesign, new auth, durable/replayed conversations, new
endpoints, full HTTP-payload/SDK migration, Expo/Tauri, provider calls, restart
or publication. HTTP contracts beyond session/model/settings are a subsequent
stage-1 child if inventory shows independent existing owners.

## Definition of done and minimum gates
- Host/GUI use one session/message DTO owner; old acceptance asymmetries tested.
- Package has no runtime, filesystem, React or provider imports.
- Every HTTP/WS operation inventoried with auth/context/owner.
- Actual host frames/session-related HTTP responses satisfy shared contracts;
  malformed/old/unknown-addition fixtures and PIN/panel behavior still pass.
- Independent package install/import and engine package inclusion verified.
- Root build, full npm test and production GUI build pass.
- Owning docs, archive/handoff, links/fences/diff and template identity pass.

## Necessity Gate
Contract revision f4dffcd; PC-01/05/06; ADR 0040 and existing
ADR 0019/0026/0027/0028/0037 v1 compatibility constraints.

| Change | Need and omission | Smallest approach | Verification |
| --- | --- | --- | --- |
| Shared wire owner | Separate server/GUI declarations can drift; independent clients lack a single contract | Pure package and thin existing-path adapters, preserve tolerance/errors | Fixture parity, real host frames, independent consumer |
| Route inventory | Global/session/admin scopes are implicit | Describe every operation without adding endpoints | Dispatcher/inventory and host tests |
| Packaging | Moved contracts must not break shipped consumers | Include compiled contracts in existing build/package | Root/GUI build, package import and engine proof |

## Checklist
- [x] Characterize parsers and routes.
- [x] Extract contracts/schemas preserving compatibility.
- [x] Wire consumers and package; verify real boundaries.
- [x] Archive, handoff and restore current-task template.

## Verification
2026-09-14, local branch `codex/A008-0104-v1-contract`:

- Frozen compatibility baseline: 90 synthetic cases captured from the original
  host/client parsers before extraction (43 commands, 47 replies/events).
- Shared package owns session/message types, schemas and compatibility parsers;
  host/core/GUI use adapters. Source import gate rejects platform/runtime owners.
- Five generated JSON schemas pass drift checks; supplemental cross-field budget
  validation and legacy reader/output asymmetries are documented explicitly.
- Every literal HTTP dispatcher operation matches the route inventory; login,
  blob/static handlers and all six WS commands/ten server frame types are mapped
  with auth/context/owner in HOST_PROTOCOL_V1_INVENTORY.md.
- `npm test`: 573 core + 4 membership + 161 GUI tests pass, zero skips/failures.
  Actual host frames and model responses satisfy shared schemas. Existing PIN,
  resume, engine panel and runtime policy tests pass.
- Root build and GUI typecheck/production build pass. GUI main chunk is 526.22 kB
  (159.20 kB gzip); Rollup emits size and Zod PURE-comment annotation warnings.
- `npm run verify:protocol`: packed protocol and dependency installed offline
  outside A008; independent TypeScript consumer compiled and ran. Tarball includes
  declarations, schemas, fixtures, README and license.
- Portable engine package built outside the repo and verified using the existing
  downstream client compatibility fixture: discovery, ACP, shared panel/history,
  explicit tool approval/actual command/result, upload/memory, panel disconnect
  and graceful process stop passed. All data/provider responses were synthetic;
  the downstream repository supplies compatibility evidence, never authority.
- Owning docs, archive/handoff, changed-document links/fences, frozen plan hash,
  task/template byte identity and diff checks verified at finalization.

## Final necessity review and handoff

Final changes match the three recorded arguments: one session wire owner, route
inventory and necessary build/package wiring. No V2, auth policy, storage change,
project redesign or new execution path was added. Zod was already pinned in the
root; it now validates shared snapshots/models in the GUI as well.

The inventory confirms remaining independent HTTP payload owners for memory,
projects, providers, source intake, shell, browser, health/login/errors. These
belong in a subsequent bounded stage-1 child. Completing this task does not
complete stage 1 or A008-0103. No live provider call, running-host restart, remote
push/merge or release was performed for this build.

Immutable archive: `docs/finished/A008-0104_shared-v1-contract.md`.
Handoff: `docs/handoffs/A008-0104.md`. CURRENT_TASK restored from its template.
