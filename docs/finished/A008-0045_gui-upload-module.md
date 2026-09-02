# Task A008-0045 — GUI upload module

Status: Complete
Owner: operator-delegated
Parent: A008-0041
Created: 2026-09-02
Completed: 2026-09-02 (worker clock: 2026-09-03)
Branch: `claude/A008-0045-gui-upload-module`
Clone: `C:\code\A008-workers\A008-0045_gui-upload-module`
Base revision: `49468c4`

## Write scope

- `gui/src/upload/**` only
- `gui/src/app.tsx` only to mount the pane: one import, one element
- `docs/handoffs/A008-0045.md`, `docs/finished/A008-0045_gui-upload-module.md`
- `docs/CURRENT_TASK.md` only to restore the template before push

## Goal

A user can attach a document or an image in the A008 GUI, see it upload, and
see whether its content was extracted or why it was not.

## Primary deliverable

`gui/src/upload/` — a client for `POST /v1/upload` and a pane that uses it.

## Outcome

- `uploadSource(file, options?)` in `gui/src/upload/upload-source.ts` POSTs
  the raw bytes of one `File`-shaped object to `/v1/upload` with
  `content-type: application/octet-stream` and
  `x-a008-filename: <percent-encoded name>`, exactly matching ADR 0020 D3.
  The filename is percent-encoded because a raw header value must be a legal
  ByteString and the stored filename is documented as advisory-only
  (`src/ingest/types.ts`), so encoding is safe and avoids a runtime
  `TypeError` on accented, CJK, or emoji filenames.
- A 2xx response is parsed strictly into
  `{ locator, sha256, bytes, mediaType, extracted, artifactId? }`; a
  malformed field throws a named `UploadError`.
- A non-2xx response reads the host's JSON error body and surfaces its
  `message` field verbatim (e.g. an unsupported media type or an oversized
  file), the same pattern `gui/src/terminal/run-shell-command.ts` uses for
  `POST /v1/shell`. Falls back to the HTTP status line only when the body is
  missing or not JSON — never a generic "upload failed".
- A network failure (fetch rejects) is mapped to `UploadError` with the
  original error as `cause`, so it fails immediately rather than hanging.
- `UploadPane` (`gui/src/upload/upload-pane.tsx`) is a plain file input, one
  file at a time. It shows `uploading` -> `done` (locator, media type, size,
  and "Extracted" / "Not extracted") or `uploading` -> `error` (the server's
  message). No drag-and-drop, no progress bar, no multi-file queue, no
  rendering of document content — the browser reads the file only once, via
  `File.arrayBuffer()`, to send its bytes.
- `App` mounts `<UploadPane />` between the composer and the terminal pane
  in `gui/src/app.tsx`; that file gained exactly one import line and one JSX
  element.
- No credential appears anywhere in `gui/src/upload/`: `credentials: "omit"`
  is set on the request, only three headers are ever sent (`accept`,
  `content-type`, `x-a008-filename`), and the module contains no reference
  to `NVIDIA_API_KEY` (grep-verified) or `Authorization`.

## Gates

- [x] Unit tests against a faked `fetch`, covering a successful upload, an
      unsupported media type, an oversized file, and a network failure (plus
      a percent-encoded filename case, an `extracted: false` success case, a
      malformed-JSON case, and an empty-filename guard) — 9 cases, all pass.
- [x] A test that the request carries the `x-a008-filename` header and the
      `application/octet-stream` content type, and checks the exact set of
      headers sent (no stray `authorization` header).
- [x] `grep -ri "NVIDIA_API_KEY" gui/src/upload/` returns nothing.
- [x] `npm --prefix gui run typecheck` — clean.
- [x] `npm --prefix gui run build` — clean.
- [x] `npm --prefix gui run test` — green, 64/64 (baseline 63 + this module's
      1 discovery-runner file), discovered by the A008-0039 runner with no
      script edit.
- [x] Root `npm run typecheck` — clean.
- [x] Root `npm test` — green, core 279/279, gui 64/64.

## Out of scope (honored)

- Every other `gui/src/*` directory — not touched.
- `src/**` — not touched.
- Drag-and-drop, progress bars, multi-file queues, preview rendering of
  document text — none implemented.
- No content parsing beyond the single `arrayBuffer()` read needed to POST
  the bytes; no provider call from the browser.
- Merge to `main` — operator only.

## Verification

Working directory: `C:\code\A008-workers\A008-0045_gui-upload-module`
Date: 2026-09-03 (worker clock; task/ADR dates read 2026-09-02)

Exact commands and output are recorded in `docs/handoffs/A008-0045.md`.
Summary:

- `grep -ri "NVIDIA_API_KEY" gui/src/upload/` — no output (exit 1, no match).
- `npx tsc -p tsconfig.json --noEmit` in `gui/` — exit 0.
- `npm run build` in `gui/` — `tsc --noEmit && vite build` exit 0, 51 modules
  transformed.
- `npm run test` in `gui/` — 64 tests, 64 pass, 0 fail, 0 skip. New file
  `src/upload/upload-source.test.ts` discovered by the existing
  `"src/**/*.test.ts"` glob with no `package.json` edit.
- `npm run typecheck` at repo root — exit 0.
- `npm test` at repo root (`test:core && test:gui`) — core 279/279, gui
  64/64, exit 0.
- `git diff --check` — no whitespace errors.
- Live smoke check: started `vite dev` (no `src/gui-host` process) and drove
  a real `<input type="file">` selection with a `DataTransfer`-constructed
  `File` in a live browser tab. The pane issued a real
  `POST http://localhost:5174/v1/upload` request (visible in the network
  log) and rendered `A008 GUI host upload failed (404): Not Found.` in the
  error state when the (unstarted) host returned nothing — confirming the
  request round-trip, header wiring, and error-surfacing path all work
  outside the unit-test fakes. No live upload route exists yet on this base
  revision (`src/gui-host/` has no `/v1/upload` handler — that is
  A008-0044's write scope, built in parallel per ADR 0020), so a true
  success/extraction round trip against a real host was not possible from
  this worker.

## Documentation updates

- [x] `docs/finished/A008-0045_gui-upload-module.md` (this archive)
- [x] `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`
      (already matched `origin/main`; no worker edit was made to it)
- [x] `docs/handoffs/A008-0045.md`
- [ ] `docs/CURRENT_STATUS.md` — outside write scope
- [ ] `docs/SYSTEMDOC.md` — outside write scope
- [ ] `docs/JOURNAL.md` — operator appends on merge

## Handoff and follow-ups

- Current state: Complete on this worker clone; awaiting operator review and
  merge.
- Next recommended step: operator reviews the PR; A008-0044 must land
  `POST /v1/upload` on `src/gui-host/` before this pane can complete a real
  upload end to end.
- Blockers: none for this slice's own scope.
- Risk to flag: the filename header is percent-encoded
  (`encodeURIComponent`) on the client. ADR 0020 D3 does not state an
  encoding for `x-a008-filename`, and the sibling host-route task
  (A008-0044) was written in parallel without a shared contract on this
  point. The stored filename is documented as advisory-only
  (`src/ingest/types.ts`), so a host that stores the header verbatim without
  decoding will just keep it percent-encoded — cosmetic, not a
  correctness risk — but the operator should confirm A008-0044's handler
  either decodes it or accepts that convention before relying on displayed
  filenames anywhere non-advisory.
- Open questions: none blocking this task.
