# Journal

Newest first. Append only: entries are never edited or reflowed after commit.

## 2026-09-02 — Close the two highest-priority GUI hardening follow-ups

- Date: 2026-09-02
- Author: Claude (operator / boss)
- Task: A008-0038 and A008-0039
- Branch: `main`
- Identity evidence: both IDs claimed on `main` as `aad3f21` with frozen
  charters, before either branch was created.
- Change: merged PR #13 (A008-0038, ACP session release) and PR #14
  (A008-0039, one GUI test command), in that order.
- A008-0038: `A008AcpAgent` now implements ACP `session/close`, advertises
  `sessionCapabilities.close`, aborts the active turn, drops session state, and
  fails closed on a session it does not hold. `AcpBridge` gained
  `closeSession`, and the GUI host releases a closing socket's owned sessions.
  The A008-0032 handoff had recorded this as "no session-close request in this
  SDK usage"; that was true of A008's usage, not of the protocol. SDK 1.4.0
  already carried the method.
- A008-0039: one shared test runner in `gui/test/`, glob discovery in
  `gui/package.json`, and root `npm test` split into `test:core && test:gui`,
  so the command everyone already types is the full gate.
- Finding: the three ambient `node:test` declaration files were never
  load-bearing. Deleting all three left the GUI typecheck green, because
  TypeScript walks up from `gui/` and resolved `node:test` from the root
  package's `@types/node`. The GUI typecheck silently depended on a sibling
  package's devDependency, and full Node typings were in scope for renderer
  code, so `gui/src/app.tsx` could have imported `node:child_process` and
  compiled. `"types": []` plus including `test/` makes the single remaining
  declaration real; that import now fails with TS2307.
- Verification: root `npm test` is now one command covering 243 core and 63 GUI
  cases, 0 fail, exit 0. Root and GUI typecheck clean; GUI build clean. Both
  A008-0038 halves were mutation-checked: removing the host release fails 4 of
  5 new host cases, removing the agent delete fails 3, and both reverts return
  the suite to green. A008-0039's gate was checked by deliberate breakage (root
  exit 1, then 0 after revert) and by a throwaway test file in a module named in
  no script, which ran without any script edit. The A008-0030 end-to-end proof
  was re-run on the merged tree and still passes 15 of 15.
- Recovery note: both delegated workers were cut off mid-task by a provider
  session limit, as the previous wave was. Neither had committed. The operator
  finished both in their own clones from the state they left rather than
  restarting, exactly as in the A008-0030 recovery.
- Not performed: no live provider call, no CI, no browser-level GUI run, no
  deployment, publication, or release.
- Handoff: `docs/backlog/gui-hardening.md` items 1, 2 and 4 are closed with
  their residuals recorded; items 3 (`messages` on `GuiSession`) and 5 (the
  redaction trade, which needs an ADR amendment) remain open. The largest
  remaining gap is that no CI enforces the gate that now exists.
- Signature: Claude

## 2026-09-02 — Complete the A008-owned GUI program

- Date: 2026-09-02
- Author: Claude (operator / boss) with three delegated writing workers
- Task: A008-0030, closing children A008-0032, A008-0033, A008-0034
- Branch: `main`
- Recovered state: the previous operator's wave was cut off when its worker
  runtime exhausted its provider quota. `main` carried an unpushed merge of
  A008-0037 and PR #9 was still open; A008-0032 and A008-0033 existed only as
  uncommitted work in their clones; A008-0034 was committed but never pushed.
  Nothing was restarted. Every clone's work was preserved and finished in
  place, and the original briefs' `git reset --hard` setup step was explicitly
  withdrawn because it would have destroyed exactly that work.
- Change: pushed `main`, which closed PR #9 (A008-0037). Delegated the three
  unfinished children to one worker per clone under `C:\code\A008-workers`,
  then merged PR #11 (A008-0032 host), PR #10 (A008-0033 session), and PR #12
  (A008-0034 chat) in that order. Added operator-owned integration: `ws: true`
  on the `gui/vite.config.ts` `/v1` proxy, and `npm run gui`.
- Defects found and fixed during the second pass: `POST /v1/shell` had no
  origin guard, so a cross-origin form post could have reached a command
  runner; the session client registered its pending connect one microtask too
  late and deadlocked its own tests; and the chat module's headline test
  asserted on the transcript model while its archive claimed it proved the
  rendered DOM contract. Each is covered by a test that now fails without the
  fix.
- Verification: `npm test` 234 pass, 0 fail. GUI composer, session, terminal,
  and settings 34 pass, 0 fail. GUI chat 29 pass, 0 fail. `npm run typecheck`
  and `npm --prefix gui run typecheck` clean. `npm --prefix gui run build`
  built. The A008-0030 definition of done was then proved end to end, 15 of 15
  checks, against a real GUI host process, a real `A008-acp` stdio subprocess,
  the real local memory runtime, and a loopback fake SSE endpoint: session
  opened, two `thought` frames and one `answer` frame streamed on separate
  channels, `POST /v1/shell` ran in the host, the host served the built GUI,
  and the credential sentinel, the token name `NVIDIA_API_KEY`, and the string
  `authorization` appeared in no observed frame or body. Recorded in
  `docs/evidence/A008-0030_gui-runtime-proof.md`.
- Not performed: no live provider call, no paid usage, no browser-level GUI
  run, no desktop packaging, no deployment, publication, or release. No
  OpenHands source was modified and no OpenHands file was copied.
- Correction to the record: the previous operator merged A008-0037 into local
  `main` without a journal entry. That merge is `43d5e3e` and is now on
  `origin/main`; this entry is where it is first recorded.
- Handoff: A008-0030 is Complete and archived. Five follow-ups are routed to
  `docs/backlog/gui-hardening.md`; the two worth taking first are giving the
  GUI module tests a single command, because the root `npm test` cannot see
  them today, and releasing ACP sessions when a renderer disconnects.
- Signature: Claude

## 2026-09-02 — Merge GUI composer and terminal panes

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0030
- Change: merged PR #7 (A008-0036 terminal) and PR #8 (A008-0035 composer).
  Both restored the CURRENT_TASK template. Remaining: 0032 host, 0033
  session, 0034 chat, 0037 brand.
- Signature: Grok

## 2026-09-02 — Adopt A008-owned GUI boundary

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0031 (parent A008-0030)
- Branch: `main`
- Decision: ADR 0019. Product GUI is A008-owned `gui/` and `src/gui-host/`
  bridging ACP WebSocket to `A008-acp`. OpenHands is not modified. Canvas is
  operator compatibility only. No credentials in the renderer. No wholesale
  Canvas copy. POST `/v1/shell` reuses `src/tools/terminal.ts`.
- Change: claimed A008-0030 through A008-0037; stub `gui/` shell with
  per-module ownership; PROJECT_BRIEF decision 1 closed.
- Signature: Grok

## 2026-09-02 — CLI slash commands and native terminal tool

- Date: 2026-09-02
- Author: Grok (operator)
- Task: A008-0029
- Branch: `main`
- Decision: Do not add `@langchain/community`. It cannot resolve against
  A008's `zod@4.5.4` because `@browserbasehq/stagehand` peers `zod@^3.23.8`.
  Terminal access is `src/tools/terminal.ts` and `/shell`.
- Change: interactive `/help` `/exit` `/quit` `/reset` `/clear` `/undo`
  `/history` `/model` `/status` `/cwd` `/tools` `/shell` `/!`. Unknown
  `/commands` are not sent to the model. `ChatSession.undoLastTurn` added.
- Signature: Grok

## 2026-09-02 — Close knowledge-model gap (A008-0021 complete)

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0021
- Branch: `main`
- Change: merged `grok/A008-0028-storage-redesign` (PR #6). Worker restored
  the CURRENT_TASK template and archived the charter before push. Parent
  program archived to `docs/finished/A008-0021_close-knowledge-model-gap.md`.
  `docs/CURRENT_TASK.md` remains the empty template.
- Evidence: `docs/handoffs/A008-0028.md`. Typecheck exit 0; 210/210 tests;
  in-memory and SQLite S1–S10 payloads match; live CLI/ACP cutover without
  V3/V4/V7. ADR 0018 D9 complete.
- Signature: Grok

## 2026-09-02 — Merge wave 3: M6 evidence lifecycle and retrieval intents

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0021
- Branch: `main`
- Change: merged `grok/A008-0027-evidence-lifecycle-intents` (PR #5). Worker
  restored `docs/CURRENT_TASK.md` from the template and archived the charter
  to `docs/finished/` before push; no CURRENT_TASK conflict.
- Evidence: `docs/handoffs/A008-0027.md`. Named S1–S10 plus decay sweep 16/16;
  full suite 189/189; `PROJECT` writes nothing.
- Next: A008-0028 (M7 storage) on a worker clone.
- Signature: Grok

## 2026-09-02 — Merge wave 2: M4 state/history and M5 evidence

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0021
- Branch: `main`
- Change: merged `grok/A008-0025-state-history-split` (PR #4) and
  `grok/A008-0026-first-class-evidence` (PR #3). Kept empty CURRENT_TASK
  template on `main`. Write scopes did not overlap. Wave 2 launched before
  the template-restore rule, so workers left filled CURRENT_TASK; operator
  discarded those copies.
- Evidence: `docs/handoffs/A008-0025.md`, `docs/handoffs/A008-0026.md`.
- Next: A008-0027 (M6) on a worker clone.
- Signature: Grok

## 2026-09-02 — CURRENT_TASK template stays on main

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0021
- Branch: `main`
- Decision: Operator claims IDs and delegates frozen charters. Workers may
  fill `docs/CURRENT_TASK.md` on their branch while working. Before the last
  commit and push they archive to `docs/finished/` and restore the file from
  `docs/template_CURRENT_TASK.md`. `main` keeps that empty template, so the
  file cannot conflict. Program record moved to
  `docs/tasks/A008-0021_close-knowledge-model-gap.md`. Workers do not append
  the journal.
- Signature: Grok

## 2026-09-02 — Merge wave 1: M1 eligibility and M3 semantic addressing

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0021
- Branch: `main`
- Isolation: canonical working tree `C:\code\A008`
- Change: merged `grok/A008-0024-semantic-addressing` (PR #1) and
  `grok/A008-0023-repair-direct-match-eligibility` (PR #2). Restored parent
  `docs/CURRENT_TASK.md` to A008-0021. ACP source renamed
  `src/acp/a007-acp-agent.ts` → `src/acp/A008-acp-agent.ts` as part of M1.
- Evidence: `docs/handoffs/A008-0024.md`; A008-0023 code is the handoff.
- Next: A008-0025 (M4) and A008-0026 (M5) on worker clones.
- Signature: Grok

## 2026-09-02 — Adopt knowledge and memory model; open gap-close program

- Date: 2026-09-02
- Author: Grok (operator / boss)
- Task: A008-0022 (parent A008-0021)
- Branch: `main`
- Isolation: canonical working tree `C:\code\A008`
- Decision: ADR 0018 accepts `KNOWLEDGE_MEMORY_MODEL.md` as constitution and
  amends ADRs 0005, 0007, 0010, and 0014. Dual-path new engine under
  `src/memory/knowledge/`; do not grow `KnowledgeItem`; clocks on new types
  (M2 is not a task); INTERPRET proposes; RECONCILE is a deterministic slot
  state machine; user-assertion becomes ACCEPT policy `user-assertion-v1`.
  100% gap close is ADR 0018 D9. Operator is sole `main` merger. Operational
  concurrent-writer cap for this program is eight.
- Change: claimed A008-0021 through A008-0028; froze parent CURRENT_TASK and
  child charters under `docs/tasks/`; added `docs/handoffs/`; product identity
  strings that still said A007 in the working tree are A008. Historical
  archive filenames under `docs/finished/` and `docs/evidence/` remain
  provenance.
- Verification: documentation landing; no product behavior change in this
  commit. Child implementation is A008-0023 and A008-0024 on worker clones.
- Security: no live provider, credential, or OpenHands mutation.
- Signature: Grok

## 2026-09-01 — Bounded relation-classifier type aliases

- Date: 2026-09-01
- Author: Grok
- Task: A008-0020
- Branch: `codex/A008-0020-classifier-relation-alias`
- Isolation: canonical working tree `C:\code\A008`, based on claim commit
  `ce6fc9b`.
- Identity and freeze evidence: A008-0020 was claimed and pushed on `main` in
  `ce6fc9b`; the Ready charter was committed before implementation in
  `7766176`.
- Decision: ADR 0017. Live Nemotron returned `{ relation: "new", targetHandle:
  null }`. Runtime accepts `type` or `relation` for the five canonical names,
  trims and case-folds them, treats JSON `null` as omitted, and still fails
  closed on unknown, missing, or conflicting names. The instruction now names
  field `type`.
- Change: `validatedClassifierDecision` normalizes bounded aliases; unknown-type
  errors include the returned value; live-shape fixture and tests added.
- Verification: typecheck/build, all 164 tests, 171-file package dry-run.
- Security: no live NVIDIA call in automation; operator `log.txt` was not
  committed.
- Signature: Grok

## 2026-09-01 — Explicit write-path source message

- Date: 2026-09-01
- Author: Grok
- Task: A008-0019
- Branch: `codex/A008-0019-write-path-context`
- Isolation: canonical working tree `C:\code\A008`, based on claim commit
  `5e0c9b3`.
- Decision: ADR 0016. User-assertion activation reads `batch.sourceMessage`.
  Overlapping session turns are rejected through post-output. Restatement/
  extend still boost from any validated relation. Live RAG/taxonomy remain
  unconfigured.
- Change: removed mutable `UserAssertionMemoryPort` message field; HTTP traces
  include `operation`; `turn_complete` has `chatStatus`/`memoryStatus`; current
  truth now records live write-path invocation.
- Verification: typecheck/build, all 160 tests including overlapping-turn
  isolation.
- Signature: Grok

## 2026-09-01 — Reasoning has no path to knowledge

- Date: 2026-09-01
- Author: Grok
- Task: A008-0018
- Branch: `codex/A008-0018-reasoning-isolation`
- Isolation: canonical working tree `C:\code\A008`, based on claim commit
  `8fdd2d2`.
- Identity and freeze evidence: A008-0018 was claimed and pushed on `main` in
  `8fdd2d2`; the Ready charter was committed before implementation in
  `861a076`.
- Decision: ADR 0015. Live Nemotron may switch from `reasoning_content` to
  `content` mid-thought. Normalize so only the user-visible answer is
  committed. Semantic calls use a non-thinking profile. Successful chat with
  failed memory is degraded, not a failed turn.
- Change: NVIDIA reasoning normalizer, live-format fixture, verified intake
  answer, `memory_read` at read time, HTTP call IDs, single `memory_failure`,
  `turn_complete` `degraded`.
- Evidence: live leak splits at `I'll generate the response.✅`; answer is
  `Hej! Ja, SQLite...`. Holy invariant holds.
- Verification: typecheck/build, all 158 tests.
- Security: no live NVIDIA call in automation; operator `log.txt` was not
  committed.
- Handoff: reasoning isolation is now a hard live-path invariant.
- Signature: Grok

## 2026-09-01 — Live write-path reconciliation reinforcement

- Date: 2026-09-01
- Author: Grok
- Task: A008-0017
- Branch: `codex/A008-0017-write-path-reinforcement`
- Isolation: canonical working tree `C:\code\A008`, based on claim commit
  `d3aaa50` after A008-0016 merged as PR #14.
- Identity and freeze evidence: A008-0017 was claimed and pushed on `main` in
  `d3aaa50`; the Ready charter was committed before implementation in
  `f1e908c`.
- Decision: ADR 0014 turns on live `reconciliationReinforcement` `0.2` and
  keeps `projectionReinforcement` at `0`. Boost then threshold; retrieval is
  not use; decay remains later work.
- Change: `createLocalMemoryRuntime` now applies the engine restatement/extend
  score boost. Hybrid reads still use `projectSelected` without mutation.
- Evidence: active `0.7` became `0.9`; dormant `0.35` reactivated at `0.55`;
  dormant `0.1` stayed dormant at `0.3`.
- Verification: audit zero vulnerabilities, typecheck/build, all 150 tests,
  167-file package dry-run.
- Security: no `.env.local`, live/paid provider, OpenHands mutation,
  deployment, or publication.
- Handoff: live Reinforce flow is on for write-path restatement/extend.
  Weaken/decay is the next policy choice if needed.
- Signature: Grok

## 2026-09-01 — Local CLI/ACP memory surfaces and debug trace

- Date: 2026-09-01
- Author: Grok
- Task: A008-0016
- Branch: `codex/A008-0016-live-memory-surfaces`
- Isolation: canonical working tree `C:\code\A008`, based on draft commit
  `4144218` and freeze commit `d791769`.
- Identity and freeze evidence: A008-0016 was claimed on `main` in `4144218`;
  the Ready charter with four owner decisions was committed before
  implementation in `d791769`.
- Decision: ADR 0013 selects one local composition root for CLI and A008 ACP,
  JSONL as the canonical diagnostic sink, answer-first then awaited memory
  settlement, process/session-local identities, and a runtime-owned user-
  assertion activation gate applied at `new` reconcile.
- Change: `createLocalMemoryRuntime` owns the existing NVIDIA transport,
  project-namespaced SQLite, hybrid read, memory-aware chat, semantic
  analyzer/classifier, relation commit, and post-output coordinator. Debug
  tracing is off by default; safe/raw JSONL never records credentials.
- Evidence: two-turn CLI and compiled ACP proofs committed an explicit user
  assertion as active revision one and projected it on the next turn against
  actual temporary SQLite and fake provider responses.
- Verification: clean install/audit, typecheck/build, all 147 tests, independent
  benchmark, CLI no-key smokes, 167-file package dry-run, Markdown, staged-
  content, template restore, and diff gates passed.
- Security: no `.env.local`, live/paid provider, OpenHands source mutation,
  deployment, publication, or release participated. The full Canvas browser
  GUI was not re-driven; OpenHands stayed at `744e8652` unmodified.
- Handoff: local surfaces are ready for an owner-executed live run. Next later
  work is Agent Server conversation binding, durable retry, or conflict/review
  UX.
- Signature: Grok

## 2026-09-01 — Committed two-turn memory-loop proof

- Date: 2026-09-01
- Author: Codex
- Task: A008-0015
- Branch: `codex/A008-0015-committed-memory-loop`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0015_committed-memory-loop`, based on claim commit
  `56f9da6`.
- Identity and freeze evidence: A008-0015 was claimed and pushed on `main` in
  `56f9da6`; the Ready charter was committed/pushed before benchmark changes in
  `430f267`.
- Decision: prove the closed loop by extending already-active canon. Brand-new
  analyzer drafts remain dormant; the benchmark does not invent a confirmation
  signal or give model output activation authority.
- Change: benchmark v2 composes real SQLite hybrid read, memory-aware chat,
  stateless analyzer/classifier, guarded relation commit/index, and next-turn
  reread over one fake transport in exact chat/analyze/classify/chat order.
- Evidence: revision-one meaning was projected on turn one, one `extend` plus
  index update advanced the same active item to revision two, and turn two
  projected the extended proposition. Reasoning and control IDs remained
  outside later context, history, semantic results, and canon.
- Verification: clean install/audit, typecheck/build, all 130 tests, independent
  benchmark, CLI no-key smokes, 151-file package dry-run, Markdown, staged-
  content, template, and diff gates passed.
- Security: no `.env.local`, live/paid provider, external OpenHands process,
  Supabase, Docker mutation, external database, deployment, publication, or
  release participated. Owner README/image and unrelated canonical lockfile
  edit remained untouched.
- Handoff: pause at this merged milestone. Next choose new-draft confirmation/
  activation or live composition only with explicit identity, privacy, durable
  retry/repair, cost, and user-visible failure policy.
- Signature: Codex

## 2026-09-01 — Stateless semantic JSON model calls

- Date: 2026-09-01
- Author: Codex
- Task: A008-0014
- Branch: `codex/A008-0014-semantic-json-model-calls`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0014_semantic-json-model-calls`, based on claim
  commit `97152bd`.
- Identity and freeze evidence: A008-0014 was claimed and pushed on `main` in
  `97152bd`; the Ready charter was committed and pushed before implementation in
  `78bab19`.
- Decision: ADR 0012 selects one stateless strict-JSON owner over an injected
  existing `ChatTransport`. Analyzer and classifier share it without using
  `ChatSession`, creating history, or constructing another provider client.
- Change: added exact two-message semantic envelopes, pre-transport budgeting,
  forced non-streaming calls, strict assistant JSON, fixed analyzer/classifier
  adapters, reasoning/metadata discard, and `AbortSignal` propagation through
  intake, relation commit, and coordinator checkpoint boundaries.
- SQLite evidence: one shared fake transport served one analyzer plus two
  classifier calls. Proposal zero created/indexed dormant canon; proposal one
  then retrieved and extended that same item to revision two. Fake provider
  reasoning and durable/runtime IDs remained outside semantic results.
- Verification: clean install/audit, strict typecheck/build, and all 130
  fake/local tests passed. The standalone two-turn benchmark and CLI no-key
  smokes passed; package dry-run contained 151 files; final Markdown,
  staged-content, template, and diff gates passed.
- Security: no `.env.local`, live provider, paid call, external OpenHands
  process, Supabase, Docker mutation, external database, deployment,
  publication, or release participated. The owner's README/image remained
  intact and the unrelated canonical lockfile edit stayed outside this task.
- Handoff: next choose an authorized live/background owner that injects the
  existing transport/model/budgets and invokes the coordinator with complete
  identity, privacy/user-control, durable retry/repair, cost, and failure-UI
  decisions. Do not bind semantic jobs to `ChatSession` or replay reasoning.
- Signature: Codex

## 2026-09-01 — Sequential post-output memory coordination

- Date: 2026-09-01
- Author: Codex
- Task: A008-0013
- Branch: `codex/A008-0013-post-output-memory-coordinator`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0013_post-output-memory-coordinator`, based on
  claim commit `0efac5a`.
- Identity and freeze evidence: A008-0013 was claimed and pushed on `main` in
  `0efac5a`; the Ready charter was committed and pushed before implementation in
  `2a5a402`.
- Decision: ADR 0011 makes the multi-proposal flow sequential and explicitly
  non-atomic. One staging call feeds ordered one-proposal commits; stage failure,
  commit failure, and post-canonical index repair remain distinguishable.
- Change: added exported `PostOutputMemoryCoordinator`, exact copied staging
  input, batch/checkpoint revalidation, defensive result copies, same-index
  commit resume, and repair-then-resume that stops later candidate comparison
  until metadata is complete and never reclassifies/reconciles the repaired
  proposal.
- SQLite evidence: one analyzer/staging call produced two proposals. The first
  created dormant SQLite canon and index metadata; the second materialized that
  exact earlier item and extended it. Final state was one revision-two current
  record with ordered create/extend audit and four non-vector retrieval
  channels.
- Verification: clean install and production audit passed with zero
  vulnerabilities; strict typecheck/build and all 117 fake/local-only tests
  passed. The two-turn reasoning-isolation benchmark remained structurally
  green, CLI no-key smokes passed, the package dry-run contained 143 files, and
  final Markdown/staged-content/template/diff gates passed.
- Security: reasoning and caller extras are excluded before staging;
  checkpoints remain runtime control state and are not persisted or exposed to
  semantic ports. No live provider, `.env.local`, external OpenHands process,
  Supabase service, Docker mutation, external database, deployment,
  publication, or release participated. The owner's README/image remained
  intact and the unrelated canonical lockfile edit stayed outside this task.
- Handoff: next choose provider-backed analyzer/classifier composition and one
  application/background invocation owner with explicit credentials, cost,
  retry persistence, identity, privacy, and user-visible failure policy. Do not
  hide those calls inside `ChatSession` or replay reasoning.
- Signature: Codex

## 2026-09-01 — Relation-gated semantic-memory commit

- Date: 2026-09-01
- Author: Codex
- Task: A008-0012
- Branch: `codex/A008-0012-relation-gated-memory-commit`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0012_relation-gated-memory-commit`, based on claim
  commit `6540e15f09da5c7b96e0080629faa6499e063517` and rebased after the owner's
  README/image commits on `main`.
- Identity and freeze evidence: A008-0012 was claimed and pushed on `main` in
  `6540e15`; the Ready charter was committed and pushed before implementation in
  original commit `20bccf2` (rebased equivalent `27e77e8`).
- Decision: ADR 0010 establishes one-proposal relation gating. Current active
  and dormant candidates are materialized through one bounded indexed search;
  an untrusted classifier sees semantic fields plus invocation-local handles,
  never runtime/knowledge IDs or write capabilities.
- Change: added exported `IndexedRelationCandidateSource` and
  `RelationGatedMemoryCommit`; exact classifier serialization/budget and tail
  trimming; strict five-way handle validation/mapping; all-materialized-
  candidate revision guards inside `SemanticMemory.reconcile`; and explicit
  `updated`, `not_required`, or `pending_repair` entity/domain index state with
  retry that never reconciles twice.
- SQLite evidence: actual in-memory SQLite executed `new`, `restatement`,
  `extend`, `supersede`, and `conflict`; materialized dormant canon; verified
  audit/current/history transitions; retrieved committed results again through
  exact/entity, lexical, tag, and domain channels; and rejected a revision
  changed during classification with `stale_state`.
- Verification: clean install and production audit passed with zero
  vulnerabilities; strict typecheck/build and all 109 fake/local-only tests
  passed. The two-turn reasoning-isolation benchmark remained structurally
  green, CLI no-key smokes passed, the package dry-run contained 139 files, and
  final Markdown/staged-content/template/diff gates passed.
- Security: reasoning, history, IDs, revisions, scores, retrieval reasons,
  provenance, and audit do not enter classifier context. No live provider,
  `.env.local`, external OpenHands process, Supabase service, Docker mutation,
  external database, deployment, publication, or release participated. The
  owner's `README.md` and `A008hero.jpg` changes were retained; the unrelated
  canonical lockfile metadata edit stayed outside this worktree and task.
- Handoff: next choose and implement the application-owned coordinator and
  provider-call ownership for analyzer/classifier adapters, failure
  presentation, and durable/background index repair. Live CLI/ACP/Canvas wiring
  still depends on complete verified identity intake and privacy policy.
- Signature: Codex

## 2026-09-01 — Reasoning isolation and staged post-output intake

- Date: 2026-09-01
- Author: Codex
- Task: A008-0011
- Branch: `codex/A008-0011-safe-post-output-knowledge-intake`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0011_safe-post-output-knowledge-intake`, based on
  claim commit `04f9446c3368ec5a53c37348004de829c8405d7a`.
- Identity and freeze evidence: A008-0011 was claimed and pushed on `main` in
  `04f9446`; the Ready charter was committed and pushed before implementation in
  `dcd577c`.
- Decision: ADR 0009 makes reasoning an ephemeral presentation channel.
  `ChatSession` commits only the final assistant message; reasoning never enters
  chat history, memory retrieval, future provider context, or knowledge intake.
- Change: added exported `PostOutputKnowledgeIntake`, whose analyzer receives
  exactly normalized message plus final answer. Staging validates identities,
  applies verified scopes and conservative runtime-owned fields, normalizes
  semantic metadata, rejects duplicates/malformed output, enforces structural
  and exact serialized UTF-8 limits, and owns no write port.
- Benchmark: `npm run benchmark:memory-loop` used actual in-memory SQLite,
  hybrid retrieval, memory-aware orchestration, and a fake streaming provider.
  Two reads and two calls selected the same knowledge twice, prior dialogue was
  zero then two messages, reasoning/content each emitted two deltas, four
  dialogue messages committed, and neither prior reasoning nor control IDs
  entered provider messages. Requests measured 666/823 bytes; observed turn
  times 10.469/3.128 ms are not guarantees.
- Verification: clean install and production audit passed with zero
  vulnerabilities; strict typecheck/build and all 95 fake/local-only tests
  passed. CLI no-key smokes, a 131-entry package dry-run, final Markdown,
  staged-content, task-template, and diff gates passed.
- Security: no live provider, `.env.local`, external OpenHands process,
  Supabase service, Docker mutation, external database, deployment,
  publication, or release participated. An unrelated pre-existing unstaged
  canonical `package-lock.json` metadata change was preserved and excluded.
- Handoff: next compare staged drafts with bounded materialized current
  candidates, validate one explicit five-way relation decision, and only then
  call `SemanticMemory.reconcile` plus retrieval-index maintenance. Provider
  ownership and failure presentation must be explicit.
- Signature: Codex

## 2026-09-01 — Memory-aware chat orchestration

- Date: 2026-09-01
- Author: Codex
- Task: A008-0010
- Branch: `codex/A008-0010-memory-aware-chat-orchestration`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0010_memory-aware-chat-orchestration`, based on
  claim commit `b480c3ba65ca3cededb7ae456f8bb61e4251de17`.
- Identity and freeze evidence: A008-0010 was claimed and pushed on `main` in
  `b480c3b`; the Ready charter was committed and pushed before implementation in
  `0212cb7`.
- Decision: ADR 0008 defines one provider-neutral read-before-chat coordinator.
  Verified identity, one read-only projection, at most two committed dialogue
  messages, and the original message become one budgeted invocation through the
  existing `ChatSession` transport owner.
- Trust boundary: materialized memory remains user-level JSON data. A fixed
  system instruction describes its handling. The default composer strips
  orchestrator-owned runtime/knowledge IDs, plans/evidence, scores, lifecycle,
  provenance, audit, and projection control serialization.
- State boundary: provider-visible context is ephemeral. Successful state
  commits only normalized original user and assistant messages; retrieval,
  identity, composition, budget, provider, cancellation, and invalid-response
  failures commit no partial turn. Memory reads remain non-mutating.
- Verification: clean install and production audit passed with zero
  vulnerabilities; strict typecheck/build and all 87 fake/local-only tests
  passed. Direct chat/CLI/ACP/provider/identity/memory regressions remained
  green. CLI no-key smokes and a 123-entry package dry-run passed; final
  Markdown, staged-content, template, and diff gates passed.
- Security: orchestration reads no environment, credential, file, database, or
  network directly. No live provider, `.env.local`, external OpenHands process,
  Supabase service, Docker mutation, external database, deployment,
  publication, or release participated.
- Handoff: next define the bounded post-output analysis contract—structured
  knowledge proposals plus explicit relation decisions—without allowing model
  output to commit itself. Live CLI/ACP identity intake remains an independent
  prerequisite for user-visible memory orchestration.
- Signature: Codex

## 2026-09-01 — SQLite hybrid semantic-memory read path

- Date: 2026-09-01
- Author: Codex
- Task: A008-0009
- Branch: `codex/A008-0009-sqlite-hybrid-memory-read-path`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0009_sqlite-hybrid-memory-read-path`, based on
  claim commit `83b523f9ab172cf9f13ecf4bbe62de5b2f0abd79`.
- Identity and freeze evidence: A008-0009 was claimed and pushed on `main` in
  `83b523f`; the Ready charter was committed and pushed before implementation in
  `6954c42`.
- Decision: ADR 0007 chooses SQLite for the first durable single-process local
  adapter. PostgreSQL/Supabase remains replaceable when multi-process, RLS, or
  server vector-scale requirements are demonstrated.
- Change: added project-namespaced schema-v1 canon/audit persistence, FTS5,
  canonical tags, indexed entities/domains, optional precomputed embeddings, a
  bounded deterministic planner, unified hybrid scoring, separate thresholds,
  read-only selected projection, and bounded debug evidence outside context.
- Lifecycle boundary: retrieval can observe dormant current canon but cannot
  reinforce, reactivate, decay, or write it. Automatic post-output extraction,
  relation classification, and lifecycle policy remain deferred.
- Verification: clean install and production dependency audit passed with zero
  vulnerabilities; strict typecheck/build passed; all 79 fake/local-only tests
  passed. The final 100-versus-100,000 test produced byte-identical 221-byte
  projections with one candidate and observed 24 ms/5,443 ms setup-plus-read
  times. CLI no-key smokes, 111-entry package dry-run, dependency-license,
  Markdown, staged-content, template, and diff gates passed.
- Security: the SQLite path and project identity are explicitly injected; the
  memory implementation reads no environment variable or credential. No live
  provider, `.env.local`, Supabase service, Docker mutation, external database,
  deployment, publication, or release participated.
- Handoff: next charter the application orchestration boundary that accepts
  complete verified runtime context, composes the one memory projection with
  bounded recent chat state, and preserves one existing provider-call owner.
- Signature: Codex

## 2026-09-01 — Post-identity current-truth repair

- Date: 2026-09-01
- Author: Codex
- Task: A008-0008
- Branch: `codex/A008-0008-current-truth-repair`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0008_current-truth-repair`, based on local `main`
  at claim commit `fab787f2a91b586a4f2b8822d5e50dff2edd0b23`.
- Identity and freeze evidence: A008-0008 was claimed and pushed on `main` in
  `fab787f`; the Ready charter was committed before corrections in `cc52604`.
- Trigger: the post-A008-0007 audit found current-facing contradictions: one
  status section listed A008-0004 through A008-0007 worktrees while another said
  only A008-0004 existed, and the memory section still called stable identities
  unimplemented after runtime identity v0 merged.
- Change: synchronized repository/worktree inventory through A008-0008, stated
  that allocated worktrees do not imply activity, changed the memory gap to
  verified identity integration, and repaired the affected project-brief wrap.
  Historical ADRs, completed archives, prior journal entries, and product source
  were not edited.
- Verification: Git reported canonical main plus five allocated task worktrees,
  A008-0004 through A008-0008. The targeted current-facing stale-phrase audit
  returned zero contradictions after excluding the active task's description.
  All 43 final Markdown files passed link/fence/index checks; staged secret/raw-
  legacy and diff checks passed; `CURRENT_TASK` matched its template.
- Not performed: npm install, typecheck, build, product tests, credential read,
  live calls, product/runtime changes, cleanup, deployment, publication, or
  release. Product gates were skipped because only documentation changed.
- Handoff: activate a bounded application orchestration task that accepts a
  complete verified runtime identity context before memory projection or post-
  output analysis.
- Signature: Codex

## 2026-09-01 — Runtime identity v0 and ACP binding contract

- Date: 2026-09-01
- Author: Codex
- Task: A008-0007
- Branch: `codex/A008-0007-runtime-identity`
- Isolation: Git worktree `C:\code\A008-workers\A008-0007_runtime-identity`,
  based on local `main` at claim commit
  `4d5f6face3b3ac26372d6fad6b0eb13a4dbecca4`.
- Identity and freeze evidence: A008-0007 was claimed and pushed on `main` in
  `4d5f6fa`; the Ready charter was committed before product changes in
  `ff33203`.
- Decision: ADR 0006 defines opaque versioned `project`, `conversation`, runtime
  `task`, `agent`, and `acp_session` identities as
  `A008_v1_<kind>_<lowercase UUIDv4>`. Product task IDs are explicitly distinct
  from docs-first addresses such as A008-0007.
- Change: added branded/public identity types, strict parser/kind inspection,
  injected/default UUIDv4 factory, typed errors, bounded namespaced external
  references, an ACP binding repository port, and an atomic concurrency-
  serialized in-memory reference with idempotency, uniqueness, conversation
  consistency, external resolution, and defensive reads.
- ACP adoption: default new sessions use canonical `acp_session` IDs. Malformed
  or duplicate injected IDs fail before the existing process-local session map
  changes. The compiled official-client loopback turn uses the canonical ID.
- Honest boundary: the bridge does not register a complete binding. Current ACP
  `session/new` does not provide a verified Agent Server conversation ID or the
  A008 project/conversation/task/agent context; those values were not invented.
- Verification: clean `npm ci` installed five packages with zero vulnerabilities;
  strict typecheck/build passed; all 66 fake-only tests passed with zero failures,
  skips, cancellations, or todo. Package dry-run contained 91 entries and did
  not publish. Final Markdown link/fence/index, staged secret/raw-legacy, and
  diff checks passed.
- Security: identity source has zero provider, environment, filesystem, network,
  chat, or memory dependencies. IDs contain only version/kind/UUID routing data;
  bindings/external references remain control plane and never enter a model
  request in this slice. `.env.local` and the NVIDIA key were not read.
- Not performed: no Agent Server/Canvas source or process, live provider/model,
  paid use, complete live binding, durable storage, migration, account/login,
  PII policy implementation, ACL, load/resume, memory/chat/CLI/GUI binding,
  deployment, publication, release, or worker-path deletion.
- Handoff: define a bounded application orchestration contract that receives a
  complete verified runtime identity context before memory projection or post-
  output analysis. Do not derive identity from paths/prompts or create a second
  provider-call owner.
- Signature: Codex

## 2026-09-01 — Semantic-memory v0 core and reference engine

- Date: 2026-09-01
- Author: Codex
- Task: A008-0006
- Branch: `codex/A008-0006-semantic-memory-core`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0006_semantic-memory-core`, based on local `main`
  at claim commit `ef188740887968ce227a306f5e88960e04c79aa6`.
- Identity and freeze evidence: A008-0006 was claimed and pushed on `main` in
  `ef18874`; the Ready charter was committed before product changes in
  `6ba1551`.
- Source boundary: the owner's Context-First Knowledge Architecture at SHA-256
  `770A78D02218F73EA867218CF23B88B8A09997F0EAA1CC5062B045179A7337E2`
  was read as design input. ADR 0005 adopts a bounded A008-owned contract; no
  external memory implementation, ACME source, or prototype code was adopted.
- Change: added exported memory state/policy/repository/projection contracts,
  typed errors, stable context serialization, exact UTF-8-byte measurement, a
  no-decay coding-agent policy, atomic transaction-serialized in-memory store,
  and the `SemanticMemory` reconciliation/discovery/history/audit/projection
  service.
- State semantics: current/superseded and active/dormant are separate;
  reconciliation applies explicit new/restatement/extend/supersede/conflict
  decisions; dormant current knowledge remains discoverable; threshold or
  keep-alive owns activation; scope miss does not decay; invalid or over-budget
  work rolls back canonical and audit changes.
- Context boundary: policies select relevance and order but cannot rewrite
  canonical content. Required/keep-alive semantics fail explicitly if missing,
  ineligible, or too large. The serialized execution projection materializes
  meaning and excludes provenance, activation/canonical metadata, and audit.
- Verification: clean `npm ci` installed five packages with zero vulnerabilities;
  strict typecheck/build passed; all 54 fake-only tests passed with zero failures,
  skips, cancellations, or todo. The same task produced byte-identical context
  with 100 and 100,000 records. Package dry-run contained 75 entries and did not
  publish. Final Markdown link/fence/index, staged secret/raw-legacy, and diff
  checks passed.
- Security: memory source has zero provider, environment, network, filesystem,
  chat, or ACP imports/uses. `.env.local` and the replacement NVIDIA key were
  not read; no model or external service was contacted.
- Not performed: no semantic extraction/classification, embedding/vector search,
  live inference, paid use, durable persistence, identity mapping, privacy/ACL
  implementation, chat/CLI/ACP/Canvas integration, deployment, publication,
  release, or worker-path deletion.
- Handoff: define stable project/conversation/task/agent/ACP-session identities
  before persistent or automatic memory integration. Preserve one A008 provider-
  call owner and require an explicit bounded post-output analysis contract.
- Signature: Codex

## 2026-09-01 — Agent Canvas runtime proof through A008 ACP

- Date: 2026-09-01
- Author: Codex
- Task: A008-0005
- Branch: `codex/A008-0005-agent-canvas-runtime-proof`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0005_agent-canvas-runtime-proof`, based on local
  `main` at `1ac51fc49af97626ceec20db15bc7912c373865e`.
- Identity and freeze evidence: A008-0005 was claimed on local `main` in
  `1ac51fc`; the Ready charter was committed before runtime/code changes in
  `487abea`.
- Change: added an A008-owned loopback fake NVIDIA SSE server and two tests,
  installed/built the clean external Canvas clone, supplied Agent Server 1.44.1
  through `uvx`, configured the compiled A008 Custom ACP command through the
  real Canvas UI, completed a deterministic browser turn, and added an indexed
  safe evidence collection with the stable screenshot.
- Runtime evidence: Canvas 1.16.0 saved `agent_kind: acp`, Agent Server
  initialized A008 and selected the verified Nemotron model, the loopback
  fixture received the exact two-message request, Canvas rendered
  `A008-CANVAS-LOOPBACK-OK`, and the conversation ended `finished`. The final UI
  had no Running state, error banner, framework overlay, or page error.
- Windows findings: Canvas shell parsing requires `C:/...` in the Custom command
  field; backslashes were consumed. `dev:minimal` timed out at 30 seconds while
  the pinned backend needed about 42 seconds, so its exact locked Agent Server
  and Vite commands were run separately without modifying OpenHands.
- Verification: A008 clean install, typecheck/build, 38/38 tests, and package
  dry-run passed. OpenHands `npm ci` installed 1,394 packages and its app build
  passed; the external checkout remained clean. The spawned frontend, backend,
  and fake server were stopped and ports 3015, 18115, 18116, and 18999 were
  free. Exact browser/runtime facts are in
  `docs/evidence/A008-0005_agent-canvas-runtime-proof.md`.
- Security: `.env.local` and the replacement NVIDIA key were not read. The
  successful model turn used only a fixed test key and loopback endpoint; no
  live model inference or paid usage occurred. OpenHands nevertheless attempted
  optional OpenAI device-auth/status control-plane paths and failed title
  generation without credentials, so zero external egress is not claimed.
- External/tool limitations: OpenHands reported five npm audit findings and a
  jsdom engine warning on Node 24.14.1; optional VSCode/browser-tool preload and
  minimal-stack automation paths were unavailable. The requested
  `agent-browser` CLI was absent, so the pinned OpenHands Playwright 1.62.1
  browser was the verification fallback.
- Not performed: no live NVIDIA/OpenAI inference, paid use, credential
  validation, OpenHands source change, tool/MCP/automation execution, memory,
  durable identity contract, desktop package, deployment, publication, release,
  or deletion of worker/runtime paths.
- Handoff: define the semantic-memory add-on's first project-owned contract and
  hermetic egress policy before implementation; do not reopen the shared
  provider owner or Custom ACP GUI boundary without contradictory evidence.
- Signature: Codex

## 2026-09-01 — Agent Canvas ACP bridge

- Date: 2026-09-01
- Author: Codex
- Task: A008-0004
- Branch: `codex/A008-0004-agent-canvas-shared-chat`
- Isolation: Git worktree
  `C:\code\A008-workers\A008-0004_agent-canvas-shared-chat`, based on local
  `main` at `ebbc0ea4641df5fff02d66b21f384b45a74e223f`.
- Identity and freeze evidence: A008-0004 was claimed on local `main` in
  `ebbc0ea`; the Ready charter was committed before product edits in `54eceda`.
- Boundary decision: ADR 0004 selects standalone Agent Canvas -> Agent Server
  -> Custom stdio ACP -> shared A008 core. Canvas, software-agent-sdk, and the
  TypeScript client were not modified or vendored.
- Change: added exact runtime dependencies `@agentclientprotocol/sdk` 1.4.0 and
  Zod 4.5.4; shared `createNvidiaChatSession`; the `A008-acp` executable;
  per-session chat state; model config; baseline text/resource-link prompts;
  thought/answer event mapping; cancellation; operator runbook; direct
  dependency inventory; and ten additional automated cases.
- Provider ownership: CLI and ACP now use the same environment-edge session
  factory and existing `NvidiaChatTransport`. Core remains environment-neutral;
  Agent Server is the intended process owner and does not become a provider
  client.
- Verification: `npm ci` installed five packages, audited six, and reported zero
  vulnerabilities. Typecheck and build passed. All 36 tests passed. The official
  ACP client spawned compiled `A008-acp`, negotiated v1, created a session,
  selected the verified model, sent one prompt through the existing adapter to
  a loopback fake SSE endpoint, and observed thought plus answer chunks. CLI
  help/model smokes exited 0; missing-key chat exited 2. Package dry-run listed
  51 files including the ACP executable. All 33 final Markdown files passed
  link, fence, and index checks; the 26 staged files had no known key/private-
  key pattern and no raw legacy path.
- License evidence: the direct ACP SDK reports Apache-2.0, Zod reports MIT, and
  the external clean Agent Canvas clone remained at
  `744e8652f254613045b779eb148bf4f741177975` under MIT terms.
- Not performed: no `.env.local` load in tests, real credential, live NVIDIA
  call, paid usage, OpenHands install/build, Agent Server, GUI/browser, desktop
  packaging, publication, release, tools, persistence, memory, or deletion of
  the task worktree.
- Handoff: A008-0005 should provide the current Canvas/Agent Server runtime on
  Windows, configure `node C:\code\A008\dist\src\acp\server.js` as the Custom
  agent, use a loopback fake provider, and capture the first visible response.
- Signature: Codex

## 2026-09-01 — Secure provider-neutral chat core and CLI

- Date: 2026-09-01
- Author: Codex
- Task: A008-0003
- Branch: `codex/A008-0003-secure-provider-core`
- Identity and freeze evidence: A008-0003 was claimed on local `main` in
  `3e61dd0`; the Ready charter was committed before product edits in `b4a430e`.
- Owner security input: the exposed legacy NVIDIA credential was deleted at the
  provider and replaced. The replacement was verified only as a non-empty
  `NVIDIA_API_KEY` in ignored `.env.local`; its value was neither displayed nor
  used.
- External contract check: NVIDIA's current NIM API reference still specifies
  `POST /v1/chat/completions`, and the current Nemotron page names
  `nvidia/nemotron-3.5-lightning-30b-a3b` with temperature 1, top-p 0.95,
  reasoning budget, and streamed reasoning/content fields.
- Change: created the private Node.js/TypeScript package, strict ESM build,
  provider-neutral contracts and typed errors, model registry, transactional
  `ChatSession`, native-fetch NVIDIA adapter, chunk-safe SSE parser, public
  exports, environment-backed interactive CLI, `.env.example`, and 26 fake-only
  tests. ADR 0003 records the initial runtime/provider boundary.
- Security boundary: core and tests never read environment. CLI model/help work
  without a key; chat checks `NVIDIA_API_KEY` before transport construction.
  Raw legacy, `.env.local`, dependencies, and build output remain ignored.
- Verification: `npm ci` installed three development packages and reported zero
  vulnerabilities; typecheck and build passed; 26/26 tests passed. Direct CLI
  help/model smokes exited 0 without loading `.env.local`; missing-key chat
  exited 2 before transport construction. All 29 final Markdown files passed
  relative-link/fence/index checks; committable candidates had no known NVIDIA,
  OpenAI, or private-key pattern; no raw legacy file was staged; and
  `git diff --cached --check` passed.
- Not performed: no live NVIDIA request, credential validation, paid usage,
  Agent Canvas/GUI/E2E, tools, memory, persistence, package publication,
  installer, deployment, push, or release.
- Handoff: activate the first shared-chat proposal. Its next proof should route
  one Agent Canvas message through this same core and choose ACP/Agent Server or
  a bounded library surface without creating a second provider-call owner.
- Signature: Codex

## 2026-09-01 — Multi-agent worker root registered

- Date: 2026-09-01
- Author: Codex
- Task: A008-0002
- Branch: `main`
- Identity evidence: claim committed locally as `e7f7604` before the charter
  moved to Ready/In Progress.
- Owner input: `C:\code\A008-workers` may be used for multi-agent repository
  clones.
- Change: registered the path in entry guardrails, multi-agent policy, current
  status, system behavior, and the external-path note in the file map. Worker
  directories use `A008-NNNN_task-slug`; the default branch convention is
  `codex/A008-nnnn-task-slug` unless a charter says otherwise.
- Verification: canonical root resolved to `C:\code\A008`; worker root resolved
  to `C:\code\A008-workers`; they were unequal and the worker root was not
  inside the canonical tree. The worker root existed and contained zero child
  items. All 26 tracked Markdown files passed relative-link, fence, and
  collection-index checks; `git diff --cached --check` passed.
- Not performed: no clone/worktree creation, agent/process launch, MCP install,
  write-permission probe, push, deployment, publication, or deletion.
- Handoff: future writing waves allocate one unique directory under the
  registered root only after child IDs, charters, base revisions, scopes, and
  approvals are ready.
- Signature: Codex

## 2026-09-01 — A008 canonical repository bootstrap

- Date: 2026-09-01
- Author: Codex with read-only mapping agents
- Task: A008-0001
- Branch: `main`
- Identity evidence: claim committed locally as `5768c41` before the charter
  moved to Ready/In Progress.
- Change: replaced copied protocol-project truth with A008-owned entry, workflow,
  brief, status, system document, file map, task template, decisions, backlog,
  provenance boundary, and multi-agent policy. Raw bootstrap/protocol/add-on
  packages remain ignored reference input.
- Product direction recorded: one shared core for CLI and GUI, Agent Canvas as
  candidate GUI/client source, and a future optional semantic-memory engine
  designed from the owner-supplied Context-First architecture.
- Owner correction: no A008 memory-engine or implementation baseline exists.
  Related ACME code is not adopted source or a dependency.
- Source evidence: the raw legacy Node.js CLI exposes model selection, settings,
  streaming, history, error, and fallback behavior. OpenHands Agent Canvas was
  inspected as a clean external MIT clone at
  `744e8652f254613045b779eb148bf4f741177975`.
- Security: the raw legacy client contains a hard-coded NVIDIA credential. Its
  value was not copied into repository authority or staged. The raw tree is
  ignored. The owner must revoke or rotate the credential before live use.
- Verification: all four bootstrap manifest SHA-256 entries matched; relative
  Markdown links, fences, and indexed collection membership passed; committable
  files had no known NVIDIA/OpenAI key prefix or private-key header; raw legacy
  paths were absent from the staged set; `git diff --cached --check` passed after
  one whitespace defect was repaired. A read-only worker ran `node --check` on
  the legacy script successfully.
- Not performed: no A008 product build, unit/integration/package test, OpenHands
  install/build, live provider call, MCP add-on installation, push, deployment,
  publication, or release. There is no product source to test yet, OpenHands
  intake was read-only, and external effects were not authorized.
- Handoff: review and activate the credential-remediation and first-shared-chat
  backlog proposals. Before code, choose the Agent Canvas/Agent Server boundary,
  provider ownership, cross-component identity contract, and first memory-engine
  specification slice.
- Signature: Codex
