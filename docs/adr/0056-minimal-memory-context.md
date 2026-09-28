# ADR 0056 — Minimal memory context

Status: Accepted
Date: 2026-09-28
Decision owner: Rickard
Task: A008-0189

The owner approves a model-facing memory item containing only `id`, a resolved
`semanticAddress` when available, and `label` as text representation of the claim / current_state.
`history` and `provenance` are optional and included only when the question or
interpretation needs them. Current state wins over fallback claims for the same
address. A recently ingested historical claim is not automatically current truth.

Tags, domains, scores, evidence IDs, kind, duplicate propositions and empty scope
remain internal. The worker and post-output extractor receive the same derived
minimal representation; A008 retains the exact identity/evidence mapping used
for reinforcement and state updates. System instructions and the user's message
remain separate concerns from the item field allowlist.

Candidate discovery does not imply context admission. Specific retrieval matches
take precedence over broad domain spillover. History and provenance are selected
for the same relevant knowledge, not appended as an unrelated database dump.
Deduplication cannot merge different semantic addresses merely because their
values match. Stored facts, source attribution and qualifications are preserved.

Repeated equivalent knowledge reuses/reinforces the existing carrier. A changed
value updates state with retained history; a new property remains new knowledge.
Retrieval alone does not reinforce. This change does not migrate or clean user
databases, add a general semantic reranker, or implement ADR 0055's processes.

Verification covers the item allowlist, worker/extractor parity, state/claim
precedence, conditional history/provenance, distinct equal-valued addresses,
relevance narrowing, budgets and reinforcement identity through real local stores.
