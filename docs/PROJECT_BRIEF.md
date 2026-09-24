# Project Brief

Status: Approved product direction. Current accepted decisions refine the
original bootstrap proof described below; new behavior needs bounded authority.

## Core Product Contract

PROJECT BRIEF UNDERLAG: A008 Local-First Agent Engine & Multi-Session ArchitectureDokumentversion: 1.0Status: Utkast till Project Brief / ArkitekturfundamentSystem: A008 Agent Platform & Semantic Memory Engine1. Executive Summary & ProduktvisionA008 är en Local-First, autonom agentmiljö utformad för djupgående mjukvaruutveckling, semantisk minneshantering och parallell exekvering. Till skillnad från klassiska molnbaserade AI-plattformar (SaaS-first) är A008 i sin grundstomi ett lokalt körbart system som fungerar helt utan internetuppkoppling eller central backend.Huvudprincip: "Dra ut nätverkskabeln"-regelnOm man drar ut nätverkskabeln ska A008 fortfarande vara 100 % A008.Lokal databas, semantisk minnesmotor (A008 Knowledge Engine), lokala projekt, verktygsanrop (MCP), exekveringsmotor (ACME) och källkodshantering via Git är autonoma och lokalt authoritative. Backend och molntjänster är valfria utökningar (add-ons) som tillför synkronisering, backup, fjärrstyrning och team-samarbete utan att äga agentens kognitiva kärna.2. Arkitekturöversikt & TopologiA008 byggs kring en tydlig uppdelning mellan den lokala körmiljön (Local Runtime) och ett valfritt synkroniseringslager (Sync Backend) via ett standardiserat gränssnitt (SyncAdapter).                              A008 Systemtopologi
       
                      ┌─────────────────────────────────┐
                      │          A008 Runtime           │
                      │          (Local-First)          │
                      ├─────────────────────────────────┤
                      │ • Local Sessions & Workspaces   │
                      │ • Semantic Memory Engine        │
                      │ • Tooling / MCP Integration     │
                      │ • ACME Task Execution Engine    │
                      │ • Git Worktree Manager          │
                      │ • Local Database (SQLite WAL)   │
                      └────────────────┬────────────────┘
                                       │
                               SyncAdapter (Interface)
                                       │
                      ┌────────────────▼────────────────┐
                      │     Optional Sync Backend       │
                      ├─────────────────────────────────┤
                      │ • Identity & Access (Auth)      │
                      │ • Cross-Device Memory Sync      │
                      │ • Project Metadata & Backup     │
                      │ • Remote Session Coordination   │
                      │ • Web / Mobile Client Proxy     │
                      └─────────────────────────────────┘
2.1 Driftlägen (Operational Modes)Läge A: Standalone (100 % Lokalt)Fullständigt isolerad körning på en enskild dator. Ingen registrering, inget konto, ingen serverinfrastruktur och noll nätverksberoende.Komponenter: Local DB, Local Memory Engine, Git Worktrees, MCP-verktyg, ACME-exekvering.Fördelar: Maximal integritet, noll latens till filsystemet, fungerar offline.Läge B: Standalone + Sync (Multi-Device / Team)A008 körs fortfarande lokalt på användarens maskin(er), men kopplas mot en frivillig A008 Sync Backend för automatisk tillståndssynkronisering mellan enheter (t.ex. Laptop, Desktop, Mobil).Funktioner: Bakgrundssynkronisering av minne, sessionsmetadata och projektstatus via händelseströmmar (append-only sync events).3. Parallella Sessioner & FilsystemsisoleringEn av de största utmaningarna i fleragent-system är hanteringen av delat filsystem. Om två agenter arbetar samtidigt i samma katalog uppstår filkollisioner, låsningsfel och osäkra git diffs.A008 löser detta genom Git Worktrees som primär isoleringsmekanism.3.1 Filarkitektur & KatalogstrukturProject Root
│
├── Canonical Repository (.git)
│
├── session-A ───> Git Worktree A ───> Branch: a008/session-A
├── session-B ───> Git Worktree B ───> Branch: a008/session-B
├── session-C ───> Git Worktree C ───> Branch: a008/session-C
│
└── A008 Project State (Shared Local Core)
      ├── SQLite Database (Current State & History)
      ├── Memory Engine Index
      ├── Task Claims & Locks
      └── Multi-Session Coordination Log
3.2 Git Worktree vs. Repo CloneEgenskapGit Worktree (Standard)Repo Clone (Fallback)IskopplingFullständig filsystemsisoleringFullständig filsystemsisoleringDiskförbrukningLåg (Delar .git-objektdatabas)Hög (Duplicerar .git-katalogen)SkapandetidBlixtsnabb (< 100 ms)Långsam (Beror på repots storlek)Git-historikGemensam, omedelbart tillgängligSeparerad, kräver fetch/pushAnvändningsfallAlla standardiserade Git-projektIcke-Git-projekt eller trasiga build-verktygFallback-princip: Om ett projekt saknar Git eller om specifika verktyg misslyckas i en worktree-miljö, faller A008 automatiskt tillbaka till en komplett kopia/klon.3.3 Separering: A008 Session $\neq$ Git WorkspaceFör att undvika att skapa en ny worktree för enkla konversationer eller efterforskningar skiljer A008 strikt på Session (chatt/kontext) och Workspace (filsystem).Project: Foo
│
├── Session 001 (Research/Chat)       ───> Workspace: NONE
├── Session 002 (Refactoring task)    ───> Workspace: Worktree-002 (a008/session-002)
├── Session 003 (Bugfix task)         ───> Workspace: Worktree-003 (a008/session-003)
└── Session 004 (Code Reviewer)        ───> Workspace: MAIN (Read-Only)
3.4 Livscykel för Parallell Exekvering                 [Skapa Parallell Session]
                            │
              Behöver sessionen skriva filer?
                            │
             ┌──────────────┴──────────────┐
             NEJ                           JA
             │                             │
    [Delat Read-Only Workspace]   [Skapa Git Worktree]
             │                             │
             │                    [Skapa Dedikerad Branch]
             │                             │
             │                    [Session Låser Workspace]
             │                             │
             └──────────────┬──────────────┘
                            │
                     [Agent Exekvering]
                            │
                    [Git Commit / Diff]
                            │
               [Merge / PR / Decision Alert]
                            │
                   [Rensa Worktree]
4. Local-First Datamodell & SynkroniseringsstrategiA008 använder inte remote-databasen som en Single Source of Truth (SSOT). Istället genererar den lokala klienten append-only händelser (Sync Events) som replikeras asynkront.4.1 Synkroniserbara EntiteterFöljande objekt ingår i SyncAdapter-gränssnittet:Project (Metadata och konfiguration)Session (Chatthistorik och status)Turn (Enskilda dialogsteg)KnowledgeOccurrence (Råa observationer)Claim (Strukturerade påståenden)Relationship (Grafkopplingar)Task (Uppgifter och status)Execution (Körningsloggar och ACME-utdata)Artifact Metadata (Filreferenser och hashar)Settings Subset (Användarinställningar)4.2 Append-Only Sync Events (Händelsebaserad synk)Istället för att ersätta hela rader i databasen vid samtidiga ändringar (vilket skapar konflikter), skickar A008 atomära händelser:[Laptop]  ──────> Event 9812: occurrence_created(...) ──────> [Backend] ──────> [Desktop]
[Desktop] ──────> Event 9813: claim_reinforced(...)   ──────> [Backend] ──────> [Laptop]
Detta överensstämmer med A008:s minnesmodell: Nuvarande tillstånd är summan av alla genomförda förändringar över tid.5. Produktstratifiering & Kommersiell ModellGenom att hålla A008 local-first slipper projektet byggas som en tung SaaS-plattform från dag ett. Det ger en modulär produkt- och affärsmodell:┌────────────────────────────────────────────────────────────────────────┐
│ A008 Core (Open / Local / Standalone)                                  │
│ Inget konto, ingen cloud DB, fullständigt lokal agent & minnesmotor.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Optional Add-on
┌───────────────────────────────────▼────────────────────────────────────┐
│ A008 Sync (Managed Synchronization Service)                            │
│ Synk mellan enheter, automatiska backups, privat krypterat moln.       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Framtida utökningar
┌───────────────────────────────────┴────────────────────────────────────┐
│ A008 Remote  ──> Fjärrexekvering i molnet / tunga GPU-modeller         │
│ A008 Teams   ──> Flera utvecklare delar projektgraf & minne          │
│ A008 Cloud   ──> Managed LLM-proxies & företagsintegrationer          │
└────────────────────────────────────────────────────────────────────────┘
6. Fördelar med RiktningenReducerad Inledande Complexitet: Vi slipper bygga multitenancy, användarhantering, komplexa databas-migrationer i molnet och serverdrift innan själva agenten och minnesmotorn är färdigutvecklade.Robusthet & Blixtsnabb Prestanda: Inga nätverks-timeouts blockerar agentens arbete med den lokala kodbasen.Ingen Leverantörsinlåsning (Data Sovereignty): Användaren äger sin källkod och sin minnesdatabas i standardiserade filer (SQLite, Git).

## Legacy / History

For reference you can find historic no longer authority docs under _legacy