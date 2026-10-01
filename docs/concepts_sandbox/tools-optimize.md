edit_file-task. Det ska vara ett litet program för modellnära I/O.
Det viktigaste fyndet är att A008 redan har ganska bra primitiva skydd, men modellen får fortfarande bära för mycket av recovery-loopen själv.
I nuvarande repository-tools.ts är read_file faktiskt rätt smart: sectional read ger whole-file SHA, output är bounded, och edit_file returnerar ny SHA så modellen kan fortsätta utan reread. Det är bra och ska behållas. Problemet kommer när något går fel:
edit_file
→ "no match, read relevant section again"
→ read_file
→ modell analyserar
→ edit_file
eller:
exec_command
→ exit != 0
→ modellen får stdout/stderr
→ ny command / read / grep / command
Alltså: hosten vet redan mycket av det modellen försöker ta reda på i efterföljande calls, men kastar bort informationen.
Det är precis där contexten blöder.
Jag skulle göra det som ett parent-program ungefär så här:
A008 native model I/O
│
├── Workspace Engine
│   ├── inspect/search/read
│   ├── create/copy/move/delete
│   ├── edit/patch
│   ├── revision/hash
│   ├── locks
│   ├── transaction
│   └── recovery capsule
│
└── Execution Engine
    ├── process/shell
    ├── bounded output
    ├── stdout/stderr tails
    ├── outcome classification
    ├── start/idle/hard timeout
    ├── interactive detection
    └── durable process path where justified
Jag skulle alltså inte donor-importera tools 1:1. Jag skulle donor-importera beteenden bakom A008:s egna, väldigt små modellkontrakt.
För filer är fördelningen nästan löjligt tydlig nu.
Behåll från A008:
- workspace-bound paths
- .git-skydd
- symlink refusal
- sectional read_file
- whole-file SHA trots sectional read
- expected_sha256
- 16 MiB processing cap
- model-visible byte budget
- ny SHA efter mutation
- native tools framför MCP
Ta från Desktop Commander:
- exact match först
- expected_replacements
- line-ending-normalisering
- closest-match recovery
- fuzzy får diagnostisera men inte skriva
- kompakt post-edit preview
- testerna för edge cases
Ta från remote-gateway:
- exclusive locks
- structured error codes
- retryable
- EditPlan(baseSha256)
- checkpoint
- candidate mutation
- validation
- atomic adoption
- rollback
- provider abstraction
Det fina är att remote-gateway redan har exakt den separationen i koden. FileTransaction gör:
checkpoint
→ patch
→ validate
→ commit

failure:
→ rollback
och native-files.ts har separata locks för file.write, file.patch, move/copy osv.
Det är en bättre arkitektonisk donor än Desktop Commander, medan Desktop Commander är en bättre modell-UX/recovery-donor.
Men jag skulle också lägga till en sak som saknas i diskussionen hittills:
A008 behöver ett native search_file / find_text.
Inte en gigantisk generell search-tool. Något extremt snävt:
{
  "path": "src/foo.ts",
  "query": "createSession(",
  "max_matches": 5,
  "context_lines": 3
}
Svar:
{
  "status": "ok",
  "sha256": "abc",
  "matches": [
    {
      "line": 418,
      "before": "...",
      "match": "createSession(",
      "after": "..."
    }
  ]
}
Då försvinner mängder av:
exec_command rg ...
read_file ...
read_file ...
Det här är sannolikt en större context-vinst än att göra edit_file 20 % bättre.
Och samma princip gäller directory/list.
Modellen behöver oftast inte:
list_files
→ 100 entries
→ inspect
→ list subdir
utan snarare:
find_paths {
  glob: "src/**/*memory*.ts",
  max_results: 20
}
med ett kompakt strukturerat resultat.
Så jag skulle låta native workspace-surface bli ungefär:
list_files
find_files
search_file
read_file

create_file
edit_file
copy_file
move_file
delete_file

git
Inte 35 små filesystem-tools, men tillräckligt många för att modellen inte ska använda shell som fil-API.
edit_file skulle samtidigt bli kraftigare men fortfarande ha ett minimalt schema:
{
  "path": "...",
  "expected_sha256": "...",
  "old_text": "...",
  "new_text": "...",
  "expected_replacements": 1
}
Internt får hosten vara hur sofistikerad som helst.
Resultatet vid success bör vara litet:
{
  "status": "ok",
  "replacements": 1,
  "sha256": "new...",
  "preview": {
    "start_line": 415,
    "content": "..."
  }
}
Previewn är viktig. Då behövs normalt ingen read efter edit.
Vid mismatch:
{
  "status": "no_exact_match",
  "retryable": true,
  "written": false,
  "sha256": "current...",
  "closest_match": {
    "similarity": 0.94,
    "start_line": 418,
    "content": "...actual source...",
    "diff": "..."
  }
}
Modellen kan då göra nästa edit direkt.
Vid stale SHA:
{
  "status": "stale_base",
  "retryable": true,
  "written": false,
  "expected_sha256": "abc...",
  "current_sha256": "def...",
  "recovery": {
    "start_line": 412,
    "content": "..."
  }
}
Här är en viktig detalj: jag skulle inte alltid skicka currentSection. Det blir annars ännu en contextläcka.
Recovery-information ska vara adaptiv:
SUCCESS
→ tiny result + tiny preview

STALE BASE
→ relevant section only

NO MATCH
→ closest match only

MULTIPLE MATCHES
→ line numbers + små anchors

VALIDATION FAILURE
→ validation diagnostic + rollback confirmation
Alltså:
Felresultat ska vara dyrare än success-resultat, men fortfarande billigare än nästa read-call.

Det tror jag är kärnan i hela designen.
Och exec_command behöver minst lika mycket kärlek.
A008:s nuvarande terminal.ts är i grunden väldigt enkel:
spawn
→ collect stdout/stderr från början
→ cap
→ timeout
→ kill
→ formattera allt
Den har ett ganska obehagligt contextbeteende.
appendCapped() behåller nämligen början av outputen tills bytecap nås.
För exempelvis:
npm test
npm run build
tsc
pytest
är det nästan exakt motsatsen till vad modellen oftast behöver.
Om 50 000 bytes kommer och cap är 8192 kan modellen få:
första 8192 bytes
...
det faktiska felet längst ned försvann
Remote-gateway gör bättre här. Dess safe process runner håller separat:
stdout tail
stderr tail
total bytes
truncated flags
exitCode
signal
duration
och felresultatet innehåller de sista ~4 KB av diagnostiken.
Det där skulle jag donor-importera nästan direkt.
Jag skulle ersätta A008:s terminalresultat:
cwd: ...
exit: 1
stdout:
gigantiskt...
stderr:
...
med ett strukturerat outcome:
{
  "status": "failed",
  "code": "PROCESS_EXIT_NONZERO",
  "retryable": false,
  "exit_code": 1,
  "duration_ms": 4132,
  "stdout": {
    "tail": "...",
    "total_bytes": 91823,
    "truncated": true
  },
  "stderr": {
    "tail": "src/foo.ts:52 TS1005...",
    "total_bytes": 3182,
    "truncated": false
  }
}
Det är mycket bättre för Luna.
Dessutom skulle jag dela upp:
operation outcome
från:
tool/infrastructure failure
Det är en stor grej.
Idag betyder A008 i princip:
failed = exitCode !== 0 || timedOut
Men:
git diff --quiet
grep
rg
npm test
kan ha olika semantik för exit codes.
Native execution-kontraktet bör kunna säga:
{
  "expected_exit_codes": [0, 1]
}
när host/tool-definitionen vet att 1 inte betyder infrastructure failure.
Remote-gateway har redan expectedExitCodes.
Ta den.
Jag skulle också donor-importera tre timeouttyper:
start timeout
idle timeout
hard timeout
A008 har idag egentligen bara hard timeout.
Det gör stor skillnad.
Ett test som kör i 15 minuter men producerar output är något helt annat än:
process startade
→ inget händer i 60 sek
→ kanske väntar på input
Remote-gateway har dessutom detection för interaktiv prompt. Desktop Commander har gått ännu längre med REPL/session-beteende.
Men där skulle jag vara försiktig.
Jag skulle inte lägga Desktop Commanders fulla process-sessionmodell i default exec_command.
Default ska fortfarande vara:
run → bounded outcome → done
För långlivade/interaktiva saker kan A008 senare exponera:
start_process
process_output
process_input
stop_process
men bara när modellen verkligen behöver dem.
Annars exploderar både tool schema och decision space.
Det ger en viktig generell regel:
Minimera inte bara tool-output tokens. Minimera antalet beslut modellen måste fatta.

20 nästan likadana filesystem-tools kostar också context och reasoning.
Jag hade därför gjort en liten modell-visible surface och en rik host-internal capability layer:
MODEL
  │
  ├─ read_file
  ├─ search_file
  ├─ list/find_files
  ├─ edit_file
  ├─ create/copy/move/delete
  ├─ exec_command
  └─ git
        │
        ▼
A008 I/O broker
        │
        ├─ workspace policy
        ├─ locking
        ├─ revisions
        ├─ transactions
        ├─ diagnostics
        ├─ output projection
        ├─ recovery
        └─ provenance
             │
       ┌─────┴─────┐
       ▼           ▼
   file engine   process engine
Och här kommer kanske den största potentiella vinsten:
Model-visible output och durable/full output ska vara två olika saker.
Exempel:
npm test
producerar 4 MB.
Hosten sparar:
full stdout/stderr → execution artifact / log
men modellen får:
{
  "status": "failed",
  "failed_tests": 3,
  "stderr_tail": "...",
  "stdout_tail": "...",
  "full_output_ref": "exec:abc123"
}
Om modellen verkligen behöver mer:
read_execution_output(exec:abc123, ...)
Men default-turnen får inte äta 4 MB.
Det harmonierar dessutom väldigt snyggt med 0198.
0198 säger i princip:
när turn-context blir för stor, reducera säkert.

Den här nya satsningen säger:
lägg inte onödiga bytes i turn-context från början.

De två tillsammans är betydligt starkare.
Jag hade därför ändrat task-strukturen från bara:
A008-0205 — Transactional native file editing with deterministic recovery

till ett parent-program:
A008-0205 — Context-efficient native I/O stabilization

0205-A Workspace file operations
0205-B Transactional edit/recovery
0205-C Native search/navigation
0205-D Structured process execution
0205-E Tool-output projection + durable full evidence
0205-F telemetry/benchmark
Eller ännu hellre två implementationstasks under ett program, för att inte göra en mammutbranch:
A008-0205
Native workspace I/O and deterministic recovery

A008-0206
Structured process execution and context-efficient output
Det är nog renare.
Och jag skulle absolut lägga en benchmark på det här. Inte bara tester.
Ta en verklig A008-uppgift och mät:
                    före       efter
tool calls           X          X
failed calls         X          X
read_file calls      X          X
edit retries         X          X
exec retries         X          X
tool-output bytes    X          X
provider input bytes X          X
mean calls/edit      X          X
mean calls/error     X          X
Den intressantaste metrik jag skulle införa är:
recovery amplification
Alltså:
antal extra model/tool rounds efter en misslyckad operation
Exempel:
edit failed
read
search
read
edit
ger ungefär:
recovery amplification = 4
Målet för vanliga filfel borde vara nära:
1
because:
edit failed + recovery capsule
→ corrected edit
Och för vissa fel:
0
because hosten själv kan säkert hantera dem.
Jag skulle också mäta:
model-visible bytes / successful mutation
model-visible bytes / successful command
Det är egentligen mer relevant för A008 än rå latency.
En liten grej jag noterade när jag inspekterade repot: A008-0198-handoffen anger den observerade Luna-körningen som 286 tool calls: 239 completed / 47 failed, med read_file 106, exec_command 75 och edit_file 63. Så den specifika evidensen i repot säger 286 calls; dina ~496 verkar sannolikt vara en annan räknare/körning eller ett bredare event/call-begrepp. Det påverkar inte slutsatsen — fördelningen är nästan ännu mer talande.
106 reads + 63 edits + 75 execs.
Det är 244 av 286 calls i exakt de tre ytor vi pratar om.
Så ja: jag skulle inte lägga tid på fler generella cognition-optimeringar här innan det här är gjort.
Det här är låg nivå nog att påverka nästan varje framtida A008-körning:
färre tool calls
       ↓
mindre tool output
       ↓
mindre request history
       ↓
färre 0198-compactions
       ↓
mindre reducerarbete
       ↓
lägre token/contextkostnad
       ↓
färre möjligheter för modellen att göra fel
Och den riktning jag skulle frysa är:
A008 owns the model contract. Desktop Commander donerar recovery UX. Remote Gateway donerar transaction/execution semantics. Full evidence stannar host-side; modellen får minsta tillräckliga success- eller recovery-projektion.

Det är, efter att ha sett koden, bredare och bättre än att bara byta ut edit_file.