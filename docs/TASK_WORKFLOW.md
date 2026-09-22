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

## Live verification budget

This section owns repository verification authority and its defaults. Adopted
by A008-0159 at the owner's direction, it replaces generic requirements for
separate permission merely because a verification call is live or paid.
Explicit narrower task restrictions remain in force. Older completed records
describe their historical authority, not a continuing blanket prohibition.
On resuming an older task, resolve this policy in its mutable verification notes
without expanding frozen scope. An inherited generic paid-call permission rule
does not require another approval inside the resolved budget; an explicit
task-specific no-live restriction or smaller ceiling still applies.

Agents choose the smallest credible verification for the uncertainty in scope.
Use deterministic fakes/fixtures for fault injection, reproducibility and safe
isolation; use live providers for real integration, wire compatibility,
capabilities and provider behavior. Do not build extensive simulation solely
to avoid a small authorized provider expense. A fake proves behavior against
its simulated contract, not the actual external provider. Neither test type
alone proves every failure/recovery case.

### Defaults and task authority

The verification budget is a ceiling, not a spending target or recommended
consumption. Choose the lowest reasonable total cost and risk that provides
sufficient verification for the concrete uncertainty. Available budget alone
does not justify a more expensive model, more calls, more tokens, longer
verification, broader scope or additional external effects. Stop when the
verification need is satisfied; unused budget is a normal and desirable outcome.
Total cost includes engineering work: this rule does not require elaborate fake
infrastructure when a small authorized live check answers the actual question.

New tasks may inherit this bounded policy; record the resolved values and policy
revision in the charter before live dispatch. These are aggregate task limits,
including workers, child allocations, retries and replacement sessions:

| Field | Default | Meaning |
| --- | --- | --- |
| max_live_verification_cost | 10 SEK | Total verification spend plus outstanding reservations |
| max_live_verification_calls | 10 | Physical provider attempts, including retries and secondary model calls |
| max_input_tokens_per_call | 16384 | Entire provider request, including context and tool schemas |
| max_output_tokens_per_call | 4096 | Total generated-token bound, including billable reasoning where applicable |
| live_call_timeout_seconds | 120 | Local deadline per attempt; timeout does not prove billing stopped |

An explicit approved deployment/task policy may replace these defaults; a worker
cannot increase its own ceilings. Stricter resource limits take precedence.
If a provider cannot honor a generated-token bound, establish an equivalent
finite cap and credible cost reservation before using it. Missing limits or
unknown prices are not permission for unbounded execution.

The task must identify its verification purpose and approved provider routes
and credential sources (references only). Existing approved scopes may be
inherited; finding a key or catalog entry alone is not approval. Free routes
still need approved access and count against call/token/time ceilings.
No per-call escalation is required within this resolved authority. Escalate
before raising a ceiling, using a new cost-bearing service or creating a
materially different external effect. Budget authority does not authorize
publication, deployment, destructive tools, new data disclosure or automatic
fallback to another provider. Model choice must still verify the actual target
capability; a cheaper substitute cannot establish a different model's behavior.

### Model-aware cost and accounting

Before dispatch, resolve provider, actual model/route and applicable price
schedule. Record a current authoritative price reference/check time, billing
units and currency. Model names and example prices in discussions are not a
price catalog. Distinguish input, output, cached input, billable reasoning and
any request/tool/media fees; avoid counting reasoning twice when included in
output pricing. Reserve input cost plus bounded maximum output and other fees,
with a stated conservative allowance. Do not assume cache hits, discounts or
free promotional capacity. Convert to the budget currency using a recorded
rate and allowance, or an approved equivalent currency ceiling.

Each physical attempt requires room under both cost and call limits. In parallel,
reserve shared budget before dispatch; alternatively allocate disjoint worker
allowances or serialize calls. Child tasks do not inherit a fresh 10 SEK each
when charged to a parent. An interrupted task resumes its existing accounting.

Track observed cost, outstanding reservations and unknown cost separately.
Unknown usage is not zero; retain its reservation until reconciled. A known-free
attempt can reserve zero money but still consumes the other limits. Do not
silently switch to a paid tier when free capacity expires. If a credible upper
estimate cannot be established, use an already approved provider-side spend cap
or obtain a bounded exception; independent verification can continue meanwhile.
Stop new dispatch when a limit would be exceeded. Already dispatched work may
still incur charges: local cancellation and estimates cannot guarantee an exact
provider invoice. Report discrepancies and reconcile before further spending.

Record fake/fixture, local-implementation or live-provider origin with each
verification result. For live results include model/route, price basis, attempt
count, usage/cost or explicit unknowns and remaining allowance, without secrets
or private payloads. A008 owns budget policy and authorization; ACME reports
observed execution and usage as execution verification evidence, without gaining
semantic authority.

These are effective working rules. Automatic cross-worker reservations and
model-price enforcement in the A008 product are future implementation; do not
claim they exist. For current tasks maintain the allocation/accounting in the
task record and handoff before further dispatch.

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
