# Current Task

Task ID: A008-0206
Parent Task: A008-0198
Status: Complete
Owner: ChatGPT (operator/worker)
Created: 2026-10-01
Last updated: 2026-10-01
Charter frozen at: 2026-10-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/finished/A008-0198_Task3.md`
- `docs/finished/A008-0131_openai-responses-luna.md`

## Task Summary

A008-0198 is implemented but enabling continuation pressure on the normal
`embedded-acme` OpenAI/Luna route fails closed before dispatch because
`EmbeddedAcmeChatTransport` does not expose exact request measurement. The
same route already executes OpenAI through ACME's native Responses adapter and
must retain reasoning plus function tools.

Priority:
1. exact selected-route wire measurement and safety;
2. preserve native Responses + reasoning/tool behavior;
3. minimum implementation and dependency surface.

## Task Charter

### Goal

Expose exact serialized-request byte measurement for the embedded ACME native
OpenAI Responses route so A008-0198 can operate on Luna without changing route
or reasoning behavior.

### Primary Deliverable

`EmbeddedAcmeChatTransport.measureRequest()` for native OpenAI selections,
using the same ACME Responses serializer and A008 final wire-body transform as
real dispatch.

### In Scope

- Reuse ACME's exported `buildResponsesBody()` rather than duplicate Responses mapping.
- Measure the final UTF-8 JSON body after stream selection and A008 reasoning-summary augmentation.
- Return a stable route identity bound to embedded ACME native OpenAI Responses.
- Keep non-OpenAI embedded routes fail-closed until they have their own exact serializer ownership.
- Add regression proof that measured bytes equal the actual request body bytes observed by the provider transport.
- Cover streamed Luna with non-none reasoning and function tools.
- Add the OpenAI ACME adapter as an explicit direct dependency if imported directly.
- Update current docs/handoff/archive for this bounded fix.

### Out of Scope

- Chat Completions fallback.
- Changing Luna reasoning effort.
- Reworking A008-0198 policy or thresholds.
- NVIDIA/KIE/compatible-route measurement.
- File-tool changes from A008-0205.
- MCP schema normalization.

### Definition of Done

- Embedded Luna still dispatches to `https://api.openai.com/v1/responses`.
- `measureRequest()` succeeds for embedded OpenAI and returns the exact UTF-8
  byte count of the body real dispatch sends.
- Streamed non-none reasoning measurement includes the same
  `reasoning.summary="auto"` wire augmentation as dispatch.
- Function-tool schemas are measured in the actual Responses body.
- Non-OpenAI measurement fails explicitly rather than estimating.
- Focused tests, typecheck/build and `git diff --check` pass.

## Minimum Verification Gates

- [ ] focused embedded ACME / continuation measurement tests
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] no live provider call required for this prerequisite

## Verification Budget

No live provider call is required. A008-0205's later owner-authorized Luna run
will be the live integration exercise after this prerequisite is merged.

## References

- `src/providers/acme/embedded-acme-chat-transport.ts`
- `src/providers/acme/acme-model-runtime.ts`
- `src/core/chat-request-budget.ts`
- `test/A008-0127-embedded-acme.test.ts`
- `@acme-engine/adapter-model-openai@0.1.7`

## Checklist

- [x] wire exact Responses measurement
- [x] add regression tests
- [x] run verification gates
- [x] update owning docs
- [x] archive task and write handoff

## Verification

- `npm run typecheck` — PASS.
- `npm run build --silent` — PASS.
- Embedded ACME + continuation pressure focused suite — 17/17 PASS.
- Streamed OpenAI Responses fixture proves measured UTF-8 bytes equal the exact provider-observed request body with non-none reasoning, `summary:auto`, streaming and function tools.
- Live isolated A008 integration: embedded ACME/Luna with 0198 enabled passed request measurement and continued beyond 70 native tool calls; pressure had not yet reached the configured 750000-byte trigger at that observation.
- `git diff --check` — PASS.
