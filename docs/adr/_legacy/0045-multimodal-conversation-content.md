# ADR 0045 — Multimodal committed conversation content

Status: Accepted
Date: 2026-09-20
Task: A008-0142
Decision owner: Operator

Supersedes the text-only chat restriction in ADR 0020 D6, the derived
`ChatMessage.content` restriction in ADR 0032, and ADR 0044 D1. ADR 0044's
source-store, capability-gating, provenance and ACME execution boundaries remain
in force except where they depended on committed chat being text-only.

## Context

A008's text-only `ChatMessage.content` rule was introduced to keep an early
source-ingest task bounded. It later became a general product constraint even
though A008 now has native vision input, generated images, a source blob store,
stable message/session identities and a richer client API.

That restriction now causes visible product defects: generated images are
detached from the ordered conversation, image state needs parallel renderer-only
bookkeeping, and natural multimodal conversation cannot be represented by the
canonical chat model.

The owner explicitly withdraws the text-only restriction. The original reason
for keeping source ingestion separate from dialogue does not justify limiting
the conversation model itself.

## Decision

### D1. Committed chat is multimodal

`ChatMessage.content` is no longer required to be a string.

The canonical conversation model may carry typed content parts, including text
and image references. Existing string content remains a compatibility form and
may be normalized to a text part rather than forcing an immediate flag-day
migration of every caller.

The exact TypeScript shape is implementation-owned by the activating task, but
it must be provider-neutral and must not expose provider-specific request
objects as durable application state.

### D2. Durable media is referenced, not embedded

Committed image content references A008-owned source-store media using bounded
metadata such as locator, media type and display name. Raw image bytes, provider
credentials, temporary provider URLs and data URLs are not durable chat state.

The existing source-store containment and local-copy rules remain authoritative.

### D3. Generated images are first-class assistant conversation content

Image generation reserves one stable assistant-side conversation position before
provider completion. Pending, completed, failed and cancelled generation states
belong to that same ordered conversation item/message identity.

Completion resolves the existing item in place. Provider completion order must
not reorder the transcript, and a completed image must not be appended later as
a detached asset.

### D4. Multimodal chat does not auto-create semantic knowledge

Removing the text-only chat restriction does not merge chat persistence with
source ingestion or semantic memory.

Text portions may continue through the existing dialogue/history and post-output
paths. Image parts do not automatically become utterance text, OCR, descriptions
or accepted knowledge. Durable image evidence and extraction/provenance remain
owned by the existing source-ingest boundary.

### D5. Provider/model capability remains authoritative

A008 may project committed multimodal content into a provider invocation only
when the selected model and execution route support the required modality.

Unsupported combinations fail explicitly before paid execution. A008 does not
silently switch models/providers or infer modality support from names.

### D6. One conversation model across clients

GUI, SDK and later native clients must consume the same canonical ordered
conversation representation. Renderer-only image arrays or post-hoc stitching
are not an alternate source of truth.

V1 compatibility adapters may project or degrade explicitly while migration is
in progress, but they do not redefine the canonical model.

### D7. Superseded decisions

The following statements are no longer authoritative:

- ADR 0020 D6: "`ChatMessage.content` is a `string` and stays one" and the
  rejection of image content blocks in `ChatMessage`.
- ADR 0032: image turns are transcript attachments "not a change to
  `ChatMessage.content`".
- ADR 0044 D1: "Committed chat remains text-only" and any downstream constraint
  whose only justification is that sentence.

ADR 0044 D2-D7 remain authoritative where compatible with this ADR. In
particular, source-store locators, model capability checks, A008 ownership of
cognition/tools, ACME's execution-only boundary and separate semantic-memory
provenance remain unchanged.

## Consequences

- A008-0142 may change the provider-neutral chat/content contract instead of
  building a second transcript type around an obsolete string-only message.
- Existing string-message callers need a compatibility path while consumers are
  migrated.
- Transcript/snapshot/protocol surfaces that expose committed messages must gain
  a typed multimodal representation or an explicit compatibility projection.
- Memory code must deliberately select the textual material it consumes instead
  of assuming every message body is one string.
- Generated images can be represented in canonical session history with stable
  identity and ordering.
- This ADR does not authorize image editing, OCR, automatic image-to-memory
  extraction, provider callbacks, or moving image generation into ACME.

## Required verification

The activating implementation must prove at minimum:

1. existing text-only conversations remain behaviorally compatible;
2. one committed assistant image survives transcript reconstruction in order;
3. a pending generated image resolves the same stable conversation identity;
4. later text can be committed while generation is pending without reordering;
5. unsupported model/media combinations fail before provider execution;
6. memory/post-output paths do not accidentally stringify, ingest or accept
   image metadata as semantic assertions;
7. renderer, host and protocol do not maintain competing transcript truth.
