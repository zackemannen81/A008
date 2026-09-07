# ADR 0025 — Read-only memory diagnostics in the A008 GUI

Status: Accepted
Date: 2026-09-06
Decision owner: Codex (operator), implementing the owner's A008 GUI request
Task: A008-0064

## Context

The owner needs three memory views in `gui/` to check that memory works.
ADR 0022 still holds: this is a test surface. Recall is a budgeted projection
and cannot truthfully represent the inventory of stored knowledge or its links.

## Decision

- Add `GET /v1/memory` bridged to custom ACP `memory/inspect`. The existing
  ACP runtime remains the only SQLite/context owner. Inspection needs no chat
  session and invokes no model.
- Return `A008_MEMORY_INSPECT_V1`, project identity, durability, actual inventory
  totals, labels, paginated diagnostic records and stored relationships. Validate
  and bound search, kind/domain/status filtering and pagination.
- Cover entities, bindings/history, claims, events, utterances, artifacts and
  provenance. Preserve uncertainty, attribution and acceptance separately from
  evidence activation. Current bindings have no evidence activation score.
- Graph edges describe stored structural/provenance links; layout distance is
  not similarity. Only draw edges with displayed endpoints and disclose bounds.
- Knowledge Manager means browsing and inspecting here. No write/delete,
  acceptance or conflict-resolution action. Render details as escaped text and
  retain the host's origin and credential-redaction guards.
- Memory is a workspace page. Keep chat mounted when hidden to preserve its
  transcript, session and pending turn. Keep the warm palette; import no mockup HTML.

## Consequences

The GUI can inspect dormant evidence and unaccepted claims a chat projection
may omit. Inventory scans are in-memory in the existing single-process adapter;
wire results are paginated, text is bounded and truncation is disclosed.
This is a local diagnostic contract, not a remote administration API or graph
retrieval policy. `A007_MEMORY_V1` is unchanged.
