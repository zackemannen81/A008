# Task A008-0046 — Memory staging budget increase

Status: Complete
Owner: mrWhite81 (claimed), implemented by the operator
Created: 2026-09-02
Completed: 2026-09-03
Branch: `claude/A008-0046-staging-budget`

## Why

Owner testing across several models and settings: an ordinary factual text
produced **49 proposals**. The staging ceiling was 8, so more than half of a
normal extraction was discarded as `budget_exceeded` before anything reached the
commit path.

## Change

| Constant | Was | Now |
| --- | --- | --- |
| `DEFAULT_LIMITS.maximumProposals` | 8 | 128 |
| `SEMANTIC_JSON_GENERATION.maxTokens` | 1024 | 16384 |

The two move together. A 128-proposal extraction does not fit in 1024 output
tokens, and a truncated JSON array is not partial knowledge — it fails the
strict parse and the whole batch is discarded. 16384 is the verified model
profile's own output maximum, so it is the ceiling rather than an arbitrary
number.

## The consequence the owner should hold onto

`maximumProposals` is a cost dial as much as a correctness one. The post-output
coordinator commits proposals strictly sequentially, one relation-classifier
call each:

```ts
for (let i = startIndex; i < batch.proposals.length; i += 1) {
  result = await this.#committer.commit({ batch, proposalIndex: i }, …);
}
```

Provider calls per delivered answer therefore go from 1 analyzer + up to 8
classifiers, to 1 + up to 128. At the observed 49 proposals that is roughly six
times the calls and six times the post-output latency, serialized. The change
was made knowingly on the owner's instruction; the number can be lowered without
touching anything else.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Core suite | `npm run test:core` | 299 pass, 0 fail |

299 accounts for the 296 baseline plus 3 new cases: a 49-proposal extraction
survives the default ceiling, 129 proposals still fail closed, and the semantic
generation profile keeps its output budget alongside temperature 0, thinking
off, and non-streaming.

### Mutation checks

| Mutation | Result |
| --- | --- |
| ceiling back to 8 | 298 pass, **1 fail** |
| `maxTokens` back to 1024 | 298 pass, **1 fail** |
| both reverted | 299 pass, 0 fail |

## Out of scope

- No change to the analyzer instruction; that is A008-0047.
- No change to `SEMANTIC_BUDGET_MAXIMUM`, the 16384-byte *input* budget in
  `src/runtime/local-memory-runtime.ts`, which is a separate limit and already
  at that value.
- No batching or parallelism in the coordinator. Making 128 proposals cheap is a
  different task from making 128 proposals possible.
