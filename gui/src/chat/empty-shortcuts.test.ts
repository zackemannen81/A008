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

test("open dock lists shortcuts and a hide control", () => {
  const html = renderToStaticMarkup(
    createElement(ShortcutDock, {
      hidden: false,
      open: true,
      onShortcut() {},
      onOpen() {},
      onHide() {},
    }),
  );
  assert.match(html, /Hide shortcuts/u);
  assert.match(html, /Workbench shortcuts/u);
  assert.match(html, /Ctrl\+Shift\+G/u);
  assert.equal(html.includes(">Shortcuts<"), false);
});

test("collapsed dock is a show control without the chip list", () => {
  const html = renderToStaticMarkup(
    createElement(ShortcutDock, {
      hidden: false,
      open: false,
      onShortcut() {},
      onOpen() {},
      onHide() {},
    }),
  );
  assert.match(html, /a008-shortcut-dock-collapsed/u);
  assert.match(html, />Shortcuts</u);
  assert.equal(html.includes("Hide shortcuts"), false);
  assert.equal(html.includes("Workbench shortcuts"), false);
});
