import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchWithAuthRecovery,
  type AuthRecoveryLocation,
} from "./engine-access.js";

const AUTH_BODY = {
  error: "Authentication required.",
  message: "Authentication required.",
};

function location(hash = ""): AuthRecoveryLocation {
  return {
    href: `https://a008.example/${hash}`,
    origin: "https://a008.example",
    hash,
    replace() {},
  };
}

function jsonResponse(body: unknown, status = 401): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("PIN auth 401 redirects through the existing gate without consuming the response", async () => {
  let redirects = 0;
  const response = await fetchWithAuthRecovery(
    "/v1/models",
    undefined,
    async () => jsonResponse(AUTH_BODY),
    location(),
    () => { redirects += 1; },
  );
  assert.equal(redirects, 1);
  assert.deepEqual(await response.json(), AUTH_BODY);
});

test("unrelated and cross-origin 401 responses stay caller-visible", async () => {
  let redirects = 0;
  const unrelated = await fetchWithAuthRecovery(
    "/v1/models",
    undefined,
    async () => jsonResponse({ error: "Provider unauthorized.", message: "Provider unauthorized." }),
    location(),
    () => { redirects += 1; },
  );
  assert.equal(unrelated.status, 401);

  const crossOrigin = await fetchWithAuthRecovery(
    "https://other.example/v1/models",
    undefined,
    async () => jsonResponse(AUTH_BODY),
    location(),
    () => { redirects += 1; },
  );
  assert.equal(crossOrigin.status, 401);
  assert.equal(redirects, 0);
});

test("native engine capability suppresses PIN-session recovery", async () => {
  let redirects = 0;
  const engineHash = `#engine=${"a".repeat(64)}`;
  const response = await fetchWithAuthRecovery(
    "/v1/models",
    undefined,
    async () => jsonResponse(AUTH_BODY),
    location(engineHash),
    () => { redirects += 1; },
  );
  assert.equal(response.status, 401);
  assert.equal(redirects, 0);
});
