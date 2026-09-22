# Memory map visual check

## Project sidebar check (A008-0155)

After root and GUI builds, run `node gui/test/project-sidebar-preview.mjs` and
open `http://127.0.0.1:5195`. It serves the actual production GUI and host with
disposable synthetic projects/chats. Provider execution points at an unavailable
loopback address; no personal project registry, credentials or databases are used.
Check opening each saved chat, New chat and returning to prior content, pin/name
changes, folder collapse, Escape/focus return, all three Appearance themes and
390×844 navigation. Stop with Ctrl+C to close the host and remove fixture data.

Run `node gui/test/memory-map-preview.mjs` from the repository root, then open
`http://127.0.0.1:5194/__memory-map-check` and select **Relationship map**.
The real MemoryPage, graph, inspector and client parser use synthetic records.
The preview exposes no memory writes, provider, credentials or user database.
The fixture route exists only in this test runner, outside the production build.

Query scenarios: `?scenario=dense` (80 nodes / 240 links), `single` (one domain),
`many` (80 domains), and `empty`. The default has 80 nodes / 152 links in six
domains. Search and surface/domain/activation filters work against the fixture.
Add `theme=deep-space` to preview Deep Space surfaces and visualization colours;
the default is Neutral.

Check with an available browser driver (A008-0084 used agent-browser):

- Desktop 1720×1100 and 1366×900: select a node; positions stay fixed, full
  content and directed links appear in the inspector. Follow a connected record.
- Focus mode frames only the selected record and its stored neighbours. Disable
  focus to restore the map. It changes the camera, never record coordinates.
- Zoom, scroll and Fit work. Tab to a node and press Enter or Space to inspect it.
- At 390×844, controls wrap, the inspector follows the graph, and zoom/focus
  remain usable without page-wide horizontal overflow.
- Search/filter/clear and empty/dense scenarios display actual fixture counts;
  no error overlay, page exception or unexpected provider request appears.

The geometry and escaped rendering regressions run in `npm run test:gui`.
