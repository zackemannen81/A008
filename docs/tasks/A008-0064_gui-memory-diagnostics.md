# A008-0064 — GUI memory diagnostics

Task ID: A008-0064
Parent Task: None
Status: Ready
Owner: Codex (operator)
Created: 2026-09-06
Last updated: 2026-09-06
Charter frozen at: 2026-09-06

## Goal and primary deliverable

Make `gui/` show whether actual memory works through Memory Overview, Memory
Relationship Map Graph and Memory Knowledge Manager, backed by read-only
inspection of the same project knowledge context used by chat in the ACP process.
The owner explicitly selected A008's diagnostic GUI, consistent with ADR 0022.

## In scope

- Documented additive host/ACP inspection contract; actual counts, paginated
  records, stored relationships, labels, state/history and provenance.
- Overview, searchable/filterable knowledge list, inspectable graph and details;
  honest loading, empty, unavailable, error and bounded-result states.
- Navigation preserving chat/session, responsive layout and keyboard access.
- Owning documentation, automated checks, browser verification and local handoff.

## Out of scope

Editing/deleting/accepting memory, conflict resolution, retrieval changes, a
second SQLite owner, provider calls, external client changes, shell redesign,
concept HTML imports, deployment, push and publication.

## Definition of done

- Three named views are usable from Memory in the A008 GUI.
- Runtime data drives all displayed values, missing data and limits are explicit.
- Inspection does not mutate state, call a model or expose credentials.
- Search/filter/page selection and graph inspection work; chat survives navigation.
- Verification, owning docs, immutable archive, handoff and template restoration.

## Minimum verification gates

- Root and GUI typecheck/build; full `npm test`.
- Runtime nonmutation, provider-free access, counts, filters, bounds, relationships;
  host guards and a real ACP round trip.
- GUI data/DOM tests; browser check of three views, selection, empty/error behavior,
  navigation and narrow layout using local synthetic data.
- Documentation links/fences, diff check, scoped secret review, template equality.

## References

- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0022-gui-is-a-test-surface.md`
- `docs/HOST_PROTOCOL.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- Base: `4bfaa50`; identity claimed on main as `4f5a73e`.

## Checklist

- [x] Read authority, inspect source, confirm target with owner and claim ID.
- [ ] Define and implement inspection contract and runtime/host bridge.
- [ ] Implement and exercise the three views.
- [ ] Verify, update owning documents, archive and hand off.

## Handoff

Implementation has not started. No push or live provider run is authorized.
