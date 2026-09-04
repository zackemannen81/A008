# A008-0056 document extraction proof

Task: A008-0056

Date: 2026-09-04

Evidence boundary: local A008 GUI host process, real `A008-acp` stdio
subprocess, real local memory runtime, real extraction registry, temporary
source store outside the repository, plus a read-only pass over the owner's own
document folder on this machine. No live model inference, no provider credential
spent, no network egress. No document content is reproduced here.

## Result

Seventeen operator checks passed and none failed, extending the thirteen in
[`A008-0041_upload-ingest-proof.md`](A008-0041_upload-ingest-proof.md) with the
two formats that route previously refused.

```text
POST /v1/upload (PDF bytes)          POST /v1/upload (DOCX bytes)
  -> GUI host: sniff, cap, blob, locator
  -> _a008/source/ingest (locator only, over stdio)
  -> A008-acp: containment, read, sniff, extract, ingest()
  -> Artifact + Utterance + appears_in provenance
```

The host still never reads file content and never loads a parser: `pdfjs-dist`
is imported inside `PdfExtractor.extract`, which runs in the ACP process.

## Observed checks

| # | Check | Observed |
| --- | --- | --- |
| 1–6 | The A008-0041 text, locator, store and dedup checks | unchanged, all passed |
| 7 | A real PDF is identified and extracted end to end | `application/pdf`, `extracted: true`, artifact id returned |
| 8 | A real Word document is identified and extracted end to end | `…wordprocessingml.document`, `extracted: true`, artifact id returned |
| 9 | The two formats produced two distinct artifacts from the same words | different locators, different artifact ids |
| 10 | A spreadsheet is stored under its own media type and not extracted | `…spreadsheetml.sheet`, `extracted: false` |
| 11 | A PDF named `.txt` is identified as a PDF | `application/pdf` |
| 12 | A corrupt PDF is stored but not extracted | `extracted: false`, blob present |
| 13 | A traversal filename cannot escape the store | sanitised name, file inside the hash directory |
| 14 | A cross-origin upload is refused | `403` |
| 15–17 | The credential, its variable name and any `authorization` echo are absent from every response body | absent |

Check 10 is the one that could not have been written before this task. Every
OOXML format is a ZIP, and the sniffer previously reported all of them as Word;
a spreadsheet would have been handed to an extractor guaranteed to fail. It is
now refused as a spreadsheet.

## Real documents

The synthetic fixtures prove the contract. They do not prove the parser copes
with documents a person actually made, so the registry was also run read-only
over the owner's `acme-promo` folder on this machine: seventeen files, a mix of
PDF and `.docx`, prose in Swedish and English with diacritics throughout.

| Outcome | Files | Notes |
| --- | --- | --- |
| Extracted | 16 | 1 829 to 16 291 characters; PDF 62–175 ms after the first load, DOCX 2–9 ms |
| Refused | 1 | 15-page PDF, no text layer |

Two things are worth recording.

**The refusal is correct, and was checked rather than assumed.** The file that
failed reports "no extractable text layer; it is probably a scan". Inspected
directly it has fifteen pages, thirty image XObjects and **zero font objects**:
there is no text in it to extract. Reading it needs OCR or the vision describer,
neither of which is in scope here. The value of the check is that A008 says so
instead of storing an empty extraction as a success.

**The two formats cross-validate each other.** Five documents exist as both a
PDF and a `.docx` of the same source. Two independent extractors — one going
through pdf.js, one through a hand-written ZIP and OOXML reader — produced
character counts within 0.8% of each other on every pair, and the same opening
sentences. Neither result rests on the other's implementation.

No document content is stored in this repository; the folder was read and not
copied.

## Automated coverage

`npm test`: 352 core and 75 GUI cases, 0 fail, 0 skipped. Thirty of those are
new in `test/document-extraction.test.ts`.

The fixtures are built rather than committed. `test/fixtures/documents.ts`
writes a real PDF with a computed cross-reference table and a real ZIP with both
stored and deflated entries, so a reviewer can read every byte the tests depend
on and the ZIP writer exercises the reader.

## Mutation results

Sixteen mutations were applied one at a time, each rebuilt and re-run. Fourteen
were caught by exactly the test that names the behaviour:

| Mutation | Caught by |
| --- | --- |
| pdf.js given the caller's buffer instead of a copy | the caller's bytes survive extraction |
| verbosity left at its default | reading a PDF writes nothing to the process streams |
| empty extraction accepted | a PDF with no text layer is reported as probably a scan |
| page separator collapsed | a PDF is read into lines and pages |
| `hasEOL` ignored | a PDF is read into lines and pages |
| `maxOutputLength` removed | a compression bomb is stopped during inflation |
| stored-entry ceiling removed | a stored entry larger than the ceiling is refused |
| local header's extra length ignored | the local header decides where entry data starts |
| naive scan for the closing bracket | an attribute containing a close bracket does not cut the tag in half |
| `w:instrText` and `w:delText` treated as text | field codes and deleted text are dropped |
| paragraph break dropped | five cases, including both extractors' output |
| relationship target ignored | a document part under a non-conventional name is still found |
| CDATA dropped | comments, processing instructions and CDATA are handled |
| entity decoding removed | entities are decoded, named and numeric alike |
| ZIP family detection disabled | the OOXML formats are told apart; the registry routes each type |

Two survived, and both were findings rather than noise.

**The suppression counter was dead code.** The OOXML scanner carried an explicit
counter to exclude `w:instrText` and `w:delText`. Removing it changed nothing,
because text is captured only inside a `w:t` and both of those are siblings of
`w:t` rather than children. The counter was removed and the comment now records
the rule that was actually doing the work. The test stayed: it asserts the
behaviour, which is still true and still load-bearing — the replacement mutation
that makes those elements captured does fail it.

**The stored-entry ceiling had no test.** The bomb case only exercised the
deflated path, where zlib enforces the limit; a stored entry never passes
through zlib. A case was added, and it now fails when that check is removed.
