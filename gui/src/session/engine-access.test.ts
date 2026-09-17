import assert from "node:assert/strict";
import test from "node:test";
import { executeShellCommand } from "../terminal/run-shell-command.js";
import { uploadSource } from "../upload/upload-source.js";
import {
  fetchWithAuthRecovery,
  type AuthRecoveryLocation,
} from "./engine-access.js";

const AUTH_BODY = {
  error: "Authentication required.",
  message: "Authentication required.",
};

test("authenticated shell and upload keep PIN recovery from reloading a valid session", async () => {
  let redirects = 0;
  let authenticated = true;
  const browserFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input), location().href);
    const cookieSent =
      init?.credentials === "same-origin" && url.origin === location().origin;
    if (!authenticated || !cookieSent) return jsonResponse(AUTH_BODY);
    return jsonResponse(
      url.pathname === "/v1/shell"
        ? {
            stdout: "## main\n",
            stderr: "",
            exitCode: 0,
            timedOut: false,
            truncated: false,
          }
        : {
            locator: "source:test/test.txt",
            sha256: "test",
            bytes: 4,
            mediaType: "text/plain",
            extracted: true,
          },
      200,
    );
  };
  const recoveringFetch: typeof fetch = (input, init) =>
    fetchWithAuthRecovery(input, init, browserFetch, location(), () => {
      redirects += 1;
    });
  const source = {
    name: "test.txt",
    async arrayBuffer() {
      return new TextEncoder().encode("test").buffer;
    },
  };
  await executeShellCommand("git status -sb", { fetch: recoveringFetch });
  await uploadSource(source, { fetch: recoveringFetch });
  assert.equal(redirects, 0, "valid PIN session remains on the connected page");

  authenticated = false;
  await assert.rejects(
    () => executeShellCommand("git status -sb", { fetch: recoveringFetch }),
    /401/,
  );
  await assert.rejects(
    () => uploadSource(source, { fetch: recoveringFetch }),
    /401/,
  );
  assert.equal(redirects, 2, "actual auth expiry still enters recovery");
});

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
    () => {
      redirects += 1;
    },
  );
  assert.equal(redirects, 1);
  assert.deepEqual(await response.json(), AUTH_BODY);
});

test("unrelated and cross-origin 401 responses stay caller-visible", async () => {
  let redirects = 0;
  const unrelated = await fetchWithAuthRecovery(
    "/v1/models",
    undefined,
    async () =>
      jsonResponse({
        error: "Provider unauthorized.",
        message: "Provider unauthorized.",
      }),
    location(),
    () => {
      redirects += 1;
    },
  );
  assert.equal(unrelated.status, 401);

  const crossOrigin = await fetchWithAuthRecovery(
    "https://other.example/v1/models",
    undefined,
    async () => jsonResponse(AUTH_BODY),
    location(),
    () => {
      redirects += 1;
    },
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
    () => {
      redirects += 1;
    },
  );
  assert.equal(response.status, 401);
  assert.equal(redirects, 0);
});
