# System Document — aktuell implementation

Granskad: 2026-09-27; sessionsprocesser uppdaterade i A008-0191.
Källrevision: `d80663e` + A008-0191 closure-docs.
Verifiering och avgränsningar: [handoff A008-0191](handoffs/A008-0191.md).

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

## Beständig körningsdata

[PlatformStore](../src/platform/platform-store.ts) lagrar conversation,
meddelanden, körningar, kommandokvitton, händelser och lease-/återhämtningsdata
i SQLite. Conversation innehåller workspace-ID, som kopieras till accepterad
körning. Äldre obundna poster markeras `legacy-unbound`.

[Coordinator](../src/platform/coordinator.ts) schemalägger accepterat arbete,
hanterar ägarskap och återhämtning samt håller aktiva GUI-körningar.
Utgångna leases hanteras konservativt: redan dispatchat arbete med okänt
utfall kan bli `needs_reconciliation`, utan implicit återspelning.

SQLite-schema 3 lagrar även senaste sessionsinstans samt publik körningsaktivitet.
Varje publik förändring får en stigande cursor; svarstext sparas som append/replace,
verktyg uppdateras med ID och väntande godkännanden kan sättas eller tas bort.
En materialiserad snapshot och dess cursor skrivs i samma transaktion. Klienten
kan läsa snapshot och därefter `activity-events?after=<cursor>` i sidor om 100.
Händelser med redan behandlad cursor ignoreras. GUI:s polling ersätter hela
aktivitetssnapshoten och lägger aldrig samma textdelta till svaret två gånger.
Privat resonemang och interna enginesnapshotar är endast liveinformation.
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

[serialization.ts](../src/memory/serialization.ts) ger worker och extractor
samma tillåtna fält: `id`, tillgänglig `semanticAddress`, samt `currentState`
eller `claim` som sträng. Strängvärden bevaras; sammansatta värden återges som
JSON-text så att grupperingar och kvalifikationer består. Det yttre kuvertet
heter `A008_memory_context_v2` och innehåller användarens meddelande separat.
Tags, domains, kind, evidenceId, scope och authority skickas inte i posterna.

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

Vanliga durable promptinmatningar är textbaserade. Bildbilagor, undo och
genereringsinställningar är inte likvärdigt exponerade mellan alla adaptrar.
Modellens bildgenereringsverktyg hanteras i GUI-körningen innan svaret sparas.
Legacy V1-historik migreras inte automatiskt till durable conversations.

### Identitets- och migrationsinventering (A008-0191)

| Yta/data | Mappning och hantering |
| --- | --- |
| Normal GUI och offentlig V3 | `conversationId = sessionId`; workspace-bindning och runId består. Nya körningar använder session-worker. SDK har process/status/stopp, activity-events och effect-review. |
| Befintlig bunden V3-session | Behåller sitt workspace, äldre branchnamn och historik. Ny process skapas vid nästa meddelande. Okänd startcommit förblir okänd; inga namn eller filer ändras automatiskt. |
| Obunden V3 (`legacy-unbound`) | Historik kan läsas; körning nekas. Ägaren behöver uttryckligen välja migration till separat worktree. Ingen rotfallback eller automatisk import. |
| V1/V2/ACP, engine-panel och standalone CLI | Befintliga kompatibilitetsadapteridentiteter och historiklager består. De blir inte automatiskt durable projektsessioner och kopieras inte till V3. Anslutna klienter använder V3 för den nya sessionslivscykeln. |
| Platform SQLite v1/v2 | Transaktionell uppgradering till v3; historik/receipts bevaras, nya instance/activity-tabeller tillkommer. Ingen process återansluts utifrån ett sparat PID. |
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
