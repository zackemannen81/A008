# ADR 0040 — Stable client API program

Status: Accepted
Date: 2026-09-14
Task: A008-0103
Refines: PC-01, PC-04, PC-05, PC-06

## Decision

The owner approved freezing the reviewed host/client plan and beginning its
implementation through frozen child charters. The accepted target is
[the plan](../backlog/host-client-api-boundary.md), whose body from its first
section heading is pinned as SHA-256 `0a7edce0560e781a5dba6ec89be28e7e75f3b0eeeca6a062b72d9e525c3d8f2c` (UTF-8, LF).
The immutable proposal provenance is commit f4dffcd; the working plan keeps its
stable path. Program activation and verified progress live in
[A008-0103](../tasks/A008-0103_stable-client-api-program.md).

The seven-stage sequence and acceptance requirements are frozen. One shared
runtime remains authority. Clients consume a versioned contract/SDK rather than
GUI/runtime internals. Existing v1 and ACP clients and user memory remain migration
obligations. SQLite, process-local sessions, no durable conversation/offline sync,
one owner and a bounded independent Expo proof are the initial scope.

Each child freezes its own necessity argument and gates before implementation.
The operator may make routine implementation choices inside this approved target
without renewed owner permission. Precise V2/auth/ownership guarantees must be
recorded in accepted child ADRs before dependent code; this ADR does not silently
change v1, ADR 0028 panel ownership or ADR 0037 disconnect behavior.

First child A008-0104 establishes the current transport/session contract, full
route inventory and real-consumer tests without changing wire behavior. Shared
HTTP payload schemas may be completed in a bounded subsequent stage-1 child;
the program cannot mark a whole stage complete from a partial foundation.

No provider charges, publication or running-host restart is inferred from a
build step. This adoption does not claim that the new API exists yet.
