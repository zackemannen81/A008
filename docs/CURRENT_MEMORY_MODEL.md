# A008 — Knowledge, State, Memory & Context Model

Status: Normativ målmodell
Syfte: Kanonisk beskrivning av hur A008 representerar kunskap, current state, history, provenance, adaptivt minne, retrieval och context.

---

# 1. Purpose

A008 ska kunna arbeta kontinuerligt över stora mängder information utan att:

* tappa kontinuitet,
* blanda ihop gammal och aktuell information,
* behandla allt som lika viktigt,
* fylla prompten med irrelevant historik,
* förlita sig på modellens implicita minne,
* förlora spårbarheten till var information kommer ifrån.

Systemet behöver därför separera fem fundamentalt olika frågor:

1. **Vad har systemet hört, läst, observerat eller genererat?**
2. **Vad är systemets aktuella state för ett visst semantiskt faktum?**
3. **Varifrån kommer informationen och vilket stöd har den?**
4. **Hur relevant eller salient är informationen just nu?**
5. **Vilken information behöver modellen se för den aktuella uppgiften?**

Dessa frågor får inte lösas av samma mekanism.

A008 består därför av flera samverkande lager:

```text
INPUT / OBSERVATION
        │
        ▼
CLAIM & EVIDENCE LEDGER
        │
        ├──────────► PROVENANCE / SUPPORT
        │
        ▼
SEMANTIC RESOLUTION
        │
        ▼
CURRENT STATE / HISTORY
        │
        │
        ├──────────► MEMORY LIFECYCLE
        │
        │               │
        │               ▼
        │            SALIENCE
        │
        ▼
RETRIEVAL
        │
        ▼
CONTEXT BUILD
        │
        ▼
MODEL EXECUTION
        │
        ▼
NEW KNOWLEDGE
```

Den centrala principen är:

> **Claims bevarar kunskapen. Current State håller HEAD. Provenance berättar varför vi tror något. Memory Lifecycle avgör vad som är salient. Retrieval avgör vad modellen behöver se.**

---

# 2. Grundprinciper

## 2.1 Single Source of Truth

För varje löst semantiskt tillstånd finns exakt en current representation.

Exempel:

```text
A008-0143.status = In Progress
```

Det får inte samtidigt finnas två konkurrerande current values:

```text
A008-0143.status = Draft
A008-0143.status = In Progress
```

Den senaste giltiga claimen för den semantiska adressen äger HEAD.

Tidigare claims finns kvar som history.

---

## 2.2 Claims försvinner inte när State ändras

State är inte ersättningen för claims.

Claims är systemets knowledge ledger.

Exempel:

```text
C1  A008-0143.status = Draft
C2  A008-0143.status = In Progress
C3  A008-0143.status = Complete
```

Resultat:

```text
CURRENT STATE

A008-0143.status = Complete
owner_claim = C3
```

History:

```text
C1 = Draft
C2 = In Progress
```

Alla tre claims finns kvar.

---

## 2.3 Current State är en projektion, inte ett separat konkurrerande knowledge-system

State kan konceptuellt beskrivas som:

```text
SELECT latest applicable claim
GROUP BY semantic_address
```

men materialiseras för effektivitet och determinism.

Current State är därför en materialized HEAD-view över claim-ledgern.

---

## 2.4 Source och truth är inte samma sak

En claim kan komma från:

* användaren,
* assistenten,
* en fil,
* Git,
* ett API,
* ett tool-resultat,
* en databas,
* en extern källa,
* en annan modell,
* ett tidigare state,
* en inference.

Source måste bevaras.

Men source bestämmer inte ensam om informationen existerar som knowledge.

A008 är inte en global fact-checker.

Om användaren säger:

```text
moon.composition = cheese
```

och det är systemets enda claim om den adressen, då är det systemets current knowledge state.

Det betyder:

> "Detta är vad knowledge-banken för närvarande säger."

Det betyder inte:

> "Detta har objektivt verifierats som universell sanning."

Den skillnaden representeras genom provenance och support.

---

# 3. Claim & Evidence Layer

Claim-lagret är systemets permanenta knowledge ledger.

Det innehåller sådant som:

* användarassertioner,
* observationer från filer,
* tool-resultat,
* information extraherad ur dokument,
* assistentgenererad kunskap,
* relationspåståenden,
* state-förändringar,
* historiska fakta,
* framtida fakta eller predictioner,
* konflikter,
* corrections,
* retractions.

En claim kan förenklat representeras som:

```ts
interface Claim {
  id: string;

  proposition: Proposition;

  source: SourceReference;
  attributed_to: string;

  about_interval?: {
    from: time | unknown;
    to: time | null;
  };

  created_at: time;

  tags: string[];
  domains: string[];

  lifecycle: MemoryLifecycle;

  provenance: ProvenanceReference[];
}
```

---

# 4. Propositioner och Semantic Address

För att knowledge ska kunna delta i Current State måste systemet förstå **vad claimen handlar om**.

Detta uttrycks genom en semantic address.

Exempel:

```text
Rickard.preferred_name

A008-0143.status

nes-demo.rom_configuration

README.current_content

AudioLeaf.subscription_price
```

Relationer har motsvarande strukturerad identitet:

```text
src/reset.s --implements--> PPU initialization

Rickard --works_on--> A008
```

## 4.1 Attribute bindings

```ts
{
  kind: "attribute_binding",
  entity: "A008-0143",
  attribute: "status",
  value: "In Progress"
}
```

Semantic address:

```text
A008-0143.status
```

---

## 4.2 Relationship bindings

```ts
{
  kind: "relationship_binding",
  subject: "src/reset.s",
  relation: "implements",
  object: "PPU initialization"
}
```

---

## 4.3 Unresolved knowledge

Inte all kunskap kan omedelbart ges en riktig semantic address.

Exempel:

```text
"Projektet känns betydligt renare nu."
```

Det ska fortfarande kunna existera som claim/evidence.

Men A008 får inte lösa problemet genom att hitta på:

```text
statement_f7188.statement =
  "Projektet känns betydligt renare nu."
```

och sedan behandla den artificiella adressen som Current State.

Princip:

> **Unresolved knowledge får existera utan att tvingas in i State.**

Det kan senare bli möjligt att lösa claimen semantiskt.

---

# 5. Current State

Current State är systemets kanoniska HEAD.

För varje resolved semantic address finns högst en aktuell binding.

Exempel:

```text
semantic_address:
A008-0143.status

HEAD:
Complete

owner_claim:
C3
```

Äldre values stängs och blir history.

```text
Draft
from T1
to   T2

In Progress
from T2
to   T3

Complete
from T3
to   null
```

`to = null` betyder current/open.

---

# 6. State Transition

När en ny claim kommer in sker:

```text
NEW CLAIM
    │
    ▼
RESOLVE SEMANTIC ADDRESS
    │
    ├── unresolved
    │      │
    │      └── claim/evidence only
    │
    ▼
READ CURRENT HEAD
    │
    ├── no HEAD
    │      │
    │      └── claim becomes first HEAD
    │
    ▼
COMPARE WITH HEAD
    │
    ├── same
    │      └── restatement / reinforcement
    │
    ├── extension
    │      └── add compatible knowledge
    │
    ├── change / supersession
    │      ├── close previous binding
    │      └── new claim becomes HEAD
    │
    ├── correction / retraction
    │      └── update state/history accordingly
    │
    └── conflict
           └── preserve competing evidence,
               maintain deterministic HEAD
```

State-uppdateringen ska vara atomär.

---

# 7. Latest Claim / HEAD Principle

Grundregeln är:

> **Latest applicable resolved claim owns Current State.**

Detta kan liknas vid Git:

```text
read HEAD
    ↓
apply semantic change
    ↓
commit
    ↓
new HEAD
```

Tidigare commit försvinner inte.

Den slutar bara vara HEAD.

Samma princip gäller knowledge.

---

# 8. Temporal Semantics

"Latest claim" betyder inte automatiskt "senast lagrad text".

Claimen måste handla om rätt world-time.

Exempel:

```text
"A008 was Draft yesterday"
```

ska inte göra:

```text
CURRENT:
A008.status = Draft
```

om current state redan är:

```text
A008.status = In Progress
```

I stället:

```text
HISTORY:
A008.status = Draft
valid yesterday
```

Likadant:

```text
"A008 will be Complete tomorrow"
```

är framtida knowledge.

Det får inte omedelbart ersätta dagens Current State.

Systemet skiljer därför mellan:

```text
ingestion time
```

och:

```text
world/about time
```

Explicit world-time vinner över ingestion time.

---

# 9. SlotClaim

A008 har ett strukturerat reconciliation-lager mellan evidence claims och bindings.

Det kan behållas.

Dess roll är:

```text
Evidence Claim
      │
      ▼
SlotClaim
structured reconciliation representation
      │
      ▼
Binding
Current State / HEAD
```

SlotClaim är **inte en andra sanningskälla**.

Det är en strukturerad reconciliation-shadow.

Current truth ägs endast av den öppna bindingen.

---

# 10. Provenance & Evidence

Varje claim ska så långt möjligt kunna svara på:

```text
Vem eller vad sade detta?

När?

Varifrån?

Var det direkt observerat?

Var det extraherat?

Var det härlett?

Vilket artifact/tool-resultat stödjer det?

Finns det konkurrerande claims?
```

Exempel:

```text
CLAIM:
ND-0001.status = In Progress

PROVENANCE:
derived_from:
docs/CURRENT_TASK.md

observation:
direct file read

observed_at:
T1
```

Jämför:

```text
CLAIM:
ND-0001.status = Complete

PROVENANCE:
speaker:
user

utterance:
"Den är klar."
```

Båda är knowledge.

Men modellen kan förstå att de har olika epistemiskt ursprung.

---

# 11. Support är inte Salience

Detta är en fundamental separation.

## Support

Beskriver varför systemet har anledning att tro på en claim.

Exempel:

```text
direct file observation
deterministic Git result
test output
user assertion
assistant inference
external source
```

## Salience

Beskriver hur relevant knowledge är för retrieval just nu.

Exempel:

```text
memory_strength
recency
frequency
domains
tags
current scope
relations
semantic similarity
```

De får aldrig blandas ihop.

```text
frequently mentioned
≠
more objectively true
```

och:

```text
rarely mentioned
≠
false
```

---

# 12. Independent Evidence

A008 ska kunna skilja mellan repetition och oberoende stöd.

Exempel:

```text
same user repeats X 10 times
```

ger:

```text
high salience
high recurrence
```

men fortfarande huvudsakligen samma epistemiska source.

Jämför:

```text
user says X
source file says X
Git says X
runtime inspection says X
test says X
```

Det finns flera självständiga evidence roots.

Det är epistemiskt starkare.

Det behöver inte reduceras till en enda "truth score".

Den konkreta provenance-strukturen är mer värdefull än ett abstrakt nummer.

---

# 13. Contradiction och Critical Reasoning

Provenance gör att modellen inte behöver vara godtrogen.

Exempel:

Tidigare observation:

```text
README.md contains stale information
source = direct file read
```

Senare säger användaren:

```text
"Allt är à jour, börja implementera."
```

Den nya user-claimen ska sparas.

Men den behöver inte mekaniskt radera specifika tidigare observationer.

De handlar dessutom ofta om olika semantic addresses:

```text
project.documentation_status = up_to_date
```

kontra:

```text
README.current_content = old behavior
```

När A008 bygger context kan båda informationerna finnas tillgängliga.

Modellen kan då resonera:

```text
User says documentation is current.

Previous direct observation found README stale.

Before modifying code that depends on this,
verify README/current repo state.
```

Detta är ett centralt värde med det dubbla claim/state-systemet.

---

# 14. Knowledge Lifecycle

Memory Lifecycle handlar enbart om:

> **Hur lätt knowledge återkommer till modellen.**

Det handlar inte om truth.

Varje relevant knowledge carrier kan ha:

```ts
interface MemoryLifecycle {
  severity: "critical" | "important" | "minor";

  persistent: boolean;

  strength: number;       // 0.0 - 1.0
  decay_rate: number;

  active: boolean;

  last_used?: time;
  last_reinforced_at?: time;
}
```

---

# 15. Severity

Severity bestämmer främst initial retrieval-policy.

Exempel:

| Severity  | Initial Strength |      Decay |
| --------- | ---------------: | ---------: |
| critical  |              1.0 | mycket låg |
| important |         ~0.7–0.8 |      medel |
| minor     |             ~0.4 |      högre |

Severity betyder inte:

```text
critical = more true
```

Det betyder:

```text
critical = harder to lose from associative retrieval
```

---

# 16. Memory Strength

`memory_strength` representerar retrieval-salience.

Exempel:

```text
strength = 0.95
```

betyder ungefär:

> knowledge är starkt tillgängligt för bred/associativ retrieval.

Det betyder inte:

> claimen är 95 % sann.

---

# 17. Active / Dormant

Knowledge kan vara:

```text
active
```

eller:

```text
dormant
```

Dormant betyder:

> bör normalt inte spontant komma med i bred context retrieval.

Dormant betyder aldrig:

```text
false
deleted
invalid
historical
```

---

# 18. Persistent

Persistent innebär:

```text
immune to ordinary retrieval decay
```

Det betyder inte:

```text
immutable truth
```

Exempel:

```text
Rickard.role = Developer
persistent = true
```

Om senare claim säger:

```text
Rickard.role = CTO
```

kan state fortfarande ändras.

`persistent` skyddar retrieval-livslängden för knowledge.

Det blockerar inte semantic state transition.

---

# 19. Decay

Decay är selektiv glömska.

Syftet är att förhindra:

```text
context clog
```

medan knowledge fortfarande finns kvar.

Konceptuellt:

```ts
effective_strength =
  decay(memory_strength, now - last_used)
```

När strength passerar en policy-threshold:

```text
active = false
```

Knowledge finns fortfarande kvar.

---

# 20. Reinforcement

Reinforcement betyder:

> **Knowledge var faktiskt relevant/aktuell i en ny occurrence.**

Det betyder inte:

> en ny sanning har skapats.

Exempel:

```text
A008.memory_model = claims + state
```

används i en ny diskussion.

Då:

```text
strength ↑
last_used = now
active = true
```

Ingen ny state transition krävs.

---

# 21. Reinforcement och State Transition är olika saker

```text
SAME KNOWLEDGE BECOMES RELEVANT AGAIN
→ reinforcement
```

```text
NEW VALUE FOR SAME SEMANTIC ADDRESS
→ new claim
→ state transition
```

Exempel:

```text
A008.status = In Progress
```

nämns igen:

```text
reinforce existing knowledge
```

Senare:

```text
A008.status = Complete
```

är:

```text
new claim
old HEAD → history
new claim → HEAD
```

---

# 22. Reinforcement måste vara exakt en gång per occurrence

Samma knowledge kan förekomma genom flera interna vägar:

```text
retrieval
→ context
→ generation
→ extractor
→ classifier
```

Detta får inte ge fyra boosts.

Identiteten ska vara:

```text
occurrence_id + knowledge_id
```

och paret får förstärkas högst en gång.

---

# 23. Reinforcement får inte bero på quote/span-validitet

Exact source spans och provenance är viktiga för evidens.

Men reinforcement beskriver semantic recurrence.

Därför:

```text
bad or unavailable source span
≠
skip reinforcement
```

Om knowledge faktiskt blev semantiskt relevant i occurrence ska den kunna förstärkas.

Provenance-validation och reinforcement är separata mekanismer.

---

# 24. Candidate Match är inte Reinforcement

Ett fuzzy/RAG-resultat ska inte automatiskt förstärkas bara för att det hittades.

Rätt pipeline är:

```text
dormant knowledge
      │
      ▼
semantic/fuzzy match
      │
      ▼
candidate
      │
      ▼
ranking / admission
      │
      ▼
provider execution
      │
      ▼
post-output extraction proves material reuse
      │
      ▼
reinforcement
```

Retrieval/admission är read-only ur lifecycle-perspektiv. Ett item förstärks först när den fullbordade turnen visar att kunskapen faktiskt återanvändes, återbekräftades eller på nytt etablerades semantiskt. Annars skulle candidate search själv hålla hela databasen levande.

---

# 25. Entities och Objects

Personer, filer, projekt, tasks, objects och andra identifierbara saker representeras som entities.

Exempel:

```text
Rickard
A008
A008-0143
README.md
src/reset.s
nes-demo
```

En entity är identitet.

Den är inte i sig truth.

Knowledge om entityn uttrycks genom claims och state.

Exempel:

```text
A008-0143.status = Complete

A008 --uses--> ACME

src/reset.s --implements--> PPU initialization
```

---

# 26. Entity Neighborhood

Entities används också för retrieval.

Om:

```text
A008-0143
```

matchas kan retrieval expandera till exempelvis:

```text
A008
memory model
current state
reinforcement
docs-first
related tasks
```

Expansionen påverkar candidate discovery.

Den skapar inte ny truth.

---

# 27. Tags

Tags är retrieval-metadata.

Exempel:

```text
memory
state
reinforcement
nes
repository
documentation
```

Tags används för:

* candidate discovery,
* filtering,
* associative expansion,
* context relevance.

Tags bestämmer inte truth.

---

# 28. Domains

Domains beskriver större semantiska områden.

Exempel:

```text
memory-system
software-development
repository-state
music
family
NES-development
```

Domains används för att snabbt begränsa retrieval-yta.

När ett område blir aktuellt kan relaterade domains också aktiveras.

---

# 29. Current Scope

Current Scope beskriver vilket semantiskt område den aktuella konversationen eller uppgiften befinner sig i.

Exempel:

```text
scope:
A008
memory
state-model
reinforcement
```

Scope är temporärt.

Det är ett retrieval-hjälplager, inte permanent truth.

Scope används för att prioritera relevant knowledge.

---

# 30. Associations och Attraction

A008 kan lagra semantiska associationer mellan knowledge records/entities.
Associationer är retrieval-kanter och är separata från truth-bearing
world-state relationships.

Varje association kan bära en signerad `attraction`:

```ts
interface SemanticAssociation {
  from: string;
  to: string;
  relation: string;
  attraction: number; // -1.0 ... +1.0
}
```

`attraction` beskriver **contextual gravity**:

* positiv attraction drar relaterad knowledge närmare vid broad/associative retrieval;
* noll är neutral;
* negativ attraction stöter bort kandidaten vid broad/associative retrieval;
* attraction får aldrig blockera exact/direct lookup eller ändra Current State.

Exempel:

```text
A008 <---- +0.92 ----> memory-model
A008 <---- +0.71 ----> ACME
A008 <---- -0.60 ----> unrelated-topic
```

Attraction är inte relationens semantiska valens. En truth-bearing relation som
`Rickard --dislikes--> X` kan samtidigt ha stark **positiv** attraction,
eftersom X är mycket relevant när Rickard diskuteras.

Attraction får förstärkas när två knowledge-noder faktiskt samretrieveras,
sammanvänds eller återkommande bedöms relevanta i samma occurrence. Den får
försvagas över tid och ska då driva mot **0 (neutral)**, aldrig automatiskt mot
negativ repulsion.

Negativ attraction kräver en faktisk negativ retrieval-signal, exempelvis
explicit semantisk separation/opposition eller upprepad relevant candidate
rejection. Frånvaro av co-occurrence får aldrig ensam skapa negativ attraction.

Samma `occurrence × association` får påverka attraction högst en gång.

Detta är en viktig skillnad:

```text
truth-bearing relationship
≠ semantic association
≠ retrieval attraction
```

Och samma separation gäller som för memory strength:

```text
strength   = hur starkt en knowledge-post själv lyser
attraction = hur starkt två knowledge-noder drar fram eller bort varandra
```

---

# 31. Retrieval – Grundprincip

Systemet ska inte fråga:

> "Vad vet jag?"

Det ska fråga:

> "Vad behöver modellen veta för just den här uppgiften?"

Retrieval sker därför stegvis.

---

# 32. Retrieval Pipeline

Översikt:

```text
USER MESSAGE / TASK
        │
        ▼
INTENT + SCOPE ANALYSIS
        │
        ▼
EXACT SEMANTIC RESOLUTION
        │
        ├────────────► CURRENT STATE LOOKUP
        │
        ▼
ENTITY / TAG / DOMAIN MATCH
        │
        ▼
RELATED DOMAINS / ASSOCIATIONS
        │
        ▼
SEMANTIC / FUZZY CANDIDATES
        │
        ▼
HISTORY / PROVENANCE EXPANSION
        │
        ▼
LIFECYCLE FILTER / RANKING
        │
        ▼
CONTEXT ADMISSION
```

---

# 33. Direct Retrieval

Om frågan direkt identifierar en semantic address:

```text
"What is A008-0143's status?"
```

ska systemet gå direkt till:

```text
A008-0143.status
```

och returnera HEAD.

Direct retrieval får inte blockeras av:

```text
low strength
dormancy
decay
low severity
```

Truth får inte bli otillgänglig bara för att den sällan används.

---

# 34. Current-State Retrieval

Default för vanliga faktafrågor är:

```text
intent = current_state
```

Resultatet ska projicera current binding.

Gamla claims får inte presenteras parallellt som om de vore aktuell truth.

Exempel:

History:

```text
preferred_name = Bertil
```

Current:

```text
preferred_name = Rickard
```

Vanlig retrieval ska ge:

```text
Rickard
```

inte:

```text
Bertil
Rickard
```

---

# 35. History Retrieval

History hämtas när frågan kräver det.

Exempel:

```text
"What was the task status before Complete?"
```

eller:

```text
"How has this decision changed?"
```

Då får tidigare claims och stängda intervals användas.

---

# 36. Attribution Retrieval

Attribution är också explicit.

Exempel:

```text
"Who said A008 was complete?"
```

Då behövs claim/evidence/provenance-lagret.

Default current-state frågor behöver inte automatiskt fyllas med all attribution.

---

# 37. Evidence Retrieval

Evidence bör inkluderas när:

* claims motsäger varandra,
* source är viktig för uppgiften,
* modellen behöver avgöra om något bör verifieras,
* användaren frågar varför systemet tror något,
* aktuell state bygger på svagt eller indirekt stöd,
* operationen är riskfylld,
* ett tidigare direkt observerat fact står mot ett senare generellt påstående.

Detta gör A008 kritiskt utan att blanda ihop evidence med truth-state.

---

# 38. Broad / Associative Retrieval

När semantic address inte är exakt känd används bredare mekanismer:

```text
current scope
domain
related domains
tags
related tags
entities
entity neighborhood
associations
semantic similarity
fuzzy matching
recency
memory strength
severity
```

Här har lifecycle-metadata stor betydelse.

Det är framför allt här `active/dormant` används.

---

# 39. Dormant Recovery

Dormant knowledge kan hittas genom stark relevant match.

Exempel:

```text
strength = 0.06
active = false
```

men user message matchar exakt entity + relation.

Då:

```text
candidate becomes eligible
```

Om knowledge sedan faktiskt tas med och används:

```text
reinforce
active = true
strength ↑
```

Detta ger "minnas tillbaka"-beteendet.

---

# 40. Ranking

Candidate ranking kan väga exempelvis:

```text
exact semantic match
scope overlap
domain overlap
tag overlap
entity proximity
relationship proximity
semantic similarity
recency
memory strength
severity
association strength
```

Dessa scores bestämmer retrieval-prioritet.

De bestämmer aldrig Current State.

---

# 41. Context Build

Efter retrieval byggs den faktiska model-contexten.

Målet är:

```text
minimum sufficient context
```

inte:

```text
maximum available knowledge
```

Context kan konceptuellt byggas i följande lager:

```text
1. System / instruction plane
2. Active task / execution constraints
3. Current scope
4. Relevant Current State
5. Relevant relationships
6. Required provenance / conflict evidence
7. Relevant historical claims
8. Adaptive memory retrieval
9. Recent conversational window
10. Current user message / tool observations
```

Ordningen kan variera i implementationen, men ägarskapet får inte blandas ihop.

---

# 42. Context ska uttrycka skillnaden mellan State och Evidence

Modellen ska kunna se något i stil med:

```text
CURRENT STATE

A008-0143.status = Complete
```

och vid behov:

```text
EVIDENCE

direct source:
CURRENT_TASK previously showed In Progress

user assertion:
"den är klar"

later repository observation:
task archived as Complete
```

Det gör modellen mycket bättre på att bedöma om ytterligare verifiering behövs.

---

# 43. Context Budget

Context är begränsat.

A008 ska därför prioritera:

```text
required exact state
>
task constraints
>
highly relevant relationships
>
support needed for reasoning
>
strong related knowledge
>
recent flow
>
weak associative memories
```

Gamla irrelevanta claims ska inte följa med bara för att de finns.

---

# 44. Window

Window är ett kort rullande konversationsminne.

Exempel:

```text
last 3 turns
```

Varje post kan vara:

```text
full turn
```

eller:

```text
summary
```

beroende på storlek.

Syftet är:

* lokal conversational flow,
* pronoun/reference resolution,
* session continuity,
* kortsiktig intention.

Window är inte långtidsminnets SSOT.

---

# 45. Snapshot

Snapshot beskriver det operationella läget som behövs för att återuppta en session.

Det kan exempelvis innehålla:

```text
current scope
active task
recent turns/window
important unresolved references
current conversation identity
```

Snapshot ersätter inte Current State.

Current State är systemets knowledge truth-surface.

Snapshot är resume-state.

---

# 46. Post-Output Knowledge Pipeline

Efter varje fullbordad turn sker en kontrollerad write-process.

Översikt:

```text
USER INPUT
    │
    ▼
RETRIEVED CURRENT KNOWLEDGE
    │
    └──────────────┐
                   ▼
MODEL EXECUTION → FINAL OUTPUT
                   │
                   ▼
KNOWLEDGE EXTRACTION
(retrieved baseline + user input + final output)
                   │
                   ├── new knowledge
                   ├── state updates
                   ├── relation updates
                   └── reinforcements
                   │
                   ▼
SEMANTIC RESOLUTION
    │
    ▼
RELATION CLASSIFICATION
    │
    ▼
CLAIM COMMIT
    │
    ├── provenance
    ├── entities
    ├── tags
    ├── domains
    └── lifecycle
    │
    ▼
STATE RECONCILIATION
    │
    ▼
REINFORCEMENT
    │
    ▼
WINDOW / SNAPSHOT UPDATE
```

Operationen ska där det krävs vara atomär.

---

# 47. Extraction

Extractorn identifierar atomic knowledge relativt den exakta retrieved-context som workern fick i samma turn.

Dialogue-inputen är:

```text
retrievedContext
userMessage
responseText
```

`retrievedContext` bär stabilt retrieved-item-ID, evidence-ID och semantic address där de redan finns. Extractorn får återanvända dessa identiteter men får inte hitta på nya semantic identities bara för att fylla schema. För reinforcement är `knowledgeId` alltid det exakta retrieved-item-`id`:t; `evidenceId` är runtime/provenance-metadata och får inte användas som ersättare.

Retrieved metadata ska komma från respektive lagrad post. Sökfrågans tags och
entities får inte kopieras till alla retrieved items som om de beskrev lagrad
kunskap. Postens egna domains följer med som klassificering. Där läsytan saknar
postspecifik applicability scope lämnas itemets scope tomt; query entities är
inte applicability scope. Metadata är inte ytterligare sakpåståenden.

Dialogue-resultatet separerar:

```text
new_knowledge
state_updates
relation_updates
reinforcements
```

För new/state/relation-kandidater ska extractorn producera proposition, kind, severity och andra säkra semantiska fält. För varje durable artifact vars ämne kan klassificeras säkert ska den dessutom ange den minsta användbara mängden breda reusable domains, normalt exakt en och högst två när kunskapen faktiskt är cross-domain. Domain är retrieval-klassificering, inte ett faktapåstående, och får därför härledas från artifactets ämne även när domänfrasen inte står ordagrant i källan. Tags klassificerar specifika återanvändbara ämnesbegrepp och ska anges när sådana kan identifieras; normalt räcker en till fyra, utan kvot eller utfyllnad. Lämpliga labels från baseline återanvänds. Sparse betyder ingen utfyllnad, inte utebliven klassificering. Entities är fortsatt optional och avser självständigt identifierbara referenter.

Retrieval-klassificeraren får samtalets befintliga, begränsade domänscope som
`currentDomains`. En indirekt följdfråga eller ändring ska kunna hämta aktuellt
state även utan upprepat filnamn; en ren social tur kan fortfarande avstå.
Scope tillhör respektive conversation och ersätter inte retrieved baseline.
Extractorn får lösa indirekta referenter mot denna baseline och ska bevara den
befintliga entity/attribute-identiteten. Flera möjliga referenter ger ingen rätt
att gissa en state-adress. Att faktiskt använda en känd egenskap för en
rekommendation, exempelvis kontrast mot aktuell textfärg, är reinforcement även
utan att användaren upprepar påståendet. Enbart topical overlap är inte reuse.

Knowledge som redan fanns i retrieved context ska inte skapas igen bara för att workern upprepar den. Om samma knowledge faktiskt återanvändes eller återbekräftades i den fullbordade turnen blir den i stället en reinforcement-kandidat. State change vid samma semantic address är inte en duplicate utan en state-update-kandidat.

En `state_update` får bara uppdatera en current-state-post som faktiskt fanns i samma retrieved baseline. Semantic address ska kopieras exakt från baseline och den strukturerade `attribute_binding`-propositionen måste beskriva samma slot. Intake validerar detta fail-closed innan relation classification/commit. Generic turn-wide workflow labels ska inte stampas på varje artifact, och runtime ska inte maskera utebliven klassificering med en påhittad catch-all-domain.

Commit-time dedupe kvarstår alltid: extraction-time jämförelsen ersätter aldrig global/relevant dedupe mot knowledge store.

En känd entity innebär inte att alla dess egenskaper redan är kända. En ny
uttryckligen etablerad egenskap och dess värde ska extraheras självständigt från
eventuell reinforcement av tidigare kunskap. När entity/attribute/value är
upplösta används source-grounded `attribute_binding`; runtime äger canonical
address. En allmän beskrivning av en fil får inte ersätta dess nya färgegenskap.
Om en reinforcement innehåller `semanticAddress` måste den finnas på och exakt
matcha samma retrieved item. Saknar posten adress utelämnas fältet; ett filnamn
är inte en semantic address.

---

# 48. Relation Classification

Ny knowledge jämförs med relevant befintlig knowledge.

Classifiern kan identifiera exempelvis:

```text
new
restatement
extend
supersede
conflict
```

Classifiern klassificerar relation, inte truth ownership. `supersede` och `conflict` kräver samma semantic address; olika attribute slots får aldrig slås ihop bara för att prosan är lik. Runtime/commit äger Current State, History, canonical IDs och lifecycle.

Classifiern beskriver semantisk relation.

Den ska inte vara en global sanningsdomare.

---

# 49. Reconciliation

Reconciliation sköter den deterministiska state-maskinen.

Den avgör exempelvis:

```text
first binding
same value
change
correction
retraction
conflict
```

Classifiern kan hjälpa till semantiskt.

State-lagret ansvarar för korrekt atomisk bookkeeping.

---

# 50. Acceptance

A008 har idag ett koncept kring `accepted` och `user-assertion-v1`.

Det är användbart för att beskriva:

```text
detta var en verifierad explicit user assertion
```

men det får inte vara den universella definitionen av:

```text
får detta existera som Current State?
```

Dessa två begrepp måste separeras.

`user-assertion-v1` är en provenance-/assertion-policy.

Current State styrs av den semantiska state-modellen.

---

# 51. Source Types

A008 bör kunna skilja mellan exempelvis:

```text
user assertion
assistant assertion
direct artifact observation
tool observation
runtime observation
source extraction
model inference
quotation
prediction
historical report
```

Source type används för:

* provenance,
* reasoning,
* verification decisions,
* evidence presentation,
* retrieval expansion.

Det får inte ensam fungera som truth score.

---

# 52. Questions, Quotes och Hypotheticals

All text är inte knowledge assertion.

Exempel:

```text
"Är månen gjord av ost?"
```

ska inte skapa:

```text
moon.composition = cheese
```

Likadant:

```text
"Om A008 vore skrivet i Rust..."
```

ska inte skapa:

```text
A008.language = Rust
```

Speech act / semantic interpretation måste skilja:

```text
assertion
question
quotation
hypothesis
prediction
command
```

bara assertorisk world-knowledge ska skapa motsvarande claim om världen.

---

# 53. Generated Knowledge

AI-genererad information kan bli knowledge.

Det är nödvändigt exempelvis för:

* story continuity,
* analyser,
* härledda relationsfakta,
* repository observations,
* tool-resultat.

Men provenance måste bevaras.

Exempel:

```text
claim:
project architecture uses adapter pattern

source:
assistant inference derived from source inspection
```

Modellen kan senare skilja detta från:

```text
direct source statement
```

---

# 54. Repository Knowledge Example

Anta:

```text
CURRENT_TASK.md:
Status: In Progress
```

A008 läser filen.

Det producerar:

```text
CLAIM

ND-0001.status = In Progress

source:
CURRENT_TASK.md

observation:
direct
```

Eftersom semantic address är löst:

```text
ND-0001.status
```

och ingen tidigare HEAD finns:

```text
CURRENT STATE

ND-0001.status = In Progress
```

Senare:

```text
CURRENT_TASK.md:
Status: Complete
```

Ny observation:

```text
C2:
ND-0001.status = Complete
```

Resultat:

```text
HISTORY
C1 = In Progress

CURRENT
C2 = Complete
```

---

# 55. User-versus-Source Example

State:

```text
README.current_description = "AGENT 008"
```

Provenance:

```text
direct file observation
```

Användaren säger:

```text
"README är fixad nu."
```

Det skapar en ny claim om README.

Beroende på semantic precision kan systemet behöva verifiera filen innan en operation som kräver exakt innehåll.

Context kan därför innehålla:

```text
latest claim:
README has been fixed
source=user

last direct observation:
README contained AGENT 008
source=file
```

Modellen kan då läsa README innan den bygger vidare på antagandet.

A008 behöver inte blint välja mellan källorna genom ett truth-score.

Den behöver **förstå skillnaden mellan claim och observation**.

---

# 56. Story Example

Claim:

```text
Myrra.location = forest
```

Senare generation:

```text
Myrra walks into the castle.
```

Extractor:

```text
Myrra.location = castle
```

State transition:

```text
forest → history
castle → current
```

Provenance:

```text
assistant-generated canonical story content
```

Memory lifecycle avgör hur lätt tidigare skogshändelser återkommer.

Det ändrar inte current location.

---

# 57. Retrieval Example

User:

```text
"Var är Myrra nu?"
```

Process:

```text
intent = current_state

semantic address:
Myrra.location

direct state lookup:
castle

result:
castle
```

Ingen fuzzy retrieval behövs.

---

# 58. Historical Retrieval Example

User:

```text
"Var var Myrra innan hon kom till slottet?"
```

Process:

```text
intent = history

address:
Myrra.location

history:
forest

current:
castle
```

Relevant transition kan inkluderas.

---

# 59. Associative Retrieval Example

User:

```text
"Vad var det där med den magiska stenen?"
```

Ingen exakt address finns.

Systemet använder:

```text
current scope
tags
domains
entities
semantic similarity
associations
memory strength
related knowledge
```

för att hitta rätt knowledge.

Om posten varit dormant kan den återaktiveras.

---

# 60. Knowledge Classification

Fields som:

```text
type
severity
tags
domains
strength
active
persistent
confidence
```

är huvudsakligen retrieval- och presentationsegenskaper.

De får inte avgöra:

```text
vilket value som är HEAD
```

State semantics och retrieval semantics är separata.

---

# 61. Truth, Salience och Support

A008 ska alltid hålla tre axlar isär:

```text
STATE
Vad säger knowledge-banken just nu?

SUPPORT
Varför säger den det?

SALIENCE
Hur relevant är informationen just nu?
```

Exempel:

```text
STATE:
A008.status = Complete

SUPPORT:
user statement + archived task document + Git observation

SALIENCE:
0.32
```

`0.32` gör inte state mindre sant.

Det gör bara informationen mindre sannolik att spontant hämtas utanför relevant scope.

---

# 62. Hard Invariants

Följande är systeminvarianter.

## Truth

* En semantic address har högst en Current HEAD.
* Tidigare values blir history.
* History raderas inte av supersession.
* Retrieval score får aldrig ändra truth.
* Strength får aldrig ändra truth.
* Severity får aldrig ändra truth.
* Dormancy får aldrig ändra truth.
* Persistent får aldrig blockera en riktig state transition.

## Claims

* Claims och provenance bevaras.
* Claims kan existera utan State.
* Unresolved claims får inte skapa syntetiska statement-state.
* Attribution måste överleva reconciliation.

## Temporal

* Explicit world-time får inte ersättas av ingestion time.
* Historical claims får inte bli current bara för att de nyligen lästes.
* Future claims får inte ersätta present state innan deras semantic interval gäller.

## Lifecycle

* Reinforcement är semantic recurrence/relevance.
* Reinforcement är inte en truth transition.
* En occurrence får förstärka samma knowledge högst en gång.
* Failed quote/span attachment får inte ensam blockera legitim reinforcement.
* Candidate discovery är inte i sig reinforcement.

## Retrieval

* Exact current-state lookup får inte blockeras av dormancy.
* History kräver history-intent eller relevant expansion.
* Attribution kräver attribution/evidence-intent eller relevant conflict.
* Broad/fuzzy retrieval får använda strength/decay/scope/domains/tags/attraction.
* Attraction får aldrig ändra truth eller blockera exact/direct eligibility.
* Negativ attraction kräver en faktisk negativ retrieval-signal; utebliven co-occurrence är neutral.
* Association attraction decays mot 0, inte mot repulsion.
* Relationship meaning/valence och retrieval attraction är separata axlar.

---

# 63. A008:s modell i en bild

```text
                         ┌──────────────────────┐
                         │ INPUT / OBSERVATION  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ CLAIM LEDGER         │
                         │                      │
                         │ immutable knowledge  │
                         │ + provenance         │
                         └───────┬──────┬───────┘
                                 │      │
                 ┌───────────────┘      └──────────────┐
                 ▼                                     ▼
       ┌──────────────────┐                  ┌──────────────────┐
       │ SEMANTIC STATE   │                  │ EVIDENCE GRAPH   │
       │                  │                  │                  │
       │ address          │                  │ source           │
       │ HEAD             │                  │ attribution      │
       │ history          │                  │ derived_from     │
       │ relations        │                  │ observations     │
       └────────┬─────────┘                  └────────┬─────────┘
                │                                     │
                └──────────────────┬──────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ MEMORY LIFECYCLE     │
                        │                      │
                        │ strength             │
                        │ decay                │
                        │ severity             │
                        │ persistent           │
                        │ active/dormant       │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ RETRIEVAL            │
                        │                      │
                        │ exact state          │
                        │ scope                │
                        │ domains              │
                        │ tags                 │
                        │ entities             │
                        │ relations            │
                        │ associations         │
                        │ fuzzy / semantic     │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ CONTEXT BUILDER      │
                        │                      │
                        │ minimum sufficient   │
                        │ knowledge            │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ MODEL EXECUTION      │
                        └──────────┬───────────┘
                                   │
                                   └──────────► new knowledge
```

---

# 64. Mapping mot befintlig A008-implementation

Mycket av denna modell finns redan i A008.

Nuvarande system har bland annat:

* Evidence Claims
* Utterances
* Artifacts
* Provenance
* Entities
* Entity references
* Tags
* Domains
* Semantic scopes
* SlotClaims
* State bindings
* Historical intervals
* Reconciliation
* Relation classification
* Memory lifecycle
* Strength
* Decay
* Activation/dormancy
* Reinforcement
* Associations
* Signed attraction
* Current-state projection
* History retrieval
* Attribution retrieval
* Context retrieval
* Occurrence identity
* Atomic knowledge operations

Detta ska inte ersättas.

Det ska organiseras under den gemensamma modellen ovan.

---

# 65. Viktig korrigering mot nuvarande implementation

Den nuvarande implementationen har fortfarande historiska designrester där:

```text
accepted by user-assertion-v1
```

har för stor koppling till:

```text
may establish Current State
```

Det är fel ansvarsfördelning.

`user-assertion-v1` beskriver en specifik evidens-/assertionssituation.

Det är inte den universella state-modellen.

På samma sätt får inte:

```text
assistant-only
```

automatiskt betyda:

```text
cannot be State
```

En direkt repository-observation som uttrycks genom assistant pipeline är fortfarande riktig system-knowledge med provenance till den observerade källan.

---

# 66. Desired End State

När modellen är helt konsekvent ska A008 kunna göra följande:

1. Läsa ett helt nytt repository.
2. Extrahera hundratals claims.
3. Skapa Current State för resolved semantic facts.
4. Behålla ostrukturerade eller olösta claims som evidence.
5. Veta vilka facts som kommer från filer, tools, användaren eller inference.
6. Uppdatera HEAD atomärt när världen förändras.
7. Behålla tidigare HEADs som history.
8. Förstärka knowledge när den återkommer.
9. Låta irrelevant knowledge blekna ur associative retrieval.
10. Återfinna dormant knowledge när den blir relevant igen.
11. Bygga ett litet context trots en mycket stor knowledge-bank.
12. Presentera Current State utan gamla claims som parallell truth.
13. Hämta history och provenance när uppgiften kräver det.
14. Vara kritisk när claims och observerad evidence inte harmonierar.
15. Aldrig låta retrieval-metadata bestämma vad som är sant.

---

# 67. Kärnformeln

Hela modellen kan sammanfattas:

```text
KNOWLEDGE
=
Claims
+ Provenance
+ Semantic Identity
```

```text
CURRENT TRUTH
=
Current HEAD per Semantic Address
```

```text
HISTORY
=
Previous Claims / Closed Bindings
```

```text
MEMORY
=
Knowledge + Lifecycle
```

```text
SALIENCE
=
Strength
+ Recency
+ Frequency
+ Scope
+ Domains
+ Tags
+ Associations
+ Attraction
```

```text
CONTEXTUAL GRAVITY
=
Signed Attraction between knowledge nodes
```

```text
SUPPORT
=
Source
+ Provenance
+ Direct Observation
+ Corroborating Evidence
+ Contradicting Evidence
```

```text
CONTEXT
=
Relevant Current State
+ Required Evidence
+ Relevant History
+ Adaptive Memory
+ Recent Flow
```

och slutligen:

> **A008 ska inte försöka minnas allt i varje ögonblick. Det ska behålla allt som knowledge, veta vad som är current, veta varför det tror det, och vid varje uppgift återkalla exakt det som betyder något.**
