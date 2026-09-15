# A008-0118 — ACME runtime/2 consumer and control-parity GO

Task ID: A008-0118
Parent Task: A008-0103
Status: Complete
Owner: Grok (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `f24a38f`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0043-acme-execution-boundary.md`
- `docs/finished/A008-0114_acme-execution-evaluation.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- ACME `docs/design/acme-model-runtime-2.md` and ADR-0054 (external protocol, not A008 write scope)

## Task Summary

A008-0114 proved that A008 can talk to ACME beneath `ChatTransport`, then recorded
**NO-GO** because frozen `acme-model-runtime/1` could not carry A008 generation
controls beyond temperature, max output tokens and stop. ACME-0180 has since
published additive `acme-model-runtime/2` with those controls and explicit
caller-owned `providerHint` routing. A008 still speaks v1 and still infers a
partial provider hint from the model id.

This task makes A008 a real consumer of runtime/2. A008 continues to own model
choice, generation options, tools and cognition. ACME only routes and executes
the already-selected text/chat call. Image/audio/video stay on their current
direct paths. After the supported chat matrix and the owner client loop are
green, Stage 3.5 is recorded **GO** so Stage 4 may start with ACME as the
text/chat execution layer.

## Task Charter

### Goal

Consume `acme-model-runtime/2` with the full A008 generation-control set and an
explicit execution provider, so ACME can execute every supported text/chat model
without silently dropping controls or choosing the model/provider.

### Primary Deliverable

`AcmeChatTransport` on `acme-model-runtime/2`, an `executionProvider` field on
A008 model profiles, aligned control contracts that match what ACME will actually
send, deterministic mapping proofs, live matrix evidence under separate owner
authority, and a recorded Stage 3.5 GO or a documented remaining NO-GO.

### In Scope

- Switch ACME protocol header, request `protocolVersion` and compatibility
  descriptor from `acme-model-runtime/1` to `acme-model-runtime/2`. Endpoints
  remain `GET /v1/model/compatibility` and `POST /v1/model/execute`.
- Extend `buildAcmeExecuteBody()` so present, supported A008 options map onto
  ACME `topP`, `reasoningBudget`, `enableThinking`, `reasoningEffort` and `seed`
  in addition to the existing `temperature`, `maxOutputTokens` and `stop`.
  Absence means the field is omitted. Do not send `false`/`null` to emulate the
  old direct-transport silent ignore.
- Add explicit `executionProvider: "openai" | "nvidia" | "kie"` on A008 model
  profiles. Do not reuse `ModelProfile.provider` for routing: Kimi remains
  `provider: "moonshotai"` and executes via NVIDIA.
- Send ACME selection as A008-owned values, for example:

  ```json
  {
    "profile": "moonshotai/kimi-k3",
    "providerHint": "nvidia",
    "modelHint": "moonshotai/kimi-k3"
  }
  ```

  ACME must not infer the provider. Missing or unknown `providerHint` fails
  before dispatch. KIE chat uses one ACME compatible route per model, so the
  hint is `kie:<model-id>` (for example `kie:gemini-3-flash`), not the bare
  `"kie"` execution-provider name.
- Align each shipped chat profile's defaults and `generationCapabilities` with
  the controls that model actually honors on the ACME adapter. Resolve the
  current contradictions in the same change:
  - Kimi K3 profile currently defaults `enableThinking: true`, while
    `generationCapabilities` sets `thinking: false` and the direct NVIDIA
    transport explicitly does not send `enableThinking` (K3 uses
    `reasoning_effort` + `seed`).
  - Muse Glimmer and Laguna XS currently default `enableThinking: false` even
    though the direct transport never sends the field. With ACME, absence means
    absence.
  - DeepSeek's profile/`generationCapabilities`/direct `thinking` mapping must
    be made one contract, not three.
- Document the local ACME runtime composition A008 needs. Do not change ACME
  code. NVIDIA-hosted families share one NVIDIA gateway; each profile has exact
  selection + model + controls. KIE chat uses one ACME compatible route per
  model because KIE's URL is `https://api.kie.ai/<MODEL>/v1/chat/completions`
  (for example `kie:gemini-3-flash`). Image/audio/video jobs stay on current
  A008 transports.
- Deterministic tests that prove, per shipped chat model:

  A008 profile → full generation options → AcmeChatTransport v2 → correct
  `providerHint` → ACME request body with exactly the supported controls.

  Unsupported supplied controls must fail before a provider call, not be
  dropped.
- Live text/chat matrix against a real ACME runtime/2 service, in this order,
  under explicit owner credential/cost authority:

  Luna → Nemotron 3.5 Lightning → Kimi K3 → DeepSeek V4 Pro → Muse Glimmer →
  Laguna XS → KIE/Gemini.

  Each live case proves stream/reasoning/tools round-trip through ACME, not
  merely a descriptor handshake.
- Owner client loop after the matrix is green: chat → tool → continuation →
  retrieval → answer → extraction → one batch relation call → commit → next
  turn retrieves the memory.
- Record Stage 3.5 **GO** only when the deterministic matrix, live matrix and
  owner loop are green. Then ACME becomes the normal configured text/chat
  execution path. Direct NVIDIA/OpenAI/KIE chat transports remain available as
  explicit reference composition. There is still no post-dispatch fallback.

### Out of Scope

- Changing ACME protocol, adapters, router or service code. ACME-0180 is the
  consumed substrate. Per-profile KIE endpoints inside ACME, if wanted later,
  are an ACME task.
- Image, audio or video execution through ACME. KIE image jobs and NVIDIA image
  transport stay on their current paths.
- Rebuilding or deleting the direct NVIDIA/OpenAI/KIE chat transports.
- A008 cognition, memory lifecycle, retrieval policy, relation decisions or
  prompt ownership.
- Stage 4 `turnId`/`messageId`, snapshots, terminal turn protocol, command
  receipts or reconnect/resume.
- Automatic provider fallback after ACME dispatch.
- Silent dropping of unsupported generation controls.
- Live provider calls without explicit owner authority in this task's
  verification record.

### Definition of Done

- `AcmeChatTransport` speaks only `acme-model-runtime/2`. A v1 descriptor or
  header fails before execute.
- Every shipped text/chat profile has an explicit `executionProvider` and sends
  that value as `providerHint`. `ModelProfile.provider` remains vendor identity.
- `buildAcmeExecuteBody()` includes each present supported control and omits
  unsupported/absent ones. Kimi does not send `enableThinking`. Muse/Laguna do
  not send `enableThinking: false`.
- Deterministic fixtures cover Luna, both Nemotrons, Kimi, DeepSeek, Muse,
  Laguna and at least one KIE Gemini chat model.
- Live matrix and owner client loop are either green under recorded owner
  authority, or the task cannot record GO.
- Existing `ChatTransport` / `ChatSession` ownership is unchanged. Semantic
  calls continue through the selected transport. ACME still does not execute
  tools.
- Full A008 verification, protocol-package proof, GUI build, portable-engine
  proof and `git diff --check` pass with deterministic providers unless a named
  live gate is separately authorized.
- Stage 3.5 is archived as **GO** or remains **NO-GO** with a concrete remaining
  blocker. GO authorizes Stage 4 to start with ACME as the text/chat execution
  layer. NO-GO does not start Stage 4 on ACME.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `f24a38f`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Consume `acme-model-runtime/2` | PC-01, PC-05, PC-06 + ADR 0043 | Supported session/model controls must actually reach the provider when ACME executes. Remaining on v1 would keep Stage 3.5 NO-GO and silently lose thinking/reasoning/topP/seed. | Upgrade the existing adapter's protocol and request mapping; keep endpoints and `ChatTransport`. | Descriptor mismatch fails closed; execute body contains the new controls. |
| Explicit `executionProvider` | PC-01, PC-05 + ADR 0043 | ACME must not choose provider. `ModelProfile.provider` is vendor identity (`moonshotai`) and would mis-route Kimi. | Add a separate execution-routing field and send it as `providerHint`. | Kimi fixture sends `providerHint: "nvidia"`; Gemini sends `"kie:gemini-3-flash"`; Luna sends `"openai"`. |
| Align control contracts | PC-06 + ADR 0043 | ACME v2 refuses unsupported controls before dispatch. Keeping profile defaults that the wire never sent would turn previous silent no-ops into hard failures. | Make profile defaults and `generationCapabilities` match honored controls; omit absent fields. | Kimi body has `reasoningEffort`/`seed` and no `enableThinking`; Muse/Laguna omit `enableThinking`. |
| Text/chat matrix and GO | PC-01, PC-05 + ADR 0041/0043 | Stage 4 must not start until execution-substrate GO is evidence, not intention. | Prove A008→ACME→provider for the shipped chat matrix, then record GO. | Deterministic mapping suite; owner-authorized live matrix; owner client memory loop. |

### Minimum Verification Gates

- [x] Compatibility check requires `acme-model-runtime/2`; v1 fails before execute.
- [x] Execute mapping covers `topP`, `reasoningBudget`, `enableThinking`,
      `reasoningEffort` and `seed` when present and supported.
- [x] `executionProvider` is the only source of ACME `providerHint` for shipped
      profiles.
- [x] Kimi, Muse, Laguna and DeepSeek control contracts no longer contradict
      `generationCapabilities` or the ACME-honored set.
- [x] Deterministic fixtures exist for Luna, Nemotron 3.5, Nemotron Omni, Kimi,
      DeepSeek, Muse, Laguna and one KIE Gemini chat model.
- [x] Unsupported supplied controls fail closed before provider dispatch.
- [x] Direct-vs-ACME cognitive/session/memory parity from equivalent normalized
      output still holds; permitted differences remain execution evidence only.
- [x] Live matrix (Luna → Nemotron → Kimi → DeepSeek → Muse → Laguna →
      KIE/Gemini) is recorded under explicit owner authority, or GO is not
      claimed.
- [x] Owner client loop (chat → tool → continuation → retrieval → answer →
      extraction → one batch relation → commit → next-turn retrieval) is
      recorded, or GO is not claimed.
- [x] No ACME repository files are modified. No image/audio/video path is moved.
- [x] `npm test`, `npm run verify:protocol`, production GUI build and
      `git diff --check` pass. Portable engine zip was skipped (see Verification).
- [x] Stage 3.5 GO/NO-GO is written into CURRENT_STATUS, SYSTEMDOC, JOURNAL and
      A008-0103.

## References

- `docs/adr/0043-acme-execution-boundary.md`
- `docs/finished/A008-0114_acme-execution-evaluation.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `src/providers/acme/acme-model-runtime.ts`
- `src/providers/acme/acme-chat-transport.ts`
- `src/core/model-registry.ts`
- `src/core/generation-controls.ts`
- `src/providers/nvidia/nvidia-chat-transport.ts`
- ACME `docs/design/acme-model-runtime-2.md`
- ACME ADR-0054 and finished ACME-0180

## Checklist

- [x] Freeze this charter on `main` after necessity review; do not implement from
      chat memory.
- [x] Inspect ACME runtime/2 wire and NVIDIA/OpenAI/KIE profile control maps as
      consumed contracts; do not edit ACME.
- [x] Add `executionProvider` and align shipped chat-profile control defaults.
- [x] Upgrade `AcmeChatTransport` and `buildAcmeExecuteBody()` to v2.
- [x] Add deterministic mapping fixtures for the full chat matrix.
- [x] Document local ACME runtime env (`OPENAI_API_KEY`, `NVIDIA_API_KEY`,
      listen host/port, bearer token, engine build, OpenAI/NVIDIA/KIE profile
      arrays). KIE uses one compatible route per chat model.
- [x] Run offline verification.
- [x] With explicit owner authority, start the ACME runtime and run the live
      matrix in the named order.
- [x] With explicit owner authority, run the client memory loop.
- [x] Record GO or remaining NO-GO and update owning docs.

## Decisions and Notes

- ADR 0043 remains the immutable boundary: A008 decides; ACME executes;
  providers compute.
- `acme-model-runtime/1` stays understood as the 0114 evaluation wire. This
  consumer moves to v2; there is no dual-speak or automatic protocol fallback.
- Vendor `provider` and execution `executionProvider` are different facts.
  Planned matrix:

  | A008 model | `provider` | `executionProvider` |
  | --- | --- | --- |
  | `gpt-5.6-luna` | `openai` | `openai` |
  | `nvidia/nemotron-3.5-lightning-30b-a3b` | `nvidia` | `nvidia` |
  | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | `nvidia` | `nvidia` |
  | `moonshotai/kimi-k3` | `moonshotai` | `nvidia` |
  | `deepseek-ai/deepseek-v4-pro-0813` | `deepseek-ai` | `nvidia` |
  | `meta/muse-glimmer-30b` | `meta` | `nvidia` |
  | `poolside/laguna-xs-2.1` | `poolside` | `nvidia` |
  | KIE `gemini-*` chat models | `kie` | `kie` |

- ACME OpenAI selections use ACME's Responses adapter. A008's direct OpenAI
  path remains Chat Completions. Luna-on-ACME must send only controls that
  adapter honors (`temperature`, `topP`, `maxOutputTokens`, `reasoningEffort`;
  it refuses `stop`, `seed`, `enableThinking`, `reasoningBudget`). Direct-path
  Chat Completions workarounds stay on the direct transport.
- ACME NVIDIA Chat Completions profiles declare the thinking-template mapping
  (`enable_thinking` vs `thinking`). A008 sends the provider-neutral
  `enableThinking` boolean only when that mapping exists for the profile.
- “All providers” in this task means text/chat execution. ACME-0180 excludes
  image/audio/video.
- Default-route adoption is the GO outcome. Selection remains explicit
  (`A008_CHAT_TRANSPORT=acme` plus runtime URL). Direct NVIDIA/OpenAI/KIE chat
  transports stay as reference composition. There is no post-dispatch fallback.
- Live calls, ACME process bind to `127.0.0.1:8790`, and owner GUI testing
  require explicit operator authority in Verification. Offline mapping tests
  do not.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against the necessity arguments and frozen scope.
- [x] Record exact deterministic fixture results.
- [x] Record live matrix command, model, ACME engineBuild and outcome per row,
      without publishing credentials or raw model payloads.
- [x] Record owner client-loop outcome.
- [x] Record skipped checks and reasons.
- [x] Record Stage 3.5 GO or remaining NO-GO.

Offline 2026-09-15:

- `npm run typecheck` PASS.
- `npm test` PASS: 636 core, 4 membership, 162 GUI.
- `npm run verify:protocol` PASS.
- Production GUI build PASS (`gui/dist` 537.78 kB / 162.26 kB gzip).
- `git diff --check` PASS.
- Deterministic v2 mapping fixtures PASS for Luna, both Nemotrons, Kimi,
  DeepSeek, Muse, Laguna and `gemini-3-flash` (`kie:gemini-3-flash`).
- Unsupported-control fail-closed fixtures PASS.
- Direct-vs-ACME parity suite PASS.
- No ACME repository files were modified.

Live matrix 2026-09-15, ACME `engineBuild=acme-0180-local-a008`,
`protocolVersion=acme-model-runtime/2`, local `127.0.0.1:8790`. Owner-observed
chat through A008 GUI → AcmeChatTransport v2. No raw payloads recorded.

| Model | `executionProvider` | Result |
| --- | --- | --- |
| `gpt-5.6-luna` | openai | PASS |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | nvidia | PASS |
| `moonshotai/kimi-k3` | nvidia | PASS |
| `deepseek-ai/deepseek-v4-pro-0813` | nvidia | PASS |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | nvidia | skipped; not in the frozen named live order |
| `meta/muse-glimmer-30b` | nvidia | PASS |
| `poolside/laguna-xs-2.1` | nvidia | PASS |
| KIE `gemini-*` | kie | PASS |

Owner client loop 2026-09-15, two models, A008 GUI through ACME v2. No raw
payloads recorded. Observed path:

chat → tool → continuation → retrieval → answer → extraction → one batch
relation call → commit → next turn retrieves the memory.

Image generation remains on the existing NVIDIA/KIE image transports (not ACME)
and was owner-verified still working.

Owner GUI screenshots (no payloads):
[evidence](../evidence/A008-0118_acme-runtime-v2-go.md). Muse retrieves
`oldschool` neon-text knowledge. Luna and DeepSeek still create images. Code
Canvas preview still works.

Skipped:

- Live Nemotron Omni: not in the frozen named order (the Nemotron row is 3.5
  Lightning). Deterministic Omni mapping still exists.
- Portable engine zip/extraction: no engine packaging or panel change; existing
  `engine-host` tests in the core suite passed.

Stage 3.5 is **GO**. ACME v2 is the accepted text/chat execution substrate when
explicitly selected. Direct chat transports remain available as reference.
Image/audio/video stay on their current owners. Stage 4 may start and must keep
application `commandId`/`turnId`/event sequence distinct from ACME
`modelExecutionId`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] `docs/tasks/A008-0103_stable-client-api-program.md`
- [x] ADR/index only if implementation reveals a real decision conflict

## Handoff and Follow-ups

- Current state: Complete. Stage 3.5 **GO**.
- Next recommended step: A008-0103 Stage 4 (turn/message identity, snapshots,
  terminal outcomes, receipts/idempotency, reconnect/resume). Keep those
  identities distinct from ACME execution IDs.
- Blockers: none for this charter.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive under `docs/finished/A008-0118_acme-runtime-v2-consumer.md`.
- Restore `docs/CURRENT_TASK.md` from the template before push.
- Write `docs/handoffs/A008-0118.md`.
- Operator appends the signed journal entry on merge.
