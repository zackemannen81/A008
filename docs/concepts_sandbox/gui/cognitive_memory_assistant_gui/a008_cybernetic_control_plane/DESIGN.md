---
name: A008 Cybernetic Control-Plane
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1b1c1e'
  surface-container: '#1f2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e4'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#e3e2e4'
  inverse-on-surface: '#303032'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffc08e'
  on-tertiary: '#4d2600'
  tertiary-container: '#ff9837'
  on-tertiary-container: '#6a3700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#121315'
  on-background: '#e3e2e4'
  surface-variant: '#343537'
  surface-canvas: '#0c0d0e'
  surface-panel: '#131416'
  surface-elevated: '#181a1d'
  surface-highlight: '#212428'
  border-subtle: '#27272a'
  border-strong: '#3f3f46'
  text-primary: '#f4f4f5'
  text-secondary: '#a1a1aa'
  text-muted: '#71717a'
  amber-bright: '#fbbf24'
  amber-dim: '#b45309'
  emerald-active: '#10b981'
  emerald-glow: '#059669'
  thought-stream-bg: '#121316'
  terminal-scrim: '#090a0b'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  thought-stream:
    fontFamily: Inter
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-xxs: 2px
  space-xs: 4px
  space-sm: 8px
  space-md: 12px
  space-lg: 16px
  space-xl: 20px
  space-2xl: 24px
  space-3xl: 32px
  sidebar-width: 260px
  telemetry-panel-width: 340px
  composer-height: 120px
  header-height: 40px
---

## Brand & Style

This design system delivers an ultra-dense, technical console aesthetic engineered for mission-critical developer environments, AI orchestration platforms, and deep telemetry runtime monitors. Inspired by hardened command terminals, telemetry flight decks, and defense-grade control panels, the UI emphasizes architectural discipline, deterministic feedback loops, and zero decorative bloat.

The emotional signature is precise, authoritative, and focused. It treats developers and machine intelligence researchers as operational commanders who demand deep visual separation between runtime channels: cognitive thought streams, executed tool manifests, and deterministic answer outputs. 

Key design attributes include:
- **Sub-perceptual Elevation:** Grounded in near-black charcoal obsidian bases with hairline zinc-slate structural borders.
- **Amber & Gold Chromatic Signature:** Operational focal points, agent brand markers, and cognitive telemetry accents glow with warm amber and molten gold against a high-contrast dark backdrop.
- **Bi-Systemic Status:** Active nodes, live socket bridges, and successful verification cycles emit a crisp, high-visibility emerald green.
- **Monospace Rigor:** Monospaced typography is elevated from a secondary code block treatment to a primary ergonomic interface token, framing session manifests, knowledge slots, and model identifiers.

## Colors

The chromatic architecture is anchored by a three-tiered dark spectrum accented by warm terminal amber and operational emerald.

### Primary & Accent Palette
- **Primary (`#f59e0b` / Amber 500)**: The dominant interactive focus and brand authority. Applied to primary CTAs, active command prompts, active tab underlines, and top-level brand nomenclature.
- **Tertiary (`#d97706` / Amber 600)**: Hover states, secondary telemetry alerts, and warm structural highlights.
- **Secondary (`#10b981` / Emerald 500)**: Reserved strictly for deterministic operational health: connected runtime sockets, memory slot verification checks, and active cluster health.

### Surface & Neutral Architecture
- **Surface Canvas (`#0c0d0e`)**: Deep obsidian base for background viewports and workspace frames.
- **Surface Panel (`#131416`)**: Mid-tier surface applied to sidebars, tab containers, and bottom composer regions.
- **Surface Elevated (`#181a1d`)**: Elevated split panes, inspect overlays, modal popovers, and input cavities.
- **Surface Highlight (`#212428`)**: Active hover layers, table row highlights, and selected memory entity records.

### Hierarchy & Text Contrast
- **Text Primary (`#f4f4f5`)**: Final user/assistant outputs, active control headers, and primary data values.
- **Text Secondary (`#a1a1aa`)**: Section headers, settings labels, and standard monospace telemetry.
- **Text Muted (`#71717a`)**: Thought stream reasoning, placeholder values, inactive channel timestamps, and keyboard shortcut glyphs.

## Typography

The typographic hierarchy utilizes a deliberate bifurcation: **Inter** handles narrative clarity and human interface readability, while **JetBrains Mono** anchors technical precision, runtime telemetry, machine metadata, and systemic labeling.

### Structural Typographic Invariants
1. **Caps Labels (`label-caps`)**: All structural control labels (e.g., `SETTINGS`, `PRODUCT`, `MODEL`, `CONNECTION`, `SESSION`, `MEMORY`) are set strictly in uppercase JetBrains Mono with `0.08em` tracking. This establishes a hardware console layout feel.
2. **Channel Thought Stream (`thought-stream`)**: The model reasoning channel is isolated using muted neutral gray (`#a1a1aa` to `#71717a`) at 12.5px with comfortable leading (20px), signaling internal deliberation without competing with the final message output.
3. **Session Hashes & Identifiers (`mono-sm` / `mono-md`)**: Model paths (`nvidia/nemotron-3.5-lightning`), session IDs, and memory addresses are rendered strictly in monospace, ensuring unambiguous character width for inspection.

## Layout & Spacing

The layout philosophy follows a high-density, multi-pane workbench optimized for large displays, ultra-wide screens, and full-screen desktop wrappers. 

### Multi-Pane Architecture
- **Header Bar (40px)**: Global status line holding the brand identity (`A008 / AI CLIENT`), system-level latency indicators, and live session health (`● CONNECTED`).
- **Left Telemetry Rail (260px fixed)**: Displays active model configurations, token consumption, session hashes, and memory state intervals. Collapsible down to an icon-only 48px strip.
- **Center Canvas (Flexible)**: Split vertically into the channel-isolated interaction viewport:
  - Upper area: Multi-channel DOM viewport separating stream thoughts, validation flags, and the final emitted response cards.
  - Bottom area: Structural message composer (120px default height) with integrated slash-command autocompleter.
- **Right Telemetry / Terminal Inspector (340px fixed or resizable)**: Segmented tab host displaying real-time command terminal, entity knowledge graphs, vector slots, and file payload buffers.

### Spatial Rhythms
- Compact baseline grid: 4px increments (`4px`, `8px`, `12px`, `16px`).
- Inset padding for cards and panels: strictly `12px` or `16px`.
- Inter-panel dividers: strictly `1px` solid hairlines (`#27272a`), devoid of outer margins.

## Elevation & Depth

This system avoids soft skeuomorphic drop shadows or deep blurred atmospheric diffusions. Instead, depth is achieved through **structural planar layering** and **hairline edge definition**.

### Elevation Strategies
1. **Low-Contrast Hairlines**: All panel boundaries, splitters, tab bars, and control fields employ a precise `1px` border (`#27272a` for resting states; `#3f3f46` for active/hover states).
2. **Layer Tiers**:
   - `Layer 0 (Canvas)`: `#0c0d0e` — Application window root.
   - `Layer 1 (Sidebars & Bins)`: `#131416` — Persistent structural navigation and workspace shells.
   - `Layer 2 (Content Modules & Thought Panels)`: `#181a1d` — Distinct interaction zones, thought cards, and terminal viewport containers.
   - `Layer 3 (Modals & Command Palettes)`: `#212428` — Overlay inspect dialogs with an ambient border illumination using `rgba(245, 158, 11, 0.2)`.
3. **Accent Glows**: Emerald status nodes use a sub-perceptual ambient bloom (`box-shadow: 0 0 8px rgba(16, 185, 129, 0.45)`) to communicate real-time heartbeat connectivity.

## Shapes

The geometric form language is rigorous, industrial, and utilitarian (`roundedness: 1`). Soft curves and playful pill buttons are rejected in favor of razor-sharp micro-radii that maximize screen real estate and align with structural code editors.

- **Standard Elements (Buttons, Inputs, Cards)**: `4px` (`rounded-sm`).
- **Terminal Panes & Split Views**: `0px` (Square, flush-docked edge alignment).
- **Inline Badges & Runtime Status Chips**: `2px` (`rounded-xs`).
- **Indicator Nodes (Pings, Health Indicators)**: `9999px` (Full circles for telemetry beacons).

## Components

### 1. Buttons
- **Primary Action (Send / Execute)**: Background `#181a1d`, border `1px solid #3f3f46`, text `#f4f4f5`. On hover: border `#f59e0b`, text `#fbbf24`. Active: background `#212428`.
- **Ghost Action / Tool Trigger**: Background transparent, border `1px solid transparent`, text `#a1a1aa`. On hover: background `#181a1d`, border `#27272a`, text `#f4f4f5`.
- **Command Run Trigger (`RUN`)**: Fixed height 28px, compact font `JetBrains Mono` 11px uppercase, border `1px solid #3f3f46`, background `#181a1d`, hover border `#10b981`.

### 2. Input Fields & Message Composer
- **Message Box**: Integrated bottom drawer with continuous border `1px solid #27272a`, background `#0c0d0e`, focused border `1px solid #f59e0b`. Inner placeholder in `#71717a` (`Message or /help`).
- **Inline Command Input**: Height 28px, monospace text, background `#0c0d0e`, border `1px solid #27272a`, active focus `#f59e0b`.

### 3. Channel-Isolated Message Panes
- **Thought Stream (Cognitive Channel)**: Continuous vertical strip with a `2px` left border in `#27272a`. Body text set in `thought-stream` (`#a1a1aa`). Never mixed into the final answer DOM block.
- **Answer Container**: High-contrast card with background `#131416`, hairline border `#27272a`, typography `body-md` (`#f4f4f5`).
- **Verification Marker**: Inline check badge rendered in emerald `#10b981` with dark background `#0c0d0e`.

### 4. Navigation & Telemetry Tabs
- **Inspector Tabs (`TERMINAL`, `UPLOAD`, `MEMORY`)**: Uppercase monospace 11px. Resting state: text `#71717a`, no border. Active state: text `#f59e0b`, bottom border `2px solid #f59e0b`.

### 5. Status Indicators & Badges
- **Node Connection Dot**: 6px circular indicator `#10b981` with soft radial halo. Coupled with uppercase monospace text `CONNECTED` (`#10b981`).
- **Telemetry Key-Value Rows**: Stacked pairs: top label in `label-caps` (`#a1a1aa`), value underneath in `mono-sm` (`#f4f4f5` or amber `#f59e0b`).