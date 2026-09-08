import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ASCII_LOGO } from "./a008-ascii.js";
import { AsciiLogo } from "./ascii-logo.js";

test("ascii logo is the owner mark and stays out of the accessibility tree", () => {
  const html = renderToStaticMarkup(createElement(AsciiLogo));
  assert.match(html, /a008-empty-logo/u);
  assert.match(html, /aria-hidden="true"/u);
  assert.match(html, /@@@@@@@@@@@/u);
  assert.equal(html.includes("What would you like"), false);
  const art = ASCII_LOGO.replace(/^\n/u, "").replace(/\n$/u, "");
  const lines = art.split("\n");
  assert.equal(lines.length, 57);
  assert.ok(lines.every((line) => line.length <= 100));
});
