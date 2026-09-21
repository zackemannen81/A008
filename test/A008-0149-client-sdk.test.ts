import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  bearerCredentials,
  cookieCredentials,
  createV2SessionClient,
  detectBrowserCredentials,
  engineCredentials,
  V2ClientError,
} from "../packages/client/src/index.js";

test("cookie, bearer and engine adapters stay out of React and V2 URLs", () => {
  const cookie = cookieCredentials();
  assert.equal(cookie.kind, "cookie");
  assert.deepEqual(cookie.headers(), {});
  assert.equal(cookie.fetchCredentials(), "same-origin");
  assert.equal(
    cookie.applySocketUrl("ws://gui.test/v2/session"),
    "ws://gui.test/v2/session",
  );

  const bearer = bearerCredentials("a008_device_secret");
  assert.equal(bearer.headers().authorization, "Bearer a008_device_secret");
  assert.equal(
    bearer.applySocketUrl("ws://gui.test/v2/session"),
    "ws://gui.test/v2/session",
  );

  const engine = engineCredentials("ab".repeat(32));
  assert.equal(engine.headers().authorization, `Bearer ${"ab".repeat(32)}`);
  assert.match(
    engine.applySocketUrl("ws://gui.test/v1/session"),
    /access=/u,
  );

  const detected = detectBrowserCredentials({ hash: `#engine=${"cd".repeat(32)}` });
  assert.equal(detected.kind, "engine");
  assert.equal(detectBrowserCredentials({ hash: "" }).kind, "cookie");
});

test("V2 client refuses to resubmit a mutation it already sent or after unknown outcome", async () => {
  const client = createV2SessionClient({
    origin: "http://127.0.0.1:9",
    projectId: "A008_v1_project_40000000-0000-4000-8000-000000000016",
    credentials: cookieCredentials(),
    fetch: async () => {
      throw new Error("fetch should not run");
    },
    webSocket: class {
      readonly url = "";
      readonly readyState = 3;
      send(): void {}
      close(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
    },
  });
  let first: unknown;
  try {
    await client.prompt("hello", "command_once");
  } catch (error) {
    first = error;
  }
  assert.ok(first instanceof V2ClientError);
  let second: unknown;
  try {
    await client.prompt("hello", "command_once");
  } catch (error) {
    second = error;
  }
  assert.ok(second instanceof V2ClientError);
  assert.equal((second as V2ClientError).code, "COMMAND_CONFLICT");
});

test("client package source stays platform-independent", () => {
  for (const name of readdirSync(resolve("packages/client/src"))) {
    if (!name.endsWith(".ts")) continue;
    const source = readFileSync(resolve("packages/client/src", name), "utf8");
    const imports = [
      ...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu),
    ].map((match) => match[1]!);
    assert.ok(
      imports.every(
        (value) => value.startsWith("./") || value === "@a008/protocol",
      ),
      `${name}: ${imports.join(", ")}`,
    );
    assert.doesNotMatch(source, /\b(?:process|window|localStorage|document)\./u);
    assert.doesNotMatch(source, /from ["']react["']/u);
  }
});
