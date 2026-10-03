import assert from "node:assert/strict";
import test from "node:test";
import { isNotificationSoundEnabled, setNotificationSoundEnabled } from "./notification-preferences.js";

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    read: () => value,
  };
}

test("notification sound defaults off and preserves other GUI preferences", () => {
  const storage = memoryStorage();
  assert.equal(isNotificationSoundEnabled(storage), false);
  storage.setItem("a008.preferences", JSON.stringify({ appearance: { theme: "neutral" } }));
  setNotificationSoundEnabled(true, storage);
  assert.equal(isNotificationSoundEnabled(storage), true);
  assert.deepEqual(JSON.parse(storage.read()!), {
    appearance: { theme: "neutral" },
    notifications: { sound: true },
  });
  setNotificationSoundEnabled(false, storage);
  assert.equal(isNotificationSoundEnabled(storage), false);
});
