# A008-0127 — embedded ACME model-runtime migration

Task ID: A008-0127
Parent Task: None
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `c975a28`

## Task Summary

Replace A008's default external ACME HTTP/SSE sidecar execution path with the published `acme-engine@0.1.1` library in-process, while preserving A008 as the sole owner of cognition, memory, prompts, tools, model selection and provider strategy.

## Goal

Normal A008 startup must require no separately started ACME process, URL, token or sidecar profile environment. A008 must prepare the model selection and dynamically compose the embedded ACME runtime from its own current model registry/catalog and provider credentials.

## Primary Deliverable

An embedded ACME `ChatTransport` used by default that maps the existing A008 request contract directly to `createAcmeModelRuntime().execute()`, preserves streaming/tool/error/evidence semantics, and rebuilds its runtime composition when the A008 user model catalog changes without restarting A008.

## In Scope

- Consume registry-published `acme-engine@0.1.1`.
- Add an embedded ACME transport/runtime composition under `src/providers/acme`.
- Reuse the existing A008→ACME request/result/error mapping rather than creating a second semantic contract.
- Derive ACME OpenAI/NVIDIA/OpenAI-compatible profiles from A008 built-in model registry plus current user catalog.
- Derive vision capability from declared A008 input modalities; preserve existing tool/generation-control behavior.
- Use A008-owned provider credentials/endpoints; ACME receives only execution configuration.
- Make embedded ACME the default chat execution mode.
- Preserve current direct transport as an explicit reference/debug path.
- Preserve the existing remote ACME sidecar path as an explicit compatibility/deployment option; it is no longer the default.
- Detect user-catalog changes and rebuild/swap embedded runtime composition for subsequent calls without process restart.
- Preserve same-turn image/tool behavior and text-only durable history from A008-0124.
- Preserve A008 error classification and model execution evidence projection.
- Update runtime config/docs/tests for the new ownership/deployment boundary.
- Verify Node engine compatibility explicitly; do not silently widen/narrow A008 support without evidence.

## Out of Scope

- Changing A008 memory, extraction, relation, provenance or knowledge semantics.
- Moving model selection/fallback policy into ACME.
- Automatic cross-model fallback.
- Step 4/V2 client protocol work.
- Removing the optional remote sidecar implementation entirely.
- Changing ACME package runtime semantics or publishing another ACME release unless a proven package defect blocks this task.
- Changing image generation or KIE product semantics beyond routing existing chat calls through embedded ACME where supported.

## Definition of Done

- Starting normal A008 with provider credentials requires no ACME sidecar process and no ACME URL/token/build env.
- A normal text turn executes through embedded `acme-engine` and returns the same A008 completion/error/evidence contract.
- OpenAI and NVIDIA selections are routed from A008-owned model metadata, not sidecar env profiles.
- Adding/removing a user model updates the embedded execution composition for subsequent calls without restarting the A008 process.
- Tool-call continuation and streaming callbacks preserve current behavior.
- Native image input reaches the embedded ACME model request and image-capable models execute with `requiredCapabilities.vision=true`; text-only models still fail before dispatch.
- Explicit remote-sidecar and direct modes remain available and existing compatibility/reference tests continue to pass or are deliberately updated for the new default.
- No A008 cognitive/memory semantics change.
- Full relevant core/GUI/protocol/typecheck/build/diff checks pass.
- Owner-authorized live smoke proves at least one OpenAI or NVIDIA text turn through embedded ACME; if a stable vision-capable endpoint is available, the A008-0124 live image proof is also closed here.

## Minimum Verification Gates

- [ ] Embedded runtime composition/profile derivation unit tests.
- [ ] Dynamic catalog rebuild/no-process-restart regression.
- [ ] Text + tools + stream callback parity regression.
- [ ] Native vision mapping/capability regression.
- [ ] Error/evidence mapping regression.
- [ ] Remote sidecar compatibility regression.
- [ ] Direct reference path regression.
- [ ] Local runtime default-mode/config regression.
- [ ] Node engine compatibility decision recorded.
- [ ] Full core/typecheck/build/diff checks.
- [ ] Owner-authorized embedded live smoke.

## Architecture Invariants

- A008 decides; ACME executes; providers compute.
- A008's model registry/catalog is authoritative.
- ACME must not become a second model catalog or memory/cognition owner.
- Embedded ACME is an implementation behind A008's existing `ChatTransport` boundary.
- Durable A008 conversation/memory remains independent of ACME execution repository lifetime.
