# ADR 0014 — Live write-path reconciliation reinforcement

Status: Accepted (amended by ADR 0018)

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The memory engine already reinforces on `restatement` and `extend`: it adds
`reconciliationReinforcement` to `relevanceScore`, then sets activation from
`keepAlive || score >= activationThreshold`. A008-0016 wired CLI/ACP to that
engine but set both live boosts to `0`, so the marked Reinforce flow did not
change canonical strength.

Mutating `SemanticMemory.project()` can also reinforce, but the hybrid reader
uses `projectSelected` and must not treat retrieval as use. Decay is still
unimplemented.

## Decision

- Live `createLocalMemoryRuntime` uses `reconciliationReinforcement: 0.2` and
  `projectionReinforcement: 0`.
- Write-path order stays boost then threshold evaluation. There is no separate
  Activate node before Reinforce.
- Chat reads remain non-mutating. Analyzer confidence still cannot activate.
  The user-assertion `keepAlive` gate remains the only `new` activation path.
- Weaken/decay remains later work.

## Alternatives considered

### Also enable projection reinforcement on live reads

Rejected. Retrieval is not use. Hybrid projection must not raise score or
reactivate dormant records merely because they were selected.

### Implement cyclic weaken/decay in the same slice

Deferred. That is a different policy and lifecycle contract than strengthening
an explicit restatement or extend.

### Activate dormant items from retrieval or analyzer confidence

Rejected. Activation remains threshold-or-keepAlive after an explicit write
decision.

## Consequences

- An already-active restatement/extend gains `0.2` strength, clamped to 1.
- A dormant restatement/extend becomes active only when the boosted score meets
  its threshold.
- The architecture benchmark still uses zero boosts and does not claim live
  reinforcement.

## Amendment

Amended 2026-09-02 by
[ADR 0018](0018-knowledge-and-memory-model.md). Retrieval remains
non-mutating; projection reinforcement stays zero. Withdrawn: encoding
acceptance as `keepAlive` / activation inside the user-assertion gate, and
treating restatement/extend score boost as a truth transition. `REINFORCE` is
a named process on evidence only (M6). User assertion becomes ACCEPT policy
`user-assertion-v1` (M5) and must not write strength or bindings. Decay
remains later work until A008-0027.
