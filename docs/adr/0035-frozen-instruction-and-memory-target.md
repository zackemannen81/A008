# ADR 0035 — Frozen instruction and memory target

Status: Accepted
Date: 2026-09-08
Task: A008-0080
Decision owner: project owner, following review of A008-0079

## Decision

The owner has reviewed the specification and requested publication to main,
freezing and implementation. Adopt
[the specification](../backlog/instruction-plane-and-memory-lifecycle.md),
including P1–P6, as the fixed target. Those six labels retain their reviewed
wording; they are now accepted choices, not requests to obtain approval again.

Reviewed commit: `97f36ebffe444858697a947260fc745af1ab8525`.
Reviewed specification blob: `7371a86ddcc1b82f8bf3d96add40e5dfda928f3f`.
The UTF-8 body from `## 1.` to end has SHA-256
`a7f32b601a6d26cceeaaad3cf6b45f362c97d9b04bb5b5286c0fbfaa57c56a5a`.
Keep that body unchanged. Status/implementation pointers above it and collection
indexes may track progress. Any requirement change needs a separately reviewed
amendment with exact deltas; do not silently edit the frozen target.

## Exact authority boundaries

- L1 refines ADR 0027's delivery rule: one composed chat system message, with
  session/global configuration and the applicable memory rule. Generic fallback
  is selected only in the absence of explicit configuration. Snapshot, data
  trust, byte budgets and durable-history guarantees survive.
- L2's P1–P5 are accepted target amendments to ADR 0018/model §§7–8 and affected
  lifecycle processes: operational exponential baselines, severity ownership,
  genuine evidence with exact targets/atomic receipts, and the specified legacy
  conversion. Reading alone may no longer authorize automatic strengthening in
  that target. Existing pins, unknown world clocks, direct-match eligibility,
  accepted state and evidence separation survive.
- P2 fixes the reviewed defaults; P1's unclassified-carrier policy and P4's legacy
  thresholds (including zero) are explicit exceptions. No numeric policy is
  silently applied by this decision record.
- L3's P6 permits independent semantic association metadata and its one-hop
  associative consumer. It does not add lifecycle to a RelationshipBinding,
  transfer strength to endpoints, or establish truth.
- ADR 0023 additive surfaces/budgets, ADR 0024 scope/retrieval and ADR 0028
  tool/reasoning boundaries remain intact except for the explicitly named
  lifecycle/association target behavior when those slices are implemented.

The existing constitution describes the implemented baseline until the
corresponding slice lands. For target direction, this exact amendment resolves
the conflicts identified in the frozen specification; old wording does not
require another approval of the same decision.

## Sequencing and verification

Activate **L1 only** in [A008-0080](../tasks/A008-0080_coherent-instruction.md).
L2 and L3 retain separate identities, charters and completion gates. Acceptance
of the whole target does not make all slices active or implemented.

A01–A30 remain verification requirements. Current behavior and actual test results
belong in SYSTEMDOC/CURRENT_STATUS and completion records, not in this decision.
The owner authorized Git publication/integration; no live/paid call, deployment
or versioned release is implied.
