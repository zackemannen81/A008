# A008 Runtime Context Compaction & Budget Recovery

Status: Proposed  
Area: Runtime / Orchestration / Memory  
Priority: Before UI/UX polish and client implementation

## 1. Problem

A008:s nuvarande agent-loop behåller för mycket rå execution history i den aktiva modellkontexten.

Vid långa körningar ackumuleras exempelvis:

- tool calls,
- tool outputs,
- tidigare resonemang,
- redan verifierade observationer,
- upprepade filinspektioner,
- avslutade delsteg,
- gamla hypoteser.

Det leder till två separata problem.

### 1.1 Context inflation

En lång körning kan efter 100–150+ tool calls bära en mycket stor mängd historik trots att bara en liten del fortfarande behövs för nästa beslut.

Konsekvenser:

- hög tokenförbrukning,
- långsammare modellkörningar,
- större Thought/resonemang,
- modellen läser eller verifierar samma sak flera gånger,
- relevanta aktuella fakta konkurrerar med gammal execution history,
- ökad risk för attention degradation.

### 1.2 Broken budget / execution limbo

När context- eller tokenbudgeten tar slut riskerar runnen att avslutas trots att arbete redan har utförts.

Resultatet kan bli:

```text
files changed
tests run
partial implementation complete
        ↓
context budget exhausted
        ↓
run terminates
        ↓
next agent does not know exactly what happened
```

Detta skapar ett limbo där repository state och agentens kognitiva state inte längre är synkroniserade.

---

# 2. Goal

A008 ska kunna köra långa tool-baserade tasks utan att den aktiva modellkontexten växer proportionellt med antalet tool calls.

Runtime ska:

```text
execute
  ↓
accumulate recent raw context
  ↓
compact completed work
  ↓
continue from compact working state
```

och vid kritisk budget:

```text
budget pressure
  ↓
persist execution checkpoint
  ↓
rebuild model context
  ↓
continue same run
```

Budget exhaustion ska alltså normalt inte vara ett terminalt execution state.

---

# 3. Core model

Runtime ska skilja mellan fem olika typer av information.

| Layer | Purpose |
|---|---|
| Raw Tool History | Komplett execution evidence/logg. Behöver inte ligga i modellkontexten. |
| Recent Raw Window | De senaste tool calls/results som modellen fortfarande behöver direkt. |
| Working State | Kompakt representation av vad som redan är etablerat under aktuell run. |
| Execution Checkpoint | Persisted task/run-state som gör execution resumable efter compaction, budget reset eller process failure. |
| Durable Knowledge | Långlivad kunskap enligt A008:s vanliga knowledge/current-state-modell. |

Working State och Execution Checkpoint är **inte automatiskt durable knowledge**.

De tillhör execution/runtime memory.

---

# 4. Runtime invariant

Följande invariant ska hållas:

> Information får tas bort från aktiv model context endast när den antingen fortfarande finns i Recent Raw Window eller har representerats i Working State / Execution Checkpoint med tillräcklig provenance för att kunna verifieras igen.

Compaction får aldrig innebära att rå execution-data raderas från logs/source store.

Compaction påverkar endast vad som projiceras till modellen.

---

# 5. Working State

Working State representerar den minsta information agenten behöver för att fortsätta samma task utan att återläsa hela execution history.

Exempel:

```text
WORKING STATE

Objective:
Bring project documentation in sync with the currently implemented runtime.

Verified:
- README still describes the old non-durable GUI flow.
- CURRENT_STATUS stops at task 0194.
- Task 0195 durable config/attachments is implemented.
- ADR-0055 owns the current session/process model.
- ADR-0056 has already been updated separately.
- Tests X and Y pass.

Completed:
- inspected README
- inspected CURRENT_STATUS
- inspected ADR-0055
- verified task 0195 implementation

Modified:
- docs/README.md
- docs/CURRENT_STATUS.md

Remaining:
- inspect SYSTEMDOC
- inspect FILESTRUCTURE
- update JOURNAL
- run final verification

Open questions:
- none

Do not re-check unless contradicted:
- ADR-0055 ownership
- task 0195 implementation status
```

---

# 6. Working State schema

Suggested internal representation:

```ts
interface RuntimeWorkingState {
  version: "a008_runtime_working_state_v1";

  runId: string;
  taskId?: string;
  workspaceId?: string;

  objective: string;

  verifiedFacts: WorkingFact[];
  completedActions: CompletedAction[];
  modifiedArtifacts: ModifiedArtifact[];
  verificationResults: VerificationResult[];

  openWork: OpenWorkItem[];
  openQuestions: OpenQuestion[];
  activeHypotheses: ActiveHypothesis[];

  doNotRecheck: EstablishedFact[];

  recentErrors: RuntimeErrorSummary[];

  sourceRefs: SourceRef[];

  compactedThroughSequence: number;

  createdAt: string;
  updatedAt: string;
}
```

A `WorkingFact` should retain a source reference:

```ts
interface WorkingFact {
  id: string;
  statement: string;
  confidence: "verified" | "observed";
  sourceRefs: string[];
}
```

Statements classified as speculation must not enter `verifiedFacts`.

They belong in `activeHypotheses`.

---

# 7. Recent Raw Window

A008 must always preserve a configurable tail of raw execution context.

Initial recommended default:

```text
latest 8–16 tool interactions
```

The exact value should ultimately be token-based rather than purely call-based.

Recent Raw Window should retain:

- current unresolved tool chain,
- most recent mutations,
- latest verification output,
- active errors,
- tool output currently being reasoned about.

Older completed interactions are eligible for compaction.

---

# 8. Compaction trigger

Compaction should not happen after every tool call.

Runtime maintains an estimated active-context budget.

Example thresholds:

```text
soft threshold: 60–70 %
compact threshold: 75 %
critical threshold: 90 %
hard provider limit: 100 %
```

Recommended behavior:

```text
< 75 %
normal execution

>= 75 %
schedule compaction before next expensive model turn

>= 90 %
force checkpoint + context rebuild before continuing

provider hard limit approached unexpectedly
emergency checkpoint + rebuild
```

Thresholds must be configuration values, not hardcoded policy.

Possible configuration:

```ts
interface ContextBudgetPolicy {
  compactAtRatio: number;     // default 0.75
  forceRebuildAtRatio: number; // default 0.90

  rawWindowMaxTokens: number;
  workingStateMaxTokens: number;

  minimumRawToolInteractions: number;
}
```

---

# 9. Compaction algorithm

Compaction operates only on execution segments considered complete.

Conceptually:

```text
active context

system/runtime instructions
task definition
durable retrieved knowledge
working state #3

tool 101
tool 102
...
tool 145
tool 146
tool 147
tool 148
        ↓

identify compactable range
101–136

        ↓

reduce 101–136 into Working State #4

        ↓

rebuild active context

system/runtime instructions
task definition
durable retrieved knowledge
Working State #4

tool 137
...
tool 148
```

The old calls remain available in execution logs/source storage but disappear from the projected model context.

---

# 10. Compaction pipeline

Compaction should consist of two stages.

## Stage A — deterministic capture

Runtime extracts information it can know without LLM interpretation.

Examples:

- tool name,
- tool call ID,
- success/failure,
- affected files,
- command exit codes,
- test status,
- timestamps,
- source references,
- sequence numbers.

This ensures that execution evidence is not dependent on summarization quality.

## Stage B — semantic reduction

The model receives only the compactable execution segment plus existing Working State.

Its task is explicitly to update Working State.

It must classify findings into:

```text
verified fact
completed action
modified artifact
verification result
remaining work
open question
active hypothesis
obsolete information
```

It must not produce narrative prose.

---

# 11. Compaction prompt contract

The compactor should receive instructions equivalent to:

```text
Update the runtime Working State from the supplied execution segment.

Preserve only information required to continue or verify the task.

Do not narrate the execution.

Do not convert hypotheses into facts.

A fact may be marked verified only when supported by tool output,
repository state, test output, or another explicit source.

Retain unresolved work and unresolved errors.

Do not discard information that would force the next agent to repeat
completed work.

Return structured Working State only.
```

The output must be schema validated before replacing the previous Working State.

---

# 12. Do-not-recheck semantics

A dedicated category should record established facts that caused repeated tool calls earlier in the run.

Example:

```json
{
  "statement": "ADR-0055 is the authoritative session/process model.",
  "sourceRefs": ["tool-result-119"],
  "validUntilContradicted": true
}
```

This is advisory, not absolute.

The agent may re-check if:

- newer evidence contradicts the statement,
- the underlying artifact has changed,
- verification is explicitly required,
- task scope changes.

This is intended to prevent loops such as:

```text
read README
understand README
perform work
later wonder what README said
read README again
```

---

# 13. Execution Checkpoint

Working State lives primarily inside an active run.

Execution Checkpoint is its persisted recovery form.

Suggested schema:

```ts
interface ExecutionCheckpoint {
  version: "a008_execution_checkpoint_v1";

  checkpointId: string;

  runId: string;
  taskId?: string;
  sessionId?: string;
  workspaceId?: string;

  branch?: string;
  cwd?: string;

  sequence: number;

  objective: string;

  workingState: RuntimeWorkingState;

  lastCompletedToolSequence: number;

  pendingToolCalls: PendingToolCall[];

  modifiedArtifacts: ModifiedArtifact[];

  sourceRefs: SourceRef[];

  reason:
    | "periodic_compaction"
    | "budget_pressure"
    | "critical_budget"
    | "shutdown"
    | "recovery";

  createdAt: string;
}
```

---

# 14. Persistence location

Execution checkpoints should be stored in A008 memory infrastructure but in a separate runtime/execution namespace.

Conceptually:

```text
memory
├── knowledge
│   ├── claims
│   ├── current-state
│   └── provenance
│
└── execution
    ├── working-state
    └── checkpoints
```

Execution checkpoints must not appear as normal retrieved knowledge unless an explicit recovery path requests them.

---

# 15. Budget recovery

When runtime determines that the active context is approaching a hard budget boundary:

```text
RUNNING
   ↓
CHECKPOINTING
   ↓
CONTEXT_REBUILD
   ↓
RUNNING
```

It must not normally transition directly to terminal failure.

Recovery procedure:

```text
1. stop scheduling new tool calls

2. wait for current atomic tool operation to complete

3. update Working State

4. persist Execution Checkpoint

5. discard old projected execution context

6. reconstruct a fresh model context from:
   - system/runtime instructions
   - task definition
   - relevant durable knowledge
   - latest Execution Checkpoint / Working State
   - recent raw tool window

7. continue run
```

The run ID should remain the same.

A context rebuild is not a new logical task.

---

# 16. Crash recovery

The same checkpoint mechanism should also cover unexpected process termination.

On startup or session restore:

```text
find latest non-terminal run
        ↓
find latest valid checkpoint
        ↓
inspect actual workspace/repository state
        ↓
rehydrate working state
        ↓
resume or mark uncertain
```

The runtime must not blindly assume that checkpoint state still matches the filesystem.

For modified artifacts it should perform lightweight reconciliation.

Example:

```text
checkpoint says:
docs/README.md modified

filesystem says:
README hash differs from checkpoint source state

→ modification still exists

filesystem says:
branch moved / file replaced

→ mark affected state uncertain
```

---

# 17. Uncertainty handling

After recovery, facts may be:

```text
verified
observed
uncertain
stale
```

Runtime must not silently convert checkpointed execution assumptions into verified current state.

If repository state has changed externally, affected Working State entries become uncertain and must be revalidated.

---

# 18. Interaction with durable knowledge

Execution information may eventually contain genuinely durable knowledge.

Example:

```text
"ADR-0055 is now authoritative for session ownership."
```

Promotion into normal A008 knowledge must still pass through the ordinary extraction/commit path.

Therefore:

```text
Execution Checkpoint
        │
        ├── temporary task state
        │       ↓
        │     expires
        │
        └── durable information
                ↓
        normal knowledge extraction
                ↓
        claim/state commit
```

Checkpoint creation must never implicitly mutate durable knowledge.

---

# 19. Raw execution retention

Compaction is not deletion.

Raw tool calls/results remain available for:

- debugging,
- audit,
- provenance,
- replay,
- verification,
- later inspection.

The context composer simply stops projecting old raw events to the model.

The runtime should be able to resolve:

```text
sourceRef → original tool event/result
```

for every compacted verified statement.

---

# 20. Context composer

The runtime context composer should build agent context approximately in this order:

```text
SYSTEM / RUNTIME CONTRACT

TASK DEFINITION

CURRENT DURABLE KNOWLEDGE

RUNTIME WORKING STATE

RECENT RAW TOOL WINDOW

CURRENT USER / AGENT INPUT
```

Old raw execution history should no longer be appended indefinitely.

---

# 21. Suggested runtime states

Extend runtime state machine with:

```text
RUNNING

COMPACTING

CHECKPOINTING

REBUILDING_CONTEXT

RESUMING

COMPLETED

FAILED

CANCELLED

UNCERTAIN
```

`COMPACTING`, `CHECKPOINTING`, and `REBUILDING_CONTEXT` are non-terminal states.

---

# 22. Failure handling

If semantic compaction fails:

```text
do not discard old context
retry once or continue until critical threshold
```

If checkpoint persistence fails:

```text
do not clear active context
mark recovery durability unavailable
```

If context rebuild fails:

```text
retain checkpoint
mark run resumable/uncertain
do not claim completion
```

No destructive transition may occur before the replacement state has been successfully persisted.

---

# 23. Atomicity rule

The critical transition must follow:

```text
build new Working State
        ↓
validate
        ↓
persist checkpoint
        ↓
confirm persistence
        ↓
replace projected context
```

Never:

```text
discard context
        ↓
attempt to create checkpoint
```

This is the principal protection against execution limbo.

---

# 24. Compaction boundaries

The runtime should prefer boundaries where a coherent unit of work has completed.

Good boundaries:

```text
file inspection completed
code modification completed
test suite completed
subtask verified
decision established
```

Bad boundaries:

```text
tool request sent but result not received
file mutation partially executed
multi-step verification halfway complete
unresolved provider response
```

An in-flight atomic operation must stay in Recent Raw Window.

---

# 25. Scope

IN SCOPE:

- token/context usage tracking,
- compactable execution segmentation,
- Working State schema,
- semantic working-state reduction,
- Recent Raw Window,
- checkpoint persistence,
- context reconstruction,
- budget-triggered recovery,
- process/restart recovery from checkpoint,
- provenance back to raw tool events,
- uncertainty after external workspace changes.

OUT OF SCOPE:

- UI visualization of checkpoint state,
- user-facing recovery controls,
- general knowledge model redesign,
- claim/current-state semantics,
- provider-specific UI,
- multi-device synchronization,
- deletion/retention policy for historical execution logs,
- generic conversation summarization.

---

# 26. Necessity Gate

This work is necessary if all of the following are true:

```text
A008 supports long-running autonomous tool loops
AND

raw tool history is currently projected cumulatively
AND

runs can approach or exceed practical context budget
AND

loss of active model context can leave partially completed work
```

All conditions currently apply.

---

# 27. Definition of Done

Implementation is complete when the following behavior is demonstrated.

### Scenario A — long execution

A test run produces at least 100 synthetic tool interactions.

Expected:

```text
active model context does not grow linearly to include all 100 calls
```

Older completed calls are represented through Working State.

Recent raw calls remain available.

### Scenario B — no redundant rediscovery

A fact verified before compaction remains present afterward with source provenance.

The post-compaction agent can continue without rereading the originating tool result.

### Scenario C — budget threshold

A run reaches configured critical budget.

Expected:

```text
checkpoint created
context rebuilt
same logical run continues
```

No terminal budget failure occurs.

### Scenario D — crash

A process is terminated after a persisted checkpoint.

After restart:

```text
latest checkpoint is found
workspace is reconciled
run can resume
```

Completed work is not silently lost.

### Scenario E — provenance

A verified compacted statement can be traced back to one or more original tool events.

### Scenario F — uncertainty

Workspace state is externally changed after checkpoint creation.

Recovery detects relevant mismatch and marks affected state uncertain instead of treating the checkpoint as current truth.

### Scenario G — compactor failure

Compactor returns invalid output.

Original context remains intact and execution is not destructively compacted.

---

# 28. Required tests

Unit tests:

```text
Working State schema validation
compaction candidate selection
Recent Raw Window preservation
budget threshold calculation
sourceRef retention
checkpoint serialization/deserialization
context reconstruction
uncertainty transition
```

Integration tests:

```text
50+ tool-call run with repeated compaction
100+ tool-call run with bounded active context
critical-budget forced rebuild
checkpoint → process restart → resume
workspace mutation between checkpoint and resume
failed checkpoint persistence
failed semantic compaction
```

A provider-backed live test should additionally verify that the agent can continue meaningful work after at least two context rebuilds in the same run.

---

# 29. Metrics

Runtime should expose at least:

```text
active_context_tokens
raw_window_tokens
working_state_tokens

tool_events_total
tool_events_projected_raw
tool_events_compacted

compaction_count
checkpoint_count
context_rebuild_count

tokens_before_compaction
tokens_after_compaction

recovery_count
recovery_uncertainty_count
```

This allows the optimization to be measured rather than inferred.

A useful primary metric is:

```text
compaction_ratio =
tokens_after_compaction / tokens_before_compaction
```

A useful behavioral metric is:

```text
raw_revisit_rate =
repeated reads of already established sources /
total source reads
```

---

# 30. Initial implementation strategy

Implement in three increments.

## Increment 1 — Runtime compaction

Add:

```text
Working State
Recent Raw Window
context budget estimator
compaction trigger
context composer support
```

No crash recovery required yet.

Prove that a 100+ tool-call execution can continue with bounded projected context.

## Increment 2 — Durable checkpointing

Add:

```text
Execution Checkpoint
runtime memory namespace
atomic checkpoint persistence
critical-budget rebuild
```

Prove:

```text
RUNNING → CHECKPOINT → REBUILD → RUNNING
```

## Increment 3 — Recovery

Add:

```text
startup checkpoint discovery
workspace reconciliation
uncertainty handling
resume after process failure
```

Prove:

```text
process dies
        ↓
restart
        ↓
checkpoint + repository state
        ↓
execution continues safely
```

---

# 31. Architectural outcome

Before:

```text
task
 ↓
tool
 ↓
tool
 ↓
tool
 ↓
tool
 ↓
...
 ↓
150 tool calls in context
 ↓
budget exhausted
 ↓
terminal run / limbo
```

After:

```text
task
 ↓
recent raw execution
 ↓
compact
 ↓
Working State
 ↓
recent raw execution
 ↓
compact
 ↓
Working State
 ↓
checkpoint
 ↓
context rebuild
 ↓
continue
```

The intended property is:

> Execution history may grow indefinitely; active cognitive context must not.

And:

> Exhausting the model's current context window must not imply losing the runtime's understanding of completed work.