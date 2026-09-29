# System Document — aktuell implementation

Granskad: 2026-09-28; A008-0195 utökar durable GUI/runtime med per-session-konfiguration, bilagor och separerade answer-/memory-/effect-utfall.
Källrevision: `cba276a` (kodgranskning; denna dokumentationsreparation är ännu ocommittad).
Verifiering och avgränsningar: [handoff A008-0194](handoffs/A008-0194.md); A008-0195-fakta nedan är verifierade mot aktuell källkod.

Detta dokument beskriver implementerade ansvar och flöden. Målarkitekturen finns
i [PROJECT_BRIEF.md](PROJECT_BRIEF.md) och [ADR 0055](adr/0055-durable-sessions-and-process-ownership.md).
Skillnader mot målbilden finns i [CURRENT_STATUS.md](CURRENT_STATUS.md).

## Lokal värd och klienter

[src/gui-host/server.ts](../src/gui-host/server.ts) är den lokala HTTP/WebSocket-värden.
Vanliga fristående GUI-chattar använder den autentiserade fasaden
`/v1/chat/v3/*`. Första åtkomsten kan öppna den gemensamma Platform-backenden
med `platform.sqlite` vid projektregistret, eller använda konfigurerad sökväg.

[platform-v3-http.ts](../src/gui-host/platform-v3-http.ts) binder resurserna till
HTTP. GUI-fasaden och offentlig V3 använder samma beständiga backend men skilda
autentiserings-/adaptervägar. Offentlig V3 har textadapter; normal GUI-körning
kan använda EngineHost-verktyg. Befintliga V1/V2/ACP-ytor har egna kontrakt;
den nya arkitekturgrunden har inte migrerat dem.

[DurableChatClient](../gui/src/session/durable-chat-client.ts) och
[useDurableChat](../gui/src/session/use-durable-chat.ts) äger GUI-observationen.
Vald session lagras per flik. Dispose/navigering kopplar bort observation utan
att skicka cancellation. Explicit avbrytning använder värdens körningsväg.

Memory-vyn skickar valt durable `projectId` till `/v1/memory`; värden resolve:ar
projektets runtime via `ProjectRuntimeRegistry` och inspekterar just den
projektägda memory-store:n. Legacy-klienter utan `projectId` kan fortfarande gå
via den äldre ACP-bridgen, men durable projektbyte är inte längre beroende av
hostens globala `workspace`/bridge-cache.

Semantic/Budgets/Instructions använder `/v1/runtime-preferences` mot en host-owned
`RuntimePreferencesStore`. Read/save/reload kräver därför varken vald chat,
worktree eller levande sessionsprocess. Durable session snapshots kan bära samma
preferences för befintlig UI-kompatibilitet, men den globala settingsytan ägs inte
av sessionens livscykel. Modell och generation parameters lagras separat per
durable conversation med revisionskontroll och kan inte ändras under aktiv run.

## Beständig körningsdata

[PlatformStore](../src/platform/platform-store.ts) lagrar conversation,
meddelanden, körningar, kommandokvitton, händelser och lease-/återhämtningsdata
i SQLite. Conversation innehåller workspace-ID, som kopieras till accepterad
körning. Äldre obundna poster markeras `legacy-unbound`.

[Coordinator](../src/platform/coordinator.ts) schemalägger accepterat arbete,
hanterar ägarskap och återhämtning samt håller aktiva GUI-körningar.
Utgångna leases hanteras konservativt: redan dispatchat arbete med okänt
utfall kan bli `needs_reconciliation`, utan implicit återspelning.

SQLite-schema version 4 lagrar även per-session-konfiguration och run-input för
bilagor, utöver senaste sessionsinstans samt publik körningsaktivitet.
Varje publik förändring får en stigande cursor; svarstext sparas som append/replace,
verktyg uppdateras med ID och väntande godkännanden kan sättas eller tas bort.
En materialiserad snapshot och dess cursor skrivs i samma transaktion. Klienten
kan läsa snapshot och därefter `activity-events?after=<cursor>` i sidor om 100.
Händelser med redan behandlad cursor ignoreras. GUI:s polling ersätter hela
aktivitetssnapshoten och lägger aldrig samma textdelta till svaret två gånger.
Privat resonemang och interna enginesnapshotar är endast liveinformation.
Run-resultat skiljer beständigt på `effectStatus`, `answerStatus` och
`memoryStatus`, så ett sparat answer inte behöver behandlas som misslyckat bara
för att efterföljande memory-arbete gör det.
Historikläsning skapar varken sessionsprocess eller semantisk runtime.

## Workspace

[ProjectWorkspaceStore](../src/runtime/project-workspace-store.ts) hanterar
SQLite-metadata och Git-worktrees. Den skapar en separat branch, registrerar
sökväg/base och stöder status, keep samt borttagning av en ren worktree.
Dirty discard nekas. Den slår inte automatiskt ihop eller publicerar ändringar.

[workspace-routes.ts](../src/gui-host/workspace-routes.ts) äger GUI-värdens
workspace-inställningar och projektbundna operationer. Global rot används för
nya worktrees; rotvalet exponeras i Parameters → Parallel sessions.

Nya durable GUI/V3-conversations får en worktree före körbar publicering.
Coordinator slår upp körningens sparade workspace och skickar dess sökväg som
CWD. Saknad eller discarded arbetsyta ger run-felet `WORKSPACE_MISSING` och ingen
modell-/verktygsexekvering startas. Projekt-roten är ingen implicit fallback. Den beständiga conversation-identiteten är produktens `sessionId`.
Nya branches heter `a008/session-<sessionId>`; worktree-sökvägen använder hela
identiteten. Utgångsbranch och faktisk startcommit lagras separat. Ändrad rot
gäller nya sessioner; befintliga worktrees flyttas inte.

## Exekvering och processgräns

Coordinator öppnar projektets gemensamma runtime via
[ProjectRuntimeRegistry](../src/engine/project-runtime-registry.ts) och äger
[SessionProcess](../src/platform/session-process.ts) per beständig session.
Den forkade [session-worker](../src/platform/session-worker.ts) är en separat
OS-process med worktree som CWD. Den lever mellan meddelanden. EngineHost och
GuiRunSession skapas för varje GUI-körning inne i sessionsprocessen; deras
interna session-ID är tillfälliga adapteridentiteter. Offentlig V3 använder
textadaptern i samma processmodell. Värdens exklusiva lease och seriella
kommandointag kombineras med en aktiv körning per session och lokal busy-spärr.

Privat [SessionIpc](../src/platform/session-ipc.ts) använder Node:s ärvda
processkanal, utan nätverksport. Kuvertet har version 1, `instanceId`, request-ID,
request/response/cancel och operation. Körningsbundna anrop innehåller `runId`.
Handshake verifierar child-PID; PID används aldrig ensamt för att återansluta
en gammal process. Processbyte ger nytt instanceId och PID. Värden accepterar
aktivitet och minnesanrop endast från aktuell instans och aktuell körning.

Väntande verktygsgodkännande finns i sessionsprocessen och speglas till värden.
Alla anslutna behöriga klienter kan svara med dess ID. Frånkoppling ger inget
beslut. Avbrott/explicit processstopp avslutar det ägda processträdet; workspace
och historik består. Efter avbrott med okänt utfall markeras körningen
`needs_reconciliation`. Ett nytt meddelande får starta en ny instans men gamla
kommandon återspelas inte. Tills användaren granskat effekterna tillåts endast
filinspektion i GUI:s verktygsväg; övriga verktyg nekas. Revisionstyrd
`effect-review` markerar den gamla körningen som avbruten/granskad, inte lyckad.
En redan startad inspektionskörning behåller spärren till sitt slut.

GUI visar anslutning, process och körningsutfall separat. Runtime details har
processstatus/PID, uttryckligt processstopp och kontroll för granskade effekter.
Värdshutdown avbryter och inväntar ägda processer och slutliga lagringsskrivningar.
Värden kan köras utan ett öppet GUI; stängning av själva värden är ett annat steg.

## Run-local continuation context — A008-0196

`src/core/chat-continuation.ts` defines a versioned, UTF-8-bounded `RunContinuationState` with distinct verified facts, hypotheses and completed actions. Every entry must cite retained source interactions. The opt-in `ChatTools.continuation` policy in `src/core/chat-session.ts` offers only complete rounds older than the configured raw tail to a caller-owned reducer. Output is validated for run ID, shape, byte limit and resolvable source refs before projected provider context is replaced. Recent rounds remain raw; in-flight tool operations are never passed to the reducer. Canonical raw messages stay untouched. Without the explicit policy, existing full wire history is preserved. Continuation data is sent as untrusted user context, not system instruction or semantic memory.

Projection preserves provider chronology: the current user message remains before temporary continuation data and the recent raw assistant/tool tail. A replacement state must retain source coverage already represented by the previous valid state as well as newly compacted interactions, and the reducer receives a detached full prior state including its run binding. Invalid or source-dropping output therefore cannot silently erase already compacted work.

This slice does not implement a semantic reducer, context-budget triggers, automatic context rebuild or process-loss recovery. Durable checkpoint persistence is now implemented separately by A008-0197; A008-0196 remains the source of truth for the continuation-state/source-reference contract.

## Durable run-continuation checkpoints — A008-0197

`PlatformStore` owns continuation persistence in the existing local Platform SQLite database. Schema v5 adds run-owned source bindings, source-event links and versioned checkpoint rows. Checkpoints inherit the authoritative platform run lifecycle through `ON DELETE CASCADE`; no independent retention policy or replay authority is introduced.

`bindContinuationSourceInteraction()` consumes the exact completed A008-0196 `RunToolInteraction`. The runtime interaction ID remains `${runtimeRunId}:n`; PlatformStore derives the runtime run identity and tool-call IDs from that object, resolves each tool call against retained durable `A008_session_activity` evidence, and stores only the binding to the authoritative raw event. Terminal successful and failed tool evidence are both admissible. Rebinding the same source to the same interaction is idempotent; attempting to mutate an existing source reference to different evidence fails closed.

`saveContinuationCheckpoint()` validates the canonical `RunContinuationState` against the durable source set, exact platform run/turn/workspace binding and byte limit before an atomic append. `latestContinuationCheckpoint()` validates rows newest-first and returns the latest valid checkpoint; malformed or mismatched newer rows are skipped without mutation so an older valid checkpoint remains recoverable. Checkpoint payloads are execution state, are not copied into the raw evidence stream, and are not candidates for ordinary semantic-memory retrieval.

A008-0197 deliberately does not choose when to compact, trigger on a context budget, rebuild provider context, resume an unfinished turn after restart, or authorize retry/replay. Those orchestration/recovery behaviors remain owned by later tasks.

## Minne och kontext

ProjectRuntimeRegistry återanvänder en gemensam projekt-runtime och dess
A008-ägda semantiska minne. Worktrees skapar inte oberoende semantiska ägare.
Sessions-CWD och projektets minnesidentitet är separata.

Minnesimplementationen finns under [src/memory](../src/memory/), med lokal
runtime-komposition under [src/runtime](../src/runtime/) och semantisk
orkestrering under [src/orchestration](../src/orchestration/).
[CURRENT_MEMORY_MODEL.md](CURRENT_MEMORY_MODEL.md) är den detaljerade målmodellen;
dess normativa text är inte bevis på fullständig implementation.

[ADR 0056](adr/0056-minimal-memory-context.md) är implementerad för den
modellvända projektionen. `KnowledgeMemoryReader` hämtar kandidater;
[projection-items.ts](../src/memory/knowledge/projection-items.ts) väljer en
aktuell state per semantisk adress eller senaste tillämpliga claim. Lika värden
på olika adresser behåller separata identiteter. En rå yttring som stödjer en
vald claim följer inte med som en andra kopia. Specifika taggträffar begränsar
överspill från breda domänträffar; detta är ingen generell semantisk reranker.

[serialization.ts](../src/memory/serialization.ts) separerar nu worker-presentation
från extractor-presentation utan att ändra retrieval eller memory-engine. Worker-
envelopen skickar `id`, tillgänglig `semanticAddress`, den retrieved postens
läsbara `label` samt villkorad `history`/`provenance`. Extractorn behåller den
engine-orienterade `currentState`/`claim`-representationen som används för state
updates och reinforcement. Det yttre worker-kuvertet heter
`A008_memory_context_v2` och innehåller användarens meddelande separat. Tags,
domains, kind, evidenceId, scope och authority skickas inte till workern.

Historikfrågor får relevant `history`; käll-/verifieringsfrågor och osäkra eller
omtvistade claims kan få `provenance`. Äldre tillstånd kvalificeras med tid;
konkurrerande claims med samma adress behåller sin konfliktinformation.
Interna turn-locatorer återges som samtalskälla. Filkällor behåller sin locator.
Urvalet följer befintliga intents och underlag: det skapar ingen saknad källa
eller workspace-information. Poster som inte ryms i kontextbudgeten utelämnas
med intern diagnostik, även om det gäller den första posten.

Rika interna poster och kopplingen mellan kunskaps-ID och evidens finns kvar.
Extractor instrueras att återanvända/förstärka oförändrad kunskap; runtime
validerar identiteten. Förändrade värden går genom befintligt state-/historikflöde.
Läsning ensam förstärker ingenting. Ingen databasrensning eller migrering ingår.

Post-output-pipelinen kan även bevara återanvändbar operational knowledge från
assistentens explicita reflektion. I en observerad A008-0196-session svarade
agenten på varför uppgiften blivit svår; extractorn skapade därefter en
workspace-kvalificerad claim om att implementation hade börjat innan aktuella
repo-instruktioner och exakta krav verifierats, med följden testfel. Claimens
domains klassificerades som projektledning/programvaruutveckling. Detta använder
ingen särskild reflection-store: det är vanlig generated knowledge med normal
provenance, scope, lifecycle och retrieval. En enskild sådan observation är inte
automatiskt en global workflow-regel.

Sessionsprocessen öppnar inget projektminne i SQLite. Retrieval, post-output-
uppdatering och ACP:s minnesoperationer går över IPC till värdens projektägare.
Den lokala konversationskopian i child-processen är flyktig och seedas från
värdens sparade historik för varje körning. Chatthistoriken kräver inte minnesmotorn.

Nya sessionsobservationer kvalificeras konservativt med workspace-ID: claimtext
och strukturerade entity-adresser skiljer arbetskopior åt. Relation classification
kan inte supersede en annan arbetskopias claim. Turn-källan behåller observerad
HEAD och markeringen `working tree observation`; detta påstår inte att ocommittade
filer motsvarar exakt HEAD. Projektionen tar med denna provenance även utan en
explicit källfråga, eftersom kvalifikationen behövs för tolkningen. Samma
projektägare kan fortfarande hämta flera arbetskopiors observationer. Globala
källor och äldre claims skrivs inte om eller tilldelas påhittad workspace-historik.
Detta gör inte en modellgenererad observation automatiskt verifierad.

## Övriga befintliga ytor och begränsningar

Repositoryt innehåller även CLI/ACP, modell-/provideradaptrar, MCP-verktyg,
filbrowser/editor, källmaterial, bilder och klient-/protokollpaket.
[FILESTRUCTURE.md](FILESTRUCTURE.md) visar deras platser. Omläggningen har inte
ändrat dessa implementationer eller verifierat alla deras beteenden på nytt.

Vanliga durable GUI-runs kan bära en bildbilagas locator och media type som
beständigt run-input. Undo och generationsinställningar är fortfarande inte
likvärdigt exponerade mellan alla adaptrar.
Modellens bildgenereringsverktyg hanteras i GUI-körningen innan svaret sparas.
Legacy V1-historik migreras inte automatiskt till durable conversations.

### Identitets- och migrationsinventering (A008-0191)

| Yta/data | Mappning och hantering |
| --- | --- |
| Normal GUI och offentlig V3 | `conversationId = sessionId`; workspace-bindning och runId består. Nya körningar använder session-worker. SDK har process/status/stopp, activity-events och effect-review. |
| Befintlig bunden V3-session | Behåller sitt workspace, äldre branchnamn och historik. Ny process skapas vid nästa meddelande. Okänd startcommit förblir okänd; inga namn eller filer ändras automatiskt. |
| Obunden V3 (`legacy-unbound`) | Historik kan läsas; körning nekas. Ägaren behöver uttryckligen välja migration till separat worktree. Ingen rotfallback eller automatisk import. |
| V1/V2/ACP, engine-panel och standalone CLI | Befintliga kompatibilitetsadapteridentiteter och historiklager består. De blir inte automatiskt durable projektsessioner och kopieras inte till V3. Anslutna klienter använder V3 för den nya sessionslivscykeln. |
| Platform SQLite äldre versioner | Transaktionell uppgradering till schema v4; historik/receipts bevaras, instance/activity-tabeller samt session config/run input migreras additivt. Ingen process återansluts utifrån ett sparat PID. |
| Workspace SQLite | Additiva, nullable sessionId/baseCommit-fält. Endast nya allokeringar får verifierad startrevision och nya branchformatet. |

Process- och aktivitetsscheman finns i `packages/protocol/src/session-lifecycle.ts`.
HTTP/OpenAPI och klientpaket levereras tillsammans. Kompatibilitetsbegränsningarna
ovan är inga nya produktförbud och ingen automatisk datamigration av äldre GUI-
eller CLI-sessioner har utförts.

## Historik

Det tidigare långa systemdokumentet bevaras som
[historisk ögonblicksbild](evidence/A008-0188/previous-SYSTEMDOC.md).
Det innehåller tidsbundna och delvis motstridiga påståenden och ska endast läsas
för specifik historisk spårning, inte som aktuell arkitekturauktoritet.
