# Task A008-0062 — Statements are a set; a failed proposal does not take the batch

Status: Complete
Owner: Operator
Parent: ADR 0018 D13, D14
Created: 2026-09-05
Completed: 2026-09-05
Branch: `claude/A008-0062-statement-set`

## Why

From a live GUI host run:

```text
memory> memory commit failed at proposal 2: UPDATE fails when the slot is contested
```

Reproduced end to end before changing anything — three facts stated in one
message about one subject:

```text
postOutput status : commit_failed
committed         : 0 of 3          ← not 2 of 3; the batch rolled back
contested slots   : [ 'attribute:zorro:statement' ]
second turn       : memory commit failed at proposal 1: ...contested
```

Three facts stated, all three lost, and the subject permanently unwritable
across restarts.

## The chain

`#ensureSlot` registered `<entity>.statement` with `single` cardinality. That
encodes "an entity has exactly one statement", which is false by construction:
the analyzer instruction asks for *every* distinct durable claim.

So proposal 0 bound a value; proposal 1 put a second distinct value on the same
slot over an overlapping interval; `reconcile` applied the single-cardinality
rule and returned `conflict`; `applyConflict` marked the slot contested; and
proposal 2 threw. The loop returned on that throw, discarding proposals it had
not reached and rolling back the ones it had. `contestedSlotKeys` persisted, so
every later turn about the same subject failed at its first proposal.

The relation classifier had returned `new` for all three. **Its judgement was
correct and a mechanical cardinality rule overruled it**, because the commit
read `classifierDecision.type === "conflict" || decision.outcome === "conflict"`.

## What changed

**The slot is a set** (ADR 0018 D13). Many statements about one entity coexist
as open members, which is what the slot always meant. Disagreement becomes the
relation classifier's judgement — what ADR 0018 already makes it, with
`reconcile` as the mechanical bookkeeper. D6 is unchanged in substance: a
conflict is still retained, still answerable, still never resolved by recency or
strength. What changes is who decides there is one.

The cost, stated rather than buried: a contradiction the classifier misses is no
longer caught by cardinality. Cardinality was catching real disagreement only by
accident on this slot, and false disagreement on every rich extraction.

**A deterministic refusal is stepped over** (ADR 0018 D14). Split by error code,
not by class — `invalid_input`, `invalid_proposal`, `policy` and `illegal_state`
skip and record; everything else keeps the resumable checkpoint. The default
leans towards stopping, because skipping loses a proposal while stopping keeps
it recoverable.

## Two things the change dragged in

**Existing stores carry the old cardinality.** A slot definition is durable and
`register` refuses to overwrite one, which is right. `SlotRegistry.widenToSet`
is the one redefinition allowed: it reinterprets no binding already stored,
every current binding stays current, and narrowing is refused because it would
orphan bindings that are legal today.

**The two judgements can now disagree.** Before this they almost never did. When
only the classifier calls it a conflict, `reconcile` has returned `change` — and
`applyConflict` requires a conflict decision and threw on what it was handed,
turning a genuine contradiction into a crash. My own test caught it. The
decision is now restated as the conflict the classifier found, naming every open
member of the slot as a competing claim.

## Verification

`npm test`: 404 core, 4 membership, 75 GUI, 0 fail, 0 skipped, up from 397.

The original reproduction, re-run:

```text
committed         : 3 of 3
contested slots   : []
open bindings     : 3   (all on zorro.statement)
second turn       : (no diagnostic)
```

Nine mutations, each applied alone, all nine caught. Two survived a first round
and both were real gaps:

- **`stale_state` classified by code, not class.** An existing test caught the
  first version, which treated every `MemoryError` as deterministic and would
  have skipped the most retryable failure there is.
- **The set registration was covered for by its own repair.** Widening a legacy
  single-valued slot is so effective that reverting the registration changed no
  test. The registration is now asserted after exactly one commit, before any
  second proposal could widen it — otherwise redundant code becomes code nobody
  notices is wrong.
- **The diagnostic wording was untested** after the batch-resilience test moved
  to the coordinator. A staging skip and a commit refusal are now asserted to
  read differently, because they point at different things to go and look at.

## What this does not do

A contested slot is still permanent, and slots already contested in a live store
stay contested. That is deliberate: `docs/KNOWLEDGE_MEMORY_MODEL.md` says a
contested slot must never silently resolve itself, and its open question 2 still
stands — *who resolves a contested slot, and through which surface? Never
automatically — but "never" needs a path.*

This task removes the defect that was firing it constantly. It does not build
that path, and it does not clear marks that already exist, because after the
fact there is no way to tell a false conflict from one the classifier genuinely
found.
