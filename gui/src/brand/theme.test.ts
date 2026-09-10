import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  APP_THEME_ATTRIBUTE,
  applyAppTheme,
  parseAppThemeId,
  REQUIRED_APP_THEME_TOKENS,
  REQUIRED_VIZ_THEME_TOKENS,
} from "./theme.js";
import {
  GUI_PREFERENCES_STORAGE_KEY,
  persistAppTheme,
  readStoredAppTheme,
  selectAppTheme,
} from "./theme-storage.js";
import { AppearancePanel } from "../settings/appearance-panel.js";
import { ParametersPanel } from "../settings/parameters-panel.js";
import { buildPreviewDocument } from "../artifact/code-artifact.js";
import type { GuiSession } from "../session/types.js";

const here = dirname(fileURLToPath(import.meta.url));

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

function attributeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name);
    },
  };
}

function tokenNames(block: string): Set<string> {
  const names = new Set<string>();
  for (const match of block.matchAll(/--a008-[a-z0-9-]+(?=\s*:)/gu)) {
    names.add(match[0]);
  }
  return names;
}

function idleSession(overrides: Partial<GuiSession> = {}): GuiSession {
  return {
    status: "idle",
    sessionId: "A008_v1_acp_session_keep-me",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    thought: "",
    answer: "existing conversation",
    error: undefined,
    async connect() {
      throw new Error("theme must not connect");
    },
    async prompt() {
      throw new Error("theme must not prompt");
    },
    async cancel() {},
    ...overrides,
  };
}

test("unknown or missing theme identity becomes Neutral", () => {
  assert.equal(parseAppThemeId(undefined), "neutral");
  assert.equal(parseAppThemeId(null), "neutral");
  assert.equal(parseAppThemeId(""), "neutral");
  assert.equal(parseAppThemeId("oled"), "neutral");
  assert.equal(parseAppThemeId("deep-space"), "deep-space");
  assert.equal(parseAppThemeId("neutral"), "neutral");
});

test("missing, invalid and unknown stored themes default to Neutral", () => {
  assert.equal(readStoredAppTheme(memoryStore()), "neutral");
  assert.equal(readStoredAppTheme(memoryStore({ [GUI_PREFERENCES_STORAGE_KEY]: "{" })), "neutral");
  assert.equal(
    readStoredAppTheme(memoryStore({ [GUI_PREFERENCES_STORAGE_KEY]: JSON.stringify({ appearance: { theme: "warm" } }) })),
    "neutral",
  );
  assert.equal(
    readStoredAppTheme(memoryStore({ [GUI_PREFERENCES_STORAGE_KEY]: JSON.stringify({ theme: "deep-space" }) })),
    "neutral",
  );
});

test("Neutral and Deep Space round-trip through preference storage", () => {
  const store = memoryStore();
  persistAppTheme("deep-space", store);
  assert.equal(readStoredAppTheme(store), "deep-space");
  assert.deepEqual(JSON.parse(store.getItem(GUI_PREFERENCES_STORAGE_KEY) ?? ""), {
    appearance: { theme: "deep-space" },
  });
  persistAppTheme("neutral", store);
  assert.equal(readStoredAppTheme(store), "neutral");
});

test("saving theme preserves unrelated preference keys", () => {
  const store = memoryStore({
    [GUI_PREFERENCES_STORAGE_KEY]: JSON.stringify({
      appearance: { density: "compact" },
      extra: { keep: true },
    }),
    "a008.shortcutDock": "hidden",
  });
  assert.equal(readStoredAppTheme(store), "neutral");
  persistAppTheme("deep-space", store);
  assert.deepEqual(JSON.parse(store.getItem(GUI_PREFERENCES_STORAGE_KEY) ?? ""), {
    appearance: { density: "compact", theme: "deep-space" },
    extra: { keep: true },
  });
  assert.equal(store.getItem("a008.shortcutDock"), "hidden");
});

test("selecting a theme updates the root data attribute immediately", () => {
  const store = memoryStore();
  const root = attributeRoot();
  assert.equal(selectAppTheme("deep-space", { storage: store, root }), "deep-space");
  assert.equal(root.getAttribute(APP_THEME_ATTRIBUTE), "deep-space");
  applyAppTheme("neutral", root);
  assert.equal(root.getAttribute(APP_THEME_ATTRIBUTE), "neutral");
});

test("Appearance renders Neutral and Deep Space with an accessible selected state", () => {
  const html = renderToStaticMarkup(createElement(AppearancePanel));
  assert.match(html, /aria-label="Appearance"/u);
  assert.match(html, />App theme</u);
  assert.match(html, />Neutral</u);
  assert.match(html, />Deep Space</u);
  assert.match(html, /data-a008-theme="neutral"/u);
  assert.match(html, /data-a008-theme="deep-space"/u);
  assert.match(html, /aria-pressed="true"/u);
  assert.match(html, /aria-pressed="false"/u);
});

test("Parameters exposes Appearance without requiring a connected session", () => {
  const html = renderToStaticMarkup(
    createElement(ParametersPanel, { session: idleSession(), onClose() {} }),
  );
  assert.match(html, />Appearance</u);
  assert.match(html, /aria-label="Appearance"/u);
  assert.match(html, />App theme</u);
  assert.match(html, />Deep Space</u);
  assert.match(html, /Connect to inspect and change the active session/u);
});

test("theme selection is renderer-local and does not use session APIs", () => {
  const store = memoryStore();
  const root = attributeRoot();
  const session = idleSession();
  selectAppTheme("deep-space", { storage: store, root });
  assert.equal(session.sessionId, "A008_v1_acp_session_keep-me");
  assert.equal(session.answer, "existing conversation");
  assert.equal(session.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
});

test("Code Canvas preview documents do not inherit host theme tokens", () => {
  const preview = buildPreviewDocument("<canvas></canvas><style>body{color:red}</style>");
  assert.equal(preview.includes(APP_THEME_ATTRIBUTE), false);
  assert.equal(preview.includes("--a008-bg-app"), false);
  assert.equal(preview.includes("deep-space"), false);
  assert.match(preview, /Content-Security-Policy/u);
});

test("index.html applies the persisted theme before the module loads", () => {
  const html = readFileSync(join(here, "../../index.html"), "utf8");
  assert.match(html, /a008\.preferences/u);
  assert.match(html, /data-a008-theme/u);
  assert.match(html, /deep-space/u);
  const scriptEnd = html.indexOf("</script>");
  const module = html.indexOf('src="/src/main.tsx"');
  assert.ok(scriptEnd > 0 && module > scriptEnd);
});

test("both themes declare every required semantic and visualization token", () => {
  const css = readFileSync(join(here, "themes.css"), "utf8");
  const deepAt = css.indexOf('[data-a008-theme="deep-space"]');
  assert.notEqual(deepAt, -1);
  const neutral = tokenNames(css.slice(0, deepAt));
  const deepSpace = tokenNames(css.slice(deepAt));
  for (const name of [...REQUIRED_APP_THEME_TOKENS, ...REQUIRED_VIZ_THEME_TOKENS]) {
    assert.ok(neutral.has(name), `Neutral missing ${name}`);
    assert.ok(deepSpace.has(name), `Deep Space missing ${name}`);
  }
});

test("Neutral token values are the extracted current A008 palette", () => {
  const css = readFileSync(join(here, "themes.css"), "utf8");
  const neutral = css.slice(0, css.indexOf('[data-a008-theme="deep-space"]'));
  const expected: Record<string, string> = {
    "--a008-bg-app": "#181818",
    "--a008-bg-sidebar": "#202020",
    "--a008-surface-1": "#202020",
    "--a008-surface-2": "#242424",
    "--a008-text-primary": "#eeeeee",
    "--a008-text-secondary": "#d0d0d0",
    "--a008-text-muted": "#a0a0a0",
    "--a008-text-disabled": "#777777",
    "--a008-accent": "#e4e4e4",
    "--a008-success": "#86a088",
    "--a008-danger": "#c07f74",
    "--a008-viz-identity": "#e8c547",
    "--a008-viz-state": "#5b8def",
    "--a008-viz-claim": "#6bcb8b",
    "--a008-viz-event": "#d08a6a",
    "--a008-viz-artifact": "#a78bfa",
    "--a008-viz-provenance": "#5ec8d6",
    "--a008-viz-history": "#8a8a8a",
    "--a008-viz-utterance": "#e8a05a",
    "--a008-viz-canvas-inner": "#171815",
    "--a008-viz-canvas-outer": "#0e100f",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.match(neutral, new RegExp(`${name}:\\s*${value.replace(/[()]/gu, "\\$&")}`));
  }
});

test("Relationship Map has no theme-id branches", () => {
  const source = readFileSync(join(here, "../memory/memory-graph.tsx"), "utf8");
  assert.equal(/deep-space|theme\s*===|data-a008-theme/u.test(source), false);
  assert.match(source, /var\(--a008-viz-identity\)/u);
});
