# A008-0124 — native vision input and model capability metadata

Task ID: A008-0124
Parent Task: None
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-17
Last updated: 2026-09-17
Charter frozen at: 2026-09-17; contract revision `79f0274b6ab62dc985ed1fe5f4b52ff155052b47`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0044-native-vision-input.md`
- `docs/adr/0020-source-upload-ingest.md`
- `docs/adr/0026-gui-session-controls.md`
- `docs/adr/0043-acme-execution-boundary.md`
- `docs/backlog/multimodal-chat-content.md`
- `docs/finished/A008-0054_model-modalities.md`

## Task Summary

Close the last owner-approved product gap before A008-0103 Stage 4: expose verified model capabilities/specifications in the Parameters UI and let already-uploadable images enter ordinary chat as native vision input when the selected model declares image support. Preserve text-only committed history, source provenance, provider ownership and the accepted ACME execution boundary.
## Task Charter

### Goal

Make verified model capabilities visible and make declared image input actually usable in the current A008 product GUI, without changing durable chat/memory semantics or bypassing ACME/provider boundaries.

### Primary Deliverable

One additive vision-input path from existing upload → transient composer attachment → capability-gated chat invocation → direct/ACME model execution, plus a model specification panel driven by A008-owned metadata.

### In Scope

- Extend the shared `/v1/models` contract with provider/execution identity, `inputModalities`, verification date and existing generation-capability metadata needed by the UI.
- Render model specification values and deterministic badges such as Vision, Multimodal and Reasoning from declared metadata only; never infer them from model ids/names.
- Add one-image composer attachment UX that reuses the existing `uploadSource()` / `POST /v1/upload` path and keeps only bounded locator metadata in renderer state after upload.
- Add an optional image-attachment descriptor to the current v1 prompt/session path and validate it under existing session ownership.
- Resolve the source locator through the existing source-store containment boundary and reject unsupported/unresolvable media before model execution.
- Add provider-neutral invocation-local image parts while keeping committed `ChatMessage.content` text-only.
- Preserve the image part through tool-call continuations within the same turn without persisting it into later dialogue history.
- Map image input for the built-in image-capable profiles through their configured direct transports and through `AcmeChatTransport`; ACME receives an image content part plus `requiredCapabilities.vision = true`.
- Keep text-only turns behaviorally unchanged, including existing committed history and post-output analysis inputs.
- Add focused protocol, GUI, transport and ACME-parity regressions plus one owner-authorized live image-turn smoke before completion.

### Out of Scope

- Video or audio chat input.
- A vision/OCR tool or cross-model vision fallback for text-only models.
- Automatic model/provider/transport switching when image input is unsupported.
- Automatic image description, OCR, source knowledge extraction or new memory semantics from a chat attachment.
- Image generation changes.
- V2/SDK attachment transport, Stage-4 command/turn identity, reconnect ordering, idempotency or recovery behavior.
- Remote catalog scraping or capability inference from model names/ids.
- Advertising structured-output, function-calling or other feature badges unless the corresponding source-backed profile contract is added in scope without changing this task's primary outcome.
- Changes to ACME cognitive/domain/memory semantics or A008 tool authority.

### Definition of Done

- `/v1/models` exposes the verified metadata needed by the Parameters UI with shared protocol validation.
- Parameters → Model shows readable specifications and capability badges without model-name inference.
- Selecting an image in the composer reuses the existing upload route and sends only its validated locator metadata over the prompt/session wire.
- An image-capable selected model receives the original image in its native multimodal provider request; a text-only selected model fails before provider/ACME dispatch with an explicit unsupported-input outcome.
- ACME execution maps the same A008-prepared attachment to ACME image content with `vision` required; it does not bypass ACME or fall back to a direct provider after dispatch.
- A tool-call continuation within the same turn retains the image context needed to continue that turn.
- Successful chat still commits only original user text and final assistant text; no attachment bytes/data URL enters committed dialogue, retrieval history or post-output analyzer input.
- Existing source ingest/provenance remains the only path by which the uploaded image itself becomes durable evidence.
- Existing text-only request payloads remain unchanged apart from additive model-metadata responses.
- One owner-authorized live image turn succeeds through the active ACME path on a built-in image-capable profile before this task is Complete.
- Full core/GUI/protocol tests, typecheck, builds and `git diff --check` pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01, PC-04 and PC-06; ADR 0044.
Contract revision: `79f0274b6ab62dc985ed1fe5f4b52ff155052b47`.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Model metadata projection | PC-06; ADR 0026 D4; ADR 0044 D6 | User can see whether the selected model actually accepts images and its verified limits; omission leaves a declared capability invisible and forces guesswork | Extend existing model DTO and Parameters model page; derive badges only from declared fields | Shared schema test + GUI model-card render tests |
| Invocation-local image input | PC-06; ADR 0044 D1-D3 | A listed image modality becomes usable in chat; omission leaves A008 advertising support it cannot exercise | Reuse upload locator, additive prompt attachment descriptor and runtime capability/containment validation | Protocol/host/session tests; text-only negative case fails pre-dispatch |
| Direct/ACME execution parity | PC-01; ADR 0043; ADR 0044 D4 | Native vision works through the configured execution substrate without a second chat engine or hidden fallback | Map one provider-neutral image part at transport boundary; set ACME `vision` requirement | Captured direct payloads + ACME request parity + live ACME image smoke |
| History/provenance isolation | PC-04; ADR 0020 as amended by ADR 0044 D1/D5 | Vision does not contaminate durable dialogue or turn an image into a user assertion | Keep committed `ChatMessage` text-only and source ingest separate | Session/history/post-output regression proving no attachment persistence |
### Minimum Verification Gates

- [ ] Shared protocol schemas accept the additive model metadata and optional prompt attachment while existing v1 fixtures remain compatible.
- [ ] GUI tests cover capability/spec rendering, image attach/remove/send and unsupported-model messaging.
- [ ] Core/session tests prove attachment validation, source-locator containment and text-only committed history.
- [ ] Direct NVIDIA/OpenAI payload tests cover built-in image-capable profiles without changing existing text-only payloads.
- [ ] ACME adapter tests prove image `ModelContentPart` mapping and `requiredCapabilities.vision = true` with no execution fallback.
- [ ] Tool-loop regression proves the image survives same-turn continuation only.
- [ ] `npm run test:core`, GUI tests, protocol verification, root/GUI typecheck and builds pass.
- [ ] `git diff --check` passes.
- [ ] Owner-authorized live image smoke through the active ACME path succeeds on one built-in image-capable model.

## References

- `docs/PROJECT_BRIEF.md` PC-01, PC-04, PC-06.
- `docs/adr/0044-native-vision-input.md`.
- `docs/adr/0020-source-upload-ingest.md` D1-D6 as amended.
- `docs/adr/0026-gui-session-controls.md` D4.
- `docs/adr/0043-acme-execution-boundary.md`.
- `docs/backlog/multimodal-chat-content.md`.
- `docs/finished/A008-0054_model-modalities.md` and A008-0055 correction history.
- ACME `ModelRequest` / `ModelContentPart` contract observed in the model-runtime dependency; A008 must verify compatibility against the configured runtime during implementation.

## Checklist

- [ ] Activate A008-0124 on an implementation branch by copying this frozen charter to `docs/CURRENT_TASK.md`.
- [ ] Extend model metadata protocol and Parameters model specification UI.
- [ ] Add transient composer image attachment using the existing upload client.
- [ ] Add additive v1 prompt attachment contract and host/runtime validation.
- [ ] Add invocation-local image representation while preserving committed string history.
- [ ] Map image input through current direct transports and ACME without fallback.
- [ ] Add focused regressions, then run full minimum gates.
- [ ] Run one owner-authorized live ACME vision smoke and record evidence.
- [ ] Update owning docs, archive task, write handoff and restore `CURRENT_TASK.md` before final push.

## Decisions and Notes

- This is the final approved pre-Stage-4 task. Completion does not itself start or modify A008-0103 Stage 4.
- ADR 0044 resolves the previous ADR 0020 D6 conflict narrowly: vision may be invocation-local while `ChatMessage.content` remains the durable text contract.
- The existing upload/source store is reused; no second upload route or blob owner is authorized.
- UI badges are presentation derived from source-backed metadata. Unknown capabilities are omitted, not guessed.
- ACME already has an image content-part/vision-capability shape in its model runtime; A008 remains responsible for preparing and validating the attachment.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact offline and live checks and outputs.
- [ ] Record skipped checks and reasons; the live ACME image smoke is required for Complete.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/HOST_PROTOCOL.md` / shared protocol docs for the additive v1 attachment/model metadata fields
- [ ] `docs/JOURNAL.md` at merge
- [ ] archive + handoff
## Handoff and Follow-ups

- Current state: Ready; no implementation branch is active from this charter commit.
- Next recommended step: implement A008-0124, complete its required live vision smoke, then return to the frozen A008-0103 Stage 4 sequence.
- Blockers: none known; active ACME runtime compatibility must be verified during implementation.
- Child tasks: none authorized.
- Resume condition: branch is based on the charter commit and `docs/CURRENT_TASK.md` matches this frozen charter.
- Open questions: none that change the frozen outcome; transport-specific image encoding is an implementation detail within ADR 0044.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from the template before final push.
- Write `docs/handoffs/A008-0124.md`.
- Append the signed `docs/JOURNAL.md` entry on merge.
- Only after A008-0124 is Complete may the operator resume A008-0103 Stage 4.
