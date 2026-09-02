# Task A008-0042 — Source extraction port and text extractor

Status: Complete
Owner: Operator
Parent: A008-0041
Created: 2026-09-02
Completed: 2026-09-03
Branch: `claude/A008-0042-source-extraction-port`
Base revision: c08dfff

## Goal

A new `src/ingest/` module that turns uploaded bytes into an `ExtractedSource`
carrying its own provenance, or fails with a named error naming the media type.

## Change

- `types.ts` — `SourceExtractor`, `ExtractedSource`, `ImageDescriber` per
  ADR 0020 D5 and D6, plus the media-type constants.
- `errors.ts` — `SourceIngestError` with `unsupported_media_type`,
  `invalid_source`, `description_failed`. Deliberately not a `ChatError`: an
  unsupported upload is not a provider condition.
- `media-type.ts` — magic-byte sniffing for PNG, JPEG, GIF, WebP, PDF and the
  ZIP/DOCX family, then a strict-UTF-8 test for text. `decodeUtf8Strict` uses
  `TextDecoder(..., { fatal: true })`.
- `text-extractor.ts` — verbatim text, `relation: "appears_in"`, speaker is the
  uploader.
- `image-extractor.ts` — text via the `ImageDescriber` port,
  `relation: "derived_from"`, speaker is the model.
- `nvidia-image-describer.ts` — OpenAI-compatible vision payload with injectable
  endpoint and fetch.
- `registry.ts` — first extractor that claims the type; no fallback.

## Decisions worth recording

**Strict UTF-8 is the point, not a detail.** The lenient decoder substitutes
U+FFFD, so a mis-sniffed binary would be stored as a document full of
replacement characters and look like a successful extraction.

**Sniffing rejects a short-window false negative.** A multi-byte sequence cut by
the 8 KiB sniff window is not evidence of binary, so the check re-reads the whole
input before deciding. A NUL byte in the window is treated as decisive.

**An unattributable description is refused.** If the describer returns no model
name there is nothing truthful to record as `speaker`, and an unattributable
machine account must not enter the evidence store.

**The ZIP family is reported as DOCX.** Distinguishing DOCX from XLSX and PPTX
needs a ZIP reader this module deliberately does not have. Reporting the family
lets the unsupported error name something true rather than guess.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Core suite | `npm run test:core` | 279 pass, 0 fail |
| Gate membership | every `test/**/*.test.ts` referenced | 44 of 44 |

279 accounts for the 266 baseline plus 13 new cases.

Gates covered: sniffing across five signatures; a PDF named `.txt` resolving as
PDF and being refused by a text-only registry; binary and invalid UTF-8 not
mistaken for text; multi-byte UTF-8 surviving; `appears_in` for text and
`derived_from` for images; empty and unattributable descriptions refused; PDF
and DOCX raising the named error with the type in the message; registry
selection order; and the NVIDIA describer sending the credential while keeping
it out of both the result and the failure message.

## Out of scope and not done

- PDF and DOCX extractors (ADR 0020 D8). Both fail with the named error.
- Live image description (ADR 0020 D8). The describer is verified against an
  injected fake fetch; no live call was made and the registry still holds no
  vision-capable model.
- No new runtime dependency was added.
- Chunking. One source produces one `ExtractedSource`.
