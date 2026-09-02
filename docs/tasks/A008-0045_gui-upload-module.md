# Task A008-0045 — GUI upload module

Status: Ready
Owner: operator-delegated
Parent: A008-0041
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0045-gui-upload-module`

## Goal

A user can attach a document or an image in the A008 GUI, see it upload, and see
whether its content was extracted or why it was not.

## Primary deliverable

`gui/src/upload/` — a client for `POST /v1/upload` and a pane that uses it.

## In scope

- `gui/src/upload/**` only
- `gui/src/app.tsx` only to mount the new pane, one import and one element

## Out of scope

- Every other `gui/src/` directory. ADR 0019 D7 still governs; this task adds
  `gui/src/upload/` to that table and touches nothing else.
- `src/**`
- Reading file content in the browser beyond what is needed to POST the bytes.
  No parsing, no preview rendering of document text, no provider call.
- Drag-and-drop, progress bars, and multi-file queues. One file at a time is the
  deliverable; anything more is a later task.

## Definition of done

- A selected file is sent as raw bytes with `content-type:
  application/octet-stream` and `x-a008-filename`, matching ADR 0020 D3.
- The returned locator and media type are displayed.
- An unsupported media type shows the server's named reason, not a generic
  failure.
- An oversized file is reported as such rather than appearing to hang.
- No credential appears anywhere in `gui/src/upload/`.

## Minimum verification gates

- [ ] Unit tests against a faked `fetch` covering: a successful upload, an
      unsupported media type, an oversized file, and a network failure.
- [ ] A test that the request carries the filename header and the octet-stream
      content type.
- [ ] `grep -ri "NVIDIA_API_KEY" gui/src/upload/` returns nothing.
- [ ] `npm --prefix gui run typecheck` and `npm --prefix gui run build` clean.
- [ ] `npm --prefix gui run test` green; the new tests are discovered by the
      A008-0039 runner without any script edit.
- [ ] Root `npm run typecheck` and `npm test` still green.

## References

- [`../adr/0020-source-upload-ingest.md`](../adr/0020-source-upload-ingest.md) D3
- [`../adr/0019-a008-owned-gui.md`](../adr/0019-a008-owned-gui.md) D6, D7
- `gui/src/terminal/run-shell-command.ts` is the pattern for a host-route client
