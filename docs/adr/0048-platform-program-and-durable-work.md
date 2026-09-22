# ADR 0048 — Platform program and durable work boundary

Status: Accepted
Date: 2026-09-22
Task: A008-0160
Authority: owner explicitly authorizes implementation of A008 Platform and operator-led integration.

## Decision

Adopt A008_PLATFORM_SPEC v1.2 as the platform direction, delivered by bounded
tasks in program A008-0160. This does not assert implementation of every capability.

- D1: durable platform resources use explicit /v3 contracts. V1/V2 retain their
  current session/disconnect/restart semantics. Advertising V3 requires actual
  host integration; schema availability alone is not feature availability.
- D2: one nonterminal writing run per tenant/project/conversation, including
  needs_reconciliation. Different conversations/projects progress independently.
- D3/D6: first deployment is one backend process and a separate local SQLite
  platform store (conversations, runs, receipts, outbox). Chat/run persistence
  does not depend on semantic-memory enablement. Do not open or mutate knowledge
  tables from this owner. Shared multi-process hosting needs a later gate.
- D4: preserve ADR 0043. A008 owns tools, cognition, semantic context and memory;
  ACME remains the authorized model-execution substrate. Execution verification
  records cannot become semantic evidence or change HEAD/reinforcement.
- D5: A008-0103 remains historical/current authority for delivered V1/V2 work.
  Platform work is a separate dependency-tracked successor program; no frozen
  old charter is rewritten. Existing native-client gates are reused later.
- D7 for P1: server-owned local tenant and existing authenticated local
  principals. No anonymous V3 operations and no client-selected authority.
  Remote identity/membership is a later P2 decision/implementation gate.
- D8: V1/V2 model/reset behavior stays unchanged. New V3 conversations select
  model per run and retain committed history. Existing saved chats are not
  silently migrated or duplicated. Explicit import/migration precedes GUI switch.
- D11: record dispatch durably before external execution. Expired pre-dispatch
  ownership may safely requeue; possibly dispatched work blocks in
  needs_reconciliation. Never replay it to repair state or memory.
- D13-D16: preserve existing external task IDs, isolated clones and repository
  acceptance authority. First local worker integration uses explicit bindings
  and capability reporting; adapter details freeze in M1 before dispatch.
  Context governance/continuity share platform owners, not a second scheduler.

The first wave supplies the storage and wire foundations, then host integration.
A storage/schema unit test is not the two-client/background execution milestone.
Provider calls continue through existing A008 runtime owners. No duplicate chat
or memory engine is introduced.

## Consequences and gates

PC-07 in PROJECT_BRIEF owns the newly approved platform outcome. Each bounded
child cites its required clauses, write scope, dependencies and exit gates.
P1 must demonstrate persistence, isolation, disconnect independence, concurrency,
idempotent commands and honest recovery through real host/process boundaries.
P2 must prove user/tenant isolation and remote clients before hosted claims.
P3-P7 and M1-M4 retain their own platform-spec acceptance gates.
Current limitations and implementation status belong in CURRENT_STATUS.

The owner's maximum is six writing workers, bounded further by the execution
environment (currently three worker slots). Each uses an isolated sibling clone,
frozen TASK_ID, branch, PR and structured handoff. Only the operator merges.
