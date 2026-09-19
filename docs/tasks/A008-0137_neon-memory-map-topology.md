# A008-0137 — neon memory-map topology presentation

Task ID: A008-0137
Parent Task: none
Status: In Progress
Owner: Rickard (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 2026-09-19

## Task Summary

Rework the existing read-only Memory Relationship Map toward the supplied neon topology reference: distinct node forms and colours, readable directed links, and a focus view that preserves the wider graph as subdued dashed context.

## Task Charter

### Goal

Make stored memory topology easier to scan and inspect in the existing Relationship Map without changing memory data, graph semantics, or runtime ownership.

### Primary Deliverable

A scoped `gui/src/memory` graph presentation with high-contrast kind-specific node shapes, directed relation labels and topology-weighted arrows, plus a focus mode that keeps unrelated nodes/edges visible as dark dashed context.

### In Scope

- Improve the existing SVG node-shape, kind-colour, directed-arrow, edge-label and edge-weight presentation.
- In focus mode retain every bounded graph node; emphasize the selected neighbourhood and render remaining nodes/links dark and dashed.
- State clearly in graph copy that visual link weight reflects parallel displayed stored links, not evidence strength.
- Add focused renderer/layout regressions and update relevant docs for the presentation behavior.

### Out of Scope

- Memory retrieval, lifecycle, evidence strength, graph API/schema or backend-bound changes.
- Invented relation scores, force simulation, new graph dependencies, graph mutation or provider calls.
- Global theme or shell redesign outside the scoped Memory Relationship Map styles.

### Definition of Done

- Existing memory kinds remain visibly distinguishable by SVG form and theme-backed neon colour.
- Every displayed stored link has a directed arrow; selected links expose their stored relation label.
- Visual arrow weight is derived only from duplicate displayed stored topology and is labelled honestly.
- Focus mode keeps unrelated graph context present but subdued/dashed, while the selected neighbourhood remains clear.
- GUI tests/typecheck/build and `git diff --check` are run when dependencies permit; documentation records actual results.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-06 — supported memory inspection through its existing runtime/host owner.
Contract revision: current repository revision reviewed 2026-09-19.
Accepted constraint: ADR 0031 and A008-0084 retain a bounded, read-only graph of stored links; topology presentation may not imply unsupported semantic distance or evidence strength.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Distinct neon topology presentation | PC-06; existing read-only inspection owner and theme-backed visualization tokens | The owner cannot efficiently distinguish record kinds or trace stored direction in a dense map | Scoped SVG/CSS refinements using existing shapes, graph records and theme tokens | Static rendered graph regression plus GUI checks |
| Context-preserving focus | PC-06; A008-0084 stable focus camera without graph mutation | Focusing a node loses wider topology context, contrary to the requested exploration behavior | Retain existing records/links; apply focus-only emphasis/dashed CSS and retain neighbourhood frame | Renderer regression verifies all nodes remain and unrelated context is dashed |
| Honest visual link weight | PC-06; stored links only, no invented evidence semantics | A strength-like visual could mislead users into believing the runtime supplied evidence strength | Derive width solely from parallel displayed edges and label that limitation in graph copy | Unit regression over repeated stored edges and copy review |

### Minimum Verification Gates

- [ ] Graph rendering regression covers kind forms, arrows, relation labels, topology weight and focus context.
- [ ] GUI typecheck/test/build pass, or unavailable gates are recorded with the actual cause.
- [ ] `git diff --check` passes.
- [ ] Final review confirms no memory/API/runtime behavior is changed.

## References

- `docs/PROJECT_BRIEF.md` PC-06
- `docs/adr/0031-workbench-context-and-memory-map.md`
- `docs/tasks/A008-0084_readable-memory-map.md`
- `gui/src/memory/memory-graph.tsx`
- `gui/src/memory/memory.css`

## Checklist

- [x] Inspect the existing graph, data contract, focus behavior and styles.
- [x] Implement scoped topology presentation and context-preserving focus.
- [x] Add focused regression coverage.
- [x] Run verification and update owning documentation.
- [ ] Archive, hand off and restore the current-task template before integration.

## Decisions and Notes

- The supplied image is visual reference only; its fabricated labels/data and any unsupported semantics are not adopted.
- The graph contract contains no edge/evidence-strength field. Width therefore represents only the count of parallel displayed stored links, never truth, confidence, relevance, lifecycle or semantic similarity.

## Charter Amendment Log

- none

## Verification

- Final scope review: only `gui/src/memory` presentation/layout/test owners and their required documentation were changed. No memory data, API/schema, runtime, retrieval, lifecycle or provider behavior changed.
- `npm --prefix gui run typecheck`: passed.
- `npm --prefix gui run test`: passed, 176 tests, 0 failures/skips.
- `npm --prefix gui run build`: passed. Vite retained existing Zod annotation and >500 kB chunk warnings only.
- `git diff --check`: passed.
- The focused memory graph regression verifies all nodes and arrows remain rendered, selected relation labels and parallel-link weights are present, the focus decision subdues only unrelated context, and the explanatory copy rejects an evidence-strength interpretation.

## Handoff and Follow-ups

- Current state: implementation in progress.
- Next recommended step: complete scoped graph changes and run GUI gates.
- Blockers: none known.
- Child tasks: none.
- Resume condition: repository working-tree state.
- Open questions: none.
