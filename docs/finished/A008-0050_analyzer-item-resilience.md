# Task A008-0050 — Per-item analyzer resilience

Status: Complete
Owner: Operator
Created: 2026-09-03
Completed: 2026-09-03

## Reported

Owner running the real GUI against a real provider:

```text
memory> memory staging failed: policy: proposal 5 proposition must be a non-empty string
```

One item in the analyzer's array came back with an empty proposition. The whole
batch was discarded.

## Cause

`stage()` validated proposals with `untrusted.map(...)`, which throws on the
first bad item. Fail-closed on any defect.

That was a reasonable policy at a ceiling of 8. A008-0046 raised it to 128 and
A008-0047 replaced the instruction with one that asks for completeness and
recursive splitting, so a normal extraction is now tens of items. The chance
that at least one is malformed is no longer small, and the cost of one bad item
is every good one beside it.

## Change

Per-item defects skip that item. Batch-level defects still fail closed.

| Defect | Before | After |
| --- | --- | --- |
| item is not an object | whole batch rejected | item skipped |
| empty proposition or kind | whole batch rejected | item skipped |
| confidence out of range | whole batch rejected | item skipped |
| semantic duplicate | whole batch rejected | item skipped |
| output is not an array | rejected | rejected |
| more items than the ceiling | rejected | rejected |
| serialized result over budget | rejected | rejected |

Nothing unsafe is admitted by this. A rejected item is still rejected; it just
no longer punishes its neighbours. The split is structural rather than a list of
special cases: every per-item rule lives inside `validateProposal` and every
batch-level rule outside it, so catching `MemoryError` around the former cannot
swallow the latter.

Duplicates skip for the same reason. The instruction asks for recursive
splitting and says to "remove only true semantic duplicates", so a model will
not always dedupe perfectly, and losing 49 propositions to one near-duplicate is
the same brittleness.

## The loss is never silent

`StagedKnowledgeBatch.skippedProposals` carries the reasons, and
`describeMemoryOutcome` reports them on an otherwise-completed batch:

```text
memory skipped 1 malformed proposal: proposal 2 proposition must be a non-empty string
```

A clean batch stays silent. The reasons are this repository's own validation
text and never analyzer content.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Full gate | `npm test` | 311 core + 75 GUI, 0 fail, 0 skipped |
| Chat proof | operator harness | 15 of 15 |
| Upload proof | operator harness | 13 of 13 |

### Mutation checks

| Mutation | Result |
| --- | --- |
| restore whole-batch rejection | **2 fail** |
| make the skipped loss silent | **1 fail** |
| both reverted | 311 pass, 0 fail |

## Note

This is a policy change at an untrusted-input boundary, made on the owner's live
report rather than proposed in advance. It is reversible in one place: the catch
in `stage()`. If fail-closed is wanted back, the batch-level rules are already
separated and only that catch needs removing.
