# A008-0094 — Project Bootstrap

Task ID: A008-0094
Parent Task: None
Status: Ready
Owner: Grok (operator)
Created: 2026-09-11
Last updated: 2026-09-11
Charter frozen at: 2026-09-11; contract revision `eb1d9b6bdab22d17a5da7b1b063e2d2d7e53ace7`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/MULTIAGENT.md`
- `docs/RUNTIME_IDENTITY.md`
- `docs/HOST_PROTOCOL.md`
- `docs/adr/0002-license-and-source-boundaries.md`
- `docs/adr/0006-runtime-identity-v0.md`
- `docs/adr/0029-standalone-gui-repository-tools.md`
- `docs/adr/0039-project-bootstrap.md`

## Task Summary

Give A008 a host-owned New Project bootstrap so the user can create a named
local project with optional Git, Docs-First Continuity, multi-agent policy and
project-scoped global memory. The GUI collects the config and confirms a
preview; the host executes one bounded transaction.

## Task Charter

### Goal

Let the user create and open an A008 project from the standalone GUI without
the renderer touching the filesystem, without mixing project memory
namespaces, and without installing the multi-agent process layer.

### Primary Deliverable

A typed `ProjectBootstrapConfig`, a host bootstrap service with preview and
confirm, a Projects UI (New / Open / Recent), and registration that binds the
generated project ID to the existing global memory store.

### In Scope

- Config shape:

  ```ts
  interface ProjectBootstrapConfig {
    projectName: string;
    rootFolder: string;
    repository: { initialize: boolean; name?: string };
    continuity: {
      docsFirst: boolean;
      multiAgent: {
        enabled: boolean;
        maxWorkers?: number;
        workerCloneRoot?: string;
      };
    };
    memory: { useGlobalA008Memory: boolean };
  }
  ```

- Generated canonical `project` runtime ID. Not a form field.
- GUI wizard matching the owner layout: Project, Repository, Continuity,
  Memory, preview of planned mutations, Cancel / Create, then Confirm.
- Multi-agent requires Docs-First. Checking the add-on locks continuity on.
  Worker fields are visible only when the add-on is enabled.
- Worker clone root must be an absolute directory outside the project tree.
  Default suggestion: `C:\code\A008-workers\<slug>` when the project root is
  under `C:\code`.
- Host preview and execute routes. Renderer never mkdir/git/write.
- Create empty project root. Optional `git init` (no commit, no remote).
- Optional A008-owned docs-first starter files parameterized by project name,
  adapted from the continuity protocol templates, with provenance recorded.
- Optional multi-agent policy file plus empty worker-root directory. No worker
  clones, worktrees, or MCP server install.
- Project registry outside the repository (beside existing `~/.a008` /
  `~/.A008` settings). Recent/Open read that registry.
- Opening or creating a project that changes workspace starts a new ACP
  session in that root. Current chat is not preserved.
- Global memory = existing sqlite file, namespace = generated project ID.
  Unchecked = this project does not attach the store.
- Allow multiple project namespaces in one sqlite file. Unregistered
  workspaces keep the current sidecar/env default.
- Idempotent where safe: empty existing folder may be used; unexpected files,
  foreign git, or existing docs-first files refuse rather than overwrite.
- Tests for validation, path isolation, preview/execute, registry, memory
  namespace, GUI dependencies, and no renderer FS writes.
- Owning docs, HOST_PROTOCOL, THIRD_PARTY pin of the two inspected sources.

### Out of Scope

- Copying `C:\code\docs-first_continuity-protocol` or
  `C:\code\docs-first-multiagent-orchestrator-addon` wholesale.
- Installing, spawning or depending on the add-on MCP server.
- Creating worker-01..N clones or worktrees at bootstrap.
- OS-native folder dialogs, accounts, remotes, first commit, push.
- Cross-project memory recall.
- Changing the live conversation without an explicit new session.
- Light/theme work, layout redesign of Chat/Memory/Tools/Help.
- Live provider calls, paid usage, publication.

### Definition of Done

- [ ] Parameters-independent Projects entry offers New, Open and Recent.
- [ ] Wizard collects the owner fields with continuity/add-on dependency.
- [ ] Preview names exact folders/files/git/memory namespace before write.
- [ ] Confirm creates the project through the host; renderer has no FS writes.
- [ ] Git, docs-first and add-on policy are optional and independently testable.
- [ ] Add-on records max workers and worker root only; no clones.
- [ ] Generated project ID is stored and used as the memory namespace when
      global memory is selected.
- [ ] Older unregistered workspaces still start.
- [ ] Existing unexpected paths are refused.
- [ ] Opening a registered project starts a new session in that root.
- [ ] Tests and GUI production build pass. No live provider call.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `eb1d9b6bdab22d17a5da7b1b063e2d2d7e53ace7`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Host-owned bootstrap transaction | PC-05, ADR 0019 D6, ADR 0039; renderer has no credentials or host FS | GUI would mkdir/git from the browser, or users stay stuck in host cwd | Preview + confirm HTTP routes; host service owns writes | Host tests create a temp project; GUI client posts JSON only |
| Generated project identity | PC-02 project-scoped retrieval; ADR 0006 generated `project` IDs | Manual IDs collide or leak into model context | Factory-create canonical ID; store in registry | Parse/round-trip; form has no ID field |
| Global memory, project namespace | PC-02/PC-04; sqlite already namespaces by projectId | One sidecar ID would mix every bootstrapped project into one namespace | Registry ID selects namespace in the existing store; sidecar remains unregistered default | Two projects, one sqlite, isolated records |
| Docs-first starter | Owner request; PC-06; ADR 0002 pin Apache-2.0 protocol revision `c1b7b44` | New repos would not be docs-first, or A008 would copy the protocol tree | A008-owned parameterized templates; no baseline/ copy | Created tree contains AGENTS.md and docs templates; source tree is not copied |
| Multi-agent policy only | ADR 0039; `docs/backlog/multiagent-process-layer.md` still not installed | Ten clones or an MCP server would appear at create time | Record maxWorkers + workerRoot; mkdir root; continuity required | Enabled add-on writes policy and empty root; no worker-01 directory |
| Workspace open | PC-01 one engine; ADR 0029 cwd is host workspace | Create would leave the GUI on the old cwd | Open/create that changes root starts a new ACP session | Open test: new sessionId and reported cwd |

### Minimum Verification Gates

- [ ] Invalid name/path, relative path, and worker-root-inside-project fail closed.
- [ ] Multi-agent without docs-first fails; enabling add-on forces continuity.
- [ ] Preview matches the files execute would write.
- [ ] Execute on a non-empty unexpected folder is refused.
- [ ] Git init and docs-first flags are independently honored.
- [ ] Two projects share one sqlite file and do not read each other's records.
- [ ] GUI renders the wizard, dependency lock, preview and confirm.
- [ ] `npm test`, GUI production build and `git diff --check` pass.

## References

- Owner brief in this task, including the inspected paths
  `C:\code\docs-first_continuity-protocol` and
  `C:\code\docs-first-multiagent-orchestrator-addon`.
- `docs/backlog/multiagent-process-layer.md` — process install remains later.
- `src/runtime/local-runtime-config.ts` — sidecar/env project ID.
- `src/gui-host/server.ts` — current `A008_GUI_WORKSPACE` cwd.

## Checklist

- [x] Claim `A008-0094` on `main` and freeze this charter as Ready.
- [ ] Copy this charter into `docs/CURRENT_TASK.md` on the implementation branch.
- [ ] Implement config, validation, preview and host execute.
- [ ] Add A008-owned docs-first templates and registry.
- [ ] Allow multi-namespace sqlite without breaking unregistered workspaces.
- [ ] Add Projects UI with New/Open/Recent, preview and confirm.
- [ ] Restart ACP on workspace change.
- [ ] Tests, build, docs, archive and handoff.

## Decisions and Notes

- Browse is a typed path plus optional host listing of an existing parent, not
  an OS folder dialog.
- Default max workers is 4; the recorded ceiling is 5 (MULTIAGENT.md).
- No first Git commit. `git init` only.
- New-project LICENSE is omitted; license of the created project is an open
  decision of that project, not A008's Apache-2.0 grant copied blindly.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/HOST_PROTOCOL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/THIRD_PARTY.md`
- [ ] `docs/JOURNAL.md` on operator merge

## Handoff and Follow-ups

- Current state: ID claimed, charter Ready, ADR 0039 accepted.
- Next recommended step: implement on a dedicated branch.
- Blockers: none.
- Child tasks: none.
- Follow-up: MCP process install, lazy worker clone allocation, cross-project
  recall, OS folder dialogs.

## Finalize When Complete

- Archive under `docs/finished/A008-0094_project-bootstrap.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Write `docs/handoffs/A008-0094.md`.
- Operator appends the journal on merge to `main`.
