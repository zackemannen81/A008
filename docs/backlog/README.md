# Backlog Proposals

Discoverability: index. Every member is listed below.
Member state: required. Every member declares a `Status:` line.

These proposals are in project direction but are not active. Activation claims
an A008 task ID and creates a reviewed charter. A proposal keeps its stable path
when its status changes.

## Proposals

| Proposal | Status | Outcome |
| --- | --- | --- |
| [`legacy-credential-remediation.md`](legacy-credential-remediation.md) | Completed | Credential revoked/rotated; secure provider-neutral intake delivered by A008-0003. |
| [`first-shared-chat-slice.md`](first-shared-chat-slice.md) | Completed | A008-0003 through A008-0005 prove CLI/core, ACP, and visible Canvas loopback behavior. |
| [`semantic-memory-addon.md`](semantic-memory-addon.md) | Partially implemented | V0 contract and in-memory engine exist; integration, semantic analysis, durable storage, identity, and privacy remain. |
| [`multiagent-process-layer.md`](multiagent-process-layer.md) | Open | Decide whether to install and verify the optional local process supervisor. |
| [`document-ingest-granularity.md`](document-ingest-granularity.md) | Open | `ingest()` makes one utterance from any length of content. Correct for a dialogue turn, wrong for a document. Also carries the correction that `ContentKind`, not this, was wrongly named the upload blocker in the A008-0040 records. |
| [`discovery-based-core-suite.md`](discovery-based-core-suite.md) | Open | `test:core` names 43 files by hand; A008-0040 found two that had silently fallen out. Three options weighed, including a cheap membership check. |
| [`gui-hardening.md`](gui-hardening.md) | Partially closed | Five follow-ups routed out of A008-0030. Items 1, 2, and 4 closed by A008-0038 and A008-0039. Items 3 (`messages` on `GuiSession`) and 5 (the redaction trade) remain open. |
