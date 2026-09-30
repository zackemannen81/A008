import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedHostUrl, preventUntrustedNavigation } from "./renderer-security.ts";

test("renderer accepts only the configured origin and denies other navigation targets", () => {
  const origin = "http://127.0.0.1:8787";
  assert.equal(isAllowedHostUrl(origin, `${origin}/settings`), true);
  assert.equal(isAllowedHostUrl(origin, "https://example.org/"), false);
  assert.equal(isAllowedHostUrl(origin, "file:///C:/secret"), false);
  let blocked = 0;
  preventUntrustedNavigation(origin, "https://example.org/", { preventDefault: () => blocked++ });
  assert.equal(blocked, 1);
});