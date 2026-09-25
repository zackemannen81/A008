export const SIDEBAR_WIDTH_STORAGE_KEY = "a008.sidebar.width";
export const SIDEBAR_HIDDEN_STORAGE_KEY = "a008.sidebar.hidden";
export const MIN_SIDEBAR_WIDTH = 208;
export const MAX_SIDEBAR_WIDTH = 480;
export const DEFAULT_SIDEBAR_WIDTH = 280;

type SidebarStorage = Pick<Storage, "getItem" | "setItem">;

export function clampSidebarWidth(value: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
}

export function readSidebarWidth(storage?: SidebarStorage): number {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return DEFAULT_SIDEBAR_WIDTH;
    const value = Number(raw);
    return Number.isFinite(value) ? clampSidebarWidth(value) : DEFAULT_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

export function persistSidebarWidth(value: number, storage?: SidebarStorage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(value)));
  } catch {}
}

export function readSidebarHidden(storage?: SidebarStorage): boolean {
  try {
    return (storage ?? globalThis.localStorage).getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistSidebarHidden(hidden: boolean, storage?: SidebarStorage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(SIDEBAR_HIDDEN_STORAGE_KEY, String(hidden));
  } catch {}
}
