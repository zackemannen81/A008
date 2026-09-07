# A008-0070 verification

Date: 2026-09-07
Branch: `A008-0070-workbench-help-memory-map`

## Automated

- `npm --prefix gui run typecheck` — pass
- `npm --prefix gui run build` — pass (Vite production build)
- `npm --prefix gui test` — 100 pass, 0 fail

Covered by tests:

- Help hosts the tool catalog and shortcut reference
- Workbench card is Environment/Sources, not the catalog
- `git status -sb` / shortstat / `git ls-files` parsers
- Empty-chat shortcut chips
- Browser rejects non-http(s) URLs and omits `allow-same-origin`
- Memory graph clusters by domain around a hub; inspector still escapes

## Host smoke

- `npm --prefix gui run dev` served `http://localhost:5173/` with status 200
  and the A008 root document. The process was stopped after the fetch.

## Skipped

- Interactive desktop/narrow browser click-through. This agent session has no
  browser automation tools. Layout and navigation were not re-proved in a
  viewport; DOM tests and the CSS/workbench markup are the substitute.
- Root `npm test` (core + membership). No core/runtime files changed.
- Live NVIDIA call, GitHub pull-request API, packaging, publication.

## Notes

Workbench git status uses `POST /v1/shell` with `git status -sb` and shortstat.
That needs a running GUI host; the parsers are unit-tested independently.
Pull request status is reported unavailable, matching the owner concept.
