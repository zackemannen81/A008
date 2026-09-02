# ADR 0017 — Bounded relation-classifier type aliases

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

Live NVIDIA Nemotron relation classification returned strict JSON
`{"relation":"new","targetHandle":null}` for empty-candidate proposals. The
instruction said "Choose exactly one relation" without naming JSON field
`type`. `RelationGatedMemoryCommit` compared only exact `raw.type` and threw
`policy: relation classifier returned an unknown type`, so a delivered answer
degraded at proposal 0 even though the model chose a canonical `new`.

## Decision

- Runtime accepts the five canonical names `new`, `restatement`, `extend`,
  `supersede`, and `conflict` from field `type` or field `relation`.
- Names are trimmed and case-folded. JSON `null` is omitted.
- If both fields are present they must name the same relation; disagreement
  fails closed before reconcile or index.
- Unknown, empty, or non-string names fail closed. The error includes the
  returned value. Runtime does not map `create`, `update`, `none`, or other
  invented labels onto a canonical relation.
- `targetHandle: null` on `new` is omitted. Restatement, extend, supersede, and
  conflict still require known local handles.
- The classifier instruction names field `type` and the five exact strings.

## Alternatives considered

### Fail closed and only change the prompt

Rejected as the sole fix. The live model already chose `new`. A prompt change
reduces recurrence; it does not recover the observed payload.

### Map `create`/`update` onto canonical relations

Rejected. That invents a relation the model did not choose.

## Consequences

- Live `relation: "new"` commits as `{ type: "new" }`.
- Canonical `{ type: "new" }` and the other four relations remain unchanged.
- Diagnostics name the actual returned type instead of a generic unknown.
