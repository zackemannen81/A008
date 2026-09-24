Architecture Decision Record (ADR)
ADR 012: Inriktning och Kontraktsjustering för A008 Knowledge Extractor
Status: Antagen / Delvis implementerad (Verifiering avbruten p.g.a. API-kvot)

Datum: 2026-09-24

Kontext/Författare: A008 Core Engineering & Knowledge Extraction Team

1. Kontext och Problemställning (Context & Problem Statement)
A008 Knowledge Extractor ansvarar för att analysera konversationer/rapporter och extrahera strukturerad kunskap till graf- och state-lagringen.

Vi identifierade två huvudproblem:

Schema-mismatch: Promptens instruktionsexempel överensstämde inte med A008 Wire Protocol (KNOWLEDGE_EXTRACTOR_INSTRUCTION.ts), vilket ledde till att valideraren avvisade förslag i intake-steget.

Kompakthet & Förlorad Struktur: Extraktorn slog ihop flera oberoende tillstånd i en och samma claim (t.ex. flera filer, kontroller och inställningar). Dessutom tappade A008:s backend-commit-logik bort strukturerade bindningar när de klassificerades som upprepningar (restatements) av tidigare ostrukturerade claims.

2. Beslut (Decision Drivers & Choices)
Vi har fattat följande arkitekturella och operativa beslut:

Ordagerant Kontraktsanpassning i Prompten:

Prompten anpassas exakt till det interna Wire Protocol-kontraktet: fyra uttryckliga arrayer (new_knowledge, state_updates, relation_updates, reinforcements).

Alla kunskaps-, state- och relationsförslag skall inkludera severity, tags och domains.

En tom retrievedContext (t.ex. vid nystartade projekt) ska tvinga nya tillstånd att skapas via new_knowledge istället för state_updates.

Atomär Granularitetsprincip (Semantic Isolation):

Varje structuredProposition ska isolera enbart en entitet, en egenskap och ett värde.

Flera filer (t.ex. index.html, style.css, demo.js) får inte slås ihop till ett samlingsobjekt, utan ska extraheras som separata entiteter.

Instruktioner/begäranden utgör inte automatiskt state om de inte etablerar ett bestående faktum eller beslut.

Backend Commitment Upgrade (Strukturberikning):

Modifiera live-commit.ts i A008 så att en upprepad claim (restatement) med ny strukturerad information (structuredProposition) uppdaterar och berikar den befintliga claimen istället för att ignoreras och returneras tidigt.

3. Konsekvenser (Consequences)
Positiva
100% Intake-Pass: Inga förslag avvisas av formatvalideraren vid commit.

Hög Precision: State-bindningar (som ZM-0008.status = Complete eller demo.js.role = main_implementation) blir sökbara och kan förändras oberoende av varandra i historiken.

Bättre Modellprestanda/Kostnad: Genom att använda gpt-5.6-luna med reasoning: none hålls extraktionskostnaderna minimala utan att förlora strukturell korrekthet.

Negativa / Risker
Tokenvolym: Fler atomära förslag ger en större JSON-payload i utdata från extraktorn (35–40+ förslag per körning jämfört med ~20 tidigare).

Beroende av Baslinje: Om baseline saknar relevanta entiteter krävs noggrann hantering för att undvika dubbletter i grafen.

4. Nästa Steg och Åtgärdsplan (Next Steps & Roadmap)
När API-kvoten återställs (eller med nya krediter) ska följande steg genomföras:

Steg 1: Slutlig Verifiering & Persistens-test (P0)
[ ] SQLite/Database Commit Check: Verifiera att de 39 extraherade förslagen från A008-0176 faktiskt skrivs till SQLite utan fel under live-commit.ts.

[ ] State Delta Test (Iteration 2): Kör en uppföljande testrun där baseline innehåller föregående tillstånd (t.ex. ändra port 8080 till 9090). Verifiera att:

Port 8080 flyttas till history/inaktiv.

Port 9090 blir aktiv i state_updates.

Steg 2: Kod- & Prompt-konsolidering (P1)
[ ] Merge Task A008-0176: Slutför och merga ändringarna från docs/tasks/A008-0176_resolved-extraction.md till huvudgrenen.

[ ] Synkronisera Promptkontrakt: Säkerställ att den skarpa systemprompten som används av backend-tjänsten läser directly från den uppdaterade promptmallen (A008-extractor-prompt.txt).

Steg 3: Kvalitetsgranskning av Semantik (P2)
[ ] Finjustera reglerna för källstöd (t.ex. att inte gissa att Base64-kodning hör till en specifik fil om rapporten inte uttryckligen anger det).