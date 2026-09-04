# ADR 0020 — Source upload ingest

Status: Accepted

Date: 2026-09-02

Decision owner: Operator

Amends: [ADR 0019](0019-a008-owned-gui.md) D4 (host protocol v1 gains a route).
Amended by its own D10 (A008-0049), which supersedes D7, and its own D11
(A008-0056), which supersedes the first bullet of D8.

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

### D10. Amends D7 — sources may run the knowledge pipeline

D7 deferred this on two grounds. A008-0047 removed one: the analyzer
instruction no longer speaks of a message and an answer, it speaks of "the
source", and it now asks for completeness and recursive splitting.

Staging and the commit path are now origin-aware.

```ts
type StagedBatchOrigin =
  | { kind: "dialogue" }
  | { kind: "source"; utteranceId: string };
```

Two things follow from that origin, and both are safety properties rather than
tidiness:

**A source is never accepted as a user assertion.** `isExplicitUserAssertion`
activates a proposal when the batch's `sourceMessage` *contains* the
proposition, and a document contains every proposition extracted from it.
Uploading a file is not asserting its contents. A source batch therefore carries
its **locator** as `sourceMessage`, never its content, and the commit path
additionally refuses acceptance on origin alone — two independent layers,
because the first failing would silently accept an entire uploaded document as
user-stated fact.

**A source is not ingested twice.** `LocalMemoryRuntime.ingestSource` already
created the utterance with the extractor's own speaker, relation and locator.
The commit path reuses that utterance instead of re-ingesting the content under
`speaker: "user"` and a fabricated `turn:` locator, which would have replaced
the provenance A008-0040 and A008-0042 exist to get right.

Extraction is **opt-in** via `extractKnowledge`, off by default. The coordinator
commits sequentially with one classifier call each and the A008-0046 ceiling is
128, so one source can mean well over a hundred provider calls. Evidence is
stored either way; the flag only decides whether knowledge is extracted now. A
failed extraction degrades the ingest and leaves the stored evidence intact.

Chunking remains out. One source is still one utterance, and passage-level
citation is still the open question in
`docs/backlog/document-ingest-granularity.md`.

### D8. What is not authorised here

- **PDF and DOCX extraction.** Both need a third-party parser. This repository
  has three runtime dependencies and ADR 0002 governs imported material, so the
  dependency is an owner decision, not a task decision. Until it is taken, both
  media types fail with the named unsupported error.

  *Superseded by D11. The owner took the decision on 2026-09-04.*
- **Live image description.** The registry holds one model,
  `nvidia/nemotron-3.5-lightning-30b-a3b`, with no modality metadata, and a live
  vision call is a paid call. The port and its NVIDIA implementation are built
  and fake-verified; enabling them live needs a registry entry and explicit cost
  authority under AGENTS.md.

### D11. Amends D8 — documents are read, and pdf.js is the one dependency

The owner authorised the parser dependency directly: choose a good PDF parser.
That closes the question D8 reserved, and this records what was chosen and what
was deliberately not.

**PDF: `pdfjs-dist`, pinned exactly, imported lazily.** It is Mozilla's own
reference implementation rather than one of the wrappers around it, for three
reasons that outlive the choice. It is Apache-2.0, the same licence as A008, so
it adds no obligation the repository does not already carry. The lockfile pins
the exact version of the PDF code present, which a wrapper that vendors its own
build does not — and a repository whose subject is provenance should be able to
say which parser read a document. And it is the implementation everything else
in this space is a repackaging of.

The costs are real and are accepted with open eyes. The package is 35 MB, it
carries an optional native dependency on `@napi-rs/canvas` that A008 never
loads because rasterising is not extraction, and its engine floor moved this
package's declared `node` from `>=22.12.0` to `>=22.13.0`. The size is bounded
by a lazy `await import()` inside `extract()`: a CLI turn that uploads nothing
never loads any of it.

**DOCX: no dependency at all.** A `.docx` is a ZIP of XML parts, Node's `zlib`
already inflates it, and reading the central directory plus the `w:t` elements
is roughly two hundred lines. The nearest library brings ten transitive
packages to do the same job. For a repository that has kept its runtime
inventory at three, writing the reader is the cheaper side of the trade, and
every byte of it is auditable here rather than three levels down a tree.

**What comes with it.** The ZIP reader also makes the media-type sniffer honest.
Every OOXML format is a ZIP, and until now any ZIP was reported as a Word
document; now the part-name prefix decides, so a spreadsheet is refused as a
spreadsheet and a plain archive as an archive.

**Still not authorised.** Live image description is unchanged: it remains a paid
call needing explicit authority. Neither extractor makes a provider call, which
is why both are in the default registry and the image describer is not. OCR is
not in scope — a PDF with no text layer is reported as probably a scan rather
than guessed at.

### D9. Module ownership

| Module | Owner task |
| --- | --- |
| `src/ingest/` | A008-0042 |
| `src/runtime/` ingest surface and `src/acp/` method | A008-0043 |
| `src/gui-host/` upload route and store | A008-0044 |
| `gui/src/upload/` | A008-0045 |
| `src/ingest/` PDF, DOCX, ZIP and OOXML readers | A008-0056 |

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
