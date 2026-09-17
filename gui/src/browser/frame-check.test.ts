import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFrame } from "./frame-check.js";

test("checkFrame maps a host refusal and never treats a failed probe as a block", async () => {
  const blocked = await checkFrame("https://chatgpt.com/", async (input) => {
    assert.match(String(input), /\/v1\/browser\/frame-check\?url=/u);
    return new Response(
      JSON.stringify({
        url: "https://chatgpt.com/",
        embeddable: false,
        reason: "frame-ancestors",
      }),
    );
  });
  assert.equal(blocked.embeddable, false);
  assert.equal(blocked.reason, "frame-ancestors");

  const unknown = await checkFrame(
    "https://example.test/",
    async () => new Response("nope", { status: 500 }),
  );
  assert.equal(unknown.embeddable, true);
});
