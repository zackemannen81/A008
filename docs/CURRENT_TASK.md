# Current Task

Task ID: A008-0213
Parent Task: None
Status: In Progress
Owner: Rickard / A008
Created: 2026-10-05
Last updated: 2026-10-05
Charter frozen at: 2026-10-05

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant accepted top-level records under `docs/adr/`; never use `docs/adr/_legacy/` as current authority

## Task Summary

Under långa autonoma körningar lägger agenten onödig kognitiv kapacitet (och tokenbudget) på att återskapa och ompröva arbetsflödesstatus och låsta beslut (exempelvis gällande task-ID och worktree-strategi). Den befintliga `RunContinuationState` innehåller redan den underliggande informationen, men den injiceras inte tillräckligt tydligt som strukturella, låsta direktiv i worker-kontexten. Denna uppgift syftar till att projicera existerande state till en minimal, läsbar representation i agentens kontext för att eliminera upprepad planering.

## Task Charter

### Goal

Ge workern en kompakt, uppdaterad projektion av exekveringstillståndet vid varje verktygssteg, så den inte behöver återskapa redan verifierad körningsstatus eller ompröva beslut som runtime uttryckligen låst.

### Primary Deliverable

En liten, strukturerad och run-local execution-state-projektion i varje worker/provider request i en aktiv verktygskörning. Projektionen utgår från existerande `RunContinuationState`, kompletteras bara med runtime-auktoritativt underlag och markerar uttryckligen `DO NOT RE-EVALUATE` för låsta beslut. Det inför inte ett nytt minnessystem eller enbart en generell promptuppmaning.

### In Scope

- Utöka och/eller projicera befintligt continuation state med begränsad arbetsstatus: `objective`, `current_phase`, `current_step`, `completed_steps`, `blocked_by` och `next_action`, där endast värden som stöds av run-input, verktygsresultat eller verifierad continuation får presenteras som fakta.
- Representera `locked_decisions` kompakt med stabil nyckel, värde och explicit låsningsstatus. Låsta beslut måste komma från explicit runtime-/operatörsauktoritativt underlag; reducerade modellförslag eller osourcade slutsatser får inte skapa eller ändra lås.
- Rendera ett litet, avgränsat exekveringsblock med tydliga `LOCKED` / `DO NOT RE-EVALUATE` och `NEXT` delar i worker-kontexten vid verktygsrundor, myös efter state-uppdatering och giltig checkpoint recovery.
- Hålla state till aktuell körning och oförändrad continuation-checkpoint-/recovery-säkerhet, proveniens och storleksbudget.
- Lägga till deterministiska tester för projection, uppdatering mellan tool rounds, låsauktoritet, saknat/osäkert state, storleksgräns och checkpoint/recovery där relevant.

### Out of Scope

- Nytt minnes-, historik-, databas- eller retrievalsystem; ändring av semantic-memory engine eller semantisk kunskapspipeline.
- Decision repetition rate, reorientation metrics, automatisk logganalys eller schemalagda 1/2/4-timmarsutvärderingar; effekt följs upp manuellt genom observation av faktiska körningar.
- Enbart längre promptinstruktioner av typen “don't repeat yourself”, eller fri modellgenererad auktoritet för låsta beslut.
- Persistens utöver existerande run-local continuation/checkpoint livscykel, verktygsreplay, ändrad recovery-auktoritet, förändrad approval/workspace/task-allokering eller annan produkt/worktree-policy.
- Live-providerbenchmark som acceptanskrav.

### Definition of Done

- Varje relevant worker/provider request vid en aktiv verktygskörning får en liten aktuell exekveringsprojektion utan att den skrivs till committed chat history eller semantic memory.
- Projektionen innehåller de tillgängliga och verifierbara fälten för objective/fas/steg/avklarat/nästa/blockerare; okända värden utelämnas eller markeras explicit som okända, aldrig fabricerade.
- Endast explicit runtime-auktoritativa låsta beslut visas under `DO NOT RE-EVALUATE`. De behålls oförändrade genom vanliga state-uppdateringar och checkpoint recovery; modellens continuation reducer kan inte låsa, låsa upp eller ändra dem.
- Projektionen är kompakt, byte-bunden och testad vid gränsfall. Ogiltigt, överstort eller osäkert state blockeras eller utelämnas enligt befintliga fail-closed continuation-regler utan att dispatcha ett felaktigt block.
- Befintlig verktygs-/approval-/workspace-/run- och recovery-semantik är oförändrad; ingen verktygsreplay eller semantiskt minne introduceras.
- Relevant fokuserad testsvit, root typecheck/build och `git diff --check` passerar. Manuell observation av en faktisk arbetssession kan därefter utvärdera om upprepningen minskat; ingen viss förbättring hävdas utan observation.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `e407cfa990c7bcfd90f22f7faaeaefc26dd68f71` (approved clause text unchanged at `origin/main` `d8ada470696d353bc34ac60403384918208b3075`)

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Run-local state projection | PC-LF-03: A008 äger state och kontextkonstruktion; exekveringsmetadata är inte semantiskt minne. Befintligt A008-0196–0199 continuation/checkpoint-kontrakt och dess proveniens-/recovery-gränser. | Worker får inte runtime-känt och verifierat exekveringsläge strukturellt i nästa request; måste återskapa det ur historik och riskerar upprepad planering eller motsägelsefull fortsättning. | Härled ett kompakt block per provider/tool request ur befintlig run-local state och auktoritativa runtime inputs; håll det borta från committed history och semantic memory. | Fokuserade ChatSession-/continuation-tester verifierar uppdaterad payload per runda, run-isolering och oförändrad committed history. |
| Auktoritativa låsta beslut | PC-LF-03/04: A008 äger runtime-state/kontext och modell/provider är exekveringsmotor; behörighet och semantisk policy ägs av A008. | Utan uttryckligt, runtime-auktoritativt lås kan workern fortsätta ompröva kända beslut; om modellen får skapa lås kan ogrundade eller injicerade värden bli felaktiga direktiv. | Validerad, separat låslista som ägs av runtime/operator; reducerade/modelgenererade data får aldrig skapa eller mutera den. Om ingen auktoritativ input finns, projicera inget lås. | Tester bevisar att lås visas exakt, bevaras genom reducer/recovery och inte kan ändras av modell-output eller osäker user/tool text. |
| Säker kompakt projektion över tool rounds och recovery | PC-LF-03/04 samt PC-LF-05/06: local state och workspace/session-identitet är auktoritativa; recovery får inte återspela tools och fel workspace får inte användas. A008-0196–0199:s byte/proveniens/fence-regler. | Utan round-trip/recovery-test kan blocket försvinna, bli inaktuellt, överskrida requestbudget eller felaktigt uppfattas som verktygsinstruktion/semantiskt minne. | Återanvänd existing validator/checkpoint pipeline och lägg projektion i den existerande worker request pathen med explicit compact schema och byte-bound. Ändra inte replay eller approval semantics. | Fokuserade testfall för bytegräns, okända fält, nästa tool request samt giltig recovery; root typecheck/build och diff review. |

### Minimum Verification Gates

- [ ] Fokuserade unit-/integrationstester täcker projection-fält, tool-round update, run isolation, trusted locked-decision authority och prevention av model/tool/user-originated lock mutation.
- [ ] Testa bounded serialization, unknown/unavailable values och felaktigt state; no unsafe projection reaches provider dispatch.
- [ ] Testa checkpoint/recovery path eller dokumentera med specifika skäl varför befintlig recovery contract test already proves the exact integration boundary.
- [ ] Kör root typecheck/build samt `git diff --check`; kör relevanta focused tests.
- [ ] Granska faktiskt provider-request fixture/logg utan live provider, och verifiera att state inte hamnar i committed history/semantic memory. Effektevaluering sker manuellt senare och är inte ett completion gate.

### Verification Budget

- Live verification purpose / required provider behavior: Not needed (Manuell utvärdering av lokala loggar)
- Budget owner / parent allocation: n/a
- Policy revision / inherited or explicit approved limits: n/a
- max_live_verification_cost (amount + currency): 0
- max_live_verification_calls (all physical attempts): 0
- max_input_tokens_per_call / max_output_tokens_per_call: 0
- live_call_timeout_seconds: 0
- Approved provider/model routes / credential-source references: n/a
- Price reference and checked-at / billing units / currency conversion / allowance: n/a
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0
- Worker allocations or serialized dispatch; resume retains prior usage: n/a

## References

- `docs/PROJECT_BRIEF.md` clauses PC-LF-03 and PC-LF-04; contract revision `e407cfa990c7bcfd90f22f7faaeaefc26dd68f71`, verified clause content at `origin/main` `d8ada470696d353bc34ac60403384918208b3075`.
- `docs/SYSTEMDOC.md`, sections “Run-local continuation context — A008-0196”, “Durable run-continuation checkpoints — A008-0197”, “Automatic live-turn context pressure — A008-0198” and “Interrupted-turn recovery — A008-0199”.
- `src/core/chat-continuation.ts`, `src/core/chat-session.ts`, `src/tools/acp-tools.ts`, `src/engine/engine-host.ts`.
- A008-0213 identity claim: `origin/main:docs/TASK_IDS.md`, commit `d8ada470696d353bc34ac60403384918208b3075`.

## Checklist

- [x] Trace complete continuation flow from durable recovery bridge through ACP/EngineHost into ChatSession and identify canonical runtime source for objective/phase/step and decision locks.
- [x] Extend run-local state/bridge contract minimally, preserving existing reducer/source references, validators, byte caps and semantic-memory isolation.
- [x] Add projection serializer/formatter with compact structured shape, unknown omission semantics and explicit `DO NOT RE-EVALUATE` for trusted locks only.
- [x] Inject/recompute the projection into durable GUI provider requests after each tool round and on recovery rebuild, without changing canonical chat history.
- [x] Add deterministic tests for projection fields, update per round, lock schema/duplication and byte limit, committed-history isolation, checkpointed-action recovery, and existing continuation semantics.
- [x] Add/complete an end-to-end durable session-process test proving coordinator-owned workspace locks reach provider requests across actual child-process IPC and recovery (`test/platform-host.test.ts`, real A008-0199 110-round process replacement scenario).
- [x] Update SYSTEMDOC/CURRENT_STATUS with final implemented behavior and verified evidence; avoid recording unintegrated behavior as merged.
- [x] Run focused tests, root typecheck/build and diff review; prepare handoff/archive at completion.

## Decisions and Notes

- No new memory or history system; use the existing run-local execution request path and continuation/checkpoint ownership only.
- No automated metrics, repeat-detection, logging programme, or mandatory timed observation. Rickard will evaluate cognitive effects manually during ordinary execution.
- A model-generated reducer summary is untrusted with respect to authority: it may not create, alter, unlock or elevate a locked decision. Only explicit runtime/operator-owned data may populate `locked_decisions`.
- Missing runtime-authoritative task/worktree facts are omitted; the projection must never guess values or infer that a plan is already locked. Durable GUI runs lock verified workspace identity/mode/path and available branch/base commit; product task ID is omitted because PlatformRun has no authoritative charter-ID binding.
- The objective is the accepted run text. Current phase is runtime-supplied (implementation/recovery); current step and next action advance from observed completed tool outcomes, not model-introspected chain-of-thought.
- Continue-existing safety rules: checkpoint data is not replay authority, unknown external effects remain fenced, and semantic memory is not a destination for execution metadata.
- **Local completion (2026-10-09):** implemented the run-local provider projection and fixed the pressure-enabled durable GUI branch that omitted it. The 110-round child-process recovery/provider-request test, focused continuation suites, root typecheck/build and diff hygiene pass; no live provider calls. Archive and handoff are written in this worktree; integration to `main` remains pending. Manual efficacy observation is optional operator follow-up.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against the necessity arguments and the frozen scope: projection is optional per run, only durable GUI composition supplies it, lock source is the coordinator-verified workspace record, and no task-ID is guessed.
- [x] `npm run typecheck -- --pretty false` — PASS.
- [x] `npm run build -- --pretty false` — PASS.
- [x] `node --test dist/test/chat-session.test.js dist/test/chat-continuation.test.js dist/test/chat-continuation-pressure.test.js` — PASS (all tests in the three suites).
- [x] `node --test --test-reporter=tap --test-name-pattern="A008-0199 real process checkpoint recovery: continue-110-rounds" dist/test/platform-host.test.js` — PASS; real durable GUI host/session child, 110 tool rounds, process replacement after round 55, coordinator-owned workspace locks present and unchanged in actual provider requests before/after recovery, run identity/tool history preserved and no tool replay. The recovery request has `current_phase: recovery` with checkpoint-derived completed steps.
- [x] `git diff --check` — PASS; `node --check test/platform-host.test.ts` — PASS.
- [ ] Manual observation in ordinary model-backed execution — not run; operator follow-up, not an automated gate.
- Skipped: full platform-host suite and live provider checks; no live provider calls were required or run.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md` — task-scoped implementation/evidence note added in this worktree; awaiting integration.
- [x] `docs/SYSTEMDOC.md` — task-scoped implementation/evidence note added in this worktree; awaiting integration.
- [ ] `docs/JOURNAL.md` — operator appends the integration record on merge per workflow.
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Implementation and local verification complete in the session worktree; final archive and handoff written. Awaiting review/integration to `main`; task implementation and A008-0213 charter are frozen.
- Next recommended step: operator reviews the path-scoped diff, integrates the implementation and documentation according to repository workflow, restores/activates the appropriate task on main, then proceeds with A008-0214's supersede process.
- Blockers: None for A008-0213's automated DoD. Full platform-host suite and optional manual efficacy observation were not run; the required real 110-round durable process/recovery integration was run and passed. No live-provider verification was required.
- Child tasks: None currently required.
- Resume condition: integration review of this A008-0213 worktree; no further implementation is pending in scope.
- Open questions: Manual efficacy observation remains operator follow-up and is not a completion gate.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task. template: template_CURRENT_TASK.md
- Append a signed `docs/JOURNAL.md` entry.