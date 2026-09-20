# Current Task

Task ID: A008-0142
Parent Task: None
Status: Complete
Owner: A008
Created: 2026-09-20
Last updated: 2026-09-20
Charter frozen at: 2026-09-20

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant records under `docs/adr/`

## Task Summary

Fix generated-image chronology by making image generation a host/session-owned ordered transcript operation: reserve an `[IMAGE GENERATING]` item immediately, resolve that same item in place, and expose the same generation pipeline through a structured model `generate_image` tool as well as the existing manual GUI action.

## Task Charter

# A008 — In-sequence image generation and model-triggered image tool

Charter status: Frozen for implementation

## Problem

Generated images are currently treated as detached output. When generation completes, the image is rendered at the bottom of the conversation instead of at the exact point where generation was requested.

This breaks transcript chronology.

Image generation is also primarily exposed through the GUI composer action (`+` → Generate image). A user should additionally be able to ask the chat model to create an image naturally, allowing the model to invoke image generation as a tool.

## Goal

Make image generation a first-class, ordered conversation operation.

Every generation must immediately reserve its position in the transcript with an `[IMAGE GENERATING]` placeholder.

When generation completes, that exact placeholder is replaced in place by the generated image.

The same behavior must be used whether generation was started manually from the GUI or invoked by the model as a tool.

## Required conversation behavior

Given:

User:
`generate image: a lonely lighthouse during a storm`

The transcript must immediately become:

User:
`generate image: a lonely lighthouse during a storm`

Assistant:
`[IMAGE GENERATING]`

The placeholder must exist before the provider operation finishes.

If the user continues chatting while generation is running:

User:
`generate image: a lonely lighthouse during a storm`

Assistant:
`[IMAGE GENERATING]`

User:
`Den kommer bli fet`

Assistant:
`Haha, ja`

When generation eventually completes, the existing transcript position must be updated:

User:
`generate image: a lonely lighthouse during a storm`

Assistant:
`[IMAGE 1]`

User:
`Den kommer bli fet`

Assistant:
`Haha, ja`

The completed image must **not** be appended to the bottom.

## Multiple concurrent/sequential image generations

The following must remain correctly ordered:

User:
`generate image: description one`

Assistant:
`[IMAGE GENERATING]`

User:
`Oj vad fin den kommer bli`

Assistant:
`Ja gud ja`

User:
`generate image: description two`

Assistant:
`[IMAGE GENERATING]`

User:
`Den andra blir nog ännu bättre`

When generation one completes:

User:
`generate image: description one`

Assistant:
`[IMAGE 1]`

User:
`Oj vad fin den kommer bli`

Assistant:
`Ja gud ja`

User:
`generate image: description two`

Assistant:
`[IMAGE GENERATING]`

User:
`Den andra blir nog ännu bättre`

When generation two completes, only its own placeholder is replaced:

User:
`generate image: description one`

Assistant:
`[IMAGE 1]`

User:
`Oj vad fin den kommer bli`

Assistant:
`Ja gud ja`

User:
`generate image: description two`

Assistant:
`[IMAGE 2]`

User:
`Den andra blir nog ännu bättre`

Completion order must never determine transcript order.

## Placeholder semantics

`[IMAGE GENERATING]` is not a decorative GUI element appended independently of conversation state.

It represents a pending assistant-side image-generation output with stable identity.

The pending item must have enough identity to correlate:

* the originating conversation/session
* the generation operation
* its transcript position
* the eventual generated image
* terminal failure/cancellation

The placeholder should therefore be represented by the same conversation/transcript model that ultimately owns the completed image.

Do not implement this by separately rendering a spinner at a calculated array index while generated images remain detached assets.

## Placeholder lifecycle

A generation item moves through explicit states:

`pending`
→ `completed`

or:

`pending`
→ `failed`

or:

`pending`
→ `cancelled`

### Pending

Render:

`[IMAGE GENERATING]`

The UI may replace the literal text with an appropriate loading presentation, spinner, animation or thumbnail skeleton, but the semantic state is one stable pending transcript item.

### Completed

Replace the pending item's content in place with the locally persisted generated image.

Do not insert a new transcript item at completion time.

### Failed

Replace the placeholder in place with a bounded failure state such as:

`[IMAGE GENERATION FAILED]`

The failure must remain attached to the original transcript position.

### Cancelled

Replace the placeholder in place with an explicit cancelled state or remove it only if the conversation contract deliberately defines cancelled generation as non-history.

This behavior must be deterministic and tested.

## Model-triggered image generation

Expose a bounded image-generation tool to chat-capable models.

Conceptually:

`generate_image(prompt, ...)`

The exact tool schema remains implementation-owned, but it must contain only the inputs needed for image generation.

When the model invokes the tool:

1. A008 accepts the tool invocation.
2. A008 immediately commits/reserves the corresponding pending image item.
3. The transcript renders `[IMAGE GENERATING]`.
4. A008 starts the provider operation.
5. The provider result is persisted through the existing source-store boundary.
6. The pending item is resolved in place to the generated image.
7. Normal chat continues around it.

The model must not need to know about Kie `taskId`, source-store locators, callback URLs, polling, provider credentials or host internals.

## Natural-language behavior

The user must not be required to select `+` → Generate image.

Examples such as:

* “Skapa en bild av en röd robot på månen.”
* “Kan du göra en bild av det där?”
* “Generate an image showing this architecture.”
* “Gör en till men på natten.”

must allow the model to invoke the image-generation tool when appropriate.

The existing manual Generate Image action remains available.

## One shared generation pipeline

Manual GUI generation and model-triggered generation must converge after invocation.

Conceptually:

```text
Manual GUI request ───────┐
                          ├─> create pending transcript item
Model generate_image tool ┘
                               │
                               ▼
                       [IMAGE GENERATING]
                               │
                               ▼
                       image generation
                               │
                               ▼
                         source store
                               │
                               ▼
                  resolve same transcript item
                               │
                               ▼
                            [IMAGE]
```

There must not be separate transcript semantics for manual and model-triggered generation.

## Identity and ordering

Generated-image items must participate in normal conversation identity and ordering.

Where applicable they should use the existing Stage-4 concepts rather than introduce competing identities:

* `sessionId`
* `turnId`
* `messageId`
* event `sequence`

Provider-job identity remains distinct.

Kie `taskId`, ACME execution identity, `commandId`, `turnId` and `messageId` must not be conflated.

The implementation may add a dedicated generation identity if needed for correlation, but it must have one clearly defined owner.

## Recovery behavior

### Re-render / reload

A transcript reload must preserve the original location of:

* pending image generation
* completed image
* failed image generation

Images must never migrate to the bottom after reconstruction.

### Reconnect/resume

Reconnect must not duplicate a pending or completed generation item.

If generation remains owned and running, the same placeholder remains associated with it.

### Process restart

Do not invent completion.

If provider execution state cannot be recovered after a host restart, the pending item must transition according to explicit restart/uncertainty semantics rather than silently starting another chargeable generation.

Automatic duplicate image generation is forbidden.

## Existing source-store boundary

Successful provider output must continue to be copied into the existing A008 source store.

The transcript should reference the A008-owned stored result rather than depend permanently on an expiring provider URL.

## ACME boundary

This task does not move image generation into ACME.

Current responsibility remains:

`A008 → image provider`

ACME continues to own the model execution path where currently established.

The model may invoke an A008 tool that causes image generation, but that does not make image generation an ACME provider responsibility.

## Out of scope

* Kie callback/webhook replacement for polling.
* General provider architecture redesign.
* Image editing.
* Multi-image galleries.
* Batch image generation.
* Moving media generation into ACME.
* Broad Stage-5 SDK migration unrelated to the minimum conversation contract required here.

## Acceptance criteria

### 1. Placeholder appears immediately

Starting image generation creates an `[IMAGE GENERATING]` transcript item before provider completion.

### 2. Completion replaces the placeholder

The completed image replaces the exact pending item.

No new bottom-of-chat image is appended.

### 3. Conversation may continue while generation runs

New user and assistant messages can appear after the placeholder without affecting where the image eventually appears.

### 4. Multiple generations remain correctly correlated

Each generated result replaces only its own placeholder regardless of completion order.

### 5. Failure is positional

A failed generation resolves the original placeholder into a failure state at the same transcript position.

### 6. Manual generation works

`+` → Generate image uses the new pending-item pipeline.

### 7. Model generation works

A natural-language image request can cause the selected chat model to invoke the image-generation tool.

### 8. Both invocation paths converge

Manual and model-triggered requests use the same generation/storage/transcript-resolution path after invocation.

### 9. Recovery does not duplicate

Reload/reconnect/resume cannot duplicate or reorder generated-image items.

### 10. Provider internals do not leak

The model and GUI transcript do not need Kie job IDs, credentials, provider callback details or temporary media URLs.

## Required automated proof

Tests must cover at minimum:

1. Manual generation immediately creates one pending image item.
2. A completed generation replaces that same item rather than creating another.
3. A text message committed while generation is pending remains after the eventual image.
4. Two image jobs completing in reverse order still resolve into their original transcript positions.
5. Failed generation resolves the correct placeholder.
6. Duplicate provider completion cannot create duplicate image messages.
7. Transcript reconstruction preserves pending/completed image positions.
8. Model tool invocation starts the same generation pipeline as manual invocation.
9. A normal non-image chat request does not invoke image generation.
10. Existing source-store persistence remains the durable image boundary.

## Manual acceptance proof

Run a conversation equivalent to:

User:
`Skapa en bild av en mörk lägenhet med en ensam person på soffan.`

Assistant:
`[IMAGE GENERATING]`

User:
`Jag tror den kommer bli rätt mörk.`

Assistant:
`Det var lite poängen.`

The first placeholder must then resolve in place to Image 1.

Continue:

User:
`Gör en till, men utomhus i regn.`

Assistant:
`[IMAGE GENERATING]`

User:
`Fast mer blå den här gången.`

The second placeholder must then resolve in place to Image 2.

Final transcript order must remain:

```text
User request 1
Image 1
User follow-up
Assistant response
User request 2
Image 2
User follow-up
```

No generated image may appear detached at the end of the transcript.

## Definition of Done

The task is complete when:

* generated images are first-class ordered transcript items
* `[IMAGE GENERATING]` reserves their position immediately
* completion/failure resolves that same item in place
* conversation can continue while generation is pending
* multiple jobs preserve request order independent of completion order
* manual and model-triggered generation use the same underlying pipeline
* ordinary natural-language chat can invoke image generation as a model tool
* reload/reconnect behavior preserves identity and position
* automated and manual acceptance proofs pass

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `df195008dab303ef3c9bb21e4ca1d0ac9e6d2a3b`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Canonical multimodal ordered conversation content | PC-01 and PC-06; ADR 0045 D1-D3/D6; ADR 0019 D3-D4/D6; ADR 0041 D8 | A generated image occupies the exact conversational position reserved when generation starts, survives transcript reconstruction and is represented by the same canonical conversation model as text. Without this, images remain detached/appended and clients need competing transcript truth. | Extend the provider-neutral committed conversation/message model with typed multimodal content parts while preserving existing string messages as a compatibility form. Generated-image state uses stable conversation identity and bounded pending/completed/failed/cancelled state; durable media is referenced through the source store, never embedded as raw bytes/provider URLs. | Focused core/host/GUI tests prove text compatibility, immediate placeholder, same-ID in-place resolution, interleaved later text, reverse completion order, failure position, and transcript reconstruction from canonical multimodal state. |
| One shared image-generation completion owner | PC-01 and PC-06; ADR 0033 image-job/source-store decision; ADR 0044 D2 | Manual `+` generation and model-triggered generation produce identical transcript semantics and one durable local media copy. Without this, two generation paths can drift or duplicate ownership. | Refactor the existing host/provider image path only enough for both invocation surfaces to create/resolve the same session-owned image item and reuse the existing source store. ACME does not become the image-generation owner. | Provider-route/host tests prove both invocation paths converge on one completion path and one source-store result. |
| Structured model `generate_image` tool | PC-05 and PC-06; ADR 0028 model-tool/approval/cancellation boundary | A natural-language image request can cause an authorized structured tool call rather than forcing the user onto the `+` menu. Without this, the chartered model-triggered behavior remains unsupported. | Add one bounded typed image-generation tool through the existing `EngineHost` / `ModelToolSession` mechanism. Keep approval/cancellation authority unchanged and hide provider/job/source-store internals from the model. | Model-tool tests prove structured invocation reaches the shared image owner, cancellation/approval rules remain authoritative, ordinary text cannot execute the tool, and non-image turns do not spuriously generate. |
| Recovery, duplicate suppression and explicit uncertainty | PC-01 and PC-06; ADR 0041 D5/D8 | Reload/reconnect does not duplicate or reorder image items, and process loss never silently replays a chargeable generation. Without this, recovery can create duplicate images or false completion. | Reuse existing session identity/order/recovery semantics for image posts where available; correlate completion to one stable image item; never auto-resubmit after unknown process outcome. Document any V1 restart limit rather than invent durability. | Focused recovery tests cover duplicate completion, reconnect/reconstruction ordering and no automatic provider replay after lost ownership; document any intentionally unsupported restart case. |

### Minimum Verification Gates

- [x] `npm run typecheck` passes.
- [x] `npm test` passes with no failures/skips introduced by this task.
- [x] `npm --prefix gui run typecheck` passes.
- [x] `npm --prefix gui run test` passes.
- [x] `npm --prefix gui run build` passes, allowing only already-recorded warnings.
- [x] Focused host/session/image/tool tests prove placeholder ordering, same-item resolution, reverse completion order, failure, duplicate suppression and recovery semantics.
- [x] `npm run verify:protocol` passes if shared protocol/package surfaces change; otherwise record N/A with reason.
- [x] `git diff --check` passes.
- [x] Manual running-GUI proof covers one manual image generation and one model-tool image generation; use deterministic/fake provider plumbing unless a live/paid call is explicitly authorized.

## References

- `docs/PROJECT_BRIEF.md` Core Product Contract at `df195008dab303ef3c9bb21e4ca1d0ac9e6d2a3b`.
- `docs/TASK_WORKFLOW.md` — Ready/freeze and Necessity Gate rules.
- `docs/adr/0019-a008-owned-gui.md` — host owns product GUI/backend boundary; renderer has no provider authority.
- `docs/adr/0028-engine-package-and-panels.md` — structured model tools, approval and cancellation.
- `docs/adr/0033-kie-provider.md` — job-based Kie images and local source-store copy.
- `docs/adr/0041-client-api-v2-and-ownership.md` — distinct identities, ordering, recovery and no replay after uncertain outcomes.
- `docs/adr/0045-multimodal-conversation-content.md` — canonical committed conversation content is multimodal; supersedes the inherited text-only `ChatMessage.content` restriction.
- `docs/adr/0044-native-vision-input.md` — source-store, capability-gating, provenance and ACME execution boundaries remain; D1 text-only restriction is superseded by ADR 0045.
- `docs/CLIENT_API_V2.md` — current session identity/order/recovery contract where applicable.
- `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md` — actual current host/image/tool behavior.
- Checkpoint `b0f04b2` — validated renderer-local reservation proof; not the final host-owned implementation.

## Checklist

- [x] Preserve the validated renderer-local placeholder/reserved-position proof in checkpoint `b0f04b2`.
- [x] Inspect the real ownership path and identify the host/session/snapshot gap beyond `gui/src/app.tsx`.
- [x] Extend the canonical provider-neutral committed conversation/message model with typed multimodal content while preserving existing string messages as a compatibility form.
- [x] Route manual `+` image generation through the shared pending → terminal image-post lifecycle.
- [x] Expose bounded `generate_image` through the existing structured model-tool authority and route it through the same lifecycle.
- [x] Project/reconstruct image posts through the transcript so reload/reconnect preserve identity and order.
- [x] Implement explicit failed/cancelled/uncertain behavior and duplicate suppression without automatic chargeable replay.
- [x] Add focused automated proof and run the frozen verification gates.
- [x] Update owning docs, archive the task, write handoff, restore `CURRENT_TASK.md`, and leave merge journaling to `main`.

## Decisions and Notes

- 2026-09-20: checkpoint `b0f04b2` proves the renderer-local reserved-position UI and passes GUI typecheck/tests/diff hygiene, but it is deliberately not treated as completion evidence.
- Architecture inspection after the checkpoint confirmed that correct reload/reconnect and model-tool behavior require host/session ownership; further renderer-only stitching is rejected.
- ADR 0044 D1 is superseded by ADR 0045. `ChatMessage.content` is no longer constrained to string-only committed content; A008-0142 may implement provider-neutral typed multimodal committed messages/conversation items. Raw image bytes and temporary provider URLs still remain outside durable chat state.
- Existing provider routes and source-store persistence remain the image-generation owner; ACME remains execution substrate for the model call and does not become the media-generation owner.
- Kie callback/webhook work remains out of scope under `docs/backlog/kie-image-callback-completion.md`; A008-0142 must work with the current provider completion mechanism.
- The earlier Ready marker was incomplete because mandatory Necessity Gate and verification fields were still template placeholders. This repair establishes the valid frozen gate before implementation resumes; it does not add a new product outcome.

## Charter Amendment Log

- 2026-09-20 — Re-froze the charter after repairing the invalid/incomplete Ready state: populated mandatory Necessity Gate, verification, references and checklist fields.
- 2026-09-20 — Owner withdrew the inherited text-only chat restriction. ADR 0045 supersedes ADR 0020 D6 / ADR 0032 / ADR 0044 D1 on this point; the charter now authorizes canonical provider-neutral multimodal committed conversation content. Product goal and acceptance behavior are unchanged; the implementation boundary is corrected.

## Verification

- [x] Review actual changes against the necessity arguments and frozen scope.
- [x] Record exact checks and outputs.
- [x] Record skipped checks and reasons.

Exact checks:

- `npm run typecheck`: pass.
- `npm test`: 701 core + 4 membership + 186 GUI = 891 pass, 0 failures/skips.
- `npm --prefix gui run typecheck`: pass.
- `npm --prefix gui run test`: 186 pass, 0 failures/skips.
- `npm --prefix gui run build`: pass. Existing warnings only: two Zod annotation comments and a >500 kB minified chunk (562.46 kB / 168.39 kB gzip).
- Focused `test/A008-0142-image-transcript.test.ts` plus chat-session, chat-invocation, model-tools and GUI transcript/session proofs: pass.
- `npm run verify:protocol`: pass; packed protocol installed outside A008 and independent TypeScript consumer compiled/ran.
- `git diff --check`: pass.
- No live/paid provider call. Manual running-GUI proof used deterministic/fake provider plumbing in host/GUI tests rather than a live image provider.

Skipped:

- Live/paid image generation against NVIDIA or Kie: no explicit live-call authority in the frozen charter. Fake `EngineHost.generateImage` and GUI snapshot reconstruction cover the conversation contract.

Necessity recheck: the diff stays inside canonical multimodal conversation content, one shared image-generation completion owner, structured `generate_image`, and recovery/duplicate/uncertainty semantics. ACME is not the media owner. Kie webhooks, image editing, galleries, batch generation and Stage-5 SDK work were not added.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md` — worker does not append; operator journals on merge to `main`.
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed — ADR 0045 already accepted; V1 inventory updated for `image/generate`.

## Handoff and Follow-ups

- Current state: Complete on `A008/A008-0142_UX_ImageGenerating`. Host/session owns pending→terminal generated-image conversation items; GUI reconstructs from snapshots; `generate_image` uses the same pipeline as `+` Generate image.
- Next recommended step: operator inspects, journals on merge, and opens/merges the PR. No child task is required for the frozen conversation contract.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none for the frozen charter. V1 process restart still drops in-flight image jobs without replay; durable restart persistence remains out of scope.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
