# ADR 0039 — Project bootstrap

Status: Accepted
Date: 2026-09-11
Task: A008-0094
Amends: ADR 0006 (project identity is generated, not typed), ADR 0029
(`A008_GUI_WORKSPACE` remains a launch override)

## Decision

A008 can create and open a local project through one host-owned bootstrap
transaction. The renderer collects a typed `ProjectBootstrapConfig` and shows a
preview. It does not create directories, copy files, or run Git. The host
validates, previews, confirms and executes.

Project identity is a generated canonical `project` runtime ID (ADR 0006). The
user never types it. Display name and folder path are user input.

### Sources

Inspected local Apache-2.0 inputs, not shipped wholesale:

- Docs-First Continuity Protocol at
  `C:\code\docs-first_continuity-protocol` revision
  `c1b7b44309095d30262d273d8f5d0704629a943c`
- Docs-First Multi-Agent Orchestrator Add-on at
  `C:\code\docs-first-multiagent-orchestrator-addon` revision
  `7b57449935d93cfe1909c83b237367eab2d7bf5b`

A008 writes its own starter documents and records those pins. It does not copy
either source tree, `baseline/`, the add-on MCP server, or the PowerShell
wizard into product runtime.

### Memory

"Use global A008 memory" means the existing durable local store with a
project-scoped namespace. It does not merge projects into one soup and does
not create a second database. Unchecked means this project does not attach
that store.

The current sqlite sidecar `A008-project-id` remains the default for an
unregistered workspace. A registered project uses its stored ID against the
same file; multiple namespaces in one store are allowed.

### Multi-agent

Orchestrator add-on requires Docs-First Continuity. Enabling it records
`maxWorkers` and a worker-clone root that is outside the project tree. The
host may create that empty root. It does not create worker clones, worktrees,
or start the add-on MCP process. Allocation stays lazy.

### Workspace switch

Creating or opening a project that changes workspace starts a new ACP session
in that root. The previous conversation is not carried across. `A008_GUI_WORKSPACE`
still overrides host launch cwd when set.

### Safety

Preview lists exact planned filesystem mutations. Confirm is one authorized
transaction. Existing unexpected files are refused. No overwrite without an
explicit later policy. No provider call.

## Consequences

A008 can own a project lifecycle instead of only attaching to the host cwd.
New projects can start docs-first without becoming copies of A008 itself.
The add-on remains optional policy, not an installed process layer.
