# ADR 0055 — Beständiga sessioner och utbytbara sessionsprocesser

Status: Accepted
Date: 2026-09-27
Decision owner: Rickard
Task: A008-0188
Implementation status: Target architecture; process-per-session is not implemented.

## Bakgrund och auktoritet

Ägaren begärde en ny arkitekturgrund eftersom gamla beslut fortsatte att styra
utvecklingen negativt. Ägaren godkände att nästa meddelande startar en ny process
för samma beständiga session när den tidigare processen har dött, och begärde
därefter att alla tidigare ADR:er arkiveras samt projektgrund, systemdokument
och status uppdateras.

Detta beslut antar ägarskap och livscykel i
[PROJECT_BRIEF.md](../PROJECT_BRIEF.md), särskilt PC-LF-05/06/08/09/10.
Alla tidigare ADR:er dras tillbaka som aktuell beslutsauktoritet och bevaras i
[arkivet](_legacy/README.md). Inga äldre ADR:er återantas genom hänvisning.
Numreringen fortsätter för att undvika återanvändning av historiska identiteter.

Arkivering är inte kod- eller dataradering. Befintliga funktioner måste bedömas
mot aktuell produktgrund före ändring. CURRENT_MEMORY_MODEL förblir detaljerad
semantisk målmodell; arkivering av ADR 0052 avvecklar inte minnesmotorn.

## Beslut

### Beständiga resurser

Varje ny projektsession får egen worktree och branch vid skapandet. Identitet,
historik, körningar och registrerat workspace består oberoende av klient/process.
Session-rot väljs i inställningar och ligger utanför projektens repositoryträd.
Branch följer `a008/session-<sessionId>`; utgångsbranch och faktisk startcommit
sparas. Sökvägen ska vara kollisionssäker. Titel kan förkortas från första
meddelandet men är aldrig identitet eller filsystemsauktoritet.

Allokeringsfel får inte exponera en körbar session eller ge implicit exekvering
i projekt-roten. Befintliga legacy-sessioner kräver en uttrycklig migrationsplan.

### Utbytbara processer

När ett meddelande ska köras säkerställer värdens processhanterare exakt en
aktiv sessionsprocess för sessionen:

- En verifierat levande process återanvänds.
- Saknas processen startas en separat OS-process med samma session, historik
  och workspace, men nytt `instanceId` och OS-tilldelat PID.
- PID ensamt bevisar inte ägarskap eftersom OS kan återanvända det.
- Samtidiga klientkommandon får inte skapa dubbla processägare.
- Högst en körning är aktiv per session; olika sessioner kan köras parallellt.

Att öppna historiken startar ingen process. Stängd klient stoppar observation,
inte bakgrundsarbetet. Processen kan återanvändas för kommande meddelanden;
automatisk idle-timeout är inte fastställd av detta beslut.

### Gemensamma ägare

Den lokala värden äger beständigt tillstånd och kan leva utan öppet GUI.
Sessionsprocessen äger agentarbete och verktygsunderprocesser i sessionens CWD.
A008 har en gemensam semantisk ägare per projekt, nåbar genom ett uttryckligt
gränssnitt. Den tjänsten kan ligga i värden; sessionsprocesserna öppnar inte
konkurrerande projektminnesägare. IPC-transport och schema beslutas i en
avgränsad implementationsuppgift.

A008 äger retrieval, kontext och minnesuppdateringar. ACME utför modellarbete.
Chatthistorik består även med semantiskt minne avstängt. Källkodsfakta behåller
workspace-/revisionskontext; ett fynd i en branch blir inte automatiskt en
observation av `main` eller en annan session.

### Återanslutning och avbrott

Klienten läser sparad historik/status och observerar därefter nya händelser.
Ordningsnummer och en definierad övergång från snapshot till ström förhindrar
luckor och dubblering av återanslutningsbara körningshändelser. Alla interna
token-/diagnostiksignaler behöver inte bli beständig historik.

Kommandon identifieras så att transportförsök inte accepterar samma arbete
två gånger. Detta är inget löfte om exakt-en-gång för externa verktygseffekter.

När processen dör behålls session, workspace och kända resultat. Nästa nya
meddelande kan starta en ny process, men tidigare avbrutna operationer
återspelas inte implicit. Nytt arbete som beror på en okänd effekt kontrollerar
den först. Processstart är inte ett löfte om att återuppta varje avbruten operation.

GUI skiljer anslutning, sessionsprocess och körningsresultat. Ansluten klient
innebär inte att senaste arbetet lyckades. Processavslut slår inte ihop,
publicerar eller raderar arbete; workspace-åtgärder är uttryckliga.

## Konsekvenser

- Uppskjuten workspace-allokering i tidigare PC-LF-05 ersätts för nya
  projektsessioner. Session och workspace har skilda identiteter med fast bindning.
- Befintliga conversation-/EngineHost-identiteter behöver en migrationsmappning.
- Dagens in-process `GuiRunSession` uppfyller inte separat OS-process per session.
- Verktygsbehörigheter och väntande godkännanden behöver en definierad väg över
  processgränsen. En klientfrånkoppling avgör inte deras utfall.
- Worktrees isolerar arbetskopior; de är inte en OS-sandbox för fientliga verktyg.
- Ingen runtime-, protokoll- eller datamigrering genomförs av detta dokumentbeslut.

## Alternativ som inte antas

Enbart interna sessionobjekt uppfyller inte processkravet. PID som beständig
identitet fungerar inte över omstarter. Process per GUI-fönster gör arbetet
klientberoende. Blind återspelning kan dubblera sidoeffekter. Parallell auktoritet
från gamla ADR:er motverkar ägarens uttryckliga omläggning.

## Acceptans för kommande implementation

1. Två sessioner har olika worktrees, branches och OS-processer.
2. Stängning/byte av GUI lämnar arbete igång; annan klient kan observera det.
3. Efter processdöd visas historik utan processstart vid enbart läsning.
4. Nästa meddelande startar ny instans med samma session och workspace.
5. Samtidiga klientmeddelanden skapar högst en processägare och en aktiv körning.
6. Historik och ström ansluter utan tappade eller dubblerade sparade händelser.
7. Okända verktygseffekter återspelas inte och kontrolleras före beroende arbete.
8. Saknad worktree ger fel och inget arbete i projekt-roten.
9. Projektminnet nås genom gemensam ägare; workspace-fakta behåller sitt scope.
10. Chatthistorik kan läsas med semantiskt minne avstängt.

Detta är framtida implementationskrav, inte testresultat från dokumentuppgiften.
Observerat nuläge finns i [CURRENT_STATUS.md](../CURRENT_STATUS.md).
