![A008](https://github.com/zackemannen81/A008/blob/main/A008hero.jpg?raw=true)

# A008

A008 is a provider-neutral AI client and local engine with one shared runtime for
chat, tools, projects and persistent semantic memory. It currently ships a CLI,
an A008-owned web GUI/host, an ACP compatibility bridge, a portable engine
bundle, shared protocol contracts, an independently installable client SDK, and
an authenticated V2 WebSocket surface plus an opt-in durable-work V3 surface for
independent/native clients.

The repository is the canonical successor to A007. A007 is retired; A008 is the
current Single Source of Truth.

# A008 memory (BASE)

A008: Pre-Provider Call Memory Retrieval
Mental Modell: Tänk dig Git med enbart en gren (main).

Nuvarande tillstånd = EXAKT NU

Historik = Tidigare tillstånd

A008 Retrieval = Din intelligenta bibliotekarie

🎭 Scentag: Besöket i Biblioteket
1. Förfrågan från Användaren
Användare: "Jag har en WORKER som ska jobba med loadfile.c för att ändra en C-funktion så att den enbart listar .md-filer och inte allt (*). Det vore också hjälpsamt att veta om någon annan har frågat om detta tidigare."

2. A008 Retrieval (Den Intelligenta Bibliotekarien)
A008: "Jaha, okej! Jag sammanställer en brief-mapp till dig... Låt mig se vad jag vet om filläsning. Jag hämtar relevant kunskap som fortfarande finns i biblioteket, sorterad efter relevans och prioritet:"

📁 Innehåll i Kontext-Kuvertet (Briefing Folder):
Exakta Taggar (Senaste nytt):
Taggar: Files, fileformat, programming, coding, C files, I/O, Disk Operations

Domänkontext:
Allt inom domänen: Development

Närliggande Kunskap:
Relaterad information via luddig logik (fuzzy logic) eller existerande kopplingar.

Aktuell Samtalskontext:
Eftersom vårt förra samtal handlade om Unreal Engine hämtade jag även allt inom Game Engines och Game Development.

Glömd/Passiv Kunskap (Dormant Knowledge Hit):
"Jag ringde det gamla biblioteket och hittade den här dammiga, glömda informationen: loadfile.c - reading and Writing files in C. Ingen har läst den på flera år, men eftersom den matchade din förfrågan exakt skickar jag med den."

Historik & Tidigare Versioner:

"Du är inte den första som frågar om detta! Tillsammans med den senaste uppdaterade versionen skickar jag med alla tidigare ersatta versioner av loadfile.c som vi har sparade."

3. Överlämning till Worker
Användare: "Hallå min lojala WORKER, jag har en CURRENT_TASK till dig:
Hjälp mig med denna utvecklingsuppgift: Ändra i loadfile.c så att den enbart listar .md-filer istället för *.
Läs igenom denna brief-mapp med all den senaste informationen innan du sätter igång."

4. Exekvering & Resultat
Worker: "WOW, det här är allt jag behöver och ingenting överflödigt! Jag är färdig! Tjena Användaren, jag har löst uppgiften:
loadfile.c läste tidigare in alla filändelser. Det är nu fixat.
Jag behövde inkludera <stdlib.h> för att det skulle fungera.
Nu listar loadfile.c enbart .md-filer och läser därefter in dem."*

5. Tillbakakoppling via Extraktorn
Extraktorn: *Knack knack*

"Det är bara jag, Extraktorn! Jag tar en kopia av ditt resultat, analyserar det och skickar tillbaka det till A008-bibliotekarien för klassificering och kategorisering. Jag behöver veta om detta ändrar något eller om ny information har lagts till."

6. Arkivering & Uppdatering
A008 (Bibliotekarien): "Äntligen! Nu har jag klassificerat och taggat den nya kunskapen. Vem kunde tro att den där gamla informationen om loadfile.c faktiskt skulle komma till användning igen? Jag ser till att den får stanna kvar i det aktiva biblioteket eftersom ämnet verkar bli populärt igen."

1. -> Not your standard Retrieval-Augmented Generation (RAG) & Kontext-berikning
Innan utvecklaren ("Worker") får sin uppgift, går bibliotekarien (A008) igenom minnet och samlar ihop ett paket ("context envelope") med allt som kan vara relevant:
Exakta taggar & domäner: Relevant kunskap om C-programmering och I/O.
Samtalskontext: Vad ni pratade om nyligen (Unreal Engine).
Dormant Knowledge (Passiv kunskap): Gammal information som inte använts på länge, men som "väcks till liv" för att den matchar exakt.
Historik: Tidigare versioner av koden.

2. Git-analogin för minneshantering
Genom att se minnet som en Git-gren med enbart main:
Exakt nu (Current state): Den senaste kända versionen av världen/koden.
Historik: Tidigare tillstånd som fortfarande finns spårade om man behöver backa eller jämföra.

3. Feedback Loop & Minnesuppdatering (Extractorn)
När Worker är klar med uppgiften slutar det inte där:

En Extractor analyserar svaret (t.ex. att <stdlib.h> behövdes läggas till).
Denna nya information skickas tillbaka till A008 (Bibliotekarien).
Bibliotekarien taggar och sparar den nya kunskapen, och gör den gamla koden/kunskapen "aktiv" igen eftersom den återigen blivit relevant.
