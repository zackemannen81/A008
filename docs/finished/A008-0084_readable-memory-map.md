# Readable memory relationship map

Task ID: A008-0084
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

AGENTS.md and ordered documentation; ADR 0030/0031 and existing read-only
memory inspection contract.

## Task Summary

The owner finds the current map difficult to read and supplied two visual
references. Current fan placement clamps crowded nodes together, labels overlap
and selecting a record changes every position. Improve the graph presentation
and access to actual selected relationships within the existing memory view.

## Task Charter

### Goal

Make the bounded memory map readable and stable while exploring stored records.

### Primary Deliverable

A spacious domain-clustered graph with stable selection, restrained labels,
usable focus/zoom and the existing read-only inspector.

### In Scope

- Deterministic spaced domain clusters around a hub; fit, zoom and overflow.
- Selective readable labels, kind colours, selected connection emphasis and focus.
- Existing inspector with accessible navigation of the displayed stored links.
- Scoped memory styles and layout at desktop/narrow widths.
- Synthetic dense graph/browser checks, owning docs and authorized integration.

### Out of Scope

- Retrieval, lifecycle, state acceptance, schema or backend graph bounds changes.
- Invented records, edges, similarity scores, cluster semantics or editable slots.
- New packages, provider calls, real user data fixtures or application restart.
- Global brand/accent changes, owner's logo CSS, or reproducing unrelated mock UI.
- New graph engines, force-simulation controls, background work or deployment.

### Definition of Done

- Up to 80 bounded nodes have distinct spaced positions without edge clamping.
- Selecting a node keeps positions stable and exposes its stored connections.
- Labels avoid crowding; full record text stays available through inspection.
- Focus and zoom work with mouse/keyboard; empty/bounded states stay truthful.
- Desktop/narrow synthetic browser inspection, GUI tests/build and relevant core
  regression pass; frozen specification and logo CSS remain unchanged.
- Necessity review, docs, archive, handoff and authorized main integration complete.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: ec77d63

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Stable spaced domain layout | PC-06; ADR 0031 radial domain grouping and read-only map | Records remain distinguishable and selections preserve spatial orientation; current clamping hides nodes | Deterministic collision-aware cluster/member placement in existing SVG, dynamic bounds and fit/zoom | Dense single/many-domain geometry, deterministic reorder and browser viewport checks |
| Labels, focus and inspection | PC-06; ADR 0030/0031, PC-04 runtime authority | Users can trace actual selected links and read full records without overlapping graph prose | Selective collision-aware labels, gentle curved stored edges and linked-record navigation in existing inspector | Keyboard selection, focus/zoom, exact stored endpoint/direction and escaped content checks |
| Verification and continuity | PC-06; docs-first evidence discipline | Presentation is checked on realistic density and screen sizes without private data | Synthetic isolated browser fixture, existing GUI/build/core checks and owning docs | Desktop/narrow screenshots, no console errors, final scope and immutable review |

### Minimum Verification Gates

- [x] Dense deterministic layout and rendering/inspection regression tests.
- [x] GUI tests/build and relevant core regression.
- [x] Browser desktop/narrow selection, focus and zoom with synthetic records.
- [x] Final necessity, documentation and immutable/owner CSS review.

## References

- [Memory map decision](../adr/0031-workbench-context-and-memory-map.md)
- [Focused workspace](../adr/0030-focused-standalone-workspace.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and claim identity on main before Ready.
- [x] Implement stable layout, restrained labels and stored-link inspection.
- [x] Verify browser and regressions; document and integrate.

## Decisions and Notes

- Owner explicitly supplied the two images as visual references. Sandbox content
  otherwise remains non-authoritative. Their fabricated counts and unsupported
  controls do not become product requirements.
- Positions and cluster shading aid reading, never imply semantic distance or
  relationships absent from the stored graph. Graph bounds remain 80/240.
- The prior owner CSS commit is the baseline and remains untouched.

## Charter Amendment Log

- none

## Verification

- GUI typecheck/production build passed; GUI suite 118/118 with no skips.
- Inspection core suite 8/8 includes a real local HTTP-to-ACP store read and
  verifies that inspection invokes no model and does not mutate SQLite.
- Geometry fixtures cover 80 nodes across 1, 6 and 79 domains, minimum 33-unit
  separation, bounded coordinates, input-order independence, label separation
  and identical rendered transforms before/after selection.
- Inspector regression preserves incoming/outgoing/self direction, parallel
  relations, displayed link counts and escaped untrusted text.
- agent-browser 0.37.1 inspected the isolated synthetic page at 1720x1100,
  1366x900 and 390x844. Actual rendered 80/152 and dense 80/240 graphs, single/many
  domain and empty scenarios load without page errors or Vite overlays.
- Browser selection preserves all 80 transforms; selected fixture 1 has 15
  stored links. Focus renders 15 nodes/15 selected edges and zero unrelated
  edges, with a neighbourhood frame. Keyboard Space selects a focused SVG node;
  connected-record buttons change selection through the existing page owner.
- Zoom changes to 150/200 percent with native overflow; Fit restores 100 percent.
  Narrow controls wrap and page-wide horizontal overflow is absent. Dense areas
  still require zoom/filter/focus to read every label on a small screen.
- Search Metadata returns 7 fixture records, domain Kognition returns 14, and
  Clear filters restores 80. No host/provider or user data is used in the preview.
- React review: stable memoized layout, pure derived labels/connections, existing
  fetch ownership, keyboard access, escaped text, unique SVG IDs and no new deps.
- Final necessity review: each changed behavior serves readable existing memory
  inspection. Camera framing and directed inspector navigation resolve crowding
  without altering topology, lifecycle, retrieval or provider ownership.
- Frozen target, prior task archives, dependencies and owner logo CSS preserved.
  Live user-data visual review remains with the owner after application restart.

## Documentation Updates

Updated CURRENT_STATUS, SYSTEMDOC and FILESTRUCTURE; preview recipe, archive and
handoff added. Operator journal entry follows main integration.

## Handoff and Follow-ups

- Complete; no blocking follow-up. Start the updated app and open Memory /
  Relationship map to review the owner store. This task does not restart it.
- Reproduce browser evidence with gui/test/README.md and synthetic scenarios.
- No runtime, schema or accepted L1-L3 specification changes.
