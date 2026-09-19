# A008-0123 — repair entity graph and relation/provenance contracts

Task ID: A008-0123
Parent Task: none
Status: Complete
Owner: mrWhite81 (operator)
Created: 2026-09-17
Last updated: 2026-09-17

## Outcome

The bounded read-only memory graph upgrade is implemented in `gui/src/memory`.
It adds force, cluster and hierarchy projections, kind-based node shapes,
relation/activation-aware edge presentation, adaptive labels and focus dimming,
and a summary-first Inspector while preserving the graph's read-only boundary.

## Verification

- The implementation is present in the working tree in the declared
  `gui/src/memory` scope.
- Full GUI test/typecheck verification was not available in this workspace
  state because the GUI test loader/build dependencies were missing.
- Existing unrelated working-tree changes were not overwritten.

## Handoff

The next active task is A008-0124, a separate GUI CRT overlay integration.
