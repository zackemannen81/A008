# Task Workflow

## States

```text
Draft -> Ready -> In Progress -> Complete
                   |
                   v
                 Paused -> In Progress

Draft / Ready / In Progress / Paused
  -> Cancelled or Superseded
```

Draft is editable. Ready freezes the goal, primary deliverable, scope,
out-of-scope, definition of done, and minimum verification gates. A frozen
charter is superseded rather than redefined. The necessity gate's contract
references, outcomes and planned checks freeze too; approach refinements stay
inside those boundaries and are recorded in mutable notes.

## Necessity Gate

Every substantive change must be necessary to enable, fix, protect or verify an
observable outcome in the current approved Core Product Contract in
`docs/PROJECT_BRIEF.md`, and fit the active task's frozen charter. If either
link is missing, do not implement that change. Route the gap using the existing
discovery rules below. Independent authorized work may continue.

Before Ready or delegation, the operator reviews these four answers recorded
in the task charter for each coherent change or group serving one outcome:

1. **Authority:** name the exact contract clause and any accepted constraint
   refining it. Pin the Git revision containing the reviewed contract.
2. **Behavior and necessity:** name the observable outcome and what would fail,
   remain unsupported or remain unverified if the change were omitted. State
   the concrete failure or risk, not a generic quality label.
3. **Smallest sufficient change:** choose the simplest credible approach meeting
   that outcome and current constraints; explain any material extra mechanism.
4. **Verification:** name a test, example or review that distinguishes success
   from failure. Put actual results and omissions in the existing Verification
   section.

Missing authority or behavior fails the gate. An undefined approach or check
leaves planning incomplete. A reference, shared keyword or filled field alone
does not establish necessity. Review the reasoning and observable behavior.

### During work and completion

Reuse the recorded argument; routine technical choices inside its authority
and scope need no new owner approval or per-file form. A necessary in-scope
checklist step may add a supporting argument in mutable notes; it cannot add a
new contract outcome to a frozen charter. Record refinements to the initial
approach in those notes rather than rewriting the gate.

Recheck before adding new behavior, dependencies, policy, fallbacks,
compatibility promises or material mechanisms. On resumption and integration,
check whether the contract has changed. Revalidate affected work against the
current accepted contract; a pinned old revision records the agreement but
cannot override a new boundary. Record successful revalidation in mutable notes;
route conflicts through pause or supersession without rewriting the charter.

Before completion, compare the actual changes with the gate arguments. Route
or remove unjustified additions. Do not weaken the contract or checks to make
the implementation pass. New product requirements need an explicit direction
decision before dependent implementation; existing owner authorization need
not be requested again.

### Engineering judgment

Extensibility, robustness, architectural elegance and future-proofing are not
independent requirements. Hypothetical abstractions, generalized infrastructure,
invented prioritization and fallbacks that change semantics fail without a
current required outcome. Compatibility needs an existing supported behavior
or an accepted migration obligation. Multiple representations need a concrete
purpose, one canonical owner and an explicit derivation or reconciliation rule.

Tests, security controls, migrations, recovery and refactoring pass when they
protect or verify a named outcome against a concrete risk and fit the charter.
"Smallest" means least unnecessary mechanism consistent with correctness and
current obligations, not fewest lines or a globally optimal solution.

Documentation repairs may use one concise argument for related corrections.
Bounded research may resolve an uncertainty needed by a contract clause; its
evidence or decision input does not authorize implementing the explored design.
If existing behavior contradicts the contract, record the discrepancy and scope
the fix or seek a direction decision when intent is unclear. Existing code
neither supplies authority nor justifies indiscriminate deletion.

The gate is a required review practice. Structural checks can establish that
references and evidence exist; they cannot prove a change is necessary. Existing
safety obligations still apply. A separate pilot or evidence programme is not
a prerequisite for applying this adopted rule.

## Identity

Append the next identity to `docs/TASK_IDS.md` on `main` before Ready. The
register allocates addresses only; activity belongs to the task record.

## Discoveries

```text
Required by the frozen charter?
|- yes -> add a truthful checklist step
`- no
   |- blocks the charter -> pause parent; activate a bounded child
   |- useful later       -> docs/backlog/
   `- outside direction  -> docs/concepts_sandbox/
```

Backlog entries state context, outcome, why they are not active, dependencies,
and suggested verification. They stay at stable paths and are indexed.

## Pause

A pause records the blocker, completed work, next action, missing verification,
and an objective resume condition. The frozen record moves to `docs/paused/`.

## Completion

- Review actual changes against necessity arguments and the frozen charter.
- Verify in proportion to risk and name skipped gates with reasons.
- Update all owning documents.
- Archive the completed task immutably under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from
  `docs/template_CURRENT_TASK.md` **before** the last commit and push.
- The operator appends the signed journal entry on merge to `main`.

At most one task is active per branch while work is in progress. A contributor
must be able to resume from repository state without private chat history.

## `main` and pull-request hygiene

`docs/CURRENT_TASK.md` on `main` is the empty template. It is not a merge
vehicle. Program records live under `docs/tasks/`. The operator claims every
identity on `main` and delegates a frozen charter. Workers do not allocate IDs.

A worker may copy its delegated charter into `docs/CURRENT_TASK.md` on its
branch while implementing. Before the last commit and push it must:

1. Archive the completed charter to `docs/finished/A008-NNNN_task-slug.md`
   with `Status: Complete`.
2. Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
3. Write `docs/handoffs/A008-NNNN.md`.
4. Push and open a pull request. Do not merge.

Then `docs/CURRENT_TASK.md` is identical on the branch and on `main`, so it
cannot conflict.
