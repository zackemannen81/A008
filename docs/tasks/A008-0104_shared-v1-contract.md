# A008-0104 — Shared v1 protocol foundation

Task ID: A008-0104
Parent Task: A008-0103
Status: Ready
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
- [ ] Characterize parsers and routes.
- [ ] Extract contracts/schemas preserving compatibility.
- [ ] Wire consumers and package; verify real boundaries.
- [ ] Archive, handoff and restore current-task template.

## Verification
Pending.
