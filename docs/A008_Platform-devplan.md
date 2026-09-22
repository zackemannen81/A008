# A008 Platform — utvecklingsplan

Status: planeringsbild 2026-09-23. Inte ett nytt kontrakt.
Authority: [A008_PLATFORM_SPEC.md](A008_PLATFORM_SPEC.md) v1.2, [ADR 0048](adr/0048-platform-program-and-durable-work.md) och programmet [A008-0160](tasks/A008-0160_platform-implementation-program.md).
Observerat läge: [CURRENT_STATUS.md](CURRENT_STATUS.md). Main vid den här bilden: `53d0a5b`.

Varje rad nedan blir en eller flera frysta uppgifter med necessity gate, eget scope och egen verifiering. Den här filen fördelar etapperna. Den godkänner inte att en etapp är klar.

## Var programmet står

P0 och den lokala P1-grunden är mergade. Plattformen är opt-in. `A008_PLATFORM_PATH` öppnar en egen SQLite-fil utanför repot. Utan den sökvägen är `/v3` avstängt och V1/V2 är oförändrade.

Det som redan finns:

| Leverans | Uppgift | Vad som är sant på main |
| --- | --- | --- |
| Kontrakt och program | A008-0160, ADR 0048 | Riktning, V3-gräns och P0-beslut D1–D5, D7, D8, D11, D13–D16 |
| Store | A008-0161 | Scoped SQLite för konversationer, runs, kvitton, outbox, lease och återhämtning |
| Wire | A008-0162 | Additivt V3-schema. V1/V2-artefakter oförändrade |
| Seed | A008-0163 | Backendägd historik in i befintlig runtime, utan legacy-skrivning eller semantisk replay |
| Host | A008-0164 | Opt-in `/v3`, textkörning, frånkoppling avbryter inte, processdöd lämnar `needs_reconciliation` |
| SDK | A008-0165 | `createPlatformV3Client`, ett HTTP-försök per mutation |
| Testisolering | A008-0166 | Host-fixturer läser inte operatörens MCP-katalog |
| GUI-yta | A008-0167 | Platform-sida bredvid vanlig chatt. V1-chatt och sparad historik är orörda |
| Admin-CLI | A008-0168 | `info`, `list-conversations`, `get-run`, `cancel-run` |

Kvar innan P1 kan stängas: explicit import av befintliga chattar, och de delar av A01–A08 som text-only-snittet inte täcker. Verktyg, godkännanden, publik avstämning och tyst migrering finns inte.

## Milstolpar

### Målbild

En kanonisk backend. Beständiga konversationer och runs oberoende av klientens livstid och av om semantiskt minne är på. Parallella projekt. Tunna klienter. Tydliga execution targets. Docs-First multi-agent som produktfunktion över samma ägare. A008 äger kognition, minne, verktyg och urval. ACME exekverar modeller.

### Första arkitekturella milstolpen

Källa: spec avsnitt 24. En gemensam backend, två oberoende webbläsarklienter, beständigt state och parallella runs. Den får inte bero på att ett desktopfönster är öppet.

| Steg | Observerbart utfall | Etapp |
| --- | --- | --- |
| 1 | Klient A och B är behöriga och öppnar samma projekt P | P2 |
| 2 | A startar en run i konversation X. B ser status och accepterat meddelande utan egen providerkörning | P2, bygger på P1 |
| 3 | A byter till projekt Q. B arbetar i P:s konversation Y. Båda gör framsteg inom kapaciteten | P1 lokalt, P2 med två användare |
| 4 | A stängs. B ser fortsatt arbete och kan hantera behörigt godkännande | P1 för frånkoppling. Godkännande är senare än text-only |
| 5 | A öppnas igen och ser samma committade meddelanden, artefakter och run-state. Memorystatus är separat | P1 för text och historik. Artefakter senare |
| 6 | Backend stoppas och startas under fake-execution. Säkert köat arbete fortsätter. Oklart arbete blockeras | P1, bevisat för text i A008-0164 |
| 7 | Användare utan projekträtt och användare i annan tenant nekas samma data | P2 |

Device Runtime krävs inte för det här serverbeviset. Den krävs innan samma löften gäller filer och terminal på en annan maskin.

### P1-exit

Två projekt och två konversationer arbetar parallellt. Klientstängning och processkrasch följer A01–A08. Minsta admin-CLI finns. Chatpersistens beror inte på memoryläge.

### P2-exit

Hela milstolpen i avsnitt 24, plus A09–A15 och relevant migrerings- och restorebevis.

### Hosted release

Egen grind efter isolering, last, restore och drift. En remote-demo räcker inte. Den ligger efter P4.

### Villkorad desktop

Electron byggs bara när ett konkret Chromium/Node-behov finns. Ingen andra A008-motor.

## Etapper

### P0 — Integrationskontrakt och beslut

Status: klar, PR #99 och ADR 0048.

Minsta leverans var versionsstrategi, identiteter, bakgrundssemantik, ägare för context och meddelanden, writescope, ACME-gräns och migreringsriktning.

Låsta val som senare etapper inte får rita om:

- V3 är eget kontrakt. V1/V2 behåller sin session- och omstartssemantik.
- En icke-terminal skrivande run per konversation, inklusive `needs_reconciliation`.
- Första drift är en backendprocess och en separat SQLite-store. Ingen kunskapstabell öppnas därifrån.
- Lokal tenant ägs av servern. Ingen anonym V3 och ingen klientvald behörighet.
- Befintliga chattar migreras inte tyst. Explicit import kommer före byte av GUI-transport.
- Dispatch sparas före extern körning. Oklart dispachat arbete replayas inte.

### P1 — Beständigt parallellt arbete lokalt

Status: grund mergad, etappen öppen.

| Del | Status | Acceptans |
| --- | --- | --- |
| Store, schema, seed, host, SDK | Klar | A008-0161–0165 |
| Frånkoppling och processkrasch för text | Klar i A008-0164 | A01, A05, A06 för text-only |
| Konflikt vid samma revision och kvitto-replay | Klar i store och host | A04, A05 |
| Lease som stoppar sen skrivare | Klar i store | A07 |
| Cancel mot completion | Klar för text, utan target-nätverksbrott | A08 delvis |
| Två projekt och två konversationer | Klar för text. MCP, artefakter och samtidiga memoryförslag är inte med | A02, A03 delvis |
| Minsta admin | CLI för info, list, get och cancel. Ingen backup och ingen publik avstämning | Spec avsnitt 18, första skiktet |
| GUI | Additiv Platform-sida. V1 är kvar | ADR 0048 D8 |
| Explicit import | Inte startad | A22, A23 och spec avsnitt 23 steg 4–5 |

Nästa frysta uppgift i P1 är importen. Ordningen från spec avsnitt 23:

1. Inventera befintliga projekt-ID, registry, memoryläge, SQLite, konversationer och klientprofiler.
2. Plattformstillägget är redan fryst.
3. Beständiga ägare finns för nya V3-konversationer.
4. Migrera innehåll med bevarade ID eller en verifierbar mapping. Memory-off kräver ett eget val. Förlorad processlokal historik får inte påstås vara migrerad.
5. Växla en ägare i taget. Ingen obestämd dubbelskrivning. Rollback före writes, framåtriktad fix efter writes.
6. Byt GUI-transport först därefter.
7. Separera lokal execution till en target först när fjärrklienter ska använda maskinens verktyg.

Importen ska ha dry run, backup, antal och referenskontroll. Den får inte ersätta projekt med tomma namespaces eller slå ihop projekt med samma namn.

### P2 — Remote web och fler användare

Status: inte startad. Kräver stängd P1-grund och ett eget beslut för identitet och medlemskap.

Minsta leverans: auth och memberships, isolering på servern, eventreplay och snapshot, GUI som fristående klient utan hostimports.

Exit: milstolpen i avsnitt 24 och A09–A15. En användare utan rättighet och en annan tenant ser inga data, events, counts eller jobb. Återkallad grant stoppar nya operationer. SDK och GUI installeras utan interna hostimports.

### P3 — Hybrid execution

Status: inte startad. Lokal targetadapter kan förberedas i M1 innan remote enrollment finns.

Minsta leverans: enrollment, Device Runtime, scoped capabilities och workspaces, devicekanal och execution verification evidence.

Exit: samma run kan startas från en webb- eller mobiltestklient mot en lokal target. A16–A18. Offline target väntar. Ingen dold serverfallback. En lokal effekt upprepas inte när evidens saknas.

### P4 — Administrativ produkt och drift

Status: inte startad. P1-CLI:t är inte den här konsolen.

Minsta leverans: Admin Console över redan befintliga kontrakt för health, kvoter, kostnad, audit, backup och restore.

Exit: A19–A21 och en dokumenterad self-hosted release. Audit får inte visa otillåten prompt eller klartexthemlighet. Restore startar inte gamla osäkra effekter.

### P5 — Tauri

Status: inte startad.

Primär desktop-host och valfri bakgrundstjänst på samma API och devicekontrakt. Att stänga fönstret och att stoppa runtimen ska ge olika, korrekta utfall.

### P6 — Expo iOS och Android

Status: inte startad.

Samma projekt, konversationer, minne och artefakter. Tung körning ligger på backend eller registrerad target. Push är inte ett slutbevis. Efter app-suspend fortsätter samma conversation, approval, artifact och targetarbete.

### P7 — Android TV

Status: inte startad.

Fjärrkontroll, röst och monitoring över samma kontrakt. Inga TV-specifika backendägare.

### Villkorad — Electron

Status: vilande. Ingen uppgift öppnas utan ett konkret integrationsbehov.

## Multi-agent-spåret

Eget spår på samma P1-ägare. Det väntar inte på remote web, alla klienter eller hosted multi-tenancy. Det är inte ett nytt bevis av arbetsmetoden.

| Leverans | Produktarbete | Acceptans | Status |
| --- | --- | --- | --- |
| M1 Coordination och gatekeeper | Bind charters och arbetsytor till delegationer och runs. Lokal processadapter, scopes, riktad inbox, GUI-status | A25, A27, A29, A30 | Inte startad. Adapterdetaljer fryses här, före dispatch |
| M2 Context governance | Master- och workerpaket, källmanifest, expansion, versionsbunden cache | A26, A31 | Inte startad. Beror på M1 |
| M3 Execution continuity | Checkpoints, inboxposition och Git-avstämning mot P1-återhämtning. Worker- och masterbyte | A28, A32 | Inte startad. Beror på P1 och M1/M2 |
| M4 Economics och audit | Budget, usage och audit över poster som samlats från första integrationen | A33 | Inte startad. Audit ändrar inte tidigare utfall |

## Beroenden

```text
P0
 └─ P1 store, wire, seed, host, SDK, additiv GUI, admin-CLI
     ├─ P1 import, sedan GUI-transportbyte
     ├─ M1 ── M2 ── M3
     │    └─ M4 när usageposter finns
     └─ P2 ── P3 ── P4
              └─ P5, P6, P7 på stabilt backend- och devicekontrakt
Electron endast vid konkret behov
```

M1 kan använda en lokal targetadapter innan P3 har remote enrollment. P2 får inte börja med fjärridentitet förrän det beslutet är taget. Ingen etapp får öppna en andra kognition, en andra memorywriter eller en andra scheduler.

## Så arbetet fortsätter

Operatorn claimar ID på main, fryser en charter och delegerar ett scope till en isolerad klon. Högst sex writers. Worker mergar inte. Merge sker när exitgrinden är observerad, inte när en worker säger klar.

Nästa rekommenderade charter är explicit import av befintliga chattar, med dry run och memory-off-val, utan att byta V1-ytan i samma uppgift.
