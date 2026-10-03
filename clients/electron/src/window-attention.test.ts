import assert from "node:assert/strict";
import test from "node:test";
import { handleDesktopTitleChange } from "./window-attention.ts";

test("desktop flashes only for an unfocused window and stops after bounded attention", () => {
  const calls: string[] = [];
  let callback: (() => void) | undefined;
  let cleared = 0;
  const window = {
    isFocused: () => false,
    flashFrame: (enabled: boolean) => calls.push(`flash:${enabled}`),
    setTitle: (title: string) => calls.push(`title:${title}`),
  };
  const timers = {
    setTimeout: (next: () => void, milliseconds: number) => {
      assert.equal(milliseconds, 8_000);
      callback = next;
      return 1;
    },
    clearTimeout: () => { cleared += 1; },
  };
  const stop = handleDesktopTitleChange(window, "⚠ Turn failed — A008", true, timers);
  assert.deepEqual(calls, ["title:⚠ Turn failed — A008", "flash:true"]);
  callback?.();
  assert.equal(calls.at(-1), "flash:false");
  stop();
  assert.equal(cleared, 1);

  calls.length = 0;
  handleDesktopTitleChange({ ...window, isFocused: () => true }, "notice", true, timers);
  assert.deepEqual(calls, ["title:notice", "flash:false"]);
});
