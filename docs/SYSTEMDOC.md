# System Document — aktuell implementation

Granskad: 2026-09-30; A008-0203 hindrar upprepad leverans av behandlade GUI-godkännanden.
Källrevision: `921fa53` + A008-0203 på `codex/a008-0203-permission-replay`.
Verifiering och avgränsningar: se CURRENT_STATUS och task-handoffs.

## Electron desktop client — A008-0204

`clients/electron` is a thin Windows x64 shell around existing `gui/` and the
local GUI host. On startup the single-instance Electron main process resolves
the loopback bind/port, probes `/health` identity and the host-served GUI HTML,
then reuses a compatible host or launches the packaged Node/runtime host as a
separate, detached OS process. Renderer creation waits for the compatible local
GUI surface. Bind/start conflicts trigger endpoint re-probe; incompatible
listeners are left untouched. Host PIN/authentication remains host-owned.

The renderer loads from the host origin so existing API/WebSocket origin and
cookie behavior remain in force. BrowserWindow disables Node integration and
enables context isolation, sandbox and web security; new windows and navigation
away from the configured origin are blocked. No preload is exposed. Closing the
window does not signal the host. A second per-profile launch focuses the current
shell through Electron's single-instance lock.

Forge's Windows x64 package carries the existing host, production runtime,
Node executable and GUI assets under `resources`. Installer/signing/publishing
are outside A008-0204. Electron adds no runtime, session, accepted-work or lease
ownership.
`DurableChatClient` and `App` project terminal transition notifications from existing durable run observations. The renderer keeps a run-identity/status edge tracker for its lifetime, so initial completed history stays quiet and polling does not duplicate notices; this is not durable across reloads or shared among clients. The GUI shows a dismissible result, blinks a localized document title, and plays a generated brief Web Audio tone only when the Appearance preference `notifications.sound` is enabled. The preference is local, off by default, and preserves other `a008.preferences`; unavailable storage and rejected/unsupported audio are non-fatal. Title attention ends on window focus, visible-document transition or an eight-second timeout. Electron's existing BrowserWindow observes only its same-origin GUI page-title updates: while unfocused, it retains the outcome title and requests a bounded native frame flash. Focus or the timer stops flashing. Existing sandbox/context-isolation/Node restrictions remain; no preload, IPC, host endpoint or run lifecycle changes.


MCP-serverposter i användarkatalogen och `/v1/mcp-servers` accepterar valfria
`strict` och `toolStrict`. Verktygsundantag använder ursprungligt MCP-namn,
inte modellens hashade alias. Exempel: `"strict": false, "toolStrict": {"inspect": true}`.
Prioritet: verktygsundantag → serverstandard → true. GUI:s MCP-editor visar
serverstandard och redigerbara undantag; inga sparade användarval ändras automatiskt.

`core/mcp-tool-policy.ts` läser den namespacade ACP-utökningen
`_meta["a008/toolPolicy"]`. ModelToolSession löser policyn vid discovery och
ACME-mappningen skickar explicit boolean per verktyg. `acme-engine` och direkt
Chat Completions-adapter använder 0.1.7. Ändrad policy ingår i MCP-fingerprint
för omstartsdiagnostik. Aktiva verktygssessioner behåller sin katalog; öppna en
ny GUI-chatt för att säkert använda sparade ändringar.

Argument valideras mot originalschemat före godkännande och exekvering i båda
lägena. Bara strict använder befintlig normalisering av optional-null till
utelämnat fält. Runtime-ägd session-bindning och containment/replay-spärrar
består. Non-strict ger ingen automatisk schemaförenkling eller fallback;
providerfel exponeras. Ogiltiga argument ger befintligt invalid_arguments-resultat
inom befintlig verktygsbudget. Strukturerade slutsvar påverkas inte.

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

ADR 0059: live aktivitet läses via `/v1/chat/v3/runs/:id/activity` med en
ephemeral `liveRevision`. `?afterLive=<revision>` väntar på nästa host-uppdatering
eller högst 25 sekunder, utan fast pollingfördröjning. Detta är event-driven
long polling med kumulativa snapshots. Thought/svar ersätts vid mottagning och
konkateneras inte igen. Vanlig view-polling finns kvar för status och reconnect.
Värden kontrollerar behörighet före väntan och före leverans. Frånkoppling städar
väntaren utan cancellation; live-revisioner rensas när GUI-runnen avslutas.

GUI:t behåller beständiga meddelanden även om en process-snapshot fortfarande
bara innehåller tidigare historik. Live-suffix (exempelvis pending bild) tillåts
när hela den beständiga prefixhistoriken finns i snapshoten. Ny användartext visas
under acceptans med `pendingTextUncommitted` och ersätts av beständig text när
den accepterade körningens user-post syns. Upprepad identisk text är en ny post.
Misslyckad submission behåller text/fel utan automatisk retry. Abort/selection-
epoch hindrar gamla observer-svar från att påverka en annan chat.

A008-0203: DurableChatClient minns HTTP-bekräftade behörighetsbeslut per
`runId`/permission-ID under klientinstansens livstid, även efter chatbyte.
Live-observation och refresh filtrerar bort dessa gamla frågor; sändvägen
spärrar också upprepning. Det gäller både godkännande och avslag. Samtidiga
anrop delar fortsatt samma promise. Misslyckade anrop markeras inte som klara,
och nya frågor/körningar påverkas inte. Minnet är lokalt och inte ett löfte om
exakt-en-gång mellan klienter eller efter sidomladdning; värdens 409-spärr består.

Memory-vyn skickar valt durable `projectId` till `/v1/memory`; värden resolve:ar
projektets runtime via `ProjectRuntimeRegistry` och inspekterar just den
projektägda memory-store:n. Legacy-klienter utan `projectId` kan fortfarande gå
via den äldre ACP-bridgen, men durable projektbyte är inte längre beroende av
hostens globala `workspace`/bridge-cache.

Semantic/Budgets/Instructions använder `/v1/runtime-preferences` mot en host-owned
`RuntimePreferencesStore`. Read/save/reload kräver därför varken vald chat,
worktree eller levande sessionsprocess. Durable session snapshots kan bära samma
preferences för befintlig UI-kompatibilitet, men den globala settingsytan ägs inte
av sessionens livscykel. Modell och generation parameters lagras separat per
durable conversation med revisionskontroll och kan inte ändras under aktiv run.

## Beständig körningsdata

[PlatformStore](../src/platform/platform-store.ts) lagrar conversation,
meddelanden, körningar, kommandokvitton, händelser och lease-/återhämtningsdata
i SQLite. Conversation innehåller workspace-ID, som kopieras till accepterad
körning. Äldre obundna poster markeras `legacy-unbound`.

[Coordinator](../src/platform/coordinator.ts) schemalägger accepterat arbete,
hanterar ägarskap och återhämtning samt håller aktiva GUI-körningar.
Utgångna leases hanteras konservativt: redan dispatchat arbete med okänt
utfall kan bli `needs_reconciliation`, utan implicit återspelning.

SQLite-schema version 6 lagrar även per-session-konfiguration och run-input för
bilagor samt A008-0197:s run-owned continuation checkpoints/source bindings,
utöver senaste sessionsinstans och publik körningsaktivitet.
Version 6 lägger additivt till checkpointbundna recovery-supplement och
effektspärrar. Gamla checkpoints får ingen implicit återupptagningsrätt.
Varje publik förändring får en stigande cursor; svarstext sparas som append/replace,
verktyg uppdateras med ID och väntande godkännanden kan sättas eller tas bort.
En materialiserad snapshot och dess cursor skrivs i samma transaktion. Klienten
kan läsa snapshot och därefter `activity-events?after=<cursor>` i sidor om 100.
Händelser med redan behandlad cursor ignoreras. GUI:s live-observation och
fallback-polling ersätter aktivitetssnapshoten och lägger aldrig samma textdelta
till svaret två gånger. LiveRevision är separat från den beständiga cursorn.
Privat resonemang och interna enginesnapshotar är endast liveinformation.
Run-resultat skiljer beständigt på `effectStatus`, `answerStatus` och
`memoryStatus`, så ett sparat answer inte behöver behandlas som misslyckat bara
för att efterföljande memory-arbete gör det.
Historikläsning skapar varken sessionsprocess eller semantisk runtime.

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
CWD. Saknad eller discarded arbetsyta ger run-felet `WORKSPACE_MISSING` och ingen
modell-/verktygsexekvering startas. Projekt-roten är ingen implicit fallback. Den beständiga conversation-identiteten är produktens `sessionId`.
Nya branches heter `a008/session-<sessionId>`; worktree-sökvägen använder hela
identiteten. Utgångsbranch och faktisk startcommit lagras separat. Ändrad rot
gäller nya sessioner; befintliga worktrees flyttas inte.

## Exekvering och processgräns

Coordinator öppnar projektets gemensamma runtime via
[ProjectRuntimeRegistry](../src/engine/project-runtime-registry.ts) och äger
[SessionProcess](../src/platform/session-process.ts) per beständig session.
Den forkade [session-worker](../src/platform/session-worker.ts) är en separat
OS-process med worktree som CWD. Den lever mellan meddelanden. EngineHost och
GuiRunSession skapas för varje GUI-körning inne i sessionsprocessen; deras
interna session-ID är tillfälliga adapteridentiteter. Offentlig V3 använder
textadaptern i samma processmodell. Värdens exklusiva lease och seriella
kommandointag kombineras med en aktiv körning per session och lokal busy-spärr.

Privat [SessionIpc](../src/platform/session-ipc.ts) använder Node:s ärvda
processkanal, utan nätverksport. Kuvertet har version 1, `instanceId`, request-ID,
request/response/cancel och operation. Körningsbundna anrop innehåller `runId`.
Handshake verifierar child-PID; PID används aldrig ensamt för att återansluta
en gammal process. Processbyte ger nytt instanceId och PID. Värden accepterar
aktivitet och minnesanrop endast från aktuell instans och aktuell körning.

Väntande verktygsgodkännande finns i sessionsprocessen och speglas till värden.
Alla anslutna behöriga klienter kan svara med dess ID. Frånkoppling ger inget
beslut. Avbrott/explicit processstopp avslutar det ägda processträdet; workspace
och historik består. Efter avbrott med okänt utfall markeras körningen
`needs_reconciliation`. Ett nytt meddelande får starta en ny instans men gamla
kommandon återspelas inte. Tills användaren granskat effekterna tillåts endast
filinspektion i GUI:s verktygsväg; övriga verktyg nekas. Revisionstyrd
`effect-review` markerar den gamla körningen som avbruten/granskad, inte lyckad.
En redan startad inspektionskörning behåller spärren till sitt slut.

GUI visar anslutning, process och körningsutfall separat. Runtime details har
processstatus/PID, uttryckligt processstopp och kontroll för granskade effekter.
Värdshutdown avbryter och inväntar ägda processer och slutliga lagringsskrivningar.
Värden kan köras utan ett öppet GUI; stängning av själva värden är ett annat steg.

## Run-local continuation context — A008-0196

`src/core/chat-continuation.ts` defines a versioned, UTF-8-bounded `RunContinuationState` with distinct verified facts, hypotheses and completed actions. Every entry must cite retained source interactions. The opt-in `ChatTools.continuation` policy in `src/core/chat-session.ts` offers only complete rounds older than the configured raw tail to a caller-owned reducer. Output is validated for run ID, shape, byte limit and resolvable source refs before projected provider context is replaced. Recent rounds remain raw; in-flight tool operations are never passed to the reducer. Canonical raw messages stay untouched. Without the explicit policy, existing full wire history is preserved. Continuation data is sent as untrusted user context, not system instruction or semantic memory.

Projection preserves provider chronology: the current user message remains before temporary continuation data and the recent raw assistant/tool tail. A replacement state must retain source coverage already represented by the previous valid state as well as newly compacted interactions, and the reducer receives a detached full prior state including its run binding. Invalid or source-dropping output therefore cannot silently erase already compacted work.

This slice does not implement a semantic reducer, context-budget triggers, automatic context rebuild or process-loss recovery. Durable checkpoint persistence is now implemented separately by A008-0197; A008-0196 remains the source of truth for the continuation-state/source-reference contract.

## Durable run-continuation checkpoints — A008-0197

`PlatformStore` owns continuation persistence in the existing local Platform SQLite database. Schema v5 adds run-owned source bindings, source-event links and versioned checkpoint rows. Checkpoints inherit the authoritative platform run lifecycle through `ON DELETE CASCADE`; no independent retention policy or replay authority is introduced.

`bindContinuationSourceInteraction()` consumes the exact completed A008-0196 `RunToolInteraction`. The runtime interaction ID remains `${runtimeRunId}:n`; PlatformStore derives the runtime run identity and tool-call IDs from that object, resolves each tool call against retained durable `A008_session_activity` evidence, and stores only the binding to the authoritative raw event. Terminal successful and failed tool evidence are both admissible. Rebinding the same source to the same interaction is idempotent; attempting to mutate an existing source reference to different evidence fails closed.

`saveContinuationCheckpoint()` validates the canonical `RunContinuationState` against the durable source set, exact platform run/turn/workspace binding and byte limit before an atomic append. `latestContinuationCheckpoint()` validates rows newest-first and returns the latest valid checkpoint; malformed or mismatched newer rows are skipped without mutation so an older valid checkpoint remains recoverable. Checkpoint payloads are execution state, are not copied into the raw evidence stream, and are not candidates for ordinary semantic-memory retrieval.

A008-0197 does not itself choose when to compact or authorize recovery/replay. A008-0198 owns live context pressure and A008-0199 owns conservative process recovery, as described below.

## Automatic live-turn context pressure — A008-0198

A008-0198 activates A008-0196/0197 only when runtime preferences configure both a finite soft pressure threshold and a larger hard serialized-request ceiling. Defaults remain disabled (0/0). After every completed tool round, `ChatSession` measures the next complete provider wire request through the selected transport's real serializer. Direct OpenAI/NVIDIA/KIE transports expose exact serialized-body measurement. A008-0206 adds exact measurement for the default embedded-ACME native OpenAI Responses route by reusing ACME's Responses serializer and A008's final reasoning-summary wire transform. Embedded NVIDIA/KIE/compatible routes still fail closed when automatic continuation is enabled until an exact serializer owner is wired.

The first exact measurement binds the selected route identity for the live turn. Every later main request, reducer request and rebuilt candidate must report the same route identity. Route drift, unavailable measurement, invalid bounds or a request above the hard ceiling prevents dispatch.

When the soft threshold is reached and older completed interactions are eligible, the selected provider route performs one tool-free bounded reducer call for that completed-operation boundary. Reducer output is strict JSON validated by the canonical A008-0196 state/provenance/byte contract. The validated state and its raw source interactions are persisted through the A008-0197 PlatformStore bridge before any live projection is adopted. A candidate projection is then built from authoritative current-turn inputs, continuation state and the configured recent raw tail, measured against the same hard route ceiling, and adopted only if it fits.

Raw execution evidence and canonical conversation history are never rewritten by compaction. In-flight tool work is never eligible. Repeated completed tool rounds may therefore cause repeated bounded compactions during one logical run while older raw provider/tool rounds leave active model context. Failed reduction, persistence, route validation or candidate measurement leaves the prior live projection usable and prevents unsafe/over-budget dispatch. A008-0198 does not itself resume after process death or authorize replay; A008-0199 supplies the bounded recovery path below.

## Interrupted-turn recovery — A008-0199

ADR 0057 refines ADR 0055 without granting tool replay. Automatic continuation
still requires Task 3's opt-in pressure policy and an exactly measurable selected
route. Direct dispatch, runtime timeout composition and debug tracing forward
the underlying serializer's measurement. A008-0206 makes the embedded-ACME
native OpenAI Responses route exactly measurable as well; embedded routes
without an owned exact serializer still fail closed and no estimated fallback
is introduced.

At each compacted completed boundary, PlatformStore atomically validates the
current lease, binds newly completed source interactions and the recent raw tail,
saves the canonical checkpoint and adds a versioned recovery supplement. It
contains the raw tail, cumulative consumed tool IDs, interaction count, runtime
run ID/route and workspace evidence. Private provider reasoning is omitted from
the persisted recovery tail. Earlier bindings remain authoritative; already
bound historical rounds are not retransmitted at every checkpoint.

Before every subsequent tool execution, and before final completion/post-output
work, the child awaits a host-owned durable effect fence. Earlier checkpoints
cannot resume after that fence. Cancellation, explicit process stop and graceful
host shutdown also invalidate eligibility. A disconnected process cannot save
state using a stale instance/run/lease. The usual uncertain-effect status remains
in place until conservative recovery or explicit effect review resolves it.

The existing coordinator discovers the latest valid checkpoint for an unfinished
GUI run after process loss or lease expiry. It requires a stopped former owner,
no newer accepted work in that session, exact run/workspace/source bindings and
matching Git/file evidence. The ordinary lease transition consumes recovery
eligibility atomically before dispatching the replacement process. A second
crash needs a new checkpoint; the same recovery authorization cannot loop.

Evidence hashes HEAD, branch, index, tracked/nonignored files and explicitly referenced
local artifacts (including ignored files). Local read/list/create/edit tools
expose those artifact paths. Terminal, Git and other opaque tool effects make
the accumulated evidence unverifiable for automatic recovery. Symlinks,
submodules, unsupported file types, scan failure, more than 10,000 paths or more
than 64 MiB of file content also fail closed. Comparison is not a filesystem
transaction and does not prevent subsequent external writes.

Changed/unverifiable evidence leaves `needs_reconciliation` with
`CONTINUATION_UNCERTAIN`; missing workspace uses `WORKSPACE_MISSING`. The error
qualifies checkpoint findings as uncertain current facts; the historical
checkpoint and raw evidence remain unchanged. No stale finding is dispatched
as verified current context. Existing effect review remains the exit path.

A successful replacement rebuilds current authoritative input/memory context,
validated continuation state and raw tail under the same durable run/session/
workspace and runtime turn identity, with a new process instance/PID. Cumulative
tool budget, duplicate IDs, route identity and full serialized request ceilings
remain enforced. Stored tool calls are context only and are never executed by
restoration. Public tool activity merges by ID across process lifetimes;
cursor events and canonical chat history remain durable. Normal memory intake
runs after final completion; recovery data is never a retrieval candidate.

## Minne och kontext

ProjectRuntimeRegistry återanvänder en gemensam projekt-runtime och dess
A008-ägda semantiska minne. Worktrees skapar inte oberoende semantiska ägare.
Sessions-CWD och projektets minnesidentitet är separata.

### Task-scoped context envelopes / context sharding by task

Multi-agent-delegation delar inte bara execution utan även den aktiva
modellkontexten. Operatorn och varje worker har en egen session/turn och gör
därför en separat retrieval mot samma projektägda semantiska minne. Den
modellvända memory-projektionen byggs för den aktuella requesten; den är inte en
kopia av hela projektminnet och inte en union av övriga workers kontext.

Konsekvensen är en task-specifik context-envelope per worker. En worker som
arbetar med exempelvis desktop-paketering kan få relevant host-, auth- och
desktop-knowledge medan en annan worker i samma projekt kan få memory- eller
tool-relaterad state. De delar durable project knowledge men behöver inte bära
varandras råa tool-historik eller arbetskontext. Detta dokument kallar
egenskapen **context sharding by task**.

Det är en emergent kombination av befintlig worker-isolation, request-specifik
retrieval/projection och gemensamt project memory; det finns ingen separat
worker-memory-databas som garanterar specialisering. Kvaliteten beror därför på
retrieval, necessity/budgetering och att användbar worker-lokal information
integreras genom normal knowledge/state/evidence-lifecycle.

Worker-lokal discovery, tentativa slutsatser och tool output blir inte
automatiskt shared truth. När verifierad återanvändbar information committas
eller integreras enligt normala ägarregler kan senare retrieval projicera den
nya current state till Operatorn eller andra workers. Hidden model state eller
worker-transkript används inte som cross-worker authority.

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

[serialization.ts](../src/memory/serialization.ts) separerar nu worker-presentation
från extractor-presentation utan att ändra retrieval eller memory-engine. Worker-
envelopen skickar `id`, tillgänglig `semanticAddress`, den retrieved postens
läsbara `label` samt villkorad `history`/`provenance`. Extractorn behåller den
engine-orienterade `currentState`/`claim`-representationen som används för state
updates och reinforcement. Det yttre worker-kuvertet heter
`A008_memory_context_v2` och innehåller användarens meddelande separat. Tags,
domains, kind, evidenceId, scope och authority skickas inte till workern.

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

Post-output-pipelinen kan även bevara återanvändbar operational knowledge från
assistentens explicita reflektion. I en observerad A008-0196-session svarade
agenten på varför uppgiften blivit svår; extractorn skapade därefter en
workspace-kvalificerad claim om att implementation hade börjat innan aktuella
repo-instruktioner och exakta krav verifierats, med följden testfel. Claimens
domains klassificerades som projektledning/programvaruutveckling. Detta använder
ingen särskild reflection-store: det är vanlig generated knowledge med normal
provenance, scope, lifecycle och retrieval. En enskild sådan observation är inte
automatiskt en global workflow-regel.

Sessionsprocessen öppnar inget projektminne i SQLite. Retrieval, post-output-
uppdatering och ACP:s minnesoperationer går över IPC till värdens projektägare.
Den lokala konversationskopian i child-processen är flyktig och seedas från
värdens sparade historik för varje körning. Chatthistoriken kräver inte minnesmotorn.

Nya sessionsobservationer kvalificeras konservativt med workspace-ID: claimtext
och strukturerade entity-adresser skiljer arbetskopior åt. Relation classification
kan inte supersede en annan arbetskopias claim. Turn-källan behåller observerad
HEAD och markeringen `working tree observation`; detta påstår inte att ocommittade
filer motsvarar exakt HEAD. Projektionen tar med denna provenance även utan en
explicit källfråga, eftersom kvalifikationen behövs för tolkningen. Samma
projektägare kan fortfarande hämta flera arbetskopiors observationer. Globala
källor och äldre claims skrivs inte om eller tilldelas påhittad workspace-historik.
Detta gör inte en modellgenererad observation automatiskt verifierad.

## Native tool context — A008-0200

ADR 0058 defines the native read contract. `read_file({path, offset?, limit?,
max_output_bytes?})` returns exact UTF-8 content for a line section, the SHA-256
of the whole local snapshot, zero-based `offset`, returned `lines`, `total_lines`,
`next_offset` (null at EOF) and `complete` (only true for the entire file).
Defaults are 200 lines and 8192 serialized result-text bytes, capped by the runtime
tool-output budget. Byte-limited reads shorten the page at whole-line boundaries;
a single line that cannot fit fails explicitly. Empty files return zero lines.
Trailing line terminators do not invent an extra empty line. Ranges past EOF return
an empty page at EOF. Optional null sentinels from strict providers use the defaults.

Local snapshot processing reads at most 16 MiB plus one detection byte, independent
of the model output budget. Hashing still reads local file bytes; only the selected
section enters model context. Binary/non-UTF-8 files and larger snapshots are refused.
`edit_file` uses the same snapshot ceiling rather than the output ceiling. It requires
the whole-file hash and exactly one exact match, keeps compact success results with the
new hash and allows chaining edits without redundant reads. Uniform LF/CRLF/CR files
normalize request line endings to the file style; mixed styles stay literal. A008-0205
adds process-local same-path serialization plus candidate write/validation and atomic
same-directory adoption. Fuzzy similarity is diagnostic only and can never authorize a
write. Stale, ambiguous and no-match outcomes are non-destructive and may include a
bounded current section, occurrence anchors or closest-match/diff recovery capsule.
A008-0207 owns final integration and live recovery-amplification verification.

`exec_command` and `git` accept `max_output_bytes`, default 8192, bounded by
`toolOutputBytes`. Their final result text is capped with explicit truncation;
the small status/JSON envelope sits outside the text-byte ceiling. Native tool
descriptions direct the model toward small file sections, reuse of successful
revision hashes, narrow rg searches, scoped Git output and targeted tests. MCP
remains available for extra capabilities. All enabled MCP definitions still enter
the catalog; model compliance and live token savings are not guaranteed.

Approvals, workspace boundaries and continuation artifact paths are unchanged.
Existing callers using only path must now check completeness for larger files.
Local verification and byte measurements are recorded in the A008-0200 handoff.

## Övriga befintliga ytor och begränsningar

Repositoryt innehåller även CLI/ACP, modell-/provideradaptrar, MCP-verktyg,
filbrowser/editor, källmaterial, bilder och klient-/protokollpaket.
[FILESTRUCTURE.md](FILESTRUCTURE.md) visar deras platser. Omläggningen har inte
ändrat dessa implementationer eller verifierat alla deras beteenden på nytt.

Vanliga durable GUI-runs kan bära en bildbilagas locator och media type som
beständigt run-input. Undo och generationsinställningar är fortfarande inte
likvärdigt exponerade mellan alla adaptrar.
Modellens bildgenereringsverktyg hanteras i GUI-körningen innan svaret sparas.
Legacy V1-historik migreras inte automatiskt till durable conversations.

### Identitets- och migrationsinventering (A008-0191)

| Yta/data | Mappning och hantering |
| --- | --- |
| Normal GUI och offentlig V3 | `conversationId = sessionId`; workspace-bindning och runId består. Nya körningar använder session-worker. SDK har process/status/stopp, activity-events och effect-review. |
| Befintlig bunden V3-session | Behåller sitt workspace, äldre branchnamn och historik. Ny process skapas vid nästa meddelande. Okänd startcommit förblir okänd; inga namn eller filer ändras automatiskt. |
| Obunden V3 (`legacy-unbound`) | Historik kan läsas; körning nekas. Ägaren behöver uttryckligen välja migration till separat worktree. Ingen rotfallback eller automatisk import. |
| V1/V2/ACP, engine-panel och standalone CLI | Befintliga kompatibilitetsadapteridentiteter och historiklager består. De blir inte automatiskt durable projektsessioner och kopieras inte till V3. Anslutna klienter använder V3 för den nya sessionslivscykeln. |
| Platform SQLite äldre versioner | Transaktionell uppgradering till schema v4; historik/receipts bevaras, instance/activity-tabeller samt session config/run input migreras additivt. Ingen process återansluts utifrån ett sparat PID. |
| Workspace SQLite | Additiva, nullable sessionId/baseCommit-fält. Endast nya allokeringar får verifierad startrevision och nya branchformatet. |

Process- och aktivitetsscheman finns i `packages/protocol/src/session-lifecycle.ts`.
HTTP/OpenAPI och klientpaket levereras tillsammans. Kompatibilitetsbegränsningarna
ovan är inga nya produktförbud och ingen automatisk datamigration av äldre GUI-
eller CLI-sessioner har utförts.

## Historik

Det tidigare långa systemdokumentet bevaras som
[historisk ögonblicksbild](evidence/A008-0188/previous-SYSTEMDOC.md).
Det innehåller tidsbundna och delvis motstridiga påståenden och ska endast läsas
för specifik historisk spårning, inte som aktuell arkitekturauktoritet.
