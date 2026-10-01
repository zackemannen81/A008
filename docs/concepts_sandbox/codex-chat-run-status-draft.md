# Utkast: Codex-lik körningsstatus i chatten

Status: Concept draft — ej auktoritativt

## Syfte

Ge chatten en kompakt, live uppdaterad körningsstatus som gör det tydligt vad
som händer under en aktiv uppgift:

- **Blått:** stopptid, förbrukade tokens och aktuell context size.
- **Gult/orange:** aktiva tool calls och actions.
- **Grönt:** modellens säkra, korta aktivitetsstatus.

Statusen ska vara separat från den permanenta chatthistoriken. När körningen är
klar ska slutlig användning kunna visas utan att tillfälliga statusuppdateringar
blir chatmeddelanden.

## Produkt- och arkitekturförutsättningar

- Lokal värd/session äger körningsstatus; GUI:t presenterar den.
- Modellprovider rapporterar tokenanvändning efter provider-anropet.
- A008 beräknar faktisk request-context före provider-anropet när tokenizer finns.
- Privata reasoning-detaljer ska inte exponeras som UI-status.
- Tool-status ska komma från befintliga körningshändelser, inte från DOM eller
  en efterhandsanalys av loggtext.
- Om tokenisering eller provider-usage saknas visas `—`, inte ett påhittat värde.

Detta är ett konceptutkast och ändrar inte den godkända produktarkitekturen.

## Föreslagen domänmodell

Inför ett körningsspecifikt statusobjekt, i stället för att lägga metadata på
chatmeddelanden:

```ts
interface RunUsage {
  startedAt: number;
  finishedAt?: number;
  elapsedMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextTokens?: number;
  contextLimit?: number;
}

type RunActivityPhase =
  | "thinking"
  | "tool"
  | "answering"
  | "finishing"
  | "idle";

interface RunActivity {
  phase: RunActivityPhase;
  text: string;
  updatedAt: number;
}

interface RunStatus {
  sessionId: string;
  runId: string;
  usage: RunUsage;
  activity?: RunActivity;
  activeToolCalls: RuntimeToolCall[];
  state: "running" | "completed" | "failed" | "cancelled";
}
```

`runId` är viktigt: en ny prompt får aldrig ärva timer, tokens eller aktiva
verktyg från en tidigare körning. `sessionId` används för att hitta rätt lokal
session, men är inte ersättning för körningsidentiteten.

## Transport

Återanvänd det befintliga session-/körningsflödet och lägg till ett explicit
status-event, exempelvis:

```ts
{
  type: "session_status",
  sessionId: "...",
  runId: "...",
  status: {
    usage: {
      startedAt: 1760000000000,
      inputTokens: 38200,
      outputTokens: 12480,
      totalTokens: 50680,
      contextTokens: 38200,
      contextLimit: 128000
    },
    activity: {
      phase: "tool",
      text: "Kör git diff",
      updatedAt: 1760000005000
    },
    activeToolCalls: [],
    state: "running"
  }
}
```

### Händelseflöde

1. Värden accepterar en körning och skickar `startedAt`, `runId` och `running`.
2. Orkestreringen publicerar säkra aktivitetsövergångar.
3. Tool-start, tool-progress och tool-finish uppdaterar `activeToolCalls`.
4. Context projection räknar context före provider-anropet.
5. Providerresultatet kompletterar input/output/total tokens.
6. Värden skickar terminal status med `finishedAt` och slutlig elapsed time.
7. Återanslutning återspelar senaste statusen och händelser utan luckor eller
   dubblering enligt sessionens befintliga ordningsmekanism.

Status-event ska vara idempotenta eller ordnade med samma event-/sekvensmodell
som övriga körningshändelser.

## Backend- och runtimearbete

### 1. Körningslivscykel

- Skapa status vid accepterad körning, inte när chatten öppnas.
- Sätt `startedAt` från värden/runtime, inte från webbläsarens klocka.
- Sätt terminal tid vid completed/failed/cancelled.
- Publicera `idle` först när körningen är terminal; rensa inte historiken i
  samma steg.

### 2. Tokenanvändning

- Normalisera providerernas olika usage-format till `inputTokens`,
  `outputTokens` och `totalTokens`.
- Bevara eventuella cached-input- och billable-reasoning-fält internt om de
  behövs för korrekt accounting, men räkna inte samma tokens två gånger.
- Visa totalen i första versionen; gör uppdelning till en senare UI-detalj.
- Om provider inte rapporterar usage: behåll fältet undefined och rendera `—`.

### 3. Context size

- Mät den faktiska request-contexten efter projection/truncation och före
  provider-anropet.
- Skicka `contextTokens` och modellens `contextLimit` när båda är kända.
- Om tokenizer saknas: skicka inget falskt exakt tal. En eventuell uppskattning
  måste vara tydligt märkt som uppskattning och kräver separat produktbeslut.
- Säkerställ att tool schemas och andra delar som faktiskt ingår i requesten
  följer samma mätregel som provideranropet.

### 4. Modellaktivitet

Använd en liten whitelist av säkra lifecycle-texter, exempelvis:

- `Analyserar uppgiften`
- `Läser filer`
- `Kör git diff`
- `Bearbetar verktygsresultat`
- `Skriver svar`
- `Slutför`

Publicera inte rå intern reasoning, dold chain-of-thought eller godtycklig
modelltext som status.

## GUI-förslag

Skapa en återanvändbar `ChatStatusBar` nära den aktiva assistentturnen:

```text
[ blå ]  02m 14s  ·  12 480 tokens  ·  38 200 / 128 000 context
[ orange ]  Kör git diff  ·  Läs 3 filer
[ grön ]  Analyserar verktygsresultat
```

### Rendering

- Rendera statusraden endast för aktiv eller nyligen avslutad körning.
- Använd lokal timer (`setInterval` eller motsvarande) mellan serverhändelser,
  men härled sluttiden från serverns terminalstatus.
- Formatera korta tider som `mm:ss`; över en timme `hh:mm:ss`.
- Formatera tokens med lokal tusentalsavgränsare.
- Visa context som `aktuell / gräns`; saknade värden som `—`.
- Orange verktygsrad kan visa flera samtidiga calls som kompakta chips/listor.
- Grön aktivitetsrad ska ha tydlig text och inte simulera streaming av reasoning.
- Färg får inte vara enda signal: komplettera med text, ikon och tillgängliga
  ARIA-labels. Kontrollera kontrast i både ljust och mörkt tema.

### Exempel på komponentgräns

```tsx
<ChatStatusBar
  usage={runStatus.usage}
  activity={runStatus.activity}
  activeToolCalls={runStatus.activeToolCalls}
  state={runStatus.state}
/>
```

Komponenten bör vara presentational. Timerlogik och eventreducering hör hemma i
state-/sessionlagret så att GUI och eventuella andra klienter får samma data.

## State- och reducerregler

- Acceptera endast status för aktuell `sessionId` och `runId`.
- Ignorera äldre sekvensnummer och terminala uppdateringar som ersätts av en
  nyare körning.
- Vid reconnect: återställ från serverns snapshot och fortsätt lokal timer.
- Vid sessionbyte: rensa aktiv status om inte den nya sessionen har en egen
  aktiv körning.
- Vid appreload: visa serverns senaste kända status, men starta inte om arbete.
- Verktyg som är avslutade ska inte ligga kvar i `activeToolCalls`.

## Implementationsordning

1. Inventera befintliga session-, run-, tool- och provider-usage-kontrakt.
2. Lägg till normaliserade typer och `session_status` i gemensamt protokoll.
3. Lägg till reducer/state för `RunStatus`, inklusive run-/sekvensvalidering.
4. Publicera start, aktivitetsövergångar, tool-status och terminal status från
   värd/orkestrering/provideradapter.
5. Implementera `ChatStatusBar` och färg-/tillgänglighetsdesign.
6. Anslut befintlig tool-aktivitet till den kompakta orange raden.
7. Dokumentera faktisk implementation i auktoritativa docs först när den finns.

## Test- och verifieringsutkast

### Enhetstester

- timer räknar från serverns `startedAt`;
- terminal status fryser elapsed time;
- saknade tokenfält renderas som `—`;
- context-limit renderas korrekt och utan falska estimat;
- gamla `runId`/sekvensnummer påverkar inte aktuell status;
- reconnect och sessionbyte återställer/rensar korrekt;
- aktiva tool calls blir orange och försvinner efter avslut;
- privata reasoningfält renderas aldrig.

### Integrationskontroller

- fake provider med usage payload;
- fake provider utan usage payload;
- context projection med truncation och tool schemas;
- parallella sessioner visar isolerad status;
- körning som avslutas genom success, error och cancel;
- återanslutning mitt under tool call utan dubblering.

### Manuell UI-review

- verifiera Codex-lik densitet utan att status konkurrerar med svaret;
- kontrollera ljust/mörkt tema, kontrast, keyboard focus och screen reader;
- kontrollera lång tool-text, flera samtidiga calls och mycket stora tokenvärden;
- kontrollera att avslutad status inte blockerar ny prompt.

## Avgränsningar och öppna beslut

- Ska status ligga ovanför den aktiva assistentturnen eller i en fast panel under
  composer? Första utkastet rekommenderar nära aktiv turn.
- Ska tokenvisning vara per provider-anrop, per turn eller ackumulerad per run?
  Rekommendation: per run, med underliggande event för framtida uppdelning.
- Ska avslutad status ligga kvar permanent i historiken? Rekommendation: behåll
  slutvärden som körningsmetadata, men inte som en serie live-event.
- Exakt provideroberoende context-tokenisering kräver inventering av befintliga
  adapters och ska inte lösas med en tyst browser-estimering.
- Färger, ikoner och exakta texter är UI-designbeslut; detta dokument föreslår
  inte en ny designstandard.

## Föreslagen nästa task-charter

Skapa en separat Ready-task med ett enda primärt utfall: en read-only live
statusrad för en aktiv lokal körning, med serverförankrad timer, normaliserad
provider-usage när tillgänglig och återanvändning av befintlig tool-aktivitet.
Lägg tokenisering/context projection och provideradapterändringar i samma task
endast om befintliga kontrakt visar att de kan implementeras utan att utvidga
scope; annars dela upp dem i ett beroende barn.
