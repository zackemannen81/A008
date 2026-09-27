# System Document — aktuell implementation

Granskad: 2026-09-27; minneskontext uppdaterad i A008-0189.
Källrevision för minnesändringen: `0d8e409f464ac32dca02d73ac969b2581428ccc7` + lokal diff.
Övriga flöden: A008-0188:s källgranskning. Minneskontext: lokal testverifiering,
se [handoff A008-0189](handoffs/A008-0189.md).

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

Databashändelser och sparade meddelanden är beständiga. Den kompletta pågående
text-/verktygsaktiviteten ligger däremot i processminne i
[GuiRunSession](../src/platform/gui-run-session.ts). Alla livedetaljer kan
därför inte beskrivas som en beständig, återspelbar ström efter processdöd.

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
CWD. Saknad eller discarded arbetsyta ger fel. Projekt-roten är ingen implicit
fallback. Den befintliga branch-/ID-allokeringen är inte ännu den nya
arkitekturens fullständiga sessionsidentitetsmodell.

## Exekvering och processgräns

Coordinator öppnar projektets runtime via
[ProjectRuntimeRegistry](../src/engine/project-runtime-registry.ts).
För vanlig GUI-körning skapas ett `GuiRunSession`-objekt, som i sin konstruktor
skapar `new EngineHost(...)` i samma OS-process. `complete()` skapar en intern
EngineHost-session med historik och workspace-CWD; `finally` stänger EngineHost.

Det är alltså ett in-process exekveringsobjekt per körning. Det är **inte en
egen OS-process per beständig session** och återanvänder inte en sådan process
mellan meddelanden. Start av ny sessionsprocess efter död PID är inte byggd i
detta flöde. Existerande verktygs-/MCP-underprocesser innebär inte att kravet är uppfyllt.

GUI-körningens väntande verktygsgodkännande och aktivitet ägs av värden genom
GuiRunSession/coordinator. Klientfrånkoppling är skild från värdens shutdown:
värdens avslut avbryter pågående lokalt exekveringsarbete.

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

Den nya gränsen där flera separata sessionsprocesser anropar en gemensam
minnesägare har inte införts. Befintliga ägarskaps-/lease-regler får inte
förväxlas med ett färdigt IPC-gränssnitt för den nya modellen.

## Övriga befintliga ytor och begränsningar

Repositoryt innehåller även CLI/ACP, modell-/provideradaptrar, MCP-verktyg,
filbrowser/editor, källmaterial, bilder och klient-/protokollpaket.
[FILESTRUCTURE.md](FILESTRUCTURE.md) visar deras platser. Omläggningen har inte
ändrat dessa implementationer eller verifierat alla deras beteenden på nytt.

Vanliga durable promptinmatningar är textbaserade. Bildbilagor, undo och
genereringsinställningar är inte likvärdigt exponerade mellan alla adaptrar.
Modellens bildgenereringsverktyg hanteras i GUI-körningen innan svaret sparas.
Legacy V1-historik migreras inte automatiskt till durable conversations.

Dessa begränsningar beskriver nuläge, inte permanenta produktförbud. Före
runtime-omläggning måste API-konsumenter, historik och användarfunktioner få en
konkret migrationsinventering.

## Historik

Det tidigare långa systemdokumentet bevaras som
[historisk ögonblicksbild](evidence/A008-0188/previous-SYSTEMDOC.md).
Det innehåller tidsbundna och delvis motstridiga påståenden och ska endast läsas
för specifik historisk spårning, inte som aktuell arkitekturauktoritet.
