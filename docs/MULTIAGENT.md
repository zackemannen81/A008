# Multi-Agent Operation

Status: Prepared policy; process enforcement is not installed for a007.

## Control and process planes

Repository state owns task identity, scope, decisions, verification, and
handoff. Agent runtimes only execute and report. A process saying done is not
completion evidence.

## Safe writing unit

```text
one child task
  = one claimed A007 identity
  = one frozen charter
  = one branch
  = one physical worktree or clone
  = one non-overlapping write scope
  = one reviewed integration handoff
```

Read-only mapping agents may inspect shared sources when they do not modify
them. Writing agents do not share a working directory.

## Worker-clone root

The configured root is:

```text
C:\code\a007-workers
```

It is a sibling of the canonical repository at `C:\code\a007`, not a child of
it. A worker directory uses `A007-NNNN_task-slug`; the corresponding default
branch uses `codex/a007-nnnn-task-slug` unless its charter names another branch.

Before creating a clone or worktree, the operator verifies that the exact target
path does not already contain unrelated data, records the source remote and base
revision, and binds it to one claimed task. Cleanup or deletion requires explicit
task authority; an old worker directory is never overwritten for convenience.

## Operator locks

The operator owns:

- `docs/TASK_IDS.md` allocation on `main`;
- the canonical a007 working tree;
- cross-task decisions and shared contracts;
- merge order, combined verification, release, and external effects;
- credentials, paid-provider authority, shared ports, and test environments.

## Wave preflight

Before a writing wave:

1. Claim every child ID on `main`.
2. Freeze non-overlapping child charters.
3. Allocate a unique directory under `C:\code\a007-workers` and verify it is
   outside the canonical repository.
4. Record base revision, branch, write scope, read dependencies, and gates.
5. Confirm real permissions and external-effect boundaries.
6. Respect at most five concurrent writing workers or the lower runtime limit.

The five-worker limit is advisory until a configured process layer proves
enforcement. The optional local MCP add-on can supervise processes but cannot
allocate IDs, decide scope, merge, or accept completion.

## Evidence and handoff

Workers report modified files, commits, exact checks, skipped checks, blockers,
and next action. Git and owning documents outrank process logs. Cross-worker
messages are observations until integrated through normal authority updates.

## Failure recovery

A replacement worker receives current repository truth, the frozen charter,
branch/base revision, last compatible checkpoint, known observations, missing
verification, and next action. No workflow claims to reconstruct hidden model
state or private chain-of-thought.
