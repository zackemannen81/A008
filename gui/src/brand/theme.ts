export type AppThemeId = "neutral" | "deep-space";

export interface AppTheme {
  readonly id: AppThemeId;
  readonly name: string;
  readonly description: string;
}

export const DEFAULT_APP_THEME: AppThemeId = "neutral";
export const APP_THEME_ATTRIBUTE = "data-a008-theme";

export const APP_THEMES: readonly AppTheme[] = [
  {
    id: "neutral",
    name: "Neutral",
    description: "The current A008 charcoal surfaces.",
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description:
      "Blue-black navy surfaces with restrained electric-blue interaction.",
  },
];

export const REQUIRED_APP_THEME_TOKENS = [
  "--a008-bg-app",
  "--a008-bg-sidebar",
  "--a008-surface-1",
  "--a008-surface-2",
  "--a008-surface-3",
  "--a008-surface-hover",
  "--a008-surface-selected",
  "--a008-border-subtle",
  "--a008-border-default",
  "--a008-border-active",
  "--a008-text-primary",
  "--a008-text-secondary",
  "--a008-text-muted",
  "--a008-text-disabled",
  "--a008-accent",
  "--a008-accent-hover",
  "--a008-on-accent",
  "--a008-accent-soft",
  "--a008-focus-ring",
  "--a008-success",
  "--a008-warning",
  "--a008-danger",
  "--a008-glow-accent",
  "--a008-shadow-panel",
] as const;

export const REQUIRED_VIZ_THEME_TOKENS = [
  "--a008-viz-identity",
  "--a008-viz-state",
  "--a008-viz-claim",
  "--a008-viz-event",
  "--a008-viz-artifact",
  "--a008-viz-provenance",
  "--a008-viz-history",
  "--a008-viz-utterance",
  "--a008-viz-canvas-inner",
  "--a008-viz-canvas-outer",
  "--a008-viz-cluster",
  "--a008-viz-edge",
  "--a008-viz-label",
  "--a008-viz-highlight",
] as const;

export function parseAppThemeId(value: unknown): AppThemeId {
  return value === "deep-space" ? "deep-space" : DEFAULT_APP_THEME;
}

export function applyAppTheme(
  id: AppThemeId,
  root?: { setAttribute(name: string, value: string): void } | null,
): void {
  const target = root ?? globalThis.document?.documentElement;
  target?.setAttribute(APP_THEME_ATTRIBUTE, parseAppThemeId(id));
}
