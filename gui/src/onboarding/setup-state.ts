import type { AppThemeId } from "../brand/theme.js";

export const FIRST_RUN_SETUP_STORAGE_KEY = "a008.first-run-setup";
export const DEFAULT_CHAT_MODEL_STORAGE_KEY = "a008.default-chat-model";

export interface FirstRunSetupState {
  readonly completed: boolean;
  readonly userName: string;
  readonly customInstructions: string;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): PreferenceStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readFirstRunSetupState(
  target: PreferenceStorage | undefined = storage(),
): FirstRunSetupState {
  if (!target) return { completed: false, userName: "", customInstructions: "" };
  try {
    const raw = target.getItem(FIRST_RUN_SETUP_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { completed: false, userName: "", customInstructions: "" };
    const value = parsed as Record<string, unknown>;
    return {
      completed: value.completed === true,
      userName: typeof value.userName === "string" ? value.userName : "",
      customInstructions:
        typeof value.customInstructions === "string"
          ? value.customInstructions
          : "",
    };
  } catch {
    return { completed: false, userName: "", customInstructions: "" };
  }
}

export function saveFirstRunSetupState(
  state: FirstRunSetupState,
  target: PreferenceStorage | undefined = storage(),
): void {
  try {
    target?.setItem(FIRST_RUN_SETUP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Restricted browser storage must not block using the app.
  }
}

export function readDefaultChatModel(
  target: PreferenceStorage | undefined = storage(),
): string | undefined {
  try {
    const value = target?.getItem(DEFAULT_CHAT_MODEL_STORAGE_KEY)?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export function saveDefaultChatModel(
  model: string,
  target: PreferenceStorage | undefined = storage(),
): void {
  try {
    if (model.trim()) target?.setItem(DEFAULT_CHAT_MODEL_STORAGE_KEY, model.trim());
  } catch {
    // Restricted browser storage must not block using the app.
  }
}

export function composeSetupInstructions(
  userName: string,
  customInstructions: string,
): string {
  const name = userName.trim();
  const custom = customInstructions.trim();
  const identity = name
    ? `The user's name is ${name}. Address the user by this name when appropriate.`
    : "";
  return [identity, custom].filter(Boolean).join("\n\n");
}

export function themeLabel(theme: AppThemeId): string {
  return theme === "deep-space"
    ? "Deep Space"
    : theme === "oldscool"
      ? "Oldscool"
      : theme === "cyberpunk"
        ? "Cyberpunk"
        : "Neutral";
}
