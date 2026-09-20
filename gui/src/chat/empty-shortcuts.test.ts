import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  persistShortcutDockVisible,
  ShortcutDock,
  shortcutDockVisible,
  SHORTCUT_DOCK_STORAGE_KEY,
} from "./empty-shortcuts.js";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

test("shortcut dock is visible until the user hides it", () => {
  const store = memoryStore();
  assert.equal(shortcutDockVisible(store), true);
  persistShortcutDockVisible(false, store);
  assert.equal(store.getItem(SHORTCUT_DOCK_STORAGE_KEY), "hidden");
  assert.equal(shortcutDockVisible(store), false);
  persistShortcutDockVisible(true, store);
  assert.equal(shortcutDockVisible(store), true);
});

test("open shortcut popover lists commands and a close control", () => {
  const html = renderToStaticMarkup(
    createElement(ShortcutDock, {
      hidden: false,
      open: true,
      onShortcut() {},
      onClose() {},
    }),
  );
  assert.match(html, /id="a008-shortcut-dock"/u);
  assert.match(html, /Close shortcuts/u);
  assert.match(html, /Workbench shortcuts/u);
  assert.match(html, /Ctrl\+Shift\+G/u);
});

test("closed shortcut popover renders nothing", () => {
  const html = renderToStaticMarkup(
    createElement(ShortcutDock, {
      hidden: false,
      open: false,
      onShortcut() {},
      onClose() {},
    }),
  );
  assert.equal(html, "");
});
