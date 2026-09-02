# ADR 0020 — Source upload ingest

Status: Accepted

Date: 2026-09-02

Decision owner: Operator

Amends: [ADR 0019](0019-a008-owned-gui.md) D4 (host protocol v1 gains a route).

## Context

The owner asked for an upload path so a user can hand A008 a document or an
image and have its content become retrievable knowledge. A design review of the
owner's flow sketch established three constraints that the sketch did not show.

**The runtime is not in the GUI host.** `src/gui-host/` bridges a WebSocket to
an `A008-acp` subprocess; `createLocalMemoryRuntime` is called in
`src/acp/server.ts`, inside that subprocess. The host has no memory runtime and
must not gain one: `docs/CURRENT_STATUS.md` records the SQLite adapter as
single-process, so a second runtime writing the same file is precisely the
failure that warns about.

**Text normalisation is not a vision workaround.** `IngestInput.content` is a
`string`, retrieval indexes propositions, and `PROJECT` budgets exact UTF-8
bytes. A model that can read an image directly does not remove the need for a
durable text representation; it changes how that text is produced.

**A008-0040 already opened the provenance the path needs.** `ingest()` accepts a
caller-named `relation`, so a model's description of an image can be recorded as
`derived_from` with the model as `speaker`, instead of being attributed to the
uploading user and passing `user-assertion-v1` as a user assertion.

## Decision

### D1. Extraction runs in the ACP process, over a locator

The GUI host receives the upload, writes the original bytes to a configured
store, and sends the ACP process a **locator**, never the bytes.

```text
browser -> POST /v1/upload (bytes)
        -> host: sniff, cap, write blob, mint locator
        -> ACP request over the existing bridge (locator only)
        -> agent: read blob, extract text, ingest()
        -> evidence artifact + utterance + provenance
```

Three reasons: blobs never cross stdio JSON-RPC; every provider call stays in
the process that composes the credential and transport, per ADR 0019 D3; and the
host remains a thin I/O surface.

### D2. The store is a configured root outside the repository

`A008_SOURCE_STORE_PATH` names it. It is validated exactly as
`A008_MEMORY_SQLITE_PATH` is: resolved, and rejected when it lands inside the
A008 repository.

A locator is `source:<sha256>/<sanitised-name>`. The agent resolves it against
the store root and **must reject any locator that escapes that root**. The host
names the path and the agent reads it, so path containment is a security
boundary, not a convenience check.

Content is addressed by SHA-256 of the bytes, which gives deduplication and lets
the same upload be re-extracted later with a better extractor.

### D3. Host protocol v1 gains one route

```text
POST /v1/upload
  headers: content-type: application/octet-stream
           x-a008-filename: <original name>
  body:    raw bytes
  ->  { locator, sha256, bytes, mediaType, extracted: boolean, artifactId? }
```

Limits are enforced before anything is written: a byte cap, and a media type
resolved by magic-byte sniffing. The declared filename is advisory and is
sanitised; the extension never decides the type.

`POST /v1/upload` carries the same origin guard and rejects a cross-origin
caller exactly as `POST /v1/shell` does.

### D4. One ACP extension method

```text
_a008/source/ingest
  params:  { locator, mediaType, filename? }
  result:  { artifactId, utteranceIds, contentKind, relation, speaker }
```

The SDK's `onRequest(method: string, params, handler)` overload carries custom
methods, so this needs no protocol fork. The method is namespaced with a leading
underscore and an `a008/` segment so it cannot collide with a future ACP method.

Agent Server never calls it. A client that does not know the method is
unaffected, exactly as with `session/close` in A008-0038.

### D5. Extraction is a port, not a branch

```ts
interface ExtractedSource {
  readonly content: string;
  readonly speaker: string;
  readonly relation: ProvenanceRelation;
  readonly contentKind?: ContentKind;
}

interface SourceExtractor {
  readonly id: string;
  supports(mediaType: string): boolean;
  extract(input: SourceExtractionInput): Promise<ExtractedSource>;
}
```

A registry picks the first extractor that supports the sniffed media type. An
unsupported type fails with a named error naming the type — it never falls back
to guessing, and never silently stores a file whose content nothing can read.

Each extractor sets its own provenance, which is the whole point of the port:

| Extractor | speaker | relation |
| --- | --- | --- |
| UTF-8 text | the uploading user | `appears_in` |
| image description | the describing model | `derived_from` |

Text extracted from a document literally appears in it. A model's description of
an image never appeared in that image.

### D6. Image description is its own port, not a chat message

`ChatMessage.content` is a `string` and stays one. Vision is an ingest concern,
not a chat concern, so it gets its own port:

```ts
interface ImageDescriber {
  describe(input: { bytes: Uint8Array; mediaType: string; signal?: AbortSignal }):
    Promise<{ description: string; model: string }>;
}
```

Changing the provider-neutral core message type would ripple through
`ChatSession`, `MemoryAwareChatSession`, the semantic JSON generator, every
budget measurer, ACP and the CLI, to serve one ingest path. Rejected.

The NVIDIA-backed implementation builds its own request payload against the
existing adapter's injectable endpoint and fetch. It is verified against a fake,
like every other provider path in this repository.

### D7. Wave 1 stores evidence; it does not run the knowledge pipeline

An uploaded source lands as an `Artifact`, an `Utterance`, and a provenance
record through `ingest()`. It does **not** run the analyze/classify/commit
coordinator.

That is deliberate. `StagePostOutputKnowledgeInput` is `{ taskId, message,
answer, applicabilityScopes }` — a dialogue pair — and the analyzer instruction
is written for one. Feeding document text through it would repeat the mistake
already recorded in `docs/backlog/document-ingest-granularity.md`: a
dialogue-tuned judgement applied to a document and stored as fact.

Knowledge extraction from uploaded sources needs a source-shaped staging input
and its own instruction. That is wave 2, and it depends on the granularity
question being settled first.

### D8. What is not authorised here

- **PDF and DOCX extraction.** Both need a third-party parser. This repository
  has three runtime dependencies and ADR 0002 governs imported material, so the
  dependency is an owner decision, not a task decision. Until it is taken, both
  media types fail with the named unsupported error.
- **Live image description.** The registry holds one model,
  `nvidia/nemotron-3.5-lightning-30b-a3b`, with no modality metadata, and a live
  vision call is a paid call. The port and its NVIDIA implementation are built
  and fake-verified; enabling them live needs a registry entry and explicit cost
  authority under AGENTS.md.

### D9. Module ownership

| Module | Owner task |
| --- | --- |
| `src/ingest/` | A008-0042 |
| `src/runtime/` ingest surface and `src/acp/` method | A008-0043 |
| `src/gui-host/` upload route and store | A008-0044 |
| `gui/src/upload/` | A008-0045 |

ADR 0019 D7 continues to govern `gui/`; `gui/src/upload/` is added to it.

## Alternatives considered

### Give the GUI host its own runtime

Rejected. Two processes writing one SQLite file, against a documented
single-process adapter.

### Send file bytes over ACP stdio

Rejected. Base64 over JSON-RPC for arbitrary uploads, and the framing cost lands
on every message the bridge already carries.

### Extract in the host and send text over ACP

Rejected. Image description is a provider call; making it from the host would
put a second provider composition and a second credential consumer outside the
runtime, against ADR 0019 D3.

### Add image content blocks to `ChatMessage`

Rejected under D6.

### Run the existing post-output coordinator over document text

Rejected under D7.

## Consequences

- The host gains its first route that writes to disk. Path containment and the
  byte cap are security gates, not hygiene.
- An uploaded source is retrievable evidence with honest provenance, and can be
  re-extracted later from the stored original because the locator is stable.
- PDF, DOCX and live vision remain explicitly unsupported with named errors
  rather than silent failure, and each is unblocked by one owner decision.
- Knowledge extraction from uploads is a stated wave 2, not an implied gap.
