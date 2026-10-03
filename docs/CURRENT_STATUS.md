# Current Status — A008

Granskad: 2026-09-30
Källrevision: `921fa53` + A008-0203 på `codex/a008-0203-permission-replay`.
Senaste arkitekturimplementation: A008-0199 (checkpointbunden processåterhämtning med effektspärr och workspace-verifiering).
Senaste minneskontextimplementation: A008-0193 (retrieved labels in worker envelope).
A008-0196/0197/0198 provide bounded run-local context, durable checkpoints and automatic live-turn compaction. A008-0199 adds conservative process-loss recovery from a verified completed boundary. Tool replay remains excluded.

## Transactional native edit checkpoint — A008-0205 / successor A008-0207

A008-0205 produced a verified predecessor checkpoint for transactional native text
editing: exact-match planning, bounded stale/ambiguity/closest-match diagnostics,
process-local same-path serialization and candidate validation with atomic same-directory
adoption. Success remains compact and fuzzy matching never writes. Focused model-tool
verification passes 26/26 after rebasing onto current main. The task is intentionally
Superseded rather than Complete: A008-0207 owns final integration/product verification
and the owner-requested Luna/Responses recovery-amplification benchmark.

## Embedded OpenAI Responses continuation measurement — A008-0206

The default `embedded-acme` OpenAI route now exposes exact A008-0198 request
measurement using ACME 0.1.7's exported Responses serializer. Measurement is
performed on the same final JSON body sent to `/v1/responses`, including
stream mode, function-tool schemas and A008's streamed reasoning-summary
augmentation. Luna therefore keeps native Responses and non-none reasoning;
there is no Chat Completions or reasoning-off fallback.

Embedded NVIDIA/KIE/compatible routes remain fail-closed for automatic
continuation until their exact wire serializers are explicitly owned. Focused
embedded-ACME + continuation tests pass 17/17 and the streamed Responses test
proves measured UTF-8 bytes equal the provider-observed request body exactly.

## Windows desktop package — A008-0204

`clients/electron` packages the existing GUI and a portable local host runtime
in a Forge Windows x64 directory. The shell reuses the host by its current
`/health` identity and served HTML surface, or launches the bundled Node host
on the configured loopback endpoint. Host ownership and authentication remain
unchanged; BrowserWindow close/reload is not host shutdown. Renderer privileges
and navigation are restricted, with no preload API. Installer, signing and
publishing are deferred.

The portable packager no longer requires removed engine documentation files
and dereferences the npm workspace protocol package into the runtime bundle.
See the A008-0204 handoff for exact checks and outstanding lifecycle/reconnect
verification.
## A008 GUI/Electron notifications — A008-0208

The GUI now tracks active-to-terminal transitions of the currently observed durable run, distinguishes success, failure and uncertain outcomes, and displays transient notices without replaying on an initial terminal snapshot. Page-title attention is bounded and restored on focus/visibility. A user-enabled completion/failure tone is available in Parameters → Appearance and is off by default. The Electron shell requests bounded native window flashing from the existing page-title signal while unfocused; no host/protocol or renderer privilege changes. Cross-reload/global notification receipts are not implemented. Verification is pending in the task handoff.


- Bekräftade godkännanden/avslag minns per körning och fråga i klientinstansen.
  Äldre live- eller polling-svar återvisar inte frågan och utlöser inte ny POST.
- Minnet består vid chatbyte. Nya permission-/run-ID:n fungerar fortsatt, och
  HTTP-fel registreras inte som lyckade beslut. Hostens behörighetskontroll består.
- [Handoff](handoffs/A008-0203.md) redovisar regressionsfallen och verifieringen.

## MCP strict-policy — A008-0202

- Publicerad ACME 0.1.7 används i embedded runtime och direkt compatible-adapter.
- MCP-katalog/API/GUI har `strict` och verktygsundantag `toolStrict`. Prioritet:
  verktyg → server → true. GUI visar valen; inga befintliga användarval ändras.
- ACP `_meta` för policyn vidare till ModelToolSession och ACME får explicit
  strict per verktyg. Katalog-fingerprint upptäcker policyändringar.
- Originalschemat valideras före godkännande/exekvering i båda lägena.
  Non-strict normaliserar inte otillåtna null-värden till utelämnade fält.
  Befintliga behörigheter, runtime-bindning och verktygsbudgetar består.
- Root/GUI build/typecheck och protocol/client-paketkontroller PASS; GUI 222/222,
  primära MCP/provider/katalog-tester 82/82. Utökad körning 107/108; separat
  semantisk modellfixture faller, se [uppföljning](backlog/semantic-model-parity-fixture.md).
- Lokala process- och wire-fixtures, 0 live-anrop/0 SEK. Ingen garanti för ett
  visst externt schema hos alla providers. [Handoff](handoffs/A008-0202.md),
  [ADR 0060](adr/0060-explicit-mcp-tool-strictness.md).

## GUI-chatt — A008-0201

- Accepterade användarmeddelanden kommer från beständig historik; äldre
  processögonblicksbilder kan inte skriva över dem. Utgående text visas direkt
  och stäms av mot körnings-ID, även när samma text skickas igen.
- Thought och svar uppdateras händelsestyrt via befintlig autentiserad
  activity-endpoint. Vanlig polling återstår för livscykel och återanslutning.
- Observationsavbrott stoppar inte bakgrundskörningen. Chatbyte skyddas mot
  sena svar; parallella behörighetsanrop samordnas. Misslyckat inskick behåller
  text och fel utan automatisk omsändning.
- Lokal verklig process/host med två klienter verifierar separat thought/svar
  före completion och körning efter båda klienternas frånkoppling. Provider eller
  nätverk kan fortfarande gruppera deltan; ingen syntetisk teckenanimation.
- [Handoff](handoffs/A008-0201.md) redovisar tester och tre befintliga, oförändrade
  kontraktstestfel som ligger i [backlog](backlog/http-contract-visited-route-coverage.md).
  [ADR 0059](adr/0059-durable-gui-live-observation.md). Inga live-anrop, 0 SEK.

## Verktygskontext — A008-0200

- `read_file` läser sektioner: nollbaserad offset, normalt högst 200 rader och
  8192 byte resultattext. Hela filens SHA-256 följer med tillsammans med
  radantal, totalantal, nästa offset och explicit fullständighetsmarkering.
- Små ändringar i filer större än resultatbudgeten fungerar nu. Lokal
  läsning/redigering har separat 16 MiB-gräns. Hash från lyckad create/edit kan
  användas för nästa ändring utan omläsning; stale- och unikhetskontroller består.
- Enhetliga LF/CRLF-filer bevarar sin radslutsstil även med andra radslut i
  modellargumenten. Blandade radslut matchas bokstavligt. Ingen fuzzy write.
- Terminal/Git får normalt högst 8192 byte resultattext och accepterar en
  mindre/större explicit gräns inom runtime-budgeten. Trunkering markeras.
- Verktygsbeskrivningar styr mot små sektioner, återanvända revisioner, avgränsade
  sökningar/diffar och MCP för kompletterande förmågor. Ingen automatisk
  MCP-filtrering införs; aktiverade scheman kostar fortfarande kontext.
- Lokal 10 000-radersfixture: 248 890 byte helfil jämfört med 692 byte för en
  sektionsläsning och två edit-resultat. Detta mäter resultatbyte, inte token
  eller verklig modellprestanda. ACME strict-serialisering kontrollerad med fake fetch.
- Build/typecheck PASS; 92 relevanta tester PASS. Inga live-anrop, 0 SEK.
  [Handoff](handoffs/A008-0200.md), [ADR 0058](adr/0058-bounded-native-tool-context.md).

## Godkänd riktning

[PROJECT_BRIEF.md](PROJECT_BRIEF.md) och
[ADR 0055](adr/0055-durable-sessions-and-process-ownership.md) anger den aktuella
runtime-grunden: en beständig projektsession äger sin historik och worktree medan
sessionsprocessen är utbytbar. Klienten observerar/styr sessionen men äger inte
dess livstid. ADR:er före 0055 är arkiverade och saknar aktuell beslutsauktoritet.

A008-0191 implementerar process-per-session-grunden för durable registrerade
Git-projekt. [ADR 0056](adr/0056-minimal-memory-context.md) anger den minimala
modellvända minnesprojektionen och är implementerad genom A008-0189.

## Implementerat nuläge

| Område | Aktuellt beteende |
| --- | --- |
| Projekt och sessioner | Durable projekt-sessioner lagras i Platform SQLite. Intern `conversationId` är uttryckligen samma beständiga identitet som produktens `sessionId` på denna yta; varje writable session har egen beständig modell-/genereringskonfiguration. |
| Workspaces | Nya projektsessioner får egen Git-worktree och branch `a008/session-<sessionId>` före körbar publicering. Base branch och faktisk startcommit sparas. Ingen tyst fallback till projekt-roten finns. |
| Sessionsprocesser | Värden äger högst en levande `SessionProcess` per session. Processen är separat OS-process, återanvänds mellan meddelanden och ersätts med nytt `instanceId`/PID efter död eller explicit stopp. |
| Körningar | Flera sessioner kan arbeta parallellt upp till värdens kapacitet; varje session tillåter en aktiv run åt gången. Accepterat arbete fortsätter när GUI byter session/projekt eller kopplas bort. |
| Historik och återanslutning | Historik kan läsas utan processstart. Publik run-aktivitet lagras med cursor/snapshot så klienten kan återansluta utan att skicka senaste kommandot igen eller dubblera sparade event. |
| Verktyg och approvals | GUI-runnern kör verktyg i sessionens workspace-CWD. Pending approvals ägs av sessionsprocessen och kan besvaras av en behörig ansluten klient; disconnect avgör inte beslutet. |
| Crash recovery | Död sessionsprocess raderar inte session/workspace/historik. En verifierad checkpoint kan fortsätta samma run i en ny process; annars visas osäkerhet. Nästa nya meddelande kan fortfarande starta en ny process. Okända tidigare effekter återspelas aldrig automatiskt och måste granskas före beroende writes. |
| Workspace-fel | Saknad/discarded worktree gör runnen failed med `WORKSPACE_MISSING`; den kör aldrig i projekt-roten. |
| Semantiskt minne | Projektets semantiska ägare ligger kvar i värden. Sessionsprocesser begär retrieval/commit över IPC. Workspace-/revisionskontext bevaras för arbetskopiespecifika observationer. |
| Chatthistorik utan memory | Durable historik är separat från semantiskt minne; answer-, minnes- och external-effect-utfall lagras separat och kan rapporteras/återhämtas utan att göra dem till semantic memory. |
| GUI-status | Connection status, sessionsprocess och run-resultat exponeras som separata signaler. |
| Memory-vy | Memory-inspektion binds uttryckligen till valt durable `projectId`; projektbyte återanvänder inte längre den cacheade legacy ACP-bridgens tidigare memory owner. Memory-inspektion startar ingen sessionsprocess. |
| Globala runtime-inställningar | Semantic/Budgets/Instructions läses och sparas genom en host-owned `RuntimePreferencesStore`, oberoende av chat/session-processens livstid och tillgänglig även innan projektet har en chat. |

Verifiering och detaljer finns i [A008-0191-handoff](handoffs/A008-0191.md) och
[SYSTEMDOC.md](SYSTEMDOC.md).

## Minneskontext — A008-0193

Worker och extractor använder samma librarian-valda retrieval-resultat men olika
presentationer. Worker/userMessage-envelope skickar `id`, tillgänglig
`semanticAddress`, postens läsbara `label` samt villkorad `history`/`provenance`.
Extractor behåller `currentState`/`claim`-representationen som behövs för
state updates och reinforcement. Intern metadata skickas inte till workern. Aktuell state prioriteras,
oberoende adresser med samma värde hålls isär och dubbla råyttringar undertrycks.
Specifika taggträffar begränsar breda domänträffar. Befintlig ID-mappning för
förstärkning finns kvar; läsning förstärker inte.

Detaljer finns i [A008-0193-handoff](handoffs/A008-0193.md).

## Multi-agent context sharding

Operatorn och varje delegerad worker gör separat retrieval mot samma
projektägda semantic memory. Eftersom varje worker samtidigt har en egen
task/session/worktree blir den modellvända memory-projektionen task-specifik i
stället för en union av projektets eller övriga workers hela arbetskontext.
Detta dokumenteras som **task-scoped context envelopes / context sharding by
task** i [MULTIAGENT.md](MULTIAGENT.md) och [SYSTEMDOC.md](SYSTEMDOC.md).

Egenskapen skapar ingen separat worker-memory och gör inte worker-lokal discovery
till shared truth. Verifierad återanvändbar information måste fortfarande
integreras genom normal handoff/evidence och knowledge/state-lifecycle innan
andra workers kan få den som durable current truth vid senare retrieval.

## Observerad operational learning

En live A008-session 2026-09-29 gav agenten en explicit efterhandsfråga om varför
A008-0196 hade varit svår. Svaret identifierade att kodning påbörjades innan
aktuella repo-instruktioner/implementation och exakta task-krav hade verifierats,
vilket ledde till testfel. Den ordinarie post-output-extractorn bevarade detta som
en workspace-kvalificerad active claim med domains för projektledning och
programvaruutveckling.

Det visar att den befintliga knowledge-pipelinen redan kan göra:
`misstag → explicit reflektion → claim → senare retrieval`, utan en separat
reflection-memory-mekanism. Observationen bevisar mekanismen för detta fall; den
gör inte en enskild agents slutsats till universell policy.

## Kvarvarande uttryckliga gränser

- Legacy V1/V2/ACP/standalone-sessioner migreras inte automatiskt till durable
  projektsessioner. Befintliga kompatibilitetsytor finns kvar med egna interna
  identiteter.
- Durable `legacy-unbound` historik kan läsas men får inte köras innan en explicit
  migration binder sessionen till en separat worktree.
- Durable input-/kontrollparitet är inte fullständig mot alla äldre adaptrar;
  bildbilagor stöds nu i durable runs, medan undo och vissa generationskontroller
  fortfarande skiljer sig mellan ytorna.
- Worktree lifecycle gör ingen automatisk merge, push, publicering eller dirty
  delete. Sådana åtgärder är fortsatt uttryckliga.
- Automatisk idle-timeout för en levande sessionsprocess är inte beslutad i ADR
  0055 och införs inte implicit.
- Worktrees är arbetskopieisolering, inte en säkerhetssandbox för fientlig kod.

## Verifiering — A008-0191

Lokala fixtures och implementationstester 2026-09-27, inga live-provideranrop:

- protocol/client package verification: PASS/PASS;
- platform store/workspace/session-process: **10/10 pass**;
- full platform host integration: **13/13 pass**;
- full GUI suite: **215/215 pass**;
- ADR 0055 crash → uncertain effect → replacement process → reviewed effects →
  missing-workspace refusal: PASS;
- `WORKSPACE_MISSING` finns i TypeScript-kontrakt, JSON schemas och OpenAPI.

A008-0191 är därmed implementation/evidence för ADR 0055:s tio acceptanskriterier.
Äldre task-/ADR-texter under historik återaktiveras inte genom sökning eller minne.

## Verifiering — A008-0194

Lokala fixtures 2026-09-28, inga live-provideranrop:

- explicit projektbunden memory-inspektion: PASS;
- host-owned runtime-preferences read/save utan sessionsprocess: PASS;
- fokuserade host memory/settings-tester: **26/26 pass**;
- root + GUI typecheck: PASS/PASS;
- full GUI suite: **216/216 pass**.

Detaljer finns i [A008-0194-handoff](handoffs/A008-0194.md).

## Verifiering — A008-0195

Lokal verifiering mot `cba276a` 2026-09-28, inga live-provideranrop:

- root TypeScript build: **PASS**;
- fokuserade Platform/session/memory-tester: **24/24 pass**;
- durable GUI-klienttester: **6/6 pass**;
- durable session configuration, image run-input och separata
  answer-/memory-/effect-utfall finns i schema/runtime-kontrakten.


## Verification — A008-0196

Final local verification 2026-09-29, no live-provider calls:

- root `npm run typecheck --silent`: **PASS**;
- root `npm run build --silent`: **PASS**;
- continuation + existing ChatSession regressions: **17/17 PASS**;
- core-suite membership: **4/4 PASS**;
- 100 completed tool interactions project one bounded continuation state plus the configured raw tail;
- provider ordering, cumulative prior-state/source preservation, invalid replacement and unfinished-batch behavior have dedicated regressions;
- `git diff --check`: **PASS**;
- canonical checkout dependencies were exposed to the worktree only through a temporary local junction; no packages were installed and no dependency versions changed;
- no live provider calls; **0 SEK**.

## Verification — A008-0197

Final local verification 2026-09-29, no live-provider calls:

- Platform SQLite schema **v5** adds run-owned continuation source/event bindings and versioned checkpoints; v4→v5 migration is additive and verified.
- `PlatformStore.bindContinuationSourceInteraction()` consumes the exact A008-0196 `RunToolInteraction`, resolves its tool-call IDs against retained durable activity events, accepts terminal `completed`/`failed` evidence, and makes each source binding immutable/idempotent.
- Checkpoint save/read reuses the A008-0196 validator, exact run/turn/workspace binding and source coverage; newest corrupt/invalid rows are skipped read-only in favor of the latest earlier valid checkpoint.
- root `npm run typecheck --silent`: **PASS**; root `npm run build --silent`: **PASS**.
- focused checkpoint + core-membership regression: **10/10 PASS** (6 checkpoint + 4 membership).
- existing PlatformStore + platform-host suites: **23/23 PASS**.
- migration/reopen, fabricated or mismatched evidence, failed-tool provenance, immutable retry binding, corrupt-newer fallback, injected transaction rollback and ordinary semantic-memory isolation all have deterministic regressions.
- checkpoints cascade with the authoritative platform run; they are execution state only and never enter ordinary semantic-memory retrieval.
- no semantic reducer, automatic budget trigger/context rebuild, same-turn resume or process-loss replay was added; those remain later-task ownership.
- no live provider calls; **0 SEK**.

## Verification — A008-0198

Final local verification 2026-09-29, no live-provider calls:

- automatic continuation remains opt-in: runtime defaults use `0/0` for pressure/hard ceiling; malformed or half-enabled bounds fail configuration validation;
- OpenAI, NVIDIA, KIE and ACME expose exact selected-route serialized request measurement; the first measured route identity is bound for the live turn and later route drift fails closed;
- pressure is re-evaluated after every completed tool round; only interactions older than the configured raw tail are eligible and no in-flight batch is compacted;
- one bounded, tool-free reducer request may run per completed-operation boundary; canonical A008-0196 validation is applied before A008-0197 checkpoint persistence;
- candidate projection is measured and adopted only after durable checkpoint write; over-hard candidates are not dispatched and canonical chat/raw evidence remains unchanged;
- long-loop regression proves repeated progressive compaction across 12 tool rounds while preserving one recent raw interaction and one logical run identity;
- root `npm run typecheck --silent`: **PASS**; root `npm run build --silent`: **PASS**;
- focused continuation/session regressions: **22/22 PASS**;
- relevant core-membership, runtime-preferences, provider transports, EngineHost, PlatformStore and platform-host suites: **96/96 PASS**;
- additional ModelTools/session-process/checkpoint regressions: **26/26 PASS**;
- ACP agent/memory/process compatibility regressions: **17/17 PASS**;
- selected final verification total: **161/161 PASS**;
- `git diff --check`: **PASS**;
- no live provider calls; **0 SEK**.

Task 4 is implemented by A008-0199. Neither live compaction nor process recovery replays ambiguous effects.

## Interrupted-turn recovery — A008-0199

- SQLite v6 adds atomic recovery supplements and durable effect fences to the
  existing PlatformStore. v5 checkpoints remain readable without gaining resume
  authority. Recovery consumes the checkpoint's eligibility with a new lease.
- A stopped GUI sessionsprocess can be replaced for the same accepted run from
  a validated checkpoint. Raw tail, source refs, runtime turn ID, selected route,
  cumulative tool budget and duplicate protection survive. Public tool activity
  remains visible across process lifetimes; final chat output is committed once.
- Tool dispatch, final completion, cancellation, explicit stop and graceful host
  shutdown invalidate older recovery eligibility. Stale owners cannot save it.
- Workspace/artifact mutation or unverifiable evidence leaves
  `needs_reconciliation` / `CONTINUATION_UNCERTAIN`; missing workspace reports
  `WORKSPACE_MISSING`. Checkpoint findings are explicitly uncertain current facts
  until reviewed; historical evidence is preserved.
- Recovery is conservative: read/list/create/edit expose verifiable local paths;
  opaque terminal/Git/external tool evidence, symlinks/submodules, scan limits and
  races outside the comparison window are not guaranteed recoverable.
- Opt-in pressure requires an exactly measured route. A008-0206 now provides
  exact final-wire measurement for embedded ACME native OpenAI Responses,
  including streaming, function tools and reasoning-summary augmentation.
  Embedded NVIDIA/KIE/compatible routes still fail closed until they own an
  equivalent exact serializer. Defaults remain disabled and no fallback is added.

Verification details and final counts: [A008-0199 handoff](handoffs/A008-0199.md).

Final local verification: root build/typecheck and GUI typecheck PASS;
selected core/runtime suites **107/107**, full platform-host **17/17**, full GUI
**218/218**. Real 110-round continuation replaces the process after round 55,
preserves one run and 110 tool results, and keeps all measured main requests
below 50,000 bytes. No live-provider calls; **0 SEK**.
