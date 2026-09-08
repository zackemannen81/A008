# Readable memory relationship map

Task ID: A008-0084
Parent Task: None
Status: Ready
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

- [ ] Dense deterministic layout and rendering/inspection regression tests.
- [ ] GUI tests/build and relevant core regression.
- [ ] Browser desktop/narrow selection, focus and zoom with synthetic records.
- [ ] Final necessity, documentation and immutable/owner CSS review.

## References

- [Memory map decision](../adr/0031-workbench-context-and-memory-map.md)
- [Focused workspace](../adr/0030-focused-standalone-workspace.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and claim identity on main before Ready.
- [ ] Implement stable layout, restrained labels and stored-link inspection.
- [ ] Verify browser and regressions; document and integrate.

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

Pending.

## Documentation Updates

Pending CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE and JOURNAL review.

## Handoff and Follow-ups

Pending.
