# Task A008-0041 — Source upload ingest program

Status: Complete
Owner: Operator
Created: 2026-09-02
Completed: 2026-09-03

Parent program for ADR 0020. `docs/CURRENT_TASK.md` on `main` stayed the empty
template throughout.

## Goal

A user uploads a document or an image in the GUI, the original is stored, its
text is extracted, and the result lands as an evidence artifact with honest
provenance that later retrieval can reach.

## Children as landed

| Task | Module | Landing |
| --- | --- | --- |
| A008-0042 | `src/ingest/` | PR #16 |
| A008-0043 | `src/runtime/` and `src/acp/` | PR #19 |
| A008-0044 | `src/gui-host/` | PR #18 |
| A008-0045 | `gui/src/upload/` | PR #17 |

A008-0042 landed first because the other three consume its types. Merge order
into `main` was 0042, then 0043, 0044, 0045.

## Three findings that shaped the design

**The runtime is not in the GUI host.** `createLocalMemoryRuntime` runs inside
the `A008-acp` subprocess, and the SQLite adapter is single-process, so the host
must not gain one. Uploads are therefore stored by the host and extracted in the
ACP process over a locator; bytes never cross stdio.

**`ChatMessage.content` is a `string`.** Image input would have needed content
blocks, rippling a chat-shaped change through `ChatSession`,
`MemoryAwareChatSession`, the semantic JSON generator, every budget measurer,
ACP and the CLI, to serve one ingest path. Image description got its own port
instead and the provider-neutral core is untouched.

**The knowledge pipeline is dialogue-shaped.** `StagePostOutputKnowledgeInput` is
a `{ message, answer }` pair with an instruction written for one. Running
document text through it would repeat the error already recorded in
`docs/backlog/document-ingest-granularity.md`, so wave 1 stores evidence only.

## Definition of done

`POST /v1/upload` with a UTF-8 text file stores the original outside the
repository, returns a stable content-addressed locator, and the ACP process
records an `Artifact`, an `Utterance`, and a provenance record for it. An
unsupported media type fails with a named error and stores nothing it cannot
account for. No credential reaches the renderer, and no locator can escape the
store root.

## Verification

All checks executed on merged `main`, 2026-09-03.

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `npm test` | 296 core + 72 GUI, 0 fail, 0 skipped |
| Root types | `npm run typecheck` | clean |
| GUI types and bundle | `npm --prefix gui run typecheck` / `build` | clean |
| Gate membership | every `test/**/*.test.ts` referenced | 45 of 45 |
| Definition of done | operator end-to-end harness | 13 of 13 |
| Chat-path regression | A008-0030 harness re-run | 15 of 15, unchanged |

The end-to-end run was the first with a real sender and a real handler for
`_a008/source/ingest`. Recorded in
[`../evidence/A008-0041_upload-ingest-proof.md`](../evidence/A008-0041_upload-ingest-proof.md).

## Out of scope, by decision

- **PDF and DOCX extraction.** Both need a third-party parser, an owner decision
  under ADR 0002 (ADR 0020 D8). They fail with a named error carrying the type,
  and the stored blob can be re-extracted later from the same locator.
- **Live image description.** The port and its NVIDIA implementation are built
  and fake-verified; enabling them needs a vision-capable model in the registry
  and explicit cost authority (ADR 0020 D8).
- **Knowledge extraction from uploads.** Wave 2, gated on the granularity
  question (ADR 0020 D7).
- **Video**, and **chunking**: one upload is one utterance.

## Notes on execution

All three wave-2 workers were cut off mid-task by a provider session limit, as
both previous waves were. None had committed. The operator finished all three
from the state they left rather than restarting, and found three things worth
recording:

1. **A008-0045's tests bypassed the runner.** A hand-rolled harness reported nine
   assertions as one test. Not unsound — a mutation confirmed failures still
   exited non-zero — but it defeated the point of A008-0039. Rewritten against
   `node:test`. The pattern was copied from two files already on `main`
   (`gui/src/terminal/` and `gui/src/settings/`), which do the same thing.
2. **A008-0043's lexical containment gate was untested.** Disabling it changed
   nothing, because realpath caught every case the tests tried. A case whose
   traversal target does not exist now separates the two gates.
3. **A008-0043's link-escape test skipped itself.** A file symlink needs
   elevation on Windows, leaving the realpath gate unproven. Rewritten to use a
   directory junction, which needs none.
