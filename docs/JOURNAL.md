# Journal

Newest first. Append only: entries are never edited or reflowed after commit.

## 2026-09-08 — A008-0082: L3 implemented and published

- Task: A008-0082; operator: Codex; branch: `main`.
- Integrated implementation `27a17081cf99a3fe8f868ffd25161fc8dc5a2be7`
  and handoff `a347a872b319267e02b2ff04e7cc6b1c425fc620`. Published main
  and verified local/remote equality at `a347a87` before this closure entry.
- Implemented accepted P6: independent directed/scoped association baselines,
  occurrence/edge receipts and audit alongside RelationIndex. Existing semantic
  comparison supplies exact handles and edge-specific original-source support;
  runtime validates under the existing atomic knowledge owner. Claim and edge
  proof remain independent; no strength transfers to endpoints or truth/state.
- One-hop expansion evaluates edge activity/applicability and endpoint evidence
  separately, preserving direct/alternate routes. Reads/graph views never boost
  or promote links. Existing record detail exposes baseline/effective values;
  scope variants retain separate metadata and share one display line.
- Knowledge schema 4 adds metadata/receipts/audit transactionally, preserves L2
  baselines and legacy untracked links, and rejects incompatible older writers.
  Settings format 4 reads earlier formats and preserves association policy on
  older-client saves. No new model call, ranking, recursion or background job.
- Verification: typecheck/build passed; core 521/521; membership 4/4; GUI 116/116,
  without failures/skips. Ten L3 groups in
  `test/knowledge-model/association-lifecycle.test.ts` cover exact directed/scope
  identity, day-45 boundaries, independent source proof, cap/backward clocks,
  same-call proposal resolution, duplicate/cancelled commits, complete rollback,
  receipt failure/retry, concurrent connections and namespace/restart isolation.
  A fixture created by the published L2 store proves DDL/version rollback,
  unchanged namespace baselines, old-store rejection and backup restoration.
- Final necessity and documentation checks passed: frozen specification body and
  charter unchanged, prior immutable records intact, current template restored,
  UTF-8, changed references/anchors/fences, credential patterns and diff checks.
  Archive: `docs/finished/A008-0082_association-lifecycle.md`; handoff:
  `docs/handoffs/A008-0082.md`. Owning model/system/status/semantic-call docs and
  indexes now describe L3. L1-L3 each have their own verification record.
- The owner's d867226 ASCII-logo CSS remains byte-for-byte intact. Pre-existing
  `.grok/` was not read, modified or staged. No live/paid model evaluation,
  physical power-loss test, user-data migration, running-application restart,
  packaged distribution rebuild or deployment was performed. Synthetic judgments
  do not establish live model accuracy; the existing backup/restore procedure
  remains the continuation for any later upgrade of valuable runtime data.

## 2026-09-08 — A008-0081: L2 implemented and published

- Task: A008-0081; operator: Codex; branch: `main`.
- Integrated implementation `e7f4874b9ee4616b7b029f54d0d1ae43b225fea0`
  and handoff `2d151da5f056140a5692f93277c971eae719f5ff`. Published main
  and verified local/remote equality at `2d151da` before this closure entry.
- Implemented accepted P1-P5: per-claim severity, numeric creation policy
  snapshots, operational exponential baselines, lazy activation and independent
  source support for exact-target restatement/extend. Canonical carrier reuse,
  creation-occurrence dedup and atomic occurrence/claim receipts prevent retry
  strengthening. Source attribution and state/history ownership survive.
- Existing SQLite ownership now encloses whole live commits, with rollback and
  stale-connection protection. Schema 3 converts legacy baselines at one time,
  preserves thresholds/pins/unknown historical clocks, and stores receipts.
  Settings format 3 preserves advanced policy through existing-client saves.
- Verification: typecheck/build passed; core 511/511; membership 4/4; GUI 116/116.
  The ten new L2 groups cover fixed clocks, source proof, rollback, duplicate
  creation/receipt, cancellation, concurrent connection delivery and restart,
  legacy migration interruption/retry, the prior published store's actual
  executable rejection and SQLite backup restoration. No failures or skips.
- Final necessity and documentation checks passed: frozen specification body
  and charter unchanged, prior immutable records intact, current-task template
  restored, references/anchors/fences and UTF-8 valid, no credential-pattern
  additions or staged whitespace errors. Existing historical broken references
  remain separately tracked; no new failures were introduced.
- Archive: `docs/finished/A008-0081_evidence-lifecycle.md`; handoff:
  `docs/handoffs/A008-0081.md`. Owning constitution/system/status/semantic-call
  docs and indexes now describe L2. The reviewed specification body is frozen.
- L3 is not activated. No live/paid provider call, physical power-loss test,
  user-data migration, running-application restart, packaged distribution
  rebuild or deployment was performed. Synthetic judgments do not establish
  live model accuracy. Backup/restore before opening valuable existing data is
  documented in the constitution. Pre-existing `.grok/` remains untouched.

## 2026-09-08 — A008-0080: L1 implemented and published

- Task: A008-0080; operator: Codex; branch: `main`.
- Implemented and integrated `ea158bf` plus handoff `3f5adb6`. Pushed main and
  verified remote/local equality at `3f5adb6` before this closure entry.
- `composeChatInvocation` owns one final system message: explicit session base,
  global/invocation configuration and applicable context rule. It selects the
  generic fallback only when explicit configuration is absent. Both runtime
  factories and the CLI preserve explicit/default provenance; an explicit
  default-equivalent --system survives model changes.
- The memory rule now uses ordinary background/trust wording in that same
  message. Envelope serialization, semantic operations, retrieval, lifecycle,
  schemas, runtime settings and dependencies are unchanged. Tool continuations
  retain the captured instruction; raw question/final answer remain the only
  durable dialogue/intake pair. The injected fallback is outgoing context,
  not synthetic history; explicit session-base metadata remains supported.
- Verification: typecheck/build passed; targeted suite 60/60; full core 501/501;
  membership 4/4; GUI 116/116, with no failures or skips. Core tests cover actual
  local host/ACP/engine paths and captured NVIDIA/kie HTTP payloads, including
  settings changes during tool execution and exact Unicode byte boundaries.
- The completed charter maps all A01–A08 to executed evidence. Model obedience
  remains unverified against a live provider. No paid/live provider call,
  package rebuild, deployment or versioned release was performed.
- Documentation review after handoff: 8 changed Markdown files/81 links; no
  new path/anchor/fence errors. Frozen target body and charter, prior immutable
  records, template bytes and scope checks passed. Credential-pattern and diff
  checks passed. The final check includes this journal entry.
- Archive: `docs/finished/A008-0080_coherent-instruction.md`; stable charter:
  `docs/tasks/A008-0080_coherent-instruction.md`; handoff:
  `docs/handoffs/A008-0080.md`. CURRENT_TASK is restored to its template.
- Reviewed target/Ready charter was published at `b9cfe1a` before implementation.
  P1–P6 are accepted through ADR 0035. L2 and L3 remain unactivated and need
  their own bounded task identities/charters, not repeated approval of the same
  frozen policy choices. Existing `.grok/` remains outside this work.
- Signature: Codex.

## 2026-09-08 — A008-0080: reviewed target published and frozen

- Owner confirms specification review and authorizes committing/pushing to main,
  freezing and implementation. Operator: Codex.
- Published the eleven pending preparation commits through `97f36eb`; remote
  main and local main were verified equal. Published task identity `2f2275c`.
- ADR 0035 accepts P1–P6 and pins the reviewed specification's unchanged body
  hash. Status/index updates distinguish this target adoption from runtime work.
- `docs/tasks/A008-0080_coherent-instruction.md` freezes L1 only. The CLI's
  earlier generic fallback injection is included because it otherwise loses
  explicit/default provenance before the shared runtime can compose instructions.
- Body-hash, current-task template and diff checks passed. No product code or
  stored policy changed in this freeze. L2/L3 remain unactivated.
- Earlier journals/archives stay immutable. Existing `.grok/` remains unrelated,
  untracked and unmodified. No paid/live call or release is authorized here.
- Next: implement and verify the frozen L1 charter on its task branch.
- Signature: Codex.

## 2026-09-08 — A008-0079: instruction and memory specification

- Task: A008-0079; operator: Codex; branch: `main`.
- Owner request: turn the supplied instruction-plane, severity, reinforcement,
  decay and relationship-strength brief into a clear implementation
  specification. The owner explicitly requested concrete defaults for decision.
- Integrated the completed branch locally at `35f73a4`, including specification
  `ad84f20` and its handoff. No push or product implementation was performed.
- `docs/backlog/instruction-plane-and-memory-lifecycle.md` owns the Proposed
  specification: 22 requirement groups, 30 future acceptance cases and three
  bounded slices. L1 fixes final system-message composition through existing
  shared owners; L2 handles evidence lifecycle; L3 handles independent edges.
  Scope accumulation, additive context, truth/state ownership and budgets are
  preserved. L1 does not depend on lifecycle policy decisions.
- Six explicit proposed decisions cover severity carriers, numeric defaults,
  fresh source/exact target/atomic retry receipts, migration, authority
  amendments and the association consumer. Existing authority is not amended.
  Model obedience and lifecycle correctness are not claimed as runtime facts.
- Proposed half-lives are 365/90/14 days for critical/important/minor and
  45 days for edges, with threshold 0.20 on new classified carriers/edges.
  Independent Python calculations confirm crossing times of 847.503754634,
  180, 14 and 45 days; equality remains active. Legacy thresholds and unknown
  clocks have explicit proposed treatment rather than invented historical data.
- Verification: source/requirement review, numeric calculations and ad hoc
  Markdown review passed. After handoff, 7 changed Markdown files and 53 links
  had no new reference/fence errors. Requirement IDs, backlog membership/state,
  frozen charter, template bytes and preservation checks passed.
  `git diff d7c5428 --check` and staged whitespace checks passed; added-text
  credential scan found no matches. Final closure also checks this entry.
- Product files, SYSTEMDOC, accepted ADRs and prior immutable records are
  unchanged. Skipped runtime/typecheck/build/unit/integration/migration and
  live-provider tests: this was specification work. A01–A30 remain future tests.
  Existing untracked `.grok/` was not read, changed or staged.
- Archive: `docs/finished/A008-0079_instruction-memory-spec.md`; handoff:
  `docs/handoffs/A008-0079.md`. CURRENT_TASK is restored from its template.
- Identity was claimed on local main in `a35b544` before Ready `b271be8`.
  Reconcile shared main before a future push; this local claim is unpublished.
- Next implementation: charter L1 when requested. Record P1–P5 before L2 and
  P6 before L3; specification completion does not adopt those recommendations.
- Signature: Codex.

## 2026-09-08 — A008-0078: necessity gate integrated locally

- Task: A008-0078; operator: Codex; branch: `main`.
- Owner request: add the docs-first Necessity Gate to A008 before a specific
  implementation that must not drift. The incoming feature remains unchartered.
- Integrated the completed branch locally at `83d96fe`, including implementation
  `d064180` and its handoff. No remote push was performed.
- The Core Product Contract in `docs/PROJECT_BRIEF.md` owns six stable PC
  clauses grounded in A008's existing decisions. The Necessity Gate in
  `docs/TASK_WORKFLOW.md` requires exact authority, observable need and omission
  consequence, smallest sufficient approach and verification. AGENTS,
  contribution guidance and the task template require its use. SYSTEMDOC now
  distinguishes evidence of existing behavior from authority to implement it.
- `docs/adr/0034-product-contract-and-necessity-gate.md` records explicit
  adoption from docs-first continuity protocol commit `c1b7b44`, Apache-2.0.
  Existing retrieval exceptions, budgets, scope behavior, provider boundaries
  and permissions were preserved; no product code or settings changed.
- Verification: twelve A008-specific manual case verdicts agreed with the
  adopted rule. Reference/anchor, fence, membership, whitespace, template-byte,
  frozen-charter and preservation checks passed without new failures;
  `git diff 440bea9 --check` passed. Three pre-existing missing evidence links
  were routed to `docs/backlog/runtime-proof-reference-repair.md`.
- Archive: `docs/finished/A008-0078_necessity-gate.md`; integration handoff:
  `docs/handoffs/A008-0078.md`. Earlier journal entries remain unchanged.
- Identity was claimed on local main at `c1175bc` before Ready. Reconcile with
  shared main before a future push; the claim has no remote visibility yet.
- Not performed: runtime/build/live-provider tests, independent actor testing,
  pilot programme, push, publication or release. This is a required review
  practice, not an automated enforcement or measured drift-prevention claim.
- Handoff: CURRENT_TASK is restored byte-for-byte from the updated template;
  the owner's next specific implementation must supply its own gate arguments.
- Signature: Codex.

## 2026-09-08 — browser iframe frame-ancestors fallback

- Task: A008-0077; operator: Grok; branch: `A008-0077-browser-frame`.
- ChatGPT and NVIDIA Build set `frame-ancestors`; A008 cannot iframe them.
- Host probes CSP/XFO and the pane opens those sites in the system browser
  instead of loading a blank frame.
- Verification: core browser-frame tests, membership, GUI typecheck/116 tests.
- Signature: Grok.

## 2026-09-08 — empty-chat 4D starfield

- Task: A008-0076; operator: Grok; branch: `A008-0076-empty-starfield`.
- Transparent 4D starfield canvas behind the empty conversation only.
- Unmounts on the first message; reduced-motion skips the loop.
- Verification: GUI typecheck and tests. No live provider call.
- Signature: Grok.

## 2026-09-08 — hideable shortcut dock

- Task: A008-0075; operator: Grok; branch: `A008-0075-hide-shortcuts`.
- Empty-chat shortcut chips can be hidden; a Shortcuts control restores them.
- Keyboard shortcuts remain. Header Parameters/Files/Workbench unchanged.
- Verification: GUI typecheck, 109 GUI tests. No live provider call.
- Signature: Grok.

## 2026-09-08 — empty-chat ASCII logo

- Task: A008-0074; operator: Grok; branch: `A008-0074-ascii-logo`.
- Owner ASCII mark on the empty conversation, above the start cards.
- Verification: GUI typecheck, 106 GUI tests, GUI build. No live provider call.
  Interactive browser click-through was not available in this agent session.
- Signature: Grok.

## 2026-09-08 — kie.ai provider for chat and image jobs

- Task: A008-0073; operator: Grok; branch: `A008-0073-kie-provider`.
- Second provider beside NVIDIA: `KIE_API_KEY` / write-only `kieApiKey`,
  OpenAI-compatible chat transport, Market job image poll, curated market list
  in Parameters, dispatch by `chatProvider` / `imageProvider` / profile.provider.
- Video, music, Claude native `/messages`, and GPT `/responses` remain out of
  scope.
- Verification: both typechecks and full `npm test` (485 core, 4 membership,
  105 GUI). No live kie.ai or NVIDIA call. Interactive browser click-through
  was not available in this agent session; DOM tests cover Provider copy.
- Signature: Grok.

## 2026-09-08 — NVIDIA catalog, image generation, start cards and file panel

- Task: A008-0071; operator: Grok; branch: `A008-0071-nvidia-catalog-images`.
- Browse/add NVIDIA Build models; generate images in chat; Provider settings
  for image model/endpoint and a write-only API key; start-view cards; Files panel.
- Verification: full `npm test` pass. No live NVIDIA call.
- Signature: Grok.

## 2026-09-07 — Workbench context, Help catalog and readable memory map

- Task: A008-0070; operator: Grok; branch: `A008-0070-workbench-help-memory-map`.
- Chat workbench is the environment/sources card. Tool catalog moved to Help.
- Empty chat shortcuts open Review, Terminal, Browser, Files and the workbench.
- Memory Relationship Map uses a domain-clustered radial layout and structured inspector.
- Verification: GUI typecheck/build, 100 GUI tests. Interactive browser click-through
  was not available in this agent session; DOM tests cover Help, workbench, shortcuts
  and clustered graph markup.
- Signature: Grok.

## 2026-09-07 — Focused standalone GUI workspace merged

- Task: A008-0069; operator: Codex; branch: `main`.
- Neutral charcoal shell, left navigation, centred chat, optional workbench.
- Verification and archive: `docs/finished/A008-0069-focused-gui.md`.
- Signature: restored 2026-09-07 because the merge journal entry was missing.

## 2026-09-07 — Standalone GUI repository tools merged

- Task: A008-0068; operator: Codex; branch: `main`.
- Native file/Git tools, visible catalog, standalone GUI-host verification.
- Verification and archive: `docs/finished/A008-0068_gui-repository-tools.md`.
- Signature: restored 2026-09-07 because the merge journal entry was missing.

## 2026-09-07 — Engine package and panel integration merged

- Task: A008-0067; operator: Codex; branch: `main`.
- Portable engine, shared sessions, bundled surfaces, approved model tools.
- Verification and archive: `docs/finished/A008-0067_engine-package.md`.
- Signature: restored 2026-09-07 because the merge journal entry was missing.

## 2026-09-07 — Runtime preferences and instructions merged

- Task: A008-0066; operator: Codex; branch: `main`.
- Editable tool limits and persistent instructions; version-2 settings save.
- Verification and archive: `docs/finished/A008-0066_runtime-preferences.md`.
- Signature: restored 2026-09-07 because the merge journal entry was missing.

## 2026-09-07 — GUI session controls integrated locally

- Task: A008-0065; operator: Codex; branch: `main`.
- Fast-forwarded the completed branch at `1c728a3` locally before the owner's
  next requested extension. CLI commands and model parameters reach real ACP
  sessions; generated output budgets are distinct from runtime input limits.
- Verification: 530 test executions, both typechecks, GUI build and desktop/mobile
  browser proof, recorded in `docs/evidence/A008-0065_session-controls-proof.md`.
- Archive and handoff exist; CURRENT_TASK is the empty template. No push or live
  provider call. Signature: Codex.

## 2026-09-06 — Memory diagnostic views integrated locally

- Task: A008-0064; operator: Codex; branch: `main`.
- Integrated the completed memory GUI branch at `1e1872c` by local fast-forward.
- Actual runtime inspection backs overview, relationship graph and knowledge
  manager. Chat and draft survive navigation; no inspection model calls.
- Verification: 521 test executions passed, both typechecks and GUI build passed;
  desktop/mobile browser proof is in `docs/evidence/A008-0064_memory-gui-proof.md`.
- Immutable archive and handoff exist. CURRENT_TASK is the empty template.
- Owner requested the next GUI extension on this result. No remote push or
  live provider call. Signature: Codex.

## 2026-09-05 — The loop closes

- Date: 2026-09-05
- Author: Claude (operator / boss)
- Task: A008-0063
- Branch: `main`
- Identity evidence: claimed on `main` as `3202e19` before the branch existed.
- Origin: the owner's specification, given twice and the second time in full,
  recorded in `docs/backlog/current-scope-retrieval.md` before any of it was
  built — deliberately, because the same requirement had been stated before and
  the implementation had not matched it.
- A008-0060 had made tags and domains real but matching was lexical: a label had
  to appear literally in the question, so "hur fungerar människans minne?" found
  nothing filed under neuroscience because the question does not contain the
  word. That gap is what this closes.
- Verified by running the owner's own worked sequence rather than by describing
  it. Three memory questions widen one scope and find both neuroscience records;
  then "och vad händer när vi sover efter att vi lärt oss något?" — classified
  as sleep science and cognitive science, *neither of which is on the stored
  records* — brings the hippocampus record back anyway, because neuroscience is
  still in the accumulated scope from three turns earlier. Then the Porsche
  question shares no domain, the intersection is empty, and the scope is
  replaced.
- My first run of that sequence was in the wrong order and the last question
  returned nothing. The code was right and the probe was wrong — I had put the
  topic change before the continuity question, so of course the scope had gone.
  Worth recording because the instinct on seeing an empty result is to change
  the code.
- Three things that were not obvious. The *related* halves are the mechanism: a
  classifier returning only the domains a message contains adds nothing a
  substring search could not do. The two semantic calls must share one taxonomy,
  because in the owner's trace retrieval answered in English and extraction in
  Swedish and those sets never intersect however they are normalised — so the
  prompt now carries the store's own vocabulary and asks the model to prefer it.
  And a *related* domain overlapping is enough to hold the discussion, which is
  easy to implement in the stricter, wrong form by accident.
- The ceiling is mine and is marked as mine. The reset fires only on an empty
  intersection, so a discussion that drifts one step at a time overlaps at every
  consecutive pair and never resets; after forty turns the scope matches
  essentially the whole store. Excellent for five turns, quietly useless at
  fifty, and it looks like retrieval got worse rather than like a rule doing what
  it was told. 32 domains, least-recently-reinforced eviction, reported. ADR 0024
  D5 says whose idea it was so it can be removed.
- Verification: `npm test` 426 core, 4 membership, 75 GUI, 0 fail. Fourteen
  mutations, all caught. Three survived a first round and all three were real
  gaps — conversation isolation that only shows when one scope changes another's
  outcome, this turn's own domains reaching the query when the ceiling evicts
  them, and the vocabulary reaching the model at all, which the reader tests
  could never cover because they use a fake classifier.
- Not performed: no live provider call. `current_scope` is in-session and per
  conversation, so a restart starts fresh — awkward for a memory system, called
  out rather than left to be discovered. Every turn now costs one more provider
  call.
- Handoff: the loop the owner drew is now closed end to end — classify, scope,
  retrieve additively across every surface, answer, extract, store. What is worth
  doing next is measuring it against a real conversation rather than a scripted
  one, which needs a live provider call and therefore explicit cost authority.
  Persisting `current_scope` per conversation is the small obvious follow-up.
- Signature: Claude

## 2026-09-05 — An entity has more than one thing said about it

- Date: 2026-09-05
- Author: Claude (operator / boss)
- Task: A008-0062
- Branch: `main`
- Identity evidence: claimed on `main` as `7be97c6` before the branch existed.
- Origin: a live GUI host run — `memory commit failed at proposal 2: UPDATE
  fails when the slot is contested`.
- Reproduced before touching anything, which is the only reason the diagnosis
  held. Three facts stated in one message about one subject: `committed 0 of 3`
  — not two of three, the batch rolled back — `contested slots
  ['attribute:zorro:statement']`, and the next turn failing at its first
  proposal. Three facts stated, all three lost, subject permanently unwritable
  across restarts.
- The cause was a slot registered with `single` cardinality. That encodes "an
  entity has exactly one statement", which is false by construction: the
  analyzer instruction asks for every distinct durable claim, so an entity
  routinely has many. `reconcile` applied the rule correctly and called the
  second true fact a disagreement with the first.
- The relation classifier had returned `new` for all three. Its judgement was
  right and a mechanical cardinality rule overruled it, because the commit read
  `classifierDecision.type === "conflict" || decision.outcome === "conflict"`.
  That is the part worth remembering: the semantic judge was already there and
  was being outvoted by bookkeeping.
- I was also wrong twice on the way to this, and both times the machine
  corrected me. First I assumed the slot came from the first listed entity;
  staging sorts them, so it comes from the alphabetically first, and my initial
  reproduction produced three separate slots and no conflict at all. Then I
  assumed the extraction of an assistant answer would hit it; acceptance
  requires the user to have said it, so nothing reached the state machine.
  Neither would have been caught by reading the code more carefully — only by
  running it.
- Change: `<entity>.statement` is a set. Disagreement is the classifier's
  judgement, which is what ADR 0018 already makes it. D6 is unchanged in
  substance — a conflict is still retained, answerable, and never resolved by
  recency or strength — what changes is who decides there is one. The cost is
  stated rather than buried: a contradiction the classifier misses is no longer
  caught by cardinality, and cardinality was catching real disagreement only by
  accident on this slot.
- Two things the change dragged in. Existing stores carry the old cardinality,
  so `widenToSet` is the one redefinition a slot registry allows: it
  reinterprets no stored binding, and narrowing is refused because it would
  orphan bindings that are legal today. And the two judgements can now disagree,
  where before they almost never did — when only the classifier calls it a
  conflict, `applyConflict` was handed the `change` reconcile had returned and
  threw, turning a genuine contradiction into a crash. My own test caught that
  one.
- Second half: a deterministic refusal no longer takes its batch with it. Split
  by error code rather than by class, because an existing test caught the first
  version treating every `MemoryError` as deterministic — `stale_state` is the
  most retryable failure there is and the checkpoint exists for it.
- Verification: `npm test` 404 core, 4 membership, 75 GUI, 0 fail. The original
  reproduction now reads `committed 3 of 3`, no contested slots, second turn
  clean. Nine mutations, all caught; two survived a first round and both were
  real gaps, including one where the legacy-repair path covered so completely
  for the registration that reverting it changed no test.
- Not performed: a contested slot is still permanent, and marks already in a
  live store stay. That is deliberate — the model says a contested slot must
  never silently resolve itself — and after the fact there is no way to tell a
  false conflict from one the classifier genuinely found. Open question 2 in
  `docs/KNOWLEDGE_MEMORY_MODEL.md` still stands: never automatically, but
  "never" needs a path.
- Handoff: the write path holds now, so the loop can be closed. What remains is
  the owner's retrieval design in `docs/backlog/current-scope-retrieval.md` —
  classify each message into domains and related domains, accumulate them into a
  `current_scope` that resets only on an empty intersection, and seed that
  classifier with the store's own vocabulary so the two provider calls share one
  taxonomy. A008-0060 built the storage and the matching; this is the last piece.
- Signature: Claude

## 2026-09-05 — An error that named the rule and nothing else

- Date: 2026-09-05
- Author: Claude (operator / boss)
- Task: A008-0061
- Branch: `main`
- Identity evidence: claimed on `main` as `05c56e8` before the branch existed.
- Origin: a live GUI host run — `memory staging failed: invalid_response:
  Semantic model assistant content must be strict JSON.` The message named the
  rule and not the length, not the finish reason, not one character of what
  arrived. Three causes need three different responses — a larger budget, an
  unwrapping, or a look at the prompt — and it distinguished none of them.
  `finishReason` already told the first apart and was sitting on the completion,
  unread, because ADR 0012 said the generator ignores it.
- The first version of this fix also pulled the first balanced JSON span out of
  prose, and ADR 0012 had rejected exactly that before I wrote it: recovery
  heuristics can silently reinterpret prose or injected text. The reasoning
  holds and matters more now than when it was written — since A008-0056 the
  analyzer's input can be an uploaded document, a document can contain a JSON
  array, and a model quoting that array back while refusing to extract would
  have had the quote parsed as its answer. Fragment extraction was removed
  before shipping.
- What shipped instead is a split, not an overturn. A fragment is chosen from
  among alternatives inside a larger text; a fence wraps the entire content, so
  unwrapping selects nothing and either yields the exact payload or fails as
  before. ADR 0012 D6 records the distinction and keeps the half that was right.
- The anchoring is the security boundary and not a tidiness detail. An
  unanchored fence pattern would find a fenced block anywhere in the content,
  which is fragment extraction under another name. Mutation testing is what
  established that: removing the anchors changed no test, because the suite had
  a case for prose without a fence and none for prose *around* a fence. The
  property that keeps this recovery honest was untested until it was mutated.
- The diagnostic reports content length, finish reason, and a bounded one-line
  excerpt of the model's own output; when the finish reason is `length` it says
  the answer was cut off and names the setting to raise. Nothing about what is
  parsed or returned changed, so ADR 0012's "finish reason is ignored" is
  narrowed to mean ignored for the result.
- Verification: `npm test` 396 core, 4 membership, 75 GUI, 0 fail. Seven
  mutations, all caught; three survived a first round and all three were real
  gaps in the tests.
- Not performed: no live provider call, so which of the three causes the owner
  actually hit is still unknown. That was the point — the failure is
  self-describing now and the next occurrence will name itself.
- Handoff: worth watching. The semantic call uses whichever model `/model`
  selected, and A008-0055 added models with much larger output budgets and
  reasoning. `enableThinking: false` is sent, but a model that ignores it would
  put reasoning where JSON is expected — which will now appear in the excerpt
  instead of as a bare rule name. If it turns out to be truncation,
  `SEMANTIC_JSON_GENERATION.maxTokens` is 16384 against a provider playground
  that accepts 32768 for the same model.
- Signature: Claude

## 2026-09-05 — The labels existed all along; nothing kept them

- Date: 2026-09-05
- Author: Claude (operator / boss)
- Task: A008-0060
- Branch: `main`
- Identity evidence: claimed on `main` as `12e1e01` before the branch existed.
- Origin: the owner's retrieval design, written down first in
  `docs/backlog/current-scope-retrieval.md` so it could not be arrived at
  differently a third time. This task builds the half that needs no provider
  call.
- Five failures in series, each of which made the next invisible. Nothing was
  stored — no column, no field, no attach. `retrieve()` wrote
  `tags: [...scope.tags]` on every record, so a record's tags were whatever had
  been asked for. `filter()` then compared the query with itself and admitted
  everything while appearing to filter. The planner matched a taxonomy no live
  composition supplies, so its tags and domains were always empty. And
  `live-reader` passed the constant `["local"]` and no domains at all.
- That is why entity labels mattered so much: they were the only retrieval
  signal that varied with the message. It is also why removing
  `tokenize(proposition)` had to wait for this task rather than being an obvious
  quick fix — cleaning them before there was a replacement would have made
  retrieval worse.
- The labels are stored beside the record rather than inside it, the way
  `EvidenceLifecycleStore` already keeps strength and state. A label set is not
  part of what a claim asserts; it is how the claim is found.
- The capability, not the refactor: a label retrieval channel, so a record is
  reachable because it is *about* the subject even when the message names none
  of its entities and shares none of its words. Deliberately not gated on
  retrieval intent, because a subject-area match is orthogonal to whether the
  question is about current state or history, and gating it would disable the
  broader signal for exactly the open-ended questions it exists to serve.
- Two things were found by failing tests rather than by inspection. Removing
  `tokenize` made the state binding unreachable — bindings are reached through a
  slot, which is reached through an entity — and the two-turn runtime test
  started returning a `claim` where it expected `state`. So bindings are now
  reachable through the label channel by the claim that established them.
  And `taskApplies` was a second gate that would have undone the whole thing: it
  requires an associative record to mention one of the message's entities, which
  is right for a relation hop and exactly wrong for a subject-area hit, which is
  by definition a record the message does not name.
- The migration is the part that would have hurt if skipped. Schema 2 adds two
  tables and changes nothing else, but `INSERT OR IGNORE` leaves an existing
  file stamped 1, so a bare version bump would have made the version check
  refuse to open a store that is perfectly readable — turning an additive change
  into a lost memory file. A test builds a version 1 database with the new
  tables dropped, opens it, and asserts it is migrated and usable.
- Verification: `npm test` 391 core, 4 membership, 75 GUI, 0 fail, up from 373.
  End to end against three labelled facts, "Vad säger neurologi om det här?"
  returns the hippocampus record, which shares no word with the question except
  the domain name, and "Vad är huvudstaden i Frankrike?" returns nothing.
- Sixteen mutations, fifteen caught by the case that names them and one rejected
  by the compiler. Four survived the first round and all four were real gaps:
  the `taskApplies` escape only fires when the message has entities and no case
  had both; the unlabelled escape only fires for an associative record and the
  case used a direct one, which short-circuits the gate; the minimum label
  length had no case at all; and removing the utterance attach changed nothing
  because every case found the claim instead. Each got a case.
- Not performed: no provider call was added. The semantic half — classify a
  message into domains and *related* domains, which the message does not
  contain, and accumulate them into a `current_scope` — is the owner's design
  and is still ahead. What exists now is the lexical half plus `vocabulary()`,
  which is what that classifier should be seeded with so the two calls stop
  inventing taxonomies in different languages.
- Also not changed, and recorded rather than quietly fixed: `taskApplies` drops
  an expanded record whose text names none of the message's entities, including
  one reached over a relation hop that has already justified itself. Arguably a
  third gate too many. The test that touches it asserts on the omission reason
  rather than on admission, so it isolates the gate it is about.
- Handoff: `channelCounts.tag` and `channelCounts.domain` were hardcoded to zero
  because nothing could set them; they count now, which makes the next task's
  behaviour observable from the first run.
- Signature: Claude

## 2026-09-05 — Twenty-seven facts thrown away over one word

- Date: 2026-09-05
- Author: Claude (operator / boss)
- Task: A008-0059
- Branch: `main`
- Identity evidence: claimed on `main` as `85d7782` before the branch existed.
- Origin: the owner walked the intended retrieve/extract loop by hand and pasted
  a real analyzer output — twenty-seven proposals, every one carrying
  `"confidence": "high"`. A008 would have stored none of them.
- The analyzer instruction names `confidence` and never says it must be a
  number. The parser coerced anything non-numeric to `NaN` and threw, and
  A008-0050's per-item resilience then skipped the proposal. That resilience is
  correct for a bad item and exactly wrong here: the item was fine. The
  proposition, kind, tags, domains and entities had all been read correctly and
  were discarded over a metadata field.
- Reproduced before touching anything, two proposals differing only in that
  field: accepted 1, skipped 1, `"proposal 1 confidence must be a finite number
  between 0 and 1"`. An extraction where every item says "high" — which is what
  a model asked for confidence usually writes — stored nothing, and reported it
  as a skip rather than as a failure.
- Change: `parseProposalConfidence` reads a number as a number, an ordinal word
  from a fixed vocabulary, or a quoted number as the number it plainly is.
  Case, spacing and `_`/`-` are normalised. Anything else is still refused by
  name, listing the vocabulary, because leniency has to stop somewhere or an
  unreadable value becomes a guess.
- The judgement is worth stating rather than hiding in a table: turning "high"
  into 0.85 is lossy and the values are chosen, not measured. It is a far
  smaller loss than the alternative, which was not a more precise number but
  silence.
- Verification: `npm test` 373 core, 4 membership, 75 GUI, 0 fail. Seven
  mutations, six caught by the case that names them; the seventh could not be
  compiled, because disabling the string branch narrows the type until the body
  is unreachable and `tsc` refuses it.
- Not performed: the instruction still does not say what `confidence` is. The
  parser is now robust to the drift, which is the right place for robustness — a
  model writes words whatever the prompt says — but a one-line addition would
  stop inviting the ambiguity. `POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` is
  owner-authored under A008-0047 and was not edited.
- Second finding, recorded and not fixed here because it is not a parser
  problem. In the owner's trace the retrieval step returned domains and tags in
  English and the extraction step returned them in Swedish. Literal matching
  between `"Cognitive Science"` and `"kognitivvetenskap"` finds nothing, and no
  amount of string normalisation closes that. The design that avoids it is to
  hand the retrieval-scope call the vocabulary the store actually holds, so the
  model selects from existing labels and may extend them rather than inventing a
  parallel taxonomy in whichever language the question happened to use.
- Handoff: the owner's design for retrieval is now explicit and is two tasks.
  Store tags and domains on knowledge records — the analyzer already produces
  them and `live-commit` drops them, and `sqlite-schema.ts` has no column for
  either. Then a retrieval-scope provider call in front of the read, which
  expands a message into domains and related tags, seeded with the store's own
  vocabulary. Removing `tokenize(proposition)` from `Entity.labels` belongs with
  the first, not before it: entities are the only retrieval signal that varies
  with the message today.
- Signature: Claude

## 2026-09-04 — One surface was hiding the other six

- Date: 2026-09-04
- Author: Claude (operator / boss)
- Task: A008-0058
- Branch: `main`
- Identity evidence: claimed on `main` as `4f7b94e` before the branch existed.
- Origin: the owner reported a question about the agent's own name answered with
  an unrelated fact about a horse, and restated a requirement they had given
  before: everything that matches should be sent along.
- The requirement was not met. `payloadItems()` pushed state and returned if it
  had any, pushed claims and returned if it had any, then pushed utterances. The
  retrieval path had found and admitted both records in the reported failure;
  the projection kept the state binding and discarded the utterance, not for
  relevance but because state came first in the function.
- Worse, and not in the report: `ProjectionPayload` carries seven surfaces and
  that function read three. `history`, `events`, `artifacts` and `provenance`
  could not reach a model under any circumstances, in any conversation, ever.
- Nothing was ever decided here. No ADR, charter or comment says state outranks
  claims. It arrived in `030def6` as an early-return written for the first case
  that had data in it, and became policy by sitting there for ten tasks.
- The reason it survived is the part worth keeping. `live-reader.ts` appeared in
  no test file. It is the single function that decides what the model sees every
  turn. `project()` builds all seven surfaces correctly and is tested; the loss
  happened one step later, in the step nobody tested. Same shape as A008-0040's
  twenty unrun cases and A008-0057's list: the failure was not a broken thing,
  it was an unwatched thing.
- Change: `projection-items.ts` owns the rule now — collect every surface,
  deduplicate, rank, budget, and report all three reasons a record can be
  missing. ADR 0023 states it as the sentence an implementer has to break to get
  this wrong again: the presence of a record on one surface must not remove a
  record on another.
- Two deliberate limits on the additivity. Deduplication is the single exception,
  because a binding, its claim and the utterance behind it really do say the same
  words and three copies read to a model as emphasis. And a byte budget was
  required rather than optional: going additive multiplies what reaches one turn,
  and shipping without a bound would have traded a silent omission for a silent
  overflow. Everything it cuts is named, and one item larger than the whole
  budget is still sent, because an empty projection is not a smaller answer.
- The first regression fixture passed for the wrong reason and that was the most
  useful thing that happened. Built with honest entity labels — `["Zorros
  häst", "Fresca"]` — the state binding was never retrieved at all, so there was
  nothing to suppress. The live store does not have honest labels:
  `live-commit.ts` writes `...tokenize(proposition)` into `Entity.labels` and
  `tokenize` keeps every word of four characters or more, so `heter` is an alias
  of the horse. The fixture now uses exactly those labels and reproduces the
  reported failure end to end, `scope: ["heter"]` and all. That defect belongs
  to the next task and is preserved here on purpose: a gate armed with a case
  that cannot fire proves nothing.
- Two existing tests asserted `selectedKnowledgeIds.length === 1` and were
  rewritten rather than left green. They had codified the exclusive rule without
  naming it. Both now assert two items — the extracted proposition first as
  `state`, then the sentence the user said it in as `utterance` — which the old
  assertion could not distinguish from "one surface won".
- Verification: `npm test` 370 core, 4 membership, 75 GUI, 0 fail, 0 skipped.
  Fourteen new cases, the first `live-reader.ts` has ever had. Thirteen
  mutations, all caught; restoring the original bug fails seven of them.
- Not performed: no live provider call. Domain and scope matching is not
  delivered, and ADR 0023 D5 records why it is not a matter of effort — A008
  does not store tags or domains on knowledge records at all. The analyzer
  extracts them, staging carries them, the classifier reads them, and
  `live-commit` drops them; `sqlite-schema.ts` has no column for either.
  Everything downstream that looks like tag matching is inert as a result:
  `retrieve()` copies the query's tags onto each record, so `filter()` compares
  the query against itself and admits everything.
- Handoff: A008-0059 is stored tags and domains, plus removing
  `tokenize(proposition)` from `Entity.labels`. Those two belong together —
  entities are the only retrieval signal that varies with the message today, so
  cleaning the labels before the tag axis works would make retrieval worse, not
  better. One thing that may shorten it: `SqliteMemoryRepository`, the other
  repository, already has FTS5 over tags and scopes and indexed entities and
  domains. A008-0028 cut the runtime over to the knowledge path and left that
  machinery behind.
- Signature: Claude

## 2026-09-04 — The list that could forget

- Date: 2026-09-04
- Author: Claude (operator / boss)
- Task: A008-0057
- Branch: `main`
- Identity evidence: claimed on `main` as `ac4caa8` before the branch existed.
- Origin: owner instruction to work the backlog; `discovery-based-core-suite.md`
  had been open since A008-0040. A008-0056 made it immediate rather than
  historical — adding a test file meant hand-editing the `test:core` line again,
  and the only thing between a forgotten edit and thirty unrun cases was
  remembering.
- The defect class is worth naming precisely, because it is not "a test broke".
  A008-0040 found two files missing from the list. Twenty cases had never run.
  Both passed the moment they were executed, so nothing was broken and nothing
  ever would have looked wrong: the suite just reported a smaller number.
- Took the backlog's option 3 and left options 1 and 2 unbuilt, for the reason
  the item itself had already worked out. `npm run build` does not clean
  `dist/`, so globbing compiled output would keep running JavaScript whose
  TypeScript source had been deleted. A green result that corresponds to no
  source is worse than the silence being fixed. Naming the files keeps a stale
  artifact unreachable and keeps `test:core` something a person can read; what
  was missing was not discovery, it was noticing.
- `test/core-suite-membership.test.ts` reads the script out of `package.json`,
  walks `test/**/*.test.ts`, and fails naming any file the list does not run. It
  fails the other direction too — an entry whose source is gone — so a rename
  reports the reason instead of a module-resolution error.
- It runs twice on purpose, and that is the part worth remembering. A membership
  check that runs only as a member of the list it checks can be disabled by the
  exact edit it exists to catch. So it is in `test:core` like any other file and
  `npm test` also invokes it by name through `test:membership`. One of its four
  cases asserts that arrangement, so quietly dropping the named step fails too.
- Verification: `npm test` 356 core, 4 membership, 75 GUI, 0 fail, 0 skipped.
  Six mutations to `package.json`, each alone and reverted, all caught. The one
  that matters reproduces A008-0040's actual defect — `evidence.test.js` removed
  from the list — and where the suite once reported a smaller count and passed,
  it now fails naming the file.
- Not performed: the list is still hand-maintained. This makes forgetting loud;
  it does not remove the editing. If that ever becomes the real problem, option
  2 is still on the table and the backlog item records what it would have to
  solve first.
- Handoff: `docs/backlog/document-ingest-granularity.md` is the open item that
  matters most now, raised to due by A008-0056. `multiagent-process-layer.md`
  needs an owner decision about installing external software.
  `gui-hardening.md` items 3 and 5 remain, both on a surface ADR 0022 demoted to
  a test harness.
- Signature: Claude

## 2026-09-04 — Documents become readable, and two mutations that survived

- Date: 2026-09-04
- Author: Claude (operator / boss)
- Task: A008-0056
- Branch: `main`
- Identity evidence: claimed on `main` as `757a22e` before the branch existed.
- Origin: owner instruction — finish the upload function, choose a good PDF
  parser. That closed the one question ADR 0020 D8 had reserved: the parser is a
  third-party dependency, and under ADR 0002 imported material is the owner's
  call, not a task's.
- Two candidates were run against the same real document before choosing, not
  compared from memory. `unpdf` is 2.5 MB to `pdfjs-dist`'s 35 MB and returns
  line breaks for free; on a three-page Swedish PDF it produced 7 473 characters
  to pdf.js's 7 475, the same text. The choice was not about capability. It went
  to `pdfjs-dist` because it is Mozilla's own implementation, it is Apache-2.0
  like A008, and the lockfile pins exactly which version of the PDF code is
  present — which a wrapper that vendors its own bundled build cannot say. A
  repository whose subject is provenance should be able to name the parser that
  read a document.
- The costs are real and are in the ADR rather than glossed: 35 MB, an optional
  `@napi-rs/canvas` native binary A008 never loads, and an engine floor that
  moved this package's declared `node` from `>=22.12.0` to `>=22.13.0`. pdf.js
  is imported inside `extract()`, so a CLI turn that uploads nothing loads none
  of it.
- DOCX took no dependency at all. `mammoth` is the obvious choice and brings ten
  transitive packages. A `.docx` is a ZIP of XML parts, `node:zlib` already
  inflates it, and the reader is about two hundred lines. For a repository that
  has kept its runtime inventory at three, that is the cheaper side of the
  trade, and every byte of it is auditable here instead of three levels down a
  tree.
- The ZIP reader paid for itself twice. `media-type.ts` had a comment admitting
  it was lying — every OOXML format is a ZIP, and telling them apart "needs a
  ZIP reader, which this module deliberately does not have", so any ZIP was
  reported as a Word document. A spreadsheet was therefore handed to an
  extractor guaranteed to fail. The part-name prefix decides now.
- Sixteen mutations, each rebuilt and re-run alone. Fourteen were caught by
  exactly the test that names the behaviour. Both survivors were findings.
  A suppression counter in the OOXML scanner turned out to be dead code:
  `w:instrText` and `w:delText` are siblings of `w:t`, never children, and text
  is only captured inside a `w:t`, so the rule that was already there was doing
  the work. It was removed and the comment now says what is true. The stored-
  entry size ceiling had no test at all — the compression-bomb case only
  exercised the deflated path, where zlib enforces the limit; a stored entry
  never passes through zlib. A case was added.
- One of my own comments was wrong and is corrected in the same commit. It
  claimed pdf.js warnings would corrupt the ACP JSON-RPC channel. Checked in a
  child process: pdf.js 6 writes them to stderr, not stdout. Silencing them is
  still right, because that stream is the host's log, but as noise reduction and
  not as protocol correctness. Confident-sounding is not the same as true, and
  the test now asserts both streams are empty either way.
- Two existing tests were rewritten rather than left green. `ingest-source.test.ts`
  had a case named "PDF and DOCX raise a named unsupported error and never fall
  through" — the exact premise this task removes. Left alone it would have kept
  passing against a registry that no longer holds those types, proving nothing.
  It is rearmed with types that are still genuinely unsupported and says so.
- Fixtures are built, not committed. A checked-in `.docx` is a blob a reviewer
  cannot diff. `test/fixtures/documents.ts` writes a real PDF with a computed
  cross-reference table — pdf.js silently rebuilds a broken one, so a faked
  table would prove only that the recovery path works — and a real ZIP with both
  stored and deflated entries.
- Verification: `npm test` 352 core and 75 GUI, 0 fail, 0 skipped, up from 322
  and 75. The end-to-end proof ran through a real GUI host process, a real
  `A008-acp` subprocess and the real memory runtime: 17 of 17, with a real PDF
  and a real Word document each reaching a distinct artifact id and a
  spreadsheet stored under its own media type without extraction. Recorded in
  `docs/evidence/A008-0056_document-extraction-proof.md`.
- The synthetic fixtures prove the contract, not the parser, so the registry was
  also run read-only over the owner's own `acme-promo` folder: seventeen files,
  Swedish and English, sixteen extracted. The one refusal was checked rather
  than assumed — fifteen pages, thirty image XObjects, zero font objects, so
  "probably a scan" is literally true. Five documents exist as both PDF and
  `.docx`, and the two independent extractors agreed within 0.8% on every pair,
  which is the only cross-check available that does not rest on one of the two
  implementations. No document content was copied into this repository.
- Not performed: no live provider call, no OCR, no chunking, no image
  description. Neither new extractor makes a provider call, which is why both
  are in the default registry and the vision describer still is not.
- Handoff: `docs/backlog/document-ingest-granularity.md` is raised from Open to
  now due, and the reason is no longer theoretical. A document is still exactly
  one `Utterance` classified by heuristics written for chat messages, the
  owner's own files run from 1 829 to 16 291 characters, and every file ingested
  from here on is stored at file granularity — re-chunking later means
  re-ingesting. One thing this task settles for it: both extractors already emit
  paragraph-per-line text and agree on where the lines are, so the
  blank-line-separated block is a cheap first answer to its open question 2.
- Signature: Claude

## 2026-09-04 — A wrong model id, and where a model's truth lives

- Date: 2026-09-04
- Author: Claude (operator / boss)
- Task: A008-0054, A008-0055
- Branch: `main`
- Identity evidence: A008-0054 claimed as `9d8bf34`, A008-0055 as `bffd481`,
  both on `main` before either branch existed.
- Origin: the owner asked for six models to be selectable via `/model`, and
  supplied a diagram in which an image goes straight into the provider call when
  the model can take one.
- A008-0054 gave `ModelProfile` the field that difference needs —
  `inputModalities` over `text | image | video | audio`, plus `verifiedOn` — and
  added the omni model. It shipped the omni model wrong. Both the id and the
  output budget came from the model card, which names
  `nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4` at 20480 tokens. The
  Build tab, which is the sample an actual request is copied from, says
  `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` at 65536. Neither error could
  fail a test. Both would have failed a live call.
- The `verifiedOn` field is what makes this worth writing down. It records when
  a value was checked and not what was checked, so a date stamp sat on top of a
  wrong source and made it look verified. The rule the correction establishes:
  for this vendor the Build tab outranks the model card, because the Build tab
  is the request.
- A008-0055 corrects the profile and adds four models, every value read from a
  Build tab: `moonshotai/kimi-k3` (text and image), and text-only
  `deepseek-ai/deepseek-v4-pro-0813`, `meta/muse-glimmer-30b`,
  `poolside/laguna-xs-2.1`. A008-0054 had deliberately left these out rather
  than guess their vendor prefixes, and that caution was right twice over —
  muse-glimmer is `meta`, laguna is `poolside`.
- Modality is read from the sample's payload shape, not from the model's name or
  description. A `content` array carrying `image_url` means the endpoint takes
  an image there. That is how `kimi-k3` turned out to be image-capable, which
  nothing about its name suggests.
- `gemma-4-31b-it` does not exist in the vendor catalogue. The nearest entry is
  `google/diffusiongemma-26b-a4b-it`, a different model. Reported, not
  substituted.
- The owner's blue line remains unbuilt, and now has a named reason.
  `ChatMessage.content` is a `string` by ADR 0020 D6, while the vendor sample
  needs an array of parts. That is a core contract change, not a registry entry;
  it is recorded in `docs/backlog/multimodal-chat-content.md` with the five
  questions it has to answer first. Until then a declared modality records a
  capability A008 cannot use, and the status document says so.
- Verification: `npm run typecheck` clean; `npm test` 322 core and 75 GUI, 0
  fail, 0 skipped. New cases assert the exact-id rule against three near misses
  including the card's NVFP4 name, the image-capable set, and that no profile
  declares a reasoning budget without thinking enabled.
- Not performed: no live provider call. The ids are verified against the
  vendor's own request sample, not against a response, and that is the remaining
  gap — a live call is the only thing that would have caught A008-0054.
- Handoff: A008-0051 and A008-0054 were merged without an archive in
  `docs/finished/`. A008-0054's is written now; A008-0051's is still missing.
- Signature: Claude

## 2026-09-03 — Upload wave 2, and the acceptance trap it uncovered

- Date: 2026-09-03
- Author: Claude (operator / boss)
- Task: A008-0049
- Branch: `main`
- Identity evidence: claimed on `main` as `84f37e3` with a frozen charter.
- Why now: ADR 0020 D7 deferred this on two grounds and A008-0047 removed one —
  the analyzer instruction no longer speaks of a message and an answer, it
  speaks of "the source".
- The charter was wrong, and finding out why was the work. It scoped this as a
  staging-shape change. `KnowledgeEngineCommit` in fact assumes a user turn in
  two hardcoded places: `#ingestOnce` ingests `batch.sourceMessage` as
  `speaker: "user"` with a `turn:` locator, and `accept()` runs
  `user-assertion-v1` over it. `isExplicitUserAssertion` activates a proposal
  when the source message *contains* the proposition, and a document contains
  every proposition extracted from it. Routing a source through that path would
  have accepted an entire uploaded file as though the user had personally stated
  every fact in it, and duplicated the utterance while replacing the provenance
  A008-0040 and A008-0042 exist to get right.
- Change: merged the ADR 0020 D10 amendment and the implementation.
  `StagedKnowledgeBatch` carries an origin; a source puts its locator in
  `sourceMessage`, never its content; the commit path reuses the existing
  utterance; and acceptance is refused on origin alone, independently of
  `sourceMessage`. Two layers, so a mistake in one is not a silent
  data-integrity failure. Extraction is opt-in and off by default.
- Verification: `npm test` 308 core and 75 GUI, 0 fail, 0 skipped; both
  end-to-end proofs unchanged at 13 of 13 and 15 of 15. Mutation-checked:
  content as `sourceMessage`, acceptance applied to sources, and re-ingest each
  fail exactly one case. The acceptance mutation initially passed; it only bites
  because a test deliberately arms the trap, which is the only way to prove that
  layer holds on its own.
- Not performed: no live provider call, no chunking, no host or renderer
  surfacing of the new option.
- Handoff: `POST /v1/upload` cannot yet request extraction — that is the next
  small task. Chunking remains the open question in
  `docs/backlog/document-ingest-granularity.md`.
- Signature: Claude

## 2026-09-03 — Owner adjustments before wave 2

- Date: 2026-09-03
- Author: Claude (operator / boss)
- Task: A008-0046, A008-0047, A008-0048
- Branch: `main`
- Identity evidence: A008-0046 was claimed by the owner on `main`; A008-0047 and
  A008-0048 were claimed as `40afdfd` before either branch was created.
- Origin: owner request, from testing across several models and settings.
- A008-0046: staging ceiling 8 to 128, semantic output budget 1024 to 16384
  tokens. An ordinary factual text produced 49 proposals, so the old ceiling
  discarded more than half of a normal extraction as `budget_exceeded`. The two
  move together because a truncated JSON array is not partial knowledge — it
  fails the strict parse and the whole batch is lost. Flagged to the owner
  before implementing: the ceiling is also a cost dial, since the coordinator
  commits proposals sequentially with one classifier call each, so provider
  calls per answer go from 1 + up to 8 to 1 + up to 128.
- A008-0047: the owner's analyzer instruction, iterated against several models
  from several providers. Two syntactic corrections were needed and were the
  only changes: two array elements were missing trailing commas, making them
  adjacent string literals, and a stray `;` sat inside one string. The wording
  was not touched. The supplied text states the field allow-list twice; that was
  kept deliberately and flagged, because it was presumably present in the
  version the owner measured.
- A008-0048: reported as "chat output does not auto-scroll". The chat pane was
  not at fault — its effect was already correct and fired on every render. It
  wrote `scrollTop` to an element that never overflowed. `.a008-app` declared
  `min-height: 100%`, a floor rather than a cap, so the `1fr` grid row grew to
  fit its content: measured in a browser at 3034px against a 720px viewport,
  with the window scrolling and the transcript's `clientHeight` equal to its
  `scrollHeight`. Fixed with `height: 100%` and `overflow: hidden`. No
  TypeScript changed.
- Verification: `npm test` 300 core and 75 GUI, 0 fail, 0 skipped; root and GUI
  typecheck clean; GUI build clean. Each limit change was mutation-checked:
  restoring either old value fails exactly one case. The scroll fix was measured
  before and after in a real browser against a live host, a real `A008-acp`
  subprocess and a streaming fake provider — transcript `clientHeight` 242
  against `scrollHeight` 2550, pinned at the bottom, document no longer
  overflowing — and the reader-scrolled-up case was checked too: a second answer
  grew the transcript while the view stayed put. Both end-to-end proofs were
  re-run and still pass 15 of 15 and 13 of 13.
- Not performed: no live provider call, no measurement of the new instruction's
  extraction quality, which is the owner's and is not claimed here.
- Known consequence recorded in `docs/CURRENT_STATUS.md`: post-output cost and
  latency rise roughly sixfold at the observed proposal count, and GUI layout
  still has no automated regression guard, because only a browser can prove a
  layout and this repository has no browser test runner.
- Signature: Claude

## 2026-09-03 — Build the document and image upload path

- Date: 2026-09-03
- Author: Claude (operator / boss) with three delegated writing workers
- Task: A008-0041, closing children A008-0042 through A008-0045
- Branch: `main`
- Identity evidence: all five IDs claimed on `main` as `c08dfff`, with ADR 0020
  and frozen charters, before any branch was created.
- Decision: ADR 0020. Uploads are stored by the GUI host and extracted in the
  ACP process over a locator. Three constraints the owner's flow sketch did not
  show drove it: the memory runtime lives in the `A008-acp` subprocess and the
  SQLite adapter is single-process, so the host must not gain one;
  `ChatMessage.content` is a `string`, so image description got its own port
  rather than rippling content blocks through the provider-neutral core; and the
  analyze/classify coordinator takes a dialogue pair, so wave 1 stores evidence
  only rather than running document text through a dialogue-shaped instruction.
- Change: merged PR #16 (A008-0042 `src/ingest/`), PR #19 (A008-0043 runtime and
  ACP method), PR #18 (A008-0044 host route and blob store), and PR #17
  (A008-0045 GUI module), in that order.
- Provenance: extraction is a port so each extractor sets its own. Text lifted
  from a document is `appears_in` and spoken by the uploader; a model's
  description of an image is `derived_from` and spoken by the model. A008-0040
  opened that parameter and this is its first caller.
- Verification: `npm test` 296 core and 72 GUI, 0 fail, 0 skipped; root and GUI
  typecheck clean; GUI build clean; 45 of 45 core test files referenced. The
  A008-0041 definition of done was then proved end to end against a real GUI
  host process, a real `A008-acp` subprocess, the real runtime and the real
  extraction registry: 13 of 13 checks, the first run where
  `_a008/source/ingest` had both a real sender and a real handler. The
  A008-0030 chat proof was re-run and still passes 15 of 15, so the ACP changes
  caused no regression. Recorded in
  `docs/evidence/A008-0041_upload-ingest-proof.md`.
- Corrections made while finishing the workers' output: A008-0045's tests used a
  hand-rolled harness that reported nine assertions as one test, defeating
  A008-0039's runner — rewritten against `node:test`, and the same pattern was
  found already on `main` in `gui/src/terminal/` and `gui/src/settings/`.
  A008-0043's lexical containment gate was untested, because realpath caught
  every case the tests tried; a case whose traversal target does not exist now
  separates them. A008-0043's link-escape test skipped itself, since a file
  symlink needs elevation on Windows, leaving the realpath gate unproven — it
  now uses a directory junction and runs.
- Recovery note: all three wave-2 workers were cut off mid-task by a provider
  session limit, as both previous waves were, and none had committed. The
  operator finished all three from the state they left rather than restarting.
- Not performed: no live provider call, no paid usage, no vision model, no PDF
  or DOCX parser dependency, no browser-level run, no CI, no deployment,
  publication, or release.
- Handoff: two owner decisions now gate the rest. PDF and DOCX extraction needs
  a third-party parser under ADR 0002; live image description needs a
  vision-capable model in the registry plus cost authority. Until either is
  taken, those uploads are stored and reported as not extracted, with the media
  type named, and can be re-extracted from the same locator afterwards.
  Knowledge extraction from uploads is wave 2 and is gated on the granularity
  question in `docs/backlog/document-ingest-granularity.md`.
- Signature: Claude

## 2026-09-02 — Correct the named blocker for document upload

- Date: 2026-09-02
- Author: Claude (operator / boss)
- Task: none; correction and backlog record
- Branch: `main`
- Correction: the previous entry, and the A008-0040 archive and handoff, name
  `ContentKind` as the remaining blocker for a correct upload ingest. That is
  wrong. `ContentKind` is a genre axis, not a medium axis — a PDF containing a
  forecast is a `forecast`, and that it arrived as a file is already carried by
  `Artifact.locator` and by the `relation` parameter A008-0040 added. No enum
  value is needed for "uploaded document". Those three records are immutable, so
  the correction lives in the new backlog entry rather than as an edit.
- Supporting checks: `contentKind` drives exactly one behaviour in `src/` —
  `interpret()` returns an empty proposal unless it is `source_code` — and
  ADR 0018 does not mention the enum, so changing it later needs no amendment.
- Actual finding: `ingest()` creates exactly one `Utterance` from any length of
  content, and `classifySpeech()` decides its act and kind with heuristics
  written for chat messages. Correct for a dialogue turn, wrong for a document.
  `IngestResult.utterances` is already plural; the implementation is not. That
  granularity is the real blocker for uploads, and it is baked into every stored
  record, so it is expensive to change after the fact.
- Change: recorded in `docs/backlog/document-ingest-granularity.md` with the
  open questions that need settling first — where splitting belongs, what the
  unit is, how order is preserved, and whether a non-dialogue caller should be
  required to state the kind rather than have it guessed.
- Owner decision: stop here. `speaker` plus `relation` are sufficient for an
  upload path to be built correctly, and the remaining choices are better made
  against a real consumer.
- Not performed: no code change, no ontology change, no upload or vision path.
- Signature: Claude

## 2026-09-02 — Let a caller name the INGEST provenance relation

- Date: 2026-09-02
- Author: Claude (operator / boss)
- Task: A008-0040
- Branch: `main`
- Identity evidence: claimed on `main` as `4049091` with a frozen charter
  before the branch was created.
- Origin: owner design review of the document and image upload flow. The
  question was how uploads should reach the knowledge store, and whether a
  vision-capable model changes that. It does not — normalising to text is a
  requirement of the store, not a workaround for a model — but the review
  surfaced that `ingest()` hardcoded `relation: "appears_in"`.
- Change: merged PR #15. `IngestInput` takes an optional `relation`, defaulting
  to the exported `DEFAULT_INGEST_RELATION`, validated before `addArtifact` so a
  rejected value cannot leave a partial write.
- Why it matters: `appears_in` is true of the dialogue path and false for
  content produced about an artifact rather than taken from it. A vision
  model's description of an uploaded image never appeared in that image.
  Recording it as `appears_in` would have written a false claim into the
  provenance graph. `derived_from` already existed in the vocabulary; only
  `ingest()` stood between a caller and it.
- Finding: `test/knowledge-model/evidence.test.ts` and `state-history.test.ts`
  were absent from `test:core` and had never run — 20 cases, both passing once
  executed. `evidence.test.ts` is where `ingest()`'s own tests live, so this
  change could not have been honestly verified while it sat outside the gate. A
  sweep confirmed those were the only two; 43 of 43 test files are now
  referenced. This is the same defect class A008-0039 closed for the GUI.
- Verification: `npm run typecheck` clean; `npm test` 266 core and 63 GUI, 0
  fail, exit 0. 266 accounts exactly for the 243 baseline, the 20 restored
  cases, and 3 new ones. Mutation-checked: restoring the hardcoded relation
  fails one case, making the validation unreachable fails one, and both reverts
  return the suite to green.
- Not performed: no live provider call, no CI, no upload or vision path, no
  `ContentKind` change, no deployment, publication, or release.
- Handoff: the root fix for the hand-maintained test list is routed to
  `docs/backlog/discovery-based-core-suite.md`, which weighs three options; it
  is deliberately not a copy of the A008-0039 glob, because `dist/` is not
  cleaned on build and a glob there could keep running a test whose source was
  deleted. The remaining blocker for a correct upload ingest is `ContentKind`:
  no value fits an uploaded document or a model-written image description, and
  `classifySpeech()` picks one on the caller's behalf.
- Signature: Claude

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
