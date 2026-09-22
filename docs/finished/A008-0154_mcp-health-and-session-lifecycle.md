# A008-0154 — MCP health probe and isolated session lifecycle

Task ID: A008-0154
Parent Task: A008-0148
Status: Complete
Owner: Grok (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 32dc512

## Task Summary

Saved stdio MCP configuration could look ready while the process never
completed an MCP handshake, and an open chat kept the catalog it was
constructed with. MCP tool calls could also share one default session when a
model omitted or varied a session argument, and a model could combine domain
containment with restore or state replay. This task reports probe and restart
state from the host and makes session identity runtime-owned without a
server-name special case.

## Goal

Show whether each saved stdio MCP server can complete an ephemeral handshake
and catalog check, tell the operator when an open chat still uses the previous
catalog, and bind one stable server-scoped session identity for every tool
call in that chat.

## Primary Deliverable

Parameters → MCP shows READY, FAILED, or RESTART REQUIRED from a host-owned
ephemeral probe and a session-catalog ledger. `ModelToolSession` supplies one
execution identity and a stable per-server scope, overwrites a published
string `session` argument with that scope, and refuses domain containment
combined with restore or state replay.

## In Scope

- Ephemeral stdio probe: spawn, MCP initialize, `tools/list`, catalog
  validation, close. The probe does not call tools and does not replace an
  active `ModelToolSession`.
- Parameters → MCP status and Reload & Test for a saved server.
- Process-local record of the MCP catalog fingerprint bound when a host
  session is constructed, cleared when that session closes.
- One execution identity per `ModelToolSession`, exposed to each MCP child as
  `A008_MCP_EXECUTION_ID` and a stable `A008_MCP_SERVER_SCOPE`.
- Schema-driven binding: hide and overwrite a top-level string `session`
  argument; reject a call that sets published domain containment together with
  published restore or state replay.

## Out of Scope

- Hot reload of an active `ModelToolSession` or its tool catalog.
- Remote, HTTP, or SSE MCP transports.
- Persisting probe results across host restart.
- Conditionals on an MCP server or product name.
- Browser daemons that outlive the MCP process beyond the existing
  process-tree stop.
- Approval, budget, credential, or provider-routing changes.

## Definition of Done

- A fixture server probe reports ready with its tool count, a missing command
  reports process failure, and a process that exits before initialize reports
  handshake failure.
- Saving a different enabled catalog while a host session is open reports
  restart required; closing that session clears it. The probe does not change
  the session's catalog.
- Two tool sessions receive different stable scopes. A model-supplied
  `session` value is overwritten. Containment plus restore does not execute.
- The model-facing schema omits the runtime `session` argument.
- Parent provider secrets are not copied into the MCP child environment.
- Owning docs match the behavior. `docs/CURRENT_TASK.md` is restored from the
  template before push.

## Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `df195008dab303ef3c9bb21e4ca1d0ac9e6d2a3b`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Ephemeral MCP health probe and restart indicator | PC-06. Supported controls stay on their runtime/host owners. ADR 0029 and A008-0148: the renderer configures stdio MCP servers and does not spawn them. A saved command is not evidence the server can speak MCP, and an open session keeps the catalog it was given. | The operator can distinguish a server that completed initialize and `tools/list` from one that failed, and can see when an open chat still uses the previous catalog. Without it, a saved command looks usable and a saved edit looks active while the open chat does not have it. | Host route spawns one temporary stdio process, performs initialize, `tools/list`, structural catalog validation, and close. A process-local ledger stores the enabled-catalog fingerprint at session construction. The panel renders READY, FAILED, or RESTART REQUIRED. No active tool session is mutated. | Fixture probe stages; ledger reset on session release; GUI markup; authenticated HTTP contract. |
| Runtime-owned MCP session scope | PC-05. Model-initiated tools require structured calls and the approval boundary. A model argument must not select process-global session identity or combine domain containment with state replay. ADR 0028 and 0029 keep execution on the host tool owner. | Each chat/tool session gets one stable server scope, so omitted or varying `session` arguments cannot share another chat's default session. A call that asks for containment and replay is rejected before execution. Without it, two clients share the default session and the model can request a combination the server refuses as unsafe. | One execution id per tool session, child env `A008_MCP_EXECUTION_ID` and `A008_MCP_SERVER_SCOPE`, and binding driven only by the server's published schema: overwrite string `session`; reject non-empty `allowedDomains` together with `restore`, `state`, or `sessionName`. No server-name conditional. | Two fixture sessions echo different stable scopes; model schema omits `session`; containment plus restore does not run; parent secrets stay out of the child. |

## Decisions and Notes

- Probe results live in host memory and are keyed by the saved server
  definition. A host restart returns the server to Not tested.
- RESTART REQUIRED means at least one still-open host session was constructed
  with a different enabled MCP catalog. FAILED from the current definition
  outranks that indicator on the server row.
- V2 session construction receives the same catalog path the V1 bridge already
  reads, so the recorded fingerprint is the catalog that will actually be
  bound.
- The published property name `session` is the runtime selector. Other
  property names stay model-controlled. Binding does not inspect the server
  name or command.
- A command that cannot be resolved on `PATH` is reported as process failure
  before spawn. On Windows the MCP client otherwise reports that case as a
  closed connection.

## Verification

- [x] Reviewed against the necessity arguments and frozen scope. The V2
  catalog-path pass is the ledger's bound catalog, not a new transport.
- [x] Focused fixture probe, two-session scope, containment rejection, ledger,
  HTTP contract, and GUI markup tests passed inside the repository gate.
- [x] Repository gate: 726/726 core + 4/4 membership + 190/190 GUI = 920/920.
- [x] Root typecheck, GUI typecheck, GUI production build, packed protocol
  verification, and `git diff --check` passed.
- [x] Skipped a click-through of the running Parameters page. No browser
  driver was used. Static markup covers READY, FAILED, and RESTART REQUIRED.
- [x] No live provider call.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md` — left for the operator on merge
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/ENGINE.md`

## Handoff and Follow-ups

- Current state: complete on `a008-0154-mcp-health-session-lifecycle`.
- Next recommended step: merge after review. A detached browser daemon beyond
  the MCP process tree remains out of scope.
- Blockers: none.
- Child tasks: none.
