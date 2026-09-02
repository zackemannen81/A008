# Task A008-0042 — Source extraction port and text extractor

Status: Ready
Owner: Operator
Parent: A008-0041
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0042-source-extraction-port`

## Goal

A new `src/ingest/` module that turns uploaded bytes into an `ExtractedSource`
carrying its own provenance, or fails with a named error naming the media type.

## Primary deliverable

The `SourceExtractor` port from ADR 0020 D5, a media-type sniffer, a UTF-8 text
extractor, an `ImageDescriber` port with an NVIDIA-backed implementation, and a
registry.

## In scope

- `src/ingest/**` only, plus `test/ingest*.ts` or `test/ingest/**`
- `package.json` only to append new test files to `test:core`

## Out of scope

- `src/runtime/`, `src/acp/`, `src/gui-host/`, `gui/` — all owned by siblings
- PDF and DOCX extractors (ADR 0020 D8); both must fail with the named
  unsupported error
- Any live provider call
- Any new runtime dependency

## Definition of done

- `ExtractedSource` and `SourceExtractor` match ADR 0020 D5 exactly.
- Media type is decided by magic bytes; a declared filename or extension never
  decides it.
- The UTF-8 text extractor sets `speaker` to the uploading user and `relation`
  to `appears_in`.
- The image extractor sets `speaker` to the describing model and `relation` to
  `derived_from`, and obtains its text through the `ImageDescriber` port.
- `application/pdf` and the DOCX type resolve to a named unsupported error that
  states the type; they never fall through to the text extractor.
- Bytes that are not valid UTF-8 fail rather than producing replacement
  characters.

## Minimum verification gates

- [ ] Sniffing tests: PNG, JPEG, PDF, and plain text identified from bytes, and
      a file whose extension disagrees with its bytes resolved by the bytes.
- [ ] A test that the text extractor's `relation` is `appears_in`.
- [ ] A test that the image extractor's `relation` is `derived_from` and its
      `speaker` is the model reported by the describer, driven by a fake
      describer.
- [ ] A test that PDF and DOCX raise the named unsupported error.
- [ ] A test that invalid UTF-8 fails rather than being replaced.
- [ ] A test that the NVIDIA describer sends the credential in the request and
      that the returned description contains neither the credential value nor
      the token `NVIDIA_API_KEY`, driven by an injected fake fetch.
- [ ] `npm run typecheck` clean and `npm test` green.

## References

- [`../adr/0020-source-upload-ingest.md`](../adr/0020-source-upload-ingest.md) D5, D6, D8
- `src/memory/knowledge/ingest.ts` — `IngestInput.relation`, added by A008-0040
- `src/providers/nvidia/nvidia-chat-transport.ts` — injectable endpoint and fetch
