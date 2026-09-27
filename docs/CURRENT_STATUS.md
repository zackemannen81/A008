# Current Status — A008

Granskad: 2026-09-27
Källrevision: `4368172b78b3a2c6f06e2939625726f7340b5c7e`
Dokumentarbete: A008-0188

## Godkänd riktning

[PROJECT_BRIEF.md](PROJECT_BRIEF.md) och
[ADR 0055](adr/0055-durable-sessions-and-process-ownership.md) anger den nya
grunden: beständig projektsession med egen worktree och separat sessionsprocess
vid behov. Nästa meddelande startar en ny process när den gamla saknas, för
samma session och workspace. Att bara öppna chatthistorik startar ingen process.

Alla tidigare ADR:er är arkiverade och saknar aktuell beslutsauktoritet.
Detta är en dokumentomläggning. Den innebär inte att målarkitekturen är byggd.

## Observerad implementation och luckor

| Område | Nuläge från källkod | Återstående arbete mot grunden |
| --- | --- | --- |
| Projekt och historik | Lokalt projektregister samt SQLite-baserade durable conversations/runs finns. | Mappa befintliga conversation-/session-ID:n och migrera äldre data uttryckligen. |
| Arbetsytor | Nya durable conversations får worktree; accepterade körningar behåller workspace-ID/CWD. | Säkerställ samma kontrakt för alla nya projektsessioner och planera äldre obundna sessioner. |
| Bakgrundsarbete | Normal GUI-navigation/frånkoppling lämnar accepterade körningar hos coordinator. | Säkerställ klientoberoende livstid även med den nya processhanteraren. |
| Processer | GuiRunSession skapar EngineHost i värdprocessen och stänger den efter körningen. | Separat OS-process per session, återanvändning, processövervakning och start vid nästa meddelande efter död process. |
| Identitet | Beständig conversation/run/workspace skiljs redan från interna enginesessioner. | Uttrycklig session/instance/PID-mappning och skydd mot dubbla processägare. |
| Återanslutning | Meddelanden och körningsdata lagras; liveaktivitet ligger delvis i värdprocessens minne. | Definiera och verifiera beständiga återanslutningshändelser över processgränsen. |
| Minne | In-process registry återanvänder projektets semantiska ägare. | Gränssnitt till samma ägare från separata sessionsprocesser; verifiera workspace-/revisionsscope. |
| Fel och återhämtning | Saknad worktree ger fel; osäkra dispatchade effekter återspelas inte automatiskt. | Verifiera samma beteende vid dödad sessionsprocess, stale ägarskap och nästa meddelande. |
| GUI/API-kapabiliteter | V1/V2/V3 och normal GUI har olika adapter-/kapabilitetsgränser. | Inventera och planera migration före omläggning; arkivering tar inte bort funktioner. |

Källhänvisningar och ansvar finns i [SYSTEMDOC.md](SYSTEMDOC.md).
En separat process per session är den centrala obebyggda delen. Verktygens
befintliga underprocesser uppfyller inte det kravet.

## Verifiering och evidensgräns

Denna dokumentuppgift läser host-, coordinator-, store-, workspace-, registry-
och GUI-kod samt kontrollerar arkiv, dokumentlänkar och diff. Inga nya
funktionstester eller live-provideranrop utförs; inga produktprocesser startas.

Äldre testresultat bevaras i handoffs och
[tidigare status](evidence/A008-0188/previous-CURRENT_STATUS.md). De är historiska
resultat och innebär inte att den nya processmodellen har verifierats.
Skärmbildernas felmeddelanden visar observerade UI-problem men orsaken har inte
fastställts i denna uppgift.

Vid start fanns en lokal ändring i `src/core/model-registry.ts`. Den tillhör
inte dokumentuppgiften och lämnas oförändrad. Dokumentarbetet är lokalt;
ingen commit, push, deployment eller runtime-migrering ingår.

## Nästa avgränsade implementation

Chartra implementation mot ADR 0055:s acceptanskriterier: sessionsidentitet,
processhanterare, workspace-bindning, gemensam minnesägare och klientens
återanslutning. Börja med att kartlägga befintliga data och API-konsumenter så
att migrationens omfattning och gates går att frysa. Inget äldre task/ADR
återaktiveras automatiskt.

Den tidigare onumrerade CURRENT_TASK med ofylld charter bevaras som historik
och är ersatt som aktiv uppgift, inte markerad som implementerad eller klar.
Detaljer finns i [A008-0188-handoff](handoffs/A008-0188.md).
