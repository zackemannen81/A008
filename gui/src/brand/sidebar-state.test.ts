import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  persistSidebarHidden,
  persistSidebarWidth,
  readSidebarHidden,
  readSidebarWidth,
} from "./sidebar-state.js";

const here = dirname(fileURLToPath(import.meta.url));

function storage(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return {
    getItem(key: string) { return values[key] ?? null; },
    setItem(key: string, value: string) { values[key] = value; },
  };
}

test("sidebar width defaults safely and remains bounded", () => {
  assert.equal(readSidebarWidth(storage()), DEFAULT_SIDEBAR_WIDTH);
  const store = storage();
  persistSidebarWidth(MIN_SIDEBAR_WIDTH - 100, store);
  assert.equal(readSidebarWidth(store), MIN_SIDEBAR_WIDTH);
  persistSidebarWidth(MAX_SIDEBAR_WIDTH + 100, store);
  assert.equal(readSidebarWidth(store), MAX_SIDEBAR_WIDTH);
});

test("sidebar visibility persists independently from its width", () => {
  const store = storage();
  assert.equal(readSidebarHidden(store), false);
  persistSidebarHidden(true, store);
  assert.equal(readSidebarHidden(store), true);
  persistSidebarHidden(false, store);
  assert.equal(readSidebarHidden(store), false);
});

test("shell exposes an accessible resizer and only existing application actions", () => {
  const app = readFileSync(join(here, "../app.tsx"), "utf8");
  const css = readFileSync(join(here, "workspace.css"), "utf8");
  assert.match(app, /aria-label="Resize sidebar"/u);
  assert.match(app, /role="separator"/u);
  assert.match(css, /cursor: col-resize/u);
  assert.match(app, /\["file", "File"/u);
  assert.match(app, /\["edit", "Edit"/u);
  assert.match(app, /\["view", "View"/u);
  assert.match(app, /\["help", "Help"/u);
});
