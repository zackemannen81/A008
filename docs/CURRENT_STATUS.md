# Current Status — A008

Granskad: 2026-09-27
Källrevision: `d80663e` + A008-0191 closure-docs.
Senaste arkitekturimplementation: A008-0191 (ADR 0055 durable session processes).
Senaste minneskontextimplementation: A008-0189 (ADR 0056 minimal memory context).

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
| Projekt och sessioner | Durable projekt-sessioner lagras i Platform SQLite. Intern `conversationId` är uttryckligen samma beständiga identitet som produktens `sessionId` på denna yta. |
| Workspaces | Nya projektsessioner får egen Git-worktree och branch `a008/session-<sessionId>` före körbar publicering. Base branch och faktisk startcommit sparas. Ingen tyst fallback till projekt-roten finns. |
| Sessionsprocesser | Värden äger högst en levande `SessionProcess` per session. Processen är separat OS-process, återanvänds mellan meddelanden och ersätts med nytt `instanceId`/PID efter död eller explicit stopp. |
| Körningar | En aktiv run per session; olika sessioner kan arbeta parallellt. Accepterat arbete fortsätter när GUI byter session/projekt eller kopplas bort. |
| Historik och återanslutning | Historik kan läsas utan processstart. Publik run-aktivitet lagras med cursor/snapshot så klienten kan återansluta utan att skicka senaste kommandot igen eller dubblera sparade event. |
| Verktyg och approvals | GUI-runnern kör verktyg i sessionens workspace-CWD. Pending approvals ägs av sessionsprocessen och kan besvaras av en behörig ansluten klient; disconnect avgör inte beslutet. |
| Crash recovery | Död sessionsprocess raderar inte session/workspace/historik. Nästa nya meddelande kan starta en ny process. Okända tidigare effekter återspelas aldrig automatiskt och kan granskas explicit före beroende writes. |
| Workspace-fel | Saknad/discarded worktree gör runnen failed med `WORKSPACE_MISSING`; den kör aldrig i projekt-roten. |
| Semantiskt minne | Projektets semantiska ägare ligger kvar i värden. Sessionsprocesser begär retrieval/commit över IPC. Workspace-/revisionskontext bevaras för arbetskopiespecifika observationer. |
| Chatthistorik utan memory | Durable historik är separat från semantiskt minne och kan läsas utan att projektets memory-runtime öppnas. |
| GUI-status | Connection status, sessionsprocess och run-resultat exponeras som separata signaler. |

Verifiering och detaljer finns i [A008-0191-handoff](handoffs/A008-0191.md) och
[SYSTEMDOC.md](SYSTEMDOC.md).

## Minneskontext — A008-0189

Worker och extractor använder samma librarian-valda retrieval-resultat men olika
presentationer. Worker/userMessage-envelope skickar `id`, tillgänglig
`semanticAddress`, postens läsbara `label` samt villkorad `history`/`provenance`.
Extractor behåller `currentState`/`claim`-representationen som behövs för
state updates och reinforcement. Intern metadata skickas inte till workern. Aktuell state prioriteras,
oberoende adresser med samma värde hålls isär och dubbla råyttringar undertrycks.
Specifika taggträffar begränsar breda domänträffar. Befintlig ID-mappning för
förstärkning finns kvar; läsning förstärker inte.

Detaljer finns i [A008-0189-handoff](handoffs/A008-0189.md).

## Kvarvarande uttryckliga gränser

- Legacy V1/V2/ACP/standalone-sessioner migreras inte automatiskt till durable
  projektsessioner. Befintliga kompatibilitetsytor finns kvar med egna interna
  identiteter.
- Durable `legacy-unbound` historik kan läsas men får inte köras innan en explicit
  migration binder sessionen till en separat worktree.
- Durable input-/kontrollparitet är inte fullständig mot alla äldre adaptrar;
  bildbilagor, undo och vissa generationskontroller är fortfarande olika mellan
  ytorna.
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
