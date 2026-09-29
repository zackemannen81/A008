# Current Status — A008

Granskad: 2026-09-29
Källrevision: `ae118e1` + verifierade A008-0196 task-branch changes (ännu ocommittade).
Senaste arkitekturimplementation: A008-0195 (durable per-session-konfiguration, bilagor och separerade run-resultat).
Senaste minneskontextimplementation: A008-0193 (retrieved labels in worker envelope).
A008-0196 (Complete on task branch; unmerged): opt-in run-local compaction for completed tool interactions in `src/core/chat-session.ts`. Raw messages remain in the run, the recent tail is preserved, continuation state requires cumulative validated source coverage, and provider chronology keeps the current user request ahead of continuation state and recent raw tool rounds. Checkpoint persistence, automatic reduction/budget triggering, and process-loss recovery remain excluded.

## Godkänd riktning

[PROJECT_BRIEF.md](PROJECT_BRIEF.md) och
[ADR 0055](adr/0055-durable-sessions-and-process-ownership.md) anger den aktuella
runtime-grunden: en beständig projektsession äger sin historik och worktree medan
sessionsprocessen är utbytbar. Klienten observerar/styr sessionen men äger inte
dess livstid. ADR:er före 0055 är arkiverade och saknar aktuell beslutsauktoritet.

A008-0191 implementerar process-per-session-grunden för durable registrerade
Git-projekt. [ADR 0056](adr/0056-minimal-memory-context.md) anger den minimala
modellvända minnesprojektionen och är implementerad genom A008-0189.

## Implementerat nuläge

| Område | Aktuellt beteende |
| --- | --- |
| Projekt och sessioner | Durable projekt-sessioner lagras i Platform SQLite. Intern `conversationId` är uttryckligen samma beständiga identitet som produktens `sessionId` på denna yta; varje writable session har egen beständig modell-/genereringskonfiguration. |
| Workspaces | Nya projektsessioner får egen Git-worktree och branch `a008/session-<sessionId>` före körbar publicering. Base branch och faktisk startcommit sparas. Ingen tyst fallback till projekt-roten finns. |
| Sessionsprocesser | Värden äger högst en levande `SessionProcess` per session. Processen är separat OS-process, återanvänds mellan meddelanden och ersätts med nytt `instanceId`/PID efter död eller explicit stopp. |
| Körningar | Flera sessioner kan arbeta parallellt upp till värdens kapacitet; varje session tillåter en aktiv run åt gången. Accepterat arbete fortsätter när GUI byter session/projekt eller kopplas bort. |
| Historik och återanslutning | Historik kan läsas utan processstart. Publik run-aktivitet lagras med cursor/snapshot så klienten kan återansluta utan att skicka senaste kommandot igen eller dubblera sparade event. |
| Verktyg och approvals | GUI-runnern kör verktyg i sessionens workspace-CWD. Pending approvals ägs av sessionsprocessen och kan besvaras av en behörig ansluten klient; disconnect avgör inte beslutet. |
| Crash recovery | Död sessionsprocess raderar inte session/workspace/historik. Nästa nya meddelande kan starta en ny process. Okända tidigare effekter återspelas aldrig automatiskt och kan granskas explicit före beroende writes. |
| Workspace-fel | Saknad/discarded worktree gör runnen failed med `WORKSPACE_MISSING`; den kör aldrig i projekt-roten. |
| Semantiskt minne | Projektets semantiska ägare ligger kvar i värden. Sessionsprocesser begär retrieval/commit över IPC. Workspace-/revisionskontext bevaras för arbetskopiespecifika observationer. |
| Chatthistorik utan memory | Durable historik är separat från semantiskt minne; answer-, minnes- och external-effect-utfall lagras separat och kan rapporteras/återhämtas utan att göra dem till semantic memory. |
| GUI-status | Connection status, sessionsprocess och run-resultat exponeras som separata signaler. |
| Memory-vy | Memory-inspektion binds uttryckligen till valt durable `projectId`; projektbyte återanvänder inte längre den cacheade legacy ACP-bridgens tidigare memory owner. Memory-inspektion startar ingen sessionsprocess. |
| Globala runtime-inställningar | Semantic/Budgets/Instructions läses och sparas genom en host-owned `RuntimePreferencesStore`, oberoende av chat/session-processens livstid och tillgänglig även innan projektet har en chat. |

Verifiering och detaljer finns i [A008-0191-handoff](handoffs/A008-0191.md) och
[SYSTEMDOC.md](SYSTEMDOC.md).

## Minneskontext — A008-0193

Worker och extractor använder samma librarian-valda retrieval-resultat men olika
presentationer. Worker/userMessage-envelope skickar `id`, tillgänglig
`semanticAddress`, postens läsbara `label` samt villkorad `history`/`provenance`.
Extractor behåller `currentState`/`claim`-representationen som behövs för
state updates och reinforcement. Intern metadata skickas inte till workern. Aktuell state prioriteras,
oberoende adresser med samma värde hålls isär och dubbla råyttringar undertrycks.
Specifika taggträffar begränsar breda domänträffar. Befintlig ID-mappning för
förstärkning finns kvar; läsning förstärker inte.

Detaljer finns i [A008-0193-handoff](handoffs/A008-0193.md).

## Observerad operational learning

En live A008-session 2026-09-29 gav agenten en explicit efterhandsfråga om varför
A008-0196 hade varit svår. Svaret identifierade att kodning påbörjades innan
aktuella repo-instruktioner/implementation och exakta task-krav hade verifierats,
vilket ledde till testfel. Den ordinarie post-output-extractorn bevarade detta som
en workspace-kvalificerad active claim med domains för projektledning och
programvaruutveckling.

Det visar att den befintliga knowledge-pipelinen redan kan göra:
`misstag → explicit reflektion → claim → senare retrieval`, utan en separat
reflection-memory-mekanism. Observationen bevisar mekanismen för detta fall; den
gör inte en enskild agents slutsats till universell policy.

## Kvarvarande uttryckliga gränser

- Legacy V1/V2/ACP/standalone-sessioner migreras inte automatiskt till durable
  projektsessioner. Befintliga kompatibilitetsytor finns kvar med egna interna
  identiteter.
- Durable `legacy-unbound` historik kan läsas men får inte köras innan en explicit
  migration binder sessionen till en separat worktree.
- Durable input-/kontrollparitet är inte fullständig mot alla äldre adaptrar;
  bildbilagor stöds nu i durable runs, medan undo och vissa generationskontroller
  fortfarande skiljer sig mellan ytorna.
- Worktree lifecycle gör ingen automatisk merge, push, publicering eller dirty
  delete. Sådana åtgärder är fortsatt uttryckliga.
- Automatisk idle-timeout för en levande sessionsprocess är inte beslutad i ADR
  0055 och införs inte implicit.
- Worktrees är arbetskopieisolering, inte en säkerhetssandbox för fientlig kod.

## Verifiering — A008-0191

Lokala fixtures och implementationstester 2026-09-27, inga live-provideranrop:

- protocol/client package verification: PASS/PASS;
- platform store/workspace/session-process: **10/10 pass**;
- full platform host integration: **13/13 pass**;
- full GUI suite: **215/215 pass**;
- ADR 0055 crash → uncertain effect → replacement process → reviewed effects →
  missing-workspace refusal: PASS;
- `WORKSPACE_MISSING` finns i TypeScript-kontrakt, JSON schemas och OpenAPI.

A008-0191 är därmed implementation/evidence för ADR 0055:s tio acceptanskriterier.
Äldre task-/ADR-texter under historik återaktiveras inte genom sökning eller minne.

## Verifiering — A008-0194

Lokala fixtures 2026-09-28, inga live-provideranrop:

- explicit projektbunden memory-inspektion: PASS;
- host-owned runtime-preferences read/save utan sessionsprocess: PASS;
- fokuserade host memory/settings-tester: **26/26 pass**;
- root + GUI typecheck: PASS/PASS;
- full GUI suite: **216/216 pass**.

Detaljer finns i [A008-0194-handoff](handoffs/A008-0194.md).

## Verifiering — A008-0195

Lokal verifiering mot `cba276a` 2026-09-28, inga live-provideranrop:

- root TypeScript build: **PASS**;
- fokuserade Platform/session/memory-tester: **24/24 pass**;
- durable GUI-klienttester: **6/6 pass**;
- durable session configuration, image run-input och separata
  answer-/memory-/effect-utfall finns i schema/runtime-kontrakten.


## Verification — A008-0196

Final local verification 2026-09-29, no live-provider calls:

- root `npm run typecheck --silent`: **PASS**;
- root `npm run build --silent`: **PASS**;
- continuation + existing ChatSession regressions: **17/17 PASS**;
- core-suite membership: **4/4 PASS**;
- 100 completed tool interactions project one bounded continuation state plus the configured raw tail;
- provider ordering, cumulative prior-state/source preservation, invalid replacement and unfinished-batch behavior have dedicated regressions;
- `git diff --check`: **PASS**;
- canonical checkout dependencies were exposed to the worktree only through a temporary local junction; no packages were installed and no dependency versions changed;
- no live provider calls; **0 SEK**.
