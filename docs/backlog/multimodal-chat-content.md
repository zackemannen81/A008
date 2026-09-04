# Multimodal chat content

Status: Open
Source: A008-0055; owner diagram of the vision upload path
Recorded: 2026-09-04

## Context

The owner's diagram of the upload flow has two lines out of an uploaded image.
The one A008 built goes image → describe with a vision model → ingest the
description as knowledge. The one it did not goes image → straight into the
provider call, for a model that accepts images itself.

A008-0055 added two such models: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
(text, image, video, audio) and `moonshotai/kimi-k3` (text, image). `/model` can
select them. A008 still cannot send them an image.

## The blocker

`ChatMessage.content` is a `string`. ADR 0020 D6 made that a decision rather
than an accident: extraction produces text, so a source becomes text before it
becomes a message, and the chat contract stayed simple.

The vendor's own Build-tab sample shows what a vision turn needs:

```json
"content": [
  { "type": "text", "text": "…" },
  { "type": "image_url", "image_url": { "url": "…" } }
]
```

That is a core contract change. It touches `ChatMessage`, the NVIDIA adapter's
request body, `ChatSession` history, and everything that reads `content` as a
string — including the memory write path, which ingests a turn's content as an
`Utterance`.

## Outcome sought

A chat turn can carry an image to a model whose profile declares the `image`
modality, without any other caller having to know about parts.

## Open questions to settle before starting

1. **Union or always-array?** `string | readonly ContentPart[]` keeps every
   existing caller compiling and every existing test meaningful, at the cost of
   a narrowing check at each read site. An always-array shape is cleaner and is
   a breaking change to a contract an external client does not see but the CLI,
   ACP and memory paths all do.
2. **What does memory ingest do with an image part?** An `Utterance` has string
   `content`. The honest answer is probably that the image part is not ingested
   as an utterance at all and the existing describe-then-ingest path remains the
   way an image enters memory — which would mean the two lines in the owner's
   diagram stay separate rather than converging.
3. **Where does the image come from?** `POST /v1/upload` already stores bytes
   content-addressed outside the repository and returns a locator. A data URI in
   the request body and a reference to the store are different trade-offs in
   request size and in what the host has to serve.
4. **What happens when the selected model has no `image` modality?** Refusing in
   core is checkable and testable; refusing at the provider is a wasted call.
   `inputModalities` exists to make the former possible.
5. **Video and audio.** The omni profile declares both. Nothing in this item
   addresses them, and a `ContentPart` union designed only around images will
   have to be reopened.

## Dependencies

None blocking. `inputModalities` (A008-0054, corrected in A008-0055) is the
prerequisite and is on `main`.

Needs an ADR amending ADR 0020 D6, because D6 is the decision this reverses.

## Suggested verification

A turn with an image part against a profile declaring `image` reaches the
adapter with the array shape the vendor sample uses; the same turn against a
text-only profile is refused in core before any request is built; an existing
string-content turn produces a byte-identical request body to the one it
produces today.
