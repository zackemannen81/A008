# A008-0144 — Canonical knowledge, memory and contextual-attraction model

Task ID: A008-0145
Parent Task: None
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-20
Last updated: 2026-09-20
Charter frozen at: 2026-09-20

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` as prior authority/history where it conflicts
- `docs/tasks/A008-0143_atomic-knowledge-state-ownership.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0035-frozen-instruction-and-memory-target.md`
- Relevant completed lifecycle, association and retrieval tasks as implementation history.

## Task Summary

Make model routing and generation controls truthful and explicit for A008 chat and semantic-memory calls, expose OpenAI reasoning summaries in the existing Thought display, use model maximum output as the OpenAI default, and stop the chat tool-summary control from repeatedly expanding/collapsing as live tool status changes.

## Task Charter

### Goal

Give the operator separate, visible ownership of chat-model and semantic-model behavior while preserving one shared runtime/provider boundary and stable chat presentation.

### Primary Deliverable

A bounded provider/settings/UI repair where chat and semantic model controls are independently explicit, OpenAI Responses requests surface reasoning summaries, supported OpenAI max output defaults to the model maximum, and tool summaries remain visually stable during multi-tool turns.

### In Scope

- Replace credential-presence semantic routing with an explicit semantic model preference.
- Route retrieval scope, post-output extraction, relation classification, and source knowledge extraction through the configured semantic model.
- Add a separate semantic reasoning-effort control and expose it in Parameters.
- Set the semantic output budget default to 128000 while still capping each request by the selected model capability.
- Set GPT-5.6 Luna/Terra chat max-token defaults to their supported 128000 maximum.
- Request OpenAI Responses reasoning summaries when reasoning is enabled and surface them through the existing thought channel without persisting private reasoning.
- Stabilize the chat tool summary so live status transitions do not force repeated open/close state.
- Add regression tests for provider routing, semantic settings, Responses wire shape, max-output defaults, and tool-summary state.

### Out of Scope

- Memory/state/reconciliation semantics owned by A008-0144.
- New providers, new models, automatic provider failover, or changes to credential ownership.
- Exposing raw chain-of-thought or persisting reasoning.
- Redesigning tool grouping/content or the broader chat layout.

### Definition of Done

- Selecting/configuring a semantic model no longer depends on which API key happens to exist.
- Chat and semantic settings are independently visible.
- GPT-5.6 Luna/Terra default chat output budget is 128000 and validation rejects values above model capability.
- Semantic output budget defaults to 128000 and is model-capped.
- OpenAI Responses requests with reasoning enabled include a reasoning-summary request and emitted summaries reach the existing thought channel only.
- Multi-tool activity no longer auto-collapses/re-expands between calls.
- Focused provider/runtime/GUI tests and typechecks pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: 3532bcd8a0546e79dde1dbdb4e2623ca387ad0c6

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Explicit semantic model controls | PC-01, PC-06 | The model/provider the operator selects must correspond to the actual owned execution path; credential presence must not silently choose a different semantic model. | Add one persisted semantic model setting and use it at all semantic call composition points. | Runtime tests with both NVIDIA and OpenAI credentials prove configured semantic route wins. |
| Semantic reasoning and max-output controls | PC-06 | Supported controls must be truthful; hidden fixed reasoning and low defaults make model comparisons misleading. | Expose semantic reasoning effort, set safe capability-capped 128k default output budget. | Settings/parser/runtime request tests. |
| OpenAI reasoning summary | PC-06, PC-04 | Reasoning-capable Responses calls currently compute reasoning but expose no display summary; raw private reasoning must remain non-durable. | Request provider reasoning summary and reuse existing transient thought channel. | Embedded Responses wire/event test and reasoning-isolation regression. |
| Stable tool summary | PC-06 | Status-driven `open` toggling visibly flashes during multi-tool turns. | Make disclosure state locally owned instead of recomputed from running count. | GUI component regression. |

### Minimum Verification Gates

- [ ] Focused runtime/provider tests pass.
- [ ] Focused GUI tests pass.
- [ ] Root and GUI typecheck/build pass.
- [ ] Diff check passes.
- [ ] No live provider call, credential readout, deployment, publication or merge.

## Decisions and Notes

- Semantic controls are global runtime preferences because semantic retrieval/extraction are runtime services rather than one chat message's sampling state.
- Raw OpenAI chain-of-thought is not exposed; only provider-supported reasoning summaries may enter the transient thought channel.
- The 128000 semantic budget is a ceiling/default; each semantic request still uses the lower of that value and the configured model capability.
- A008-0144 remains untouched in its existing worktree.

## Verification

- Pending.

## Documentation Updates

- [ ] `docs/CURRENT_MEMORY_MODEL.md`
- [ ] `docs/KNOWLEDGE_MEMORY_MODEL.md`
- [ ] affected ADR(s), explicitly marking superseded clauses rather than silently editing history
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` if settings surface ownership changes materially.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0145.md`.
