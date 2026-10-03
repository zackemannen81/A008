export const NOTIFICATION_PREFERENCES_KEY = "a008.preferences";

export interface NotificationPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function preferences(storage?: NotificationPreferenceStorage): Record<string, unknown> {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(NOTIFICATION_PREFERENCES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function isNotificationSoundEnabled(storage?: NotificationPreferenceStorage): boolean {
  const notification = preferences(storage).notifications;
  return notification !== null && typeof notification === "object" && !Array.isArray(notification)
    ? (notification as { sound?: unknown }).sound === true
    : false;
}

export function setNotificationSoundEnabled(
  enabled: boolean,
  storage?: NotificationPreferenceStorage,
): void {
  try {
    const target = storage ?? globalThis.localStorage;
    const current = preferences(target);
    const existing = current.notifications;
    const notifications = existing !== null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>), sound: enabled }
      : { sound: enabled };
    target.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify({ ...current, notifications }));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
