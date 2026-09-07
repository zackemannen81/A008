# A008-0070 — Workbench context, Help catalog and readable memory map

Task ID: A008-0070
Parent Task: None
Status: Complete
Owner: Grok (operator)
Created: 2026-09-07
Last updated: 2026-09-07
Charter frozen at: 2026-09-07

## Goal and primary deliverable

Give the standalone GUI the owner-supplied workbench, help, empty-chat shortcuts
and a readable Memory Relationship Map, without changing the engine contract.

## Scope

GUI presentation and local UI state. Tool catalog moved to Help. Chat workbench
became the environment/sources card. Empty-chat shortcuts and Tools panes for
Terminal, Files, Browser and Upload. Domain-clustered memory graph.

## Out of scope

Provider/runtime/memory-write changes, GitHub PR API, persisted conversations,
third-party UI, live NVIDIA, packaging.

## Completion

Implemented and verified as recorded in
[evidence](../evidence/A008-0070_workbench-memory-map.md) and
[ADR 0031](../adr/0031-workbench-context-and-memory-map.md).
GUI typecheck/build and 100 tests pass. Interactive browser click-through was
not available in this session and is named as a skipped gate.
