# ADR 0052 — A008 Memory Engine Semantic State, Retrieval, and Associative Propagation Model

Status: Proposed

Date: 2026-09-24

Decision owner: mrWhite81 aka Rickard / Zackemannen81

## Context

The A008 memory engine needs a unified, stable architecture for state persistence, history accumulation, and intelligent retrieval. Previous discussions conflated concurrent state updates with semantic conflict resolution, assuming that parallel agent modifications to the same concern required reconciliation. Furthermore, while the baseline memory engine tracks factual statements, it lacks domain-specific calibration for decay/attention and associative memory propagation ("attraction fields"). 

Development agents working on codebase architecture, dependencies, and file IO (e.g., `loadfile.c`) require distinct memory behaviors compared to short-lived conversational agents. High-severity or structural knowledge must remain accessible even when dormant, while temporary debugging noise must decay rapidly. Additionally, associative memory must allow related nodes (e.g., a `severity: minor` node strongly tied to a `severity: critical` node) to be retrieved dynamically without causing self-reinforcing feedback loops that flood the context envelope with irrelevancies.

## Decision

A008 will implement the memory engine semantic state, retrieval, and associative propagation model with the following core mechanisms:

### 1. Dual-Tier State and Knowledge Accumulation (Git-Like Model)
- **Knowledge (Append/Accumulate):** Every state transition and factual observation is preserved immutably as historical knowledge with full provenance. Multiple historical values for a semantic concern (e.g., `balloon.color = red` $\rightarrow$ `blue` $\rightarrow$ `none`) remain intact in the history log.
- **Current State (Replaced on Commit):** Current state maintains exactly one active value per semantic concern (`HEAD`). A newly committed state replaces the previous active state for that concern.
- **No Concurrent Reconciler Needed:** Parallel agent execution does not trigger semantic conflict resolution. State updates are applied atomically under a database write-lock (`BEGIN IMMEDIATE`). The latest successfully committed transaction defines `current state`.
- **Retrieval Scope:** Default retrieval returns exclusively `current state`. Historical intent (e.g., "Why are the balloons no longer red?") dynamically expands retrieval scope to include current state plus relevant historical transitions with provenance.

### 2. Idempotent & Atomic Commit Path
- Write transactions must be short and execute outside of LLM provider execution loops.
- Commit operations validate transactional idempotency using stable operation identifiers to prevent duplicate reinforcements or stale rollbacks.
- Retrieval operations always execute a fresh, isolated WAL read transaction immediately before generating provider prompts, ensuring long-lived chat sessions see external state changes committed by parallel agents.

### 3. Associative Memory Propagation ("Attraction Fields")
- **Associative Spreading Activation:** When a primary node is activated during retrieval, strongly linked adjacent nodes (via signed `attraction` bindings) receive a temporary retrieval priority boost ("tacking on").
- **Decoupled Propagation vs. Permanent Strength:** Associative activation grants *opportunity for retrieval* within the context folder/envelope, but does *not* grant permanent node strength or decay reduction. Permanent strength reinforcement is awarded only if the retrieved node is actively utilized and cited in the downstream task result. This prevents dense subgraphs from creating self-sustaining memory feedback loops.

### 4. Domain-Calibrated Attention, Severity, and Decay Profiles
- **Domain Profiles:** Retrieval, attention thresholds, and decay rates are calibrated per operational domain (e.g., Software Engineering vs. General Assistant).
- **Engineering Domain Rules:**
  - Structural contracts, architectural boundaries, and critical dependencies utilize slow decay curves and lower dormancy thresholds.
  - Temporary debugging states and ephemeral task notes decay rapidly.
  - Strongly attracted dependency relationships (`depends_on`, `constrained_by`, `tested_by`) override temporal age during retrieval, pulling dormant relevant knowledge into the active briefing folder when the target entity (e.g., `loadfile.c`) is referenced.

## Alternatives considered

### Global Fact Reconciliation Engine
Rejected because forcing a semantic reconciliation step whenever two agents update the same concern creates unnecessary overhead. Ordering state by atomic transaction commit timestamp (`HEAD`) reflects standard state transitions without corrupting history.

### Universal Decay & Attention Parameters across All Domains
Rejected because software development requires long-term retention of structural constraints and legacy file formats, whereas general chat requires aggressive pruning of transient conversational context.

### Permanent Strength Boost on Associative Retrieval
Rejected because boosting node strength whenever a neighbor node is fetched causes isolated, dense memory clusters to permanently stay alive and pollute context envelopes without providing actual task utility.

## Consequences

- The memory engine commit pipeline in `sqlite-store.ts` and `live-commit.ts` must enforce atomic single-concern `HEAD` replacement alongside immutable knowledge insertion.
- Retrieval queries must separate standard context retrieval (`current state`) from historical provenance queries (`current state` + historical audit log).
- Retrieval scoring algorithms must integrate domain-specific profile multipliers for strength, decay, severity, and associative attraction.
- Integration tests must verify that concurrent agent writes yield deterministic state sequences and that re-executed commits remain idempotent.