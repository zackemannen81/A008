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
| [`document-ingest-granularity.md`](document-ingest-granularity.md) | Open — now due | `ingest()` makes one utterance from any length of content. Correct for a dialogue turn, wrong for a document. Also carries the correction that `ContentKind`, not this, was wrongly named the upload blocker in the A008-0040 records. A008-0056 made real documents readable, so this is no longer theoretical: every file ingested from now on is stored at file granularity. |
| [`discovery-based-core-suite.md`](discovery-based-core-suite.md) | Closed | A008-0057 took the membership check. `test:core` still names every file by hand, but a forgotten one now fails the suite by name instead of quietly reducing the count. Globbing compiled output stays rejected: `build` does not clean `dist/`. |
| [`gui-hardening.md`](gui-hardening.md) | Partially closed | Five follow-ups routed out of A008-0030. Items 1, 2, and 4 closed by A008-0038 and A008-0039. Items 3 (`messages` on `GuiSession`) and 5 (the redaction trade) remain open. |
| [`multimodal-chat-content.md`](multimodal-chat-content.md) | Open | `ChatMessage.content` is a `string` (ADR 0020 D6), so A008 cannot send an image to the two image-capable models A008-0055 added. The owner's diagram needs this; it is a core contract change and an ADR amendment. |
| [`current-scope-retrieval.md`](current-scope-retrieval.md) | Built by A008-0063 | The owner's retrieval mechanism written down precisely: classify each message into domains and related domains, accumulate them into a `current_scope` that resets only on an empty intersection, and match a record on any tag, domain or scope hit. Carries five open questions, the sharpest being that gradual topic drift never triggers the reset. |
