import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  parseAppThemeId,
  type AppThemeId,
} from "./theme.js";

export const GUI_PREFERENCES_STORAGE_KEY = "a008.preferences";

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function readPreferenceObject(
  storage: PreferenceStorage,
): Record<string, unknown> {
  try {
    const raw = storage.getItem(GUI_PREFERENCES_STORAGE_KEY);
    if (raw === null || raw === "") return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function appearanceTheme(value: unknown): AppThemeId {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_APP_THEME;
  }
  return parseAppThemeId((value as { readonly theme?: unknown }).theme);
}

export function readStoredAppTheme(storage?: PreferenceStorage): AppThemeId {
  try {
    const store = storage ?? globalThis.localStorage;
    if (!store) return DEFAULT_APP_THEME;
    return appearanceTheme(readPreferenceObject(store).appearance);
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function persistAppTheme(
  id: AppThemeId,
  storage?: PreferenceStorage,
): void {
  try {
    const store = storage ?? globalThis.localStorage;
    if (!store) return;
    const current = readPreferenceObject(store);
    const previous = current.appearance;
    const appearance =
      previous !== null && typeof previous === "object" && !Array.isArray(previous)
        ? { ...(previous as Record<string, unknown>), theme: parseAppThemeId(id) }
        : { theme: parseAppThemeId(id) };
    store.setItem(
      GUI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ ...current, appearance }),
    );
  } catch {
    /* private mode or missing storage */
  }
}

export function selectAppTheme(
  id: AppThemeId,
  options?: {
    storage?: PreferenceStorage;
    root?: { setAttribute(name: string, value: string): void } | null;
  },
): AppThemeId {
  const theme = parseAppThemeId(id);
  persistAppTheme(theme, options?.storage);
  applyAppTheme(theme, options?.root);
  return theme;
}
