# Runtime context compaction and budget recovery

Status: Open
Source: `docs/temp/# A008 Runtime Context Compaction & Budget Recover.md`
Recorded: 2026-09-28

## Proposed outcome

Keep one long-running model/tool turn resumable without projecting an ever-growing
raw execution history into every continuation request. Preserve raw execution
evidence, keep temporary continuation state separate from A008 semantic memory,
and recover conservatively when the active turn approaches its context budget or
its execution process is lost before the turn finishes.

This proposal does **not** replace inter-turn memory. Normal continuity between
completed turns remains owned by A008 memory projection: the configured recent
turn window plus retrieval/current knowledge. The mechanism below exists only
inside an unfinished run/tool/turn.

This is a four-task sequence, not authorization to implement. Each task needs
an operator-claimed ID on `main`, a reviewed charter, and its own Necessity Gate
against the then-current `docs/PROJECT_BRIEF.md`. Thresholds, schemas and store
details below are design inputs until a charter accepts them.

## Task 1 — Bounded intra-turn context and continuation state

**Outcome:** Completed tool-loop evidence no longer accumulates unboundedly in
the active provider request. The same unfinished turn can continue from compact,
source-linked state while recent and in-flight interactions remain raw.

**Candidate scope:** Map the actual request/tool-history composition paths and
existing event sources. Define a validated `RunContinuationState` and source
references; select only completed segments for compaction; preserve a bounded
recent raw tail plus all in-flight operations; rebuild projected context without
deleting or rewriting source history. Keep hypotheses distinct from verified
findings. Do not change normal semantic-memory retrieval or completed-turn
projection.

**Acceptance evidence:** A deterministic 100+ interaction run shows projected
context is bounded rather than linear in total tool history; recent/in-flight
interactions survive; compacted verified findings retain resolvable provenance;
invalid compaction cannot replace the prior valid continuation state.

**Depends on:** None.

## Task 2 — Durable continuation checkpoints

**Outcome:** A validated continuation state for the unfinished turn can be
persisted safely without becoming semantic memory or losing evidence links.

**Candidate scope:** Choose the existing runtime/platform owner after inspecting
current run/event persistence. Define checkpoint identity/versioning, run/turn/
workspace binding, sequence and source references; implement atomic save/read
and latest-valid selection. Raw execution history remains authoritative and is
not copied wholesale. No automatic cross-turn retrieval uses these checkpoints.

**Acceptance evidence:** Schema validation, round-trip/version handling and
atomic writes; failed writes leave the previous checkpoint usable; references
resolve to retained source events; ordinary knowledge retrieval never returns
the checkpoint.

**Depends on:** Task 1.

## Task 3 — Budget-triggered same-turn rebuild

**Outcome:** When the current provider/tool turn approaches its effective
context limit, runtime checkpoints and rebuilds the continuation request, then
continues the same logical run/turn when safe.

**Candidate scope:** Account for the complete provider request, including base
instructions, retrieved memory context, tool schemas and the current raw tail.
Add configurable pressure policy, safe compaction only at completed operation
boundaries, checkpoint-before-replacement ordering, and reconstruction from the
current task/turn input, relevant A008 memory projection, continuation checkpoint
and recent raw events. Keep the same logical run and turn identity. Never replay
an ambiguous external effect.

**Acceptance evidence:** A deterministic pressure test proves checkpoint →
rebuild → continuation under the same run/turn; reconstructed provider context
fits the configured bound; failure injection shows the prior context/checkpoint
remains recoverable and no in-flight effect is replayed.

**Depends on:** Tasks 1 and 2.

## Task 4 — Interrupted-turn recovery and continuity proof

**Outcome:** If the execution process dies before the turn completes, a
replacement process can discover the latest continuation checkpoint, reconcile
it with authoritative workspace/run state, and either continue the unfinished
turn safely or expose uncertainty.

**Candidate scope:** Integrate checkpoint discovery with the existing durable
run/session recovery owner. Reconcile checkpoint revision/workspace and relevant
artifact evidence with current repository state. Mark affected findings
uncertain when changed or unverifiable. Reuse existing lease, cancellation,
effect-review and workspace-missing semantics; do not create a competing
scheduler. Add only observability required to prove boundedness and recovery.

**Acceptance evidence:** Restart fixture resumes the latest valid unfinished-turn
checkpoint; external workspace mutation is detected; missing workspace and
ambiguous effects follow existing recovery semantics; an end-to-end 100+
interaction run remains bounded across repeated compactions and a process
replacement.

**Depends on:** Tasks 1–3 and compatibility review against current durable
session/run recovery.

## Shared boundaries

- A008 semantic memory owns continuity **between completed turns**.
- Runtime continuation owns continuity **inside the current unfinished turn**.
- Raw execution history remains authoritative evidence; compaction changes only
  what is projected into the provider request.
- Continuation state/checkpoints are ephemeral execution state, not claims,
  current state, relationships or retrieval candidates.
- The normal memory extraction/commit path runs when the turn completes.
- No fixed 75/90 percent thresholds, fixed tool-count tail or new SQLite
  namespace is accepted merely because it appeared in the source draft.
- UI visualization, client recovery controls, semantic-memory redesign,
  conversation summarization and retention/deletion policy are out of scope.

## Activation

The operator should claim four distinct IDs on `main`, then create four
independently reviewable Draft charters in dependency order. Activate only the
next slice after current code/contracts, Necessity Gate, verification gates and
interaction with the existing durable run/session owner have been reviewed.
