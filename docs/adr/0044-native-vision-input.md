# ADR 0044 — Invocation-local native vision input

Status: Accepted
Date: 2026-09-17
Task: A008-0124
Decision owner: Operator

Partially superseded by [ADR 0045](0045-multimodal-conversation-content.md): D1 and all derived text-only committed-chat restrictions are withdrawn. D2-D7 remain authoritative where compatible with ADR 0045.

Amends: ADR 0020 D6. Complements ADR 0026, ADR 0032 and ADR 0043.

## Context

A008 already records `ModelProfile.inputModalities`, and built-in profiles include image-capable models. The GUI already uploads images through `POST /v1/upload`, stores them content-addressed outside the repository, and receives a validated source locator. The missing path is from that uploaded image into an ordinary chat invocation.

ADR 0020 D6 deliberately kept `ChatMessage.content` as a string and rejected changing durable chat/history merely to support image ingest. That remains a good boundary for committed dialogue, but its stronger statement that vision is never a chat concern now blocks an owner-approved product capability.

The active ACME model-runtime contract already represents model input as content parts, including image parts with `mediaType` and `dataRef`, and has a `vision` capability. A008 can therefore add native vision without giving ACME any cognitive, memory or tool authority.

## Decision

### D1. Committed chat remains text-only

`ChatMessage.content` remains a string. User history, memory-aware dialogue history and post-output staging continue to commit the original user text plus final assistant text only. Image bytes, data URLs and attachment descriptors never become committed chat content merely because they were used for one model invocation.

Native image input is invocation-local data attached to the current prompt/request. This explicitly amends ADR 0020 D6 only to permit vision during model execution; it does not collapse source ingest and chat history into one representation.
### D2. Reuse the existing upload/source boundary

The product GUI reuses the existing `POST /v1/upload` path. After upload, the composer holds only bounded attachment metadata such as locator, media type and display name. The runtime resolves the locator through the existing source-store containment checks before dispatch.

The prompt/session wire gains only an additive optional attachment descriptor. The renderer does not read provider credentials and does not invent a second blob store or image transport.

### D3. Capability is checked before provider execution

The selected model profile is authoritative for supported input modalities. A prompt carrying an image is refused before provider/ACME dispatch when the selected profile does not declare `image` input or when the attachment cannot be resolved as an accepted image.

The GUI may disable or explain unsupported attachment controls for usability, but runtime validation remains authoritative. A008 does not automatically switch models, providers or execution transports to make an image request succeed.

### D4. A008 prepares one multimodal invocation; transports only map it

A008 owns one provider-neutral invocation representation containing text plus image attachment parts. Direct provider transports map that representation to their documented multimodal request shape. The ACME adapter maps the same prepared image input to ACME `ModelContentPart` image entries and sets `requiredCapabilities.vision = true`.

ACME still only executes an A008-prepared call. It does not choose attachments, describe images for memory, execute A008 tools or reinterpret the user's request. There is no automatic fallback from ACME to a direct provider after dispatch.
### D5. Image memory/provenance stays separate

Using an image in a chat turn does not automatically ingest, describe, OCR or accept facts from that image. The existing source-ingest path remains the owner of durable image evidence and its provenance. Post-output knowledge analysis continues to receive the committed text message and final answer under its existing contract.

Tool-call continuations within the same turn may reuse the invocation-local image context needed to complete that turn, but later committed turns do not inherit it unless a new attachment is supplied or durable knowledge was established through the normal memory path.

### D6. Model metadata is projected, not inferred in the renderer

`GET /v1/models` may expose verified model/provider metadata already owned by A008, including provider identity, execution provider, input modalities, verification date and generation capabilities. The Parameters UI may derive presentation badges such as `Vision`, `Multimodal` and `Reasoning` from those declared fields.

The renderer must not infer capabilities from model ids or names. Unknown or unverified feature claims are omitted rather than guessed. Adding new provider feature facts such as structured-output support requires a source-backed model/profile contract; this decision does not authorize decorative claims.

### D7. This task is image-only and precedes Stage 4

A008-0124 implements current product-GUI image input and model metadata before A008-0103 Stage 4 begins. Video/audio input, vision-tool fallback, OCR, automatic image-to-memory extraction and V2/SDK attachment transport are separate work. Stage 4 may reuse the provider-neutral attachment contract but owns its own V2/session sequencing and recovery semantics.

## Consequences

Text-only turns retain their existing payload/history behavior. Image-capable turns gain native image understanding without changing durable dialogue representation. Unsupported model/image combinations fail before paid execution. Existing source storage, provenance, provider credential and ACME execution boundaries remain authoritative.
