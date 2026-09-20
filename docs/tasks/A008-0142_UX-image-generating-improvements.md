# Current Task

Task ID: A008-0142
Parent Task: None
Status: Ready
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

Describe why this bounded task is active now and its intended outcome.

## Task Charter

# A008 — In-sequence image generation and model-triggered image tool

Status: Draft
Parent Task: None
Created: 2026-09-20

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
Contract revision: <Git commit containing the reviewed contract>

One row per coherent change or group serving one outcome. Apply the Necessity
Gate in `docs/TASK_WORKFLOW.md`; results belong in Verification. References,
intended outcomes and planned checks freeze with the charter. Record refinements
of the initial approach in mutable notes within those bounds.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| <coherent change> | <exact reference> | <enable / fix / protect / verify; concrete consequence> | <bounded approach> | <test or named review> |

### Minimum Verification Gates

- [ ] Define checks that may be strengthened but not removed after Ready.

## References

- Add owned documents, source revisions, contracts, and decisions.

## Checklist

- [ ] Break work into ordered steps and keep them truthful.
- [ ] Include verification and documentation updates.

## Decisions and Notes

- Record assumptions and route discoveries through `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state:
- Next recommended step:
- Blockers:
- Child tasks:
- Resume condition:
- Open questions:

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
