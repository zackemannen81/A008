# Task A008-0056 — Document extraction for PDF and DOCX

Status: Complete
Owner: Operator
Parent: ADR 0020
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0056-document-extraction`

## Why

ADR 0020 D8 held PDF and DOCX extraction back on one point: both need a
third-party parser, this repository keeps three runtime dependencies, and
ADR 0002 makes imported material an owner decision. The owner took it — choose a
good PDF parser — so the reserved question closed and the work became ordinary.

Until now `POST /v1/upload` stored those files honestly and reported
`extracted: false`. The blob was content-addressed and re-extractable, which is
why waiting cost nothing.

## The dependency, and the one that was not taken

**PDF: `pdfjs-dist` 6.3.289, pinned, imported lazily.**

Four candidates were measured rather than compared from memory. `pdf-parse`
pulls a native canvas binary and a second copy of pdf.js. `unpdf` is 2.5 MB
against pdfjs-dist's 35 MB and gives line breaks for free, which is genuinely
attractive — but it vendors its own bundled build, so the lockfile cannot say
which version of the PDF code is present. For a repository whose subject is
provenance, being unable to name the parser that read a document is the wrong
trade. `pdfjs-dist` is Mozilla's reference implementation, is Apache-2.0 like
A008 itself, and the line-break handling it does not do is ten lines here.

Both were run against the same real document first. unpdf produced 7 473
characters, pdfjs-dist with `hasEOL` handling produced 7 475 and the same text.
The choice was not made on capability.

Costs, stated plainly: 35 MB, an optional `@napi-rs/canvas` native binary A008
never loads, and an engine floor that moved this package's declared `node` from
`>=22.12.0` to `>=22.13.0`. The size is contained by importing pdf.js inside
`extract()`, so a CLI turn that uploads nothing never loads any of it.

**DOCX: no dependency.** `mammoth` is the obvious choice and brings ten
transitive packages, several of them long in the tooth. A `.docx` is a ZIP of
XML parts, Node's `zlib` already inflates it, and the reader is about two
hundred lines in `zip.ts` and `ooxml.ts`. For a repository that has kept its
runtime inventory at three, writing it is the cheaper side of the trade and
every byte is auditable here rather than three levels down a tree.

Recorded as ADR 0020 D11, which supersedes the first bullet of D8.

## What else the ZIP reader bought

The media-type sniffer was lying, and had a comment admitting it: every OOXML
format is a ZIP, so any ZIP was reported as `…wordprocessingml.document`
because telling them apart "needs a ZIP reader, which this module deliberately
does not have". It has one now. The part-name prefix decides — `word/`, `xl/`,
`ppt/` — and anything else is `application/zip`.

That matters beyond tidiness. A spreadsheet used to be handed to an extractor
guaranteed to fail; now it is refused as a spreadsheet.

## Failures are named, not swallowed

Three cases return `invalid_source` with the reason instead of an empty
success: a PDF with no text layer ("probably a scan"), a Word package whose
document part has no text, and an archive that cannot be read. Storing any of
them as a successful extraction of nothing would put a false record in a store
whose whole value is that its records are true.

## What was found by breaking it

Sixteen mutations, each rebuilt and re-run alone. Fourteen were caught by
exactly the test that names the behaviour. The two survivors were both real.

**A suppression counter in the OOXML scanner was dead code.** It excluded
`w:instrText` (field instruction codes — a hyperlink's target) and `w:delText`
(text a tracked revision removed). Mutating it away changed nothing, because
text is captured only inside a `w:t` and both of those are siblings of `w:t`,
never children. It was removed and the comment now records the rule that was
actually doing the work. The test stayed — it asserts behaviour that is still
true, and the replacement mutation that makes those elements captured does fail
it.

**The stored-entry size ceiling had no test.** The compression-bomb case only
exercised the deflated path, where zlib enforces the limit through
`maxOutputLength`. A stored entry never passes through zlib. A case was added.

One implementation comment was also wrong and is corrected: it claimed pdf.js
warnings would corrupt the ACP JSON-RPC channel. Checked in a child process,
pdf.js 6 writes them to stderr, not stdout. Silencing them is still right —
that stream is the host's log — but as noise reduction, not as protocol
correctness. The test that guards it asserts both streams are empty.

## Verification

`npm test`: 352 core and 75 GUI, 0 fail, 0 skipped, up from 322 and 75.

`docs/evidence/A008-0056_document-extraction-proof.md`: 17 of 17 end-to-end
checks through a real GUI host, a real `A008-acp` subprocess and the real memory
runtime, including a real PDF and a real Word document each reaching a distinct
artifact id.

Sixteen of seventeen documents in the owner's own folder extracted read-only.
The one refusal was verified to be correct rather than assumed: fifteen pages,
thirty image XObjects, zero font objects. Five of those documents exist as both
PDF and `.docx`, and the two independent extractors agreed within 0.8% on every
pair — neither result rests on the other's implementation.

Fixtures are built, not committed. `test/fixtures/documents.ts` writes a real
PDF with a computed cross-reference table (pdf.js silently rebuilds a broken
one, so a faked table would prove only that the recovery path works) and a real
ZIP with both stored and deflated entries.

## Two existing tests were rewritten rather than left passing

`ingest-source.test.ts` had a case named "PDF and DOCX raise a named unsupported
error and never fall through". Its premise is exactly what this task removes.
Left alone it would have gone on passing against a registry that no longer
contains those types, proving nothing. It is now armed with types that are still
genuinely unsupported, and its comment says why it was rearmed. The ZIP-sniffing
assertion next to it was updated the same way.

## What this does not do

- **Chunking.** One document is still one `Utterance`, classified by heuristics
  written for chat messages. That was tolerable while nothing large could be
  ingested. `docs/backlog/document-ingest-granularity.md` is raised to "now due"
  with the reason: every file ingested from here on is stored at file
  granularity, and re-chunking later means re-ingesting.
- **OCR.** A scan is reported, not read.
- **Live image description.** Unchanged, and still a paid call needing explicit
  authority. Neither new extractor makes a provider call, which is why both are
  in the default registry and the describer is not.
- **Anything beyond text.** No styling, no tables reconstructed, no headers,
  footers or footnotes — those are separate OOXML parts and are not read.
