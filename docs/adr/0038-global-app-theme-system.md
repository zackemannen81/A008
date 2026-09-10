# ADR 0038 — Global app theme system

Status: Accepted
Date: 2026-09-11
Task: A008-0093
Amends: ADR 0021 D2 and ADR 0030 (single shipped palette)

## Decision

The standalone A008 GUI has a named app-theme identity. The first two themes
are **Neutral** and **Deep Space**. Neutral is the default and must preserve
the current charcoal look from ADR 0030. Deep Space is an additional
owner-requested expression: near-black/navy/slate surfaces, colder blue-gray
text, subtle blue borders, restrained electric-blue interaction, and selective
glow. It remains A008: dense when needed, quiet outside active information,
functional before decorative. It is not a cyberpunk, neon, or light theme, and
it is not a return to the retired cyan HUD.

TypeScript owns theme identity (`neutral` | `deep-space`). CSS owns
presentation through semantic custom properties on a root data attribute such
as `html[data-a008-theme="deep-space"]`. Components consume tokens; they do
not hard-code global chrome colours or branch on theme id.

App-theme chrome (surfaces, text, borders, interaction, status, panel shadow)
and visualization colours (graph nodes, relationship categories) are separate
token families. A later selectable graph palette must not require a new app
theme. Relationship strength remains stored data, not decorative glow.

Theme is a renderer-local global GUI preference. It is not runtime settings
(ADR 0027), conversation or ACP session state, memory, a provider call, or a
host-protocol field. Missing or unknown values default to Neutral without
rewriting older preference documents. The selected theme is applied before
first paint to avoid a Neutral flash. Switching updates the root attribute
immediately and must not create a session, change the model, mutate memory,
alter tool permissions, or restyle the sandboxed Code Canvas preview document.
The Code Canvas chrome around that preview may follow the host theme.

Existing `--a008-*` token names remain as aliases bound to the semantic model
so unmigrated feature CSS still follows the selected theme. This task may
replace hardcoded global-semantic colours in GUI chrome and Memory surfaces
with tokens. It may not redesign layout, navigation, typography family, the
Relationship Map algorithm, Canvas sandbox policy, or mobile navigation.

OLED, Warm, High Contrast, Custom, OS-theme detection, and a user-selectable
visualization palette are compatible later work. They are not authorized here.

## Consequences

A008 keeps one visual language family with more than one named expression.
Neutral users see the current product. Deep Space can demonstrate the approved
Memory Relationship Map material across the whole shell without a second GUI.
Runtime, credentials, tools and preview isolation stay unchanged because theme
never leaves renderer presentation state.
