# A008-0122 — repair entity graph and relation/provenance contracts

Task ID: A008-0122
Parent Task: A008-0121
Status: Ready
Owner: Grok (delegated)
Created: 2026-09-17
Last updated: 2026-09-17
Charter frozen at: 2026-09-17; contract revision `7661245`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0031-workbench-context-and-memory-map.md`
- `docs/adr/0035-frozen-instruction-and-memory-target.md`
- `docs/finished/A008-0082_association-lifecycle.md`
- `docs/finished/A008-0116_batch-relation-classification.md`
- `docs/finished/A008-0121_extractor-hardening.md`
- `docs/handoffs/A008-0121.md`

## Task Summary

Repair the contract between analyzer output, entity identity, persisted claim topology, relation classification and graph projection. Live A008-0121 validation proved that useful claims are being extracted, but `entities[]` is currently interpreted as first-entity ownership plus aliases, new entities are not addressable during the batch relation call, graph nodes remain structurally disconnected, and assistant-answer discoveries can inherit user provenance.
## Task Charter

### Goal

Make entity identity, claim↔entity topology, relation semantics and graph/provenance projection agree on one explicit contract without changing A008 lifecycle ownership, retrieval intent, ACME execution boundaries or L3 semantic-association meaning.

### Primary Deliverable

A bounded memory-contract repair in four implementation steps:

1. **Identity** — `entities[]` means distinct referents. Resolve/materialize each independently; normalize lexical identity so equivalent labels such as `React`/`react` resolve to one canonical entity while preserving a preferred display label. Never turn co-mentioned entities into aliases. Slot ownership must follow structured proposition semantics when explicit, otherwise a statement-specific fallback; array position is not semantic ownership.
2. **Topology** — persist/project deterministic structural claim↔entity membership for every resolved extracted entity and make current-batch entities addressable during relation classification. Structural membership is not an L3 semantic association and must not acquire association evidence, strength, reinforcement or decay merely to satisfy graph connectivity.
3. **Relation semantics** — make single and batch relation prompts self-contained views of shared source fragments defining `new`, `restatement`, `extend`, `supersede`, `conflict`, association shape and evidence rules. Remove references to unseen prompt contracts. Carry `structuredProposition` into relation comparison for proposals and stored candidates where available; severity remains lifecycle-only and must not influence relation judgment.
4. **Projection / provenance** — expose direct `storedDomains`, derived `effectiveDomains` and deterministic `primaryEffectiveDomain` for graph clustering without mutating entity semantics. Entity effective domains derive from connected claims; provenance/utterance graph records may derive display grouping from the claims they support. Eligible assistant-answer-only discoveries must never be attributed to the user utterance or accepted with user authority.

### In Scope

- Entity registry/identity normalization required by the invariants above.
- Live knowledge write-path entity materialization, slot-owner selection and structural claim↔entity connectivity.
- Batch association context/current-batch entity handles and structured proposition comparison data.
- Shared single/batch relation prompt fragments and focused classifier-contract tests.
- Read-only memory inspection/graph projection fields required for stored/effective/primary domain grouping.
- Dialogue provenance/origin changes required to distinguish user-message claims from assistant-answer-only claims.
- Focused deterministic regressions derived from the observed React/package files scenario.
### Out of Scope

- Migration or repair of existing development stores containing the old alias-collapsed topology; those stores may be deleted and recreated.
- Changing evidence lifecycle severity/strength/half-life/threshold/reinforcement semantics.
- Reinterpreting deterministic structural membership as L3 semantic association evidence.
- Retrieval-ranking or scope-classifier tuning unrelated to the new structural connectivity.
- ACME execution semantics, provider routing or adding model calls.
- Importing Graphiti code/ontology or redesigning the GUI beyond consuming the repaired projection.
- Fuzzy entity merging based on semantic similarity; identity normalization must remain deterministic and explainable.

### Definition of Done

- `entities: ["gui/package-lock.json", "gui/package.json", "React"]` creates/resolves three independently addressable identities, never one identity with three aliases.
- `React` and `react` resolve to one canonical identity while retaining a readable preferred label; `gui/package.json` and `gui/package-lock.json` remain distinct.
- A persisted claim exposes structural connectivity to every resolved entity it names, and memory inspection reports those connected records.
- Structural claim↔entity connectivity has no L3 association lifecycle record unless an independently classified semantic relation also exists.
- Current-batch entity handles are legal relation-classifier endpoints before the batch is committed.
- Slot ownership never derives from `entities[0]`; structured proposition ownership is honored and unstructured multi-entity claims use a non-conflating fallback.
- Relation classification receives structured proposition data where stored/available and keeps severity out of the relation contract.
- Single and batch classifier prompts contain the same relation/association semantics without an invisible cross-prompt reference.
- Graph projection distinguishes stored versus derived domains and chooses a deterministic primary effective domain without persisting inherited domains onto entities.
- An assistant-answer-only durable discovery cannot be stored as `speakerRole: user`, `attributedTo: user`, user-assertion accepted, or `derived_from` the user utterance.
- Focused regressions, full core tests, typecheck, build and `git diff --check` pass.