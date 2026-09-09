# A008-0090 — A008-integrerad kod-canvas

Task ID: A008-0090
Parent Task: None
Status: Superseded
Owner: Rickard (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09; contract revision `5975aadb565be335382d5e70609ddf0367914e1e66962e78768d934063319440`

## Task Summary

Skapa en avgränsad A008-funktion där användaren kan be chatten skriva eller
uppdatera kod och se resultatet renderat lokalt som HTML och/eller Canvas.
Funktionen ska använda A008:s befintliga chat-, runtime- och approvalgränser.
Renderern ska endast ta emot ett säkert renderingsunderlag och får inte ha
provider-, credential- eller direkt runtimeåtkomst.

## Task Charter

### Goal

Göra chat-driven lokal kodskapning och HTML/Canvas-rendering till en A008-ägd,
säker GUI-funktion utan en konkurrerande chat- eller providerägare.

### Primary Deliverable

En fungerande kod-canvas i `gui/` med nödvändiga host/runtime-kontrakt som:

- tar emot kodrelaterade användarönskemål via befintlig chattsession,
- visar och kan uppdatera ett avgränsat kodprojekt eller kodinnehåll,
- renderar HTML/Canvas lokalt i en isolerad renderingsyta,
- bevisar att renderern inte kan nå provider eller credentials.

### In Scope

- Definiera kod-canvasens minsta UX och dataflöde i A008:s befintliga GUI.
- Återanvända befintlig `ChatSession`, ACP/host-brygga och approval-flöden.
- Definiera ett explicit, versionsbart host/runtime-kontrakt för kodförslag,
  koduppdateringar och renderingsresultat.
- Implementera lokal HTML/Canvas-rendering i en isolerad yta med tydlig
  capability- och originbegränsning.
- Stödja chat-driven skapning och uppdatering av kod inom taskens avgränsade
  kodformat och arbetsyta.
- Säkerställa att provideranrop och credentials stannar i befintlig host/ACP-
  och runtimegräns.
- Lägga till proportionerliga tester, säkerhetskontroller och ägd dokumentation.

### Out of Scope

- Ny provider, ny credential store eller browser-to-provider-anrop.
- Att ge renderern shell-, filsystems-, nätverks- eller ACP-provideråtkomst.
- Godtycklig modellgenererad kodexekvering med obegränsade host-rättigheter.
- Full IDE, multi-file buildsystem, paketinstallation eller fjärrdeployment.
- Live provider-smoketests, betalda anrop, publicering eller desktoppaketering.
- Ändringar i OpenHands-källträdet eller en konkurrerande chatmotor.
- Nya persistens-, kontos-, ACL-, retention- eller delningspolicyer.

### Definition of Done

- [ ] Kod-canvasen är åtkomlig från A008:s befintliga GUI utan separat chatmotor.
- [ ] En användarprompt kan skapa och uppdatera ett definierat kodunderlag.
- [ ] HTML/Canvas-resultat renderas lokalt och uppdateras deterministiskt.
- [ ] Renderern saknar direkt provider-, credential-, ACP-, shell- och
      host-filsystemsåtkomst enligt kodgranskning och negativa tester.
- [ ] Approval-flöden och befintliga session-/hostgränser kvarstår.
- [ ] Fel, avvisningar, avbrutna uppdateringar och ogiltig kod hanteras explicit.
- [ ] Typecheck, relevanta enhetstester, GUI-/host-kontraktstester och en lokal
      integrationstest passerar utan live provider.
- [ ] Ägda dokument beskriver faktisk funktion, säkerhetsgräns och begränsningar.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `main` revision containing the reviewed `docs/PROJECT_BRIEF.md`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| A008 GUI kod-canvas och chatdrivet kodunderlag | PC-01 — one shared engine; GUI must not create a competing chat engine or provider owner | Users cannot work with code in the existing A008 chat surface; a parallel implementation would split session/provider behavior | Add one GUI feature over the existing session/host/ACP path and keep chat ownership in runtime | GUI session contract test proves prompts use the existing session path and no renderer provider import exists |
| Lokal HTML/Canvas-rendering | PC-05 — explicit execution and credential boundaries; retrieved/model content cannot grant execution | HTML/Canvas output cannot be previewed locally, or preview could become an unintended host execution path | Render only a bounded code payload inside an isolated local preview with no host/provider capabilities | Browser/DOM or headless preview test renders approved HTML/Canvas and negative capability test rejects provider, shell, filesystem and ACP access |
| Koduppdatering och approvalgräns | PC-05 and PC-06 — supported controls and explicit unsupported outcomes; existing approval flows remain | Chat output could mutate code or execute side effects without a visible, bounded user decision | Route code writes/updates through existing host tool/approval boundary and expose rejected/unsupported results | Contract tests cover approval required, denial, cancellation, malformed patch and stale revision |
| Ägd dokumentation och regressionstester | PC-01, PC-05 and PC-06; product surfaces must preserve shared boundaries and explicit unsupported behavior | Future work could incorrectly add direct provider access or claim unsupported execution | Update only owning status/system/protocol docs and add focused fake/local gates | Documentation/link/diff checks plus full local test command |

### Minimum Verification Gates

- [ ] Verify no renderer bundle import or runtime path exposes provider adapters,
      credentials, ACP transport, shell executor or unrestricted filesystem APIs.
- [ ] Verify one complete fake/local flow: prompt → approved code update → local
      HTML/Canvas render.
- [ ] Verify denied, cancelled, malformed and stale code-update flows.
- [ ] Verify renderer navigation/origin/isolation behavior and no external
      provider/network dependency in the preview path.
- [ ] Run repository typecheck/build and focused core, host and GUI tests.
- [ ] Review the final diff against this necessity gate and frozen scope.
- [ ] Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, and relevant protocol
      or ADR documentation when behavior is implemented.

## References

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/HOST_PROTOCOL.md`
- `docs/SYSTEMDOC.md`
- `docs/CURRENT_STATUS.md`
- `docs/CONTRIBUTING.md`
- `docs/FILESTRUCTURE.md`
- Relevant GUI and security ADRs under `docs/adr/`

## Checklist

- [x] Task ID `A008-0090` is claimed in `docs/TASK_IDS.md`; charter is frozen as Ready.
- [ ] Review existing GUI/session/host boundaries and choose the smallest design.
- [ ] Record any required direction decision or ADR before implementation.
- [ ] Implement the host/runtime contract and GUI feature in bounded slices.
- [ ] Add focused fake/local tests and security-negative tests.
- [ ] Update owning documentation with observed behavior.
- [ ] Review final diff and route discoveries through `docs/TASK_WORKFLOW.md`.

## Decisions and Notes

- This charter is Ready and frozen. Implementation must remain within the recorded scope and gates.
- The existing `vectorfield.html` remains unrelated working-tree material until
  the operator explicitly decides whether to preserve, commit, or remove it.
- No renderer capability may be inferred from model output or command-shaped text.
- Any need for arbitrary code execution, package installation, persistence,
  collaboration or remote rendering requires a separate bounded task or ADR.

## Charter Amendment Log

- 2026-09-09: Initial Draft created from the owner request.
- 2026-09-09: Superseded by A008-0091 after owner review clarified that an in-chat code artifact is transient content, not a repository mutation. A008-0090's frozen implementation scope is not rewritten.

## Verification

- [ ] No implementation verification performed; charter-only change.
- [ ] Record exact checks and outputs when implementation begins.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Task ID `A008-0090` is claimed and this charter is Ready/frozen.
- Next recommended step: implement the bounded first slice on a dedicated task branch, preserving the pinned contract and verification gates.
- Blockers: existing untracked `vectorfield.html` remains unrelated working-tree material and requires an explicit operator decision before inclusion.
- Child tasks: none.
- Resume condition: implementation begins under the frozen charter with local/fake verification only.
- Open questions: exact code format, update granularity, preview isolation mechanism, and whether persistence is needed are implementation decisions within the frozen scope; material expansion requires a child task or ADR.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Write `docs/handoffs/A008-0090.md`.
- Append the signed journal entry through the operator merge process.
