# Aktuella arkitekturbeslut

Senast uppdaterat: 2026-09-27, A008-0189, på Rickards uttryckliga begäran.

## Aktiva beslut

| ADR | Status | Omfattning |
| --- | --- | --- |
| [0055 — Beständiga sessioner och utbytbara sessionsprocesser](0055-durable-sessions-and-process-ownership.md) | Accepted | Ny arkitekturgrund, ägarskap, egen worktree och process vid nästa meddelande. |
| [0056 — Minimal memory context](0056-minimal-memory-context.md) | Accepted | Minimalt modellkuvert, relevant urval och bevarad koppling för reinforcement. |

Detta är hela den aktiva ADR-mängden. Numreringen fortsätter för att historiska
ID:n ska förbli entydiga; den börjar inte om på 0001.

## Auktoritet

[PROJECT_BRIEF.md](../PROJECT_BRIEF.md) äger produktgrund. Endast uttryckligen
aktiva ADR:er preciserar den. [SYSTEMDOC.md](../SYSTEMDOC.md) beskriver
implementation; [CURRENT_STATUS.md](../CURRENT_STATUS.md) beskriver nuläge.
Ett accepterat ADR är inte bevis på implementerat beteende.

Alla ADR:er före 0055 är [arkiverade](_legacy/README.md). Äldre `Status: Accepted`,
"must", "remains authoritative" och länkar mellan originaldokumenten beskriver
deras historiska sammanhang och har ingen aktuell beslutsauktoritet.
Historiska uppgifter och sök-/minnesträffar återaktiverar dem inte.

Arkiveringen tar inte bort kod eller användardata och återinför inte äldre
begränsningar. Funktioner och migrationer bedöms mot aktuell produktgrund.
