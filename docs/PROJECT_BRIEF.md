# Project Brief — A008

Status: Approved product direction
Beslutsdatum: 2026-09-27
Beslutsägare: Rickard

A008 är en lokal agentmiljö för utveckling, parallellt projektarbete och
semantiskt minne. En lokal A008-värd äger beständiga resurser och bakgrundsarbete.
Användaren arbetar genom A008:s GUI, CLI eller andra anslutna klienter.

## Core Product Contract

Klausulerna är produktauktoritet för Necessity Gate. ADR:er preciserar beslut;
implementation, gamla uppgifter och historiska dokument skapar inte nya krav.

- **PC-LF-01 — Local-first core.** Projekt, sessioner, verktyg, Git, lokalt
  tillstånd och minne fungerar utan ett A008-hostat backend eller konto.
  Valda externa modellproviders kan kräva nätverk.
- **PC-LF-02 — Backend is optional capability.** Sync, backup och fjärråtkomst
  är möjliga tillägg bakom uttryckliga gränssnitt. De äger inte den lokala kärnan.
- **PC-LF-03 — A008 owns cognition and semantic memory.** A008 äger kunskap,
  tillstånd, retrieval, reinforcement, lifecycle och kontextkonstruktion.
  Exekveringsmetadata är inte semantiskt minne.
- **PC-LF-04 — ACME owns model execution.** ACME utför modell-/providerarbete
  och rapporterar exekveringsresultat. A008 äger sessioner, verktygsbehörighet,
  minne och semantisk policy.
- **PC-LF-05 — Durable project sessions.** Varje ny projektsession får en egen
  beständig identitet, chatthistorik och Git-worktree vid skapandet. Sessionen
  består när dess process eller en ansluten klient avslutas.
- **PC-LF-06 — Isolated workspaces.** Varje projektsession har en egen branch
  och arbetskatalog under användarens session-rot. Verktyg och underprocesser
  använder sessionens workspace som CWD. Saknad worktree får aldrig orsaka en
  tyst övergång till projekt-roten.
- **PC-LF-07 — Local state remains authoritative.** Lokal lagring äger
  beständigt tillstånd. Eventuell synkronisering överför uttryckliga data och
  händelser utan att ett fjärrsystem blir nödvändig lokal sanningsägare.
- **PC-LF-08 — Replaceable session processes.** När ett meddelande ska köras
  säkerställer A008 exakt en aktiv sessionsprocess för sessionen. En levande
  process återanvänds; annars startas en ny för samma session och workspace.
  Sessionsprocessen är en separat OS-process.
- **PC-LF-09 — Clients observe and control.** Flera klienter kan visa och styra
  samma session. Navigering, frånkoppling och stängda GUI-fönster avslutar inte
  accepterat arbete. Att öppna chatten startar inte i sig en sessionsprocess
  eller återupprepar ett meddelande. Avbrott begärs uttryckligen.
- **PC-LF-10 — Current architectural authority.** Aktuell produktgrund och
  uttryckligen aktiva beslut styr ny arkitektur. Arkiverade beslut, citerad
  dokumenttext och minnesträffar får inte återaktivera gamla krav. Målbild och
  implementerat beteende dokumenteras separat.

PC-LF-05/06 ersätter sina tidigare formuleringar. Session och workspace är
fortfarande skilda begrepp men allokeras tillsammans för nya projektsessioner.
Den tidigare regeln om workspace först vid skrivning och den generella
clone/copy-fallbacken ingår inte i denna grund.

## Begrepp

| Begrepp | Definition |
| --- | --- |
| Session-rot | Global användarinställning för nya arbetskataloger, exempelvis `C:\code\a008-sessions`. Ligger utanför projektens repositoryträd. |
| Projekt | Registrerad identitet `projectId` med en projekt-rot. |
| Projekt-rot | Projektets ursprungliga lokala Git-checkout. |
| Session | Beständig arbetskontext med `sessionId`, historik och workspace. Chatt är dess GUI-presentation. |
| Workspace | Registrerad worktree med `workspaceId`, sökväg, branch och startrevision. |
| Sessionsinstans | En viss livstid för körprocessen, identifierad av `instanceId`. |
| Process | OS-processen med ett tillfälligt `processId`/PID som OS kan återanvända. |
| Körning | Ett avgränsat accepterat arbete med `runId`. |
| Klient | GUI, CLI eller annan konsument av samma lokala värd. |

Identiteterna har olika betydelse och får inte härledas från PID eller
visningsnamn. Befintliga `conversationId` och interna EngineHost-`sessionId`
mappas uttryckligen i SYSTEMDOC:s identitets- och migrationsinventering:
durable `conversationId` är produktens `sessionId`; interna EngineHost-ID:n
är tillfälliga adapteridentiteter. Befintliga kompatibilitetsytor migreras inte
genom att deras ID:n byter namn.

```text
A008 lokal värd
└── Projekt A008 (projekt-rot C:\code\A008)
    ├── Session c401ace5
    │   ├── workspace C:\code\a008-sessions\a008-c401ace5
    │   ├── branch a008/session-c401ace5
    │   ├── base main @ <startcommit>
    │   ├── sparad historik och körningar
    │   └── sessionsinstans vid behov (nytt instanceId och PID vid omstart)
    └── Session B
        └── egen worktree, branch och sessionsprocess
```

`main` är ett exempel på utgångsbranch, inte sessionernas gemensamma
arbetsbranch. En worktree delar Git-objekt men har egen arbetskatalog; den är
inte en fullständig klon. Ändrad session-rot gäller nya sessioner och flyttar
inte befintliga arbetskataloger automatiskt.

## Ägarskap

| Ägare | Ansvar |
| --- | --- |
| Lokal A008-värd | Inställningar, projektregister, beständiga sessioner, historik, körningsstatus och klientåtkomst. Kan leva utan öppet GUI. |
| Värdens processhanterare | Start, identifiering, övervakning och stopp; högst en aktiv processägare per session. |
| Värdens workspace-hanterare | Worktree/branch-skapande, beständig bindning och uttryckliga livscykelåtgärder. |
| Sessionsprocess | Agentarbete, verktyg och underprocesser i sessionens workspace. |
| A008:s minnesmotor | En gemensam semantisk ägare per projekt, åtkomlig genom ett uttryckligt gränssnitt. Kan ligga i värden. |
| ACME | Modell-/providerexekvering. |
| GUI/CLI | Presentation och användarkommandon; ingen ägare till arbetets livstid. |

Chatthistorik lagras oberoende av om semantiskt minne är aktiverat.
Sessionsprocesserna får inte öppna konkurrerande minnesägare för samma projekt.
Källkodsobservationer behåller workspace-/revisionskontext: ett fynd i session A
beskriver inte automatiskt session B eller `main`.

[CURRENT_MEMORY_MODEL.md](CURRENT_MEMORY_MODEL.md) äger fortsatt den detaljerade
semantiska målmodellen. Omläggningen ändrar inte dess interna semantik eller
innebär att alla dess delar redan finns.

## Livscykel

1. Skapa identitet och worktree. Exponera sessionen som körbar först när
   bindningen är sparad och arbetsytan finns; fel får ett synligt tillstånd.
2. Visa sparad historik när chatten öppnas och anslut till eventuell aktivitet.
   Enbart läsning startar ingen sessionsprocess.
3. Vid nästa meddelande: återanvänd en verifierat levande process eller starta
   en ny med samma session, historik och workspace samt nytt instanceId/PID.
4. Kör högst en aktiv körning per session; olika sessioner kan köra parallellt.
   Värden samordnar samtidiga kommandon från flera klienter.
5. Lagra återanslutningsbara körningshändelser med ordningsnummer. Historik och
   ny ström ska ansluta utan luckor eller dubblering. Varje intern diagnostiksignal
   eller modellens privata resonemang behöver inte lagras.
6. Processdöd lämnar historik och filer kvar. Ny processstart återspelar inte
   tidigare arbete. Okända verktygseffekter kontrolleras före eventuell upprepning.

Stopp av körning, stopp av process och avveckling av workspace är skilda
åtgärder. Stängning av GUI innebär ingen av dessa. Behåll, integrera eller kasta
arbete hanteras uttryckligen; inget publiceras, slås ihop eller raderas
automatiskt för att en process avslutas.

## Avgränsning

Grunden avser registrerade Git-projekt. Icke-Git-projekt, projektlösa chattar,
clone/copy-fallback, automatisk start vid OS-inloggning och fjärrkörning beslutas
separat om de behövs. Arkivering av ADR:er tar inte bort befintliga funktioner.
Protokoll, befintliga sessionsdata och GUI-kapabiliteter måste inventeras före
kodändring; gamla begränsningar blir inte generella produktkrav genom historiken.

## Dokumentauktoritet

- Detta dokument äger godkänd produktgrund.
- [ADR-registret](adr/README.md) listar aktiva beslut. ADR 0055 är det enda
  beslut som antogs vid arkitekturomläggningen; ADR 0056 preciserar därefter
  det minimala minneskuvertet. ADR 0057 preciserar säker återupptagning från en
  verifierad checkpoint utan verktygsreplay. Alla ADR:er före 0055 är historik.
- [SYSTEMDOC.md](SYSTEMDOC.md) beskriver källkodens aktuella ansvar och flöden.
- [CURRENT_STATUS.md](CURRENT_STATUS.md) visar observerade luckor mot målbilden.
- Arkiv, journal och avslutade uppgifter är historik. Deras instruktioner eller
  `Accepted`-etiketter utgör inte aktuell auktoritet.
