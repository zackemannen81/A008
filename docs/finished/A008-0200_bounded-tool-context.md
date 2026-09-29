# A008-0200 — Bounded native tool context

Task ID: A008-0200
Parent Task: None
Status: Complete
Owner: Codex (operator/implementer)
Created: 2026-09-30
Last updated: 2026-09-30
Charter frozen at: 2026-09-30, after local identity allocation on main (00c9151)

## Task Summary

The owner requested lower-context tool use across A008 and available MCP tools,
especially avoiding whole-file rereads for small edits. Native read_file currently
returns the entire file and couples readable/editable size to tool-output bytes.

## Task Charter

### Goal

Reduce avoidable model context during local repository inspection and editing
while preserving workspace, approval and stale-revision protections.

### Primary Deliverable

A bounded native read/edit workflow with sectional file reads, whole-file revision
hashes, compact results and actionable tool-choice/output guidance.

### In Scope

- Paginated line reads with explicit completeness/cursors and whole-file SHA-256.
- Separate bounded local file processing from model-visible result limits so
  small edits in larger files work without returning entire contents.
- Preserve exact unique matching and stale checks; handle consistent LF/CRLF
  differences without fuzzy writes, with bounded actionable failure diagnostics.
- Per-call terminal/Git output caps under existing runtime ceilings, and concise
  tool descriptions steering native work, narrow searches and MCP-only capabilities.
- Focused local regression and context-size evidence; owning documentation,
  archive, handoff and current-task template restoration.

### Out of Scope

- ACME/provider strict-mode changes, Remote Gateway/Desktop Commander changes.
- Automatically removing enabled MCP tools, dynamic tool discovery/routing,
  user-settings changes, new providers or external publication.
- Semantic memory, compaction/recovery policy, GUI or public API redesign.
- Fuzzy edits, removal of revisions/approvals, concurrent-writer transaction guarantees.

### Definition of Done

- A file larger than the result budget can be read in sections and edited with
  the returned whole-file hash. Unrequested contents do not enter tool results.
- Default reads are bounded; range/cursor metadata makes omissions explicit;
  UTF-8, BOM and line endings survive, including byte-limit boundaries.
- Stale hashes, ambiguous matches, binary files and workspace escapes remain
  rejected. Approved edits return the next revision without echoing file content.
- Shell/Git output can be narrowed per call without exceeding runtime limits.
- Existing MCP access and approval behavior remain; guidance distinguishes
  native repository work from capabilities requiring MCP.
- Verification records real local read/edit context reduction and limitations.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: 0174a4e

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Sectional read/edit | PC-LF-01 local tools; PC-LF-03 A008 owns context; PC-LF-06 workspace CWD; ADR 0055/0057 retain workspace evidence | Enable small edits in files exceeding result budget without dumping whole files; omission keeps this failure and excess context | Existing tool names with line ranges and full-file hash, bounded local snapshot, existing write checks | Large-file small-range edit, hash/stale/ambiguous/UTF-8/path/approval regression and byte comparison |
| Narrow output and tool choice | PC-LF-03 context ownership; PC-LF-04 A008 owns tool permissions | Avoid unnecessary output and duplicate-capability calls while retaining MCP capabilities | Native descriptions plus per-call output caps, no new router or MCP filtering | Actual shell/Git cap tests; catalog and existing MCP regression |

### Minimum Verification Gates

- [x] Root build/typecheck.
- [x] Model-tools and terminal tests, provider strict schema serialization checks.
- [x] Continuation/recovery and tool integration regressions relevant to changed contracts.
- [x] Local fixture demonstrates bounded large-file read/edit and measures context bytes.
- [x] Scope/necessity and final diff review; archive and template equality.

### Verification Budget

Local filesystem, process and provider-serialization fixtures only. No external
provider behavior changes; live-provider performance is not claimed.
Policy revision: 0174a4e; live calls/cost/input/output tokens: 0; live timeout: 0.
No credentials or external routes used. No push, deployment or publication.

## References

- docs/PROJECT_BRIEF.md, docs/SYSTEMDOC.md, docs/adr/0055-durable-sessions-and-process-ownership.md
- docs/adr/0057-checkpointed-turn-recovery.md
- src/tools/repository-tools.ts, src/tools/model-tools.ts, test/model-tools.test.ts

## Checklist

- [x] Inspect authority, current implementation and Desktop Commander comparison.
- [x] Allocate identity on main, review necessity and freeze charter.
- [x] Implement bounded tool workflow and tests.
- [x] Verify, document, archive and restore template.

## Decisions and Notes

- Local allocation on main; implementation branch codex/a008-0200-bounded-tool-context.
- No third-party code copied. Tool selection remains model-driven; guidance is
  not a guarantee of optimal calls. Enabled MCP schemas still occupy context.
- Read defaults: 200 lines, 8192 result-text bytes; zero-based cursor, whole-line
  boundaries, complete flag and whole-file revision. Local snapshot cap is 16 MiB.
- Native command caps do not raise the runtime ceiling. Status/JSON envelope
  bytes are outside the result-text cap. No filtering of MCP schemas or responses.
- Owner explicitly reserved C:\code\acme for another agent. This task did not
  access or modify that checkout; only A008's installed package was exercised.
- Final necessity review: changes serve the recorded local inspection/editing
  outcome. ADR 0058 records the model-facing read compatibility change; no new
  product clause, provider policy, memory policy or recovery behavior introduced.

## Charter Amendment Log

- none

## Verification

- `npm run build --silent`: PASS.
- `npm run typecheck --silent`: PASS.
- `node --test` on model-tools, terminal-tool, platform-continuation-recovery,
  chat-continuation, chat-continuation-pressure, A008-0127-embedded-acme,
  openai-chat-transport, core-suite-membership, acp-agent, engine-host and
  session-controls: **92/92 PASS**, no skipped tests.
- New cases verify sectional large-file reads and chained edits, byte-bound
  UTF-8/BOM/CRLF page reconstruction, default limits, EOF/empty/range errors,
  binary/invalid UTF-8/oversized refusal, original revision checks after outside-
  section mutation, mixed-line-ending literal matching and denied writes.
- Actual shell and Git caps plus strict-provider nullable optional arguments
  pass. Real installed ACME serializes the native catalog to OpenAI strict wire
  using intercepted fake fetch; this is not live OpenAI validation.
- 10,000-line local fixture: whole file **248890 bytes**; one three-line read
  and two successful edit results **692 bytes**, including the result wrappers.
  No actual token count, request-wide percentage or model retry reduction claimed.
- Existing GUI→ACP tool flow, stdio MCP, denial/cancellation, checkpoint evidence,
  lease/fence/recovery and provider regressions pass.
- Full unrelated GUI/core suites and live providers not run: no GUI/provider
  behavior changed and the relevant integration paths have local coverage.
- Diff/necessity review PASS. Current-task template restored byte-for-byte and
  archive copied exactly. No dependency changes or external publication.

## Documentation Updates

- Updated SYSTEMDOC, CURRENT_STATUS, JOURNAL, FILESTRUCTURE and collection indexes.
- ADR 0058 accepted and indexed; PROJECT_BRIEF's ADR inventory updated only.

## Handoff and Follow-ups

Complete locally; see docs/handoffs/A008-0200.md. No child task or blocker.
Next step is owner review/integration; no push or merge performed. Restart/reload
the A008 runtime after integration to use new tool definitions in running sessions.
