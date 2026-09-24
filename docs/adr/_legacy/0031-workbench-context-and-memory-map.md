# ADR 0031 — Workbench context and readable memory map

Status: Accepted
Date: 2026-09-07
Task: A008-0070
Amends: ADR 0030

## Decision

The Chat workbench is the session context panel: git environment and attached
sources. It is not the tool catalog. Tool names, descriptions and how-to copy
live on a Help page. Empty chat offers shortcuts for Review, Terminal, Browser,
Files and the workbench itself. Tools keeps the working panes (Terminal,
Upload, Browser, Files).

The Memory Relationship Map uses a domain-clustered radial layout around a hub
record. Node colour encodes surface kind. Distances still make no similarity
claim. Inspection remains read-only over the existing `/v1/memory` contract.

## Consequences

A008-0069's optional right-hand Repository/Terminal/Upload workbench is replaced
for Chat. Those working surfaces stay on Tools. Git status in the workbench is
a host-shell observation (`git status -sb` and shortstat), not a model tool
call. Writes (commit, push, file edits) still go through chat and existing
approvals.

Kind colours on the graph are a readability device, not a second product accent.
The shared `--a008-accent` token is unchanged.
