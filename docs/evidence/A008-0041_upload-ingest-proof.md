# A008-0041 source upload ingest proof

Task: A008-0041

Date: 2026-09-03

Evidence boundary: local A008 GUI host process, real `A008-acp` stdio
subprocess, real local memory runtime, real extraction registry, temporary
source store outside the repository. No live model inference, no provider
credential spent, no network egress.

## Result

Thirteen operator checks passed and none failed. This was the first run in which
`_a008/source/ingest` had both a real sender and a real handler: the GUI host's
bridge on one side, the ACP agent on the other.

```text
POST /v1/upload (bytes)
  -> GUI host: sniff, cap, write blob, mint locator
  -> _a008/source/ingest (locator only, over stdio)
  -> A008-acp: containment, read, sniff, extract, ingest()
  -> Artifact + Utterance + provenance
```

Nothing inside the chain was stubbed. Bytes never crossed the ACP boundary.

## Observed checks

| # | Check | Observed |
| --- | --- | --- |
| 1 | `POST /v1/upload` accepts a text document | 200, 56 bytes |
| 2 | Media type sniffed from the bytes | `text/plain` |
| 3 | Locator is content-addressed | `source:6e09e1f8…/invoice-notes.txt` |
| 4 | The original is stored outside the repository | file present, byte-identical |
| 5 | The ACP process extracted and ingested it | `A008_knowledge_artifact_2f8ddd4a-…` |
| 6 | The same bytes twice yield one locator and one blob | one file in the hash directory |
| 7 | A PDF named `.txt` is identified as a PDF | `application/pdf` |
| 8 | An unsupported type is stored but not extracted | 200, `extracted: false`, blob present |
| 9 | A traversal filename cannot escape the store | stored as `escape.txt` under its hash |
| 10 | A cross-origin upload is refused | 403 |
| 11 | The credential never appears on the wire | absent |
| 12 | The token name `NVIDIA_API_KEY` never appears | absent |
| 13 | No `authorization` header echoed | absent |

## What check 8 demonstrates

An upload A008 cannot read is not lost and is not silently mangled. The bytes
are stored and content-addressed, the response says `extracted: false`, and the
media type is named. When a PDF extractor exists, the same blob can be
re-extracted from the same locator without the user re-uploading anything.

## What check 7 demonstrates

The declared filename is advisory throughout. A file named `notes.txt` whose
bytes begin `%PDF-` is a PDF, and the text extractor never sees it. Had the
extension decided, a PDF object graph would have been stored as prose.

## No regression in the chat path

`A008-0043` changed `src/acp/A008-acp-agent.ts` and `src/acp/server.ts`, so the
A008-0030 runtime proof was re-run on the merged tree and passed 15 of 15
unchanged: `session/new/ok`, two `thought` frames, one `answer` frame,
`prompt/ok`, and the same credential boundary.

## Reproduction

1. `npm run build`.
2. Start `node dist/src/gui-host/server.js` with `NVIDIA_API_KEY` set to a
   sentinel, `A008_GUI_HOST_PORT`, `A008_MEMORY_SQLITE_PATH` and
   `A008_SOURCE_STORE_PATH` under temporary directories outside the repository,
   and `A008_PROJECT_ID` / `A008_AGENT_ID` in canonical form.
3. `POST /v1/upload` with `content-type: application/octet-stream`, an
   `x-a008-filename` header, and raw bytes.
4. Assert the response fields, the stored blob, and that the sentinel,
   `NVIDIA_API_KEY` and `authorization` appear in no response body.

## Boundary

No live provider call, no paid usage, no vision model, no browser session. PDF
and DOCX extraction and live image description remain unimplemented by decision
(ADR 0020 D8); check 8 is the observed behaviour of that decision, not a defect.
