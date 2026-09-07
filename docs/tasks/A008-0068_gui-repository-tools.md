# A008-0068 — Standalone GUI repository tools

Task ID: A008-0068
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-07
Last updated: 2026-09-07
Charter frozen at: 2026-09-07

## Goal
Work with a local repository from A008's own GUI using real model tool calls.

## Primary deliverable
Shared native repository tools and a GUI tool catalog with project context,
approval and execution feedback, independently of the external client.

## Scope
- Reuse the existing structured tool loop and standalone ACP permission bridge.
- Add bounded directory/file reads, new files, exact guarded edits and Git.
- Show the actual native tool catalog, cwd and model actions in the GUI.
- Make standalone workspace selection explicit at host startup.
- Verify real standalone HTTP/WebSocket/ACP/provider continuation, files and Git
  in isolated temporary repositories, plus GUI controls.
- Keep user instructions independent; inspect OpenAI source as reference only.

## Out of scope
External-client changes, an IDE/editor replacement, automatic prompt adoption,
third-party source import, general plugin marketplace, sandboxing, paid provider
tests, remote Git mutations, publishing or release.

## Definition of done
A GUI chat can read AGENTS.md, list its root, create/edit files and inspect Git
through approved tools, with actual results returned to the model. Denial,
cancellation, malformed input and stale edits do not report success. Existing
engine/CLI/GUI behavior passes regression gates.

## Minimum gates
- Root and GUI typecheck/build; full existing test suite.
- Native file/Git tests and standalone process integration with synthetic provider.
- GUI catalog/action tests and browser inspection.
- Owning docs, archived charter, handoff and restored CURRENT_TASK template.

## Checklist
- [x] Claimed identity on main before freezing.
- [x] Existing standalone tools/permission wiring inspected.
- [x] Implementation and regression verification.
- [x] Documentation, archive and handoff.

## Decisions
The user explicitly chooses A008 GUI as the repository work surface. Git is a
native offered tool; no third-party Git server install is needed. Existing ACP
stdio MCP integration remains available to clients supplying trusted servers.

## Verification and handoff

557 full-suite tests passed; targeted tool and host suites passed after final
changes. Desktop/mobile browser approval and result flow verified with a
synthetic provider. See ../evidence/A008-0068_gui-repository-tools.md and
../handoffs/A008-0068.md. No live calls, publishing or release.
