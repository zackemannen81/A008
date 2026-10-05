# Backlog Proposals

Discoverability: index. Every member is listed below.
Member state: required. Every member declares a `Status:` line.

These proposals are in project direction but are not active. Activation claims
an A008 task ID and creates a reviewed charter. A proposal keeps its stable path
when its status changes. A008-0210 has been activated, then paused before
implementation because the current host cannot verify the main-chat role; see
[the paused task](../paused/A008-0210_remove-delete-project-chats.md) and
[handoff](../handoffs/A008-0210.md). The operator has approved investigating a
native OS confirmation surface under A008-0212; this alone does not resolve the
host-to-broker trust boundary.

| [`remove-project-chat-with-main-chat-confirmation.md`](remove-project-chat-with-main-chat-confirmation.md) | Paused as A008-0210 | Main-chat-only confirmation is requested; implementation awaits a host-verifiable identity/authorization boundary. |
| [`project-open-create-delete-actions.md`](project-open-create-delete-actions.md) | Active as A008-0211 (charter local) | Root/main chat uses original checkout; parallel chats use worktrees; open root, delete eligible chat with clean worktree, and unlink project without deleting files. For this scope, host verifies main-chat origin and user approves exact target in native OS dialog; A008-0212 owns durable identity/broker prerequisite. |
| [`semantic-model-parity-fixture.md`](semantic-model-parity-fixture.md) | Proposed | Make Luna semantic fixture select its independent semantic model explicitly; observed during A008-0202. |
| [`http-contract-visited-route-coverage.md`](http-contract-visited-route-coverage.md) | Proposed | Repair three existing HTTP/protocol fixture inventory mismatches observed during A008-0201; preserve meaningful route coverage. |
| [`legacy-credential-remediation.md`](legacy-credential-remediation.md) | Completed | Credential revoked/rotated; secure provider-neutral intake delivered by A008-0003. |
| [`multiagent-process-layer.md`](multiagent-process-layer.md) | Open | Decide whether to install and verify the optional local process supervisor. |
| [`multimodal-chat-content.md`](multimodal-chat-content.md) | Superseded by ADR 0045 / A008-0142 | The inherited text-only `ChatMessage.content` restriction is withdrawn. ADR 0045 owns canonical multimodal committed conversation content; A008-0142 owns the active migration and generated-image transcript behavior. |
| [`current-scope-retrieval.md`](current-scope-retrieval.md) | Built by A008-0063 | The owner's retrieval mechanism written down precisely: classify each message into domains and related domains, accumulate them into a `current_scope` that resets only on an empty intersection, and match a record on any tag, domain or scope hit. Carries five open questions, the sharpest being that gradual topic drift never triggers the reset. |
| [`host-fixture-secrets-isolation.md`](host-fixture-secrets-isolation.md) | Open | A008-0166 left `A008_SECRETS_PATH` unset in `isolatedMemoryEnv`. A later child should point that fixture at a missing temporary secrets file without changing product secret resolution. |
| [`A008-runtime-context-compaction-budget-recovery.md`](A008-runtime-context-compaction-budget-recovery.md) | Completed locally, A008-0196–0199 | Bounded intra-turn context, durable checkpoints, live compaction and conservative process-loss recovery; Task 4 awaits remote integration. |


## History / _legacy
for reference purpose you can find old longer authority docs under _legacy
