# Task A008-0041 — Source upload ingest program

Status: In Progress
Owner: Operator
Created: 2026-09-02

Parent program for ADR 0020. `docs/CURRENT_TASK.md` on `main` stays the empty
template.

## Goal

A user uploads a document or an image in the GUI, the original is stored, its
text is extracted, and the result lands as an evidence artifact with honest
provenance that later retrieval can reach.

## Children

| Task | Module |
| --- | --- |
| A008-0042 | `src/ingest/` — extraction port, sniffing, text extractor, image-describer port |
| A008-0043 | `src/runtime/` ingest surface and `src/acp/` `_a008/source/ingest` |
| A008-0044 | `src/gui-host/` `POST /v1/upload` and the blob store |
| A008-0045 | `gui/src/upload/` |

A008-0042 lands first because the other three consume its types. The remaining
three then run in parallel against the contracts frozen in ADR 0020.

## Out of scope

- PDF and DOCX extraction. Both need a third-party parser, which is an owner
  decision under ADR 0002, not a task decision (ADR 0020 D8).
- Live image description. The port and its NVIDIA implementation are built and
  fake-verified, but the registry has no vision-capable model and a live call is
  a paid call requiring explicit authority (ADR 0020 D8).
- Running the analyze/classify/commit coordinator over uploaded text. The
  staging input is a dialogue pair and its instruction is written for one;
  feeding document text through it would repeat the error recorded in
  `docs/backlog/document-ingest-granularity.md` (ADR 0020 D7).
- Video. Still out of scope, as in A008-0030.
- Chunking. One upload produces one utterance, as `ingest()` does today.

## Definition of done

`POST /v1/upload` with a UTF-8 text file stores the original outside the
repository, returns a stable content-addressed locator, and the ACP process
records an `Artifact`, an `Utterance`, and a provenance record for it. An
unsupported media type fails with a named error and stores nothing. No
credential reaches the renderer, and no locator can escape the store root.
