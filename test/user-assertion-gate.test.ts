import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUserAssertionActivation,
  isExplicitUserAssertion,
} from "../src/runtime/user-assertion-gate.js";

const PROPOSITION = "the local memory project code is alpha-seven";

test("only contiguous user assertions that are not questions activate", () => {
  assert.equal(
    isExplicitUserAssertion(`Durable fact: ${PROPOSITION}.`, PROPOSITION),
    true,
  );
  assert.equal(
    isExplicitUserAssertion(`What is ${PROPOSITION}?`, PROPOSITION),
    false,
  );
  assert.equal(
    isExplicitUserAssertion("The assistant invented this fact.", PROPOSITION),
    false,
  );
  assert.equal(isExplicitUserAssertion("short", "tiny"), false);
});

test("analyzer confidence does not grant activation", () => {
  const activated = applyUserAssertionActivation(
    `Durable fact: ${PROPOSITION}.`,
    {
      proposition: PROPOSITION,
      kind: "fact",
      scope: ["local"],
      confidence: 0.1,
      authority: 0.25,
    },
  );
  const dormant = applyUserAssertionActivation("What did the assistant say?", {
    proposition: PROPOSITION,
    kind: "fact",
    scope: ["local"],
    confidence: 0.99,
    authority: 0.25,
  });

  assert.equal(activated.keepAlive, true);
  assert.equal(activated.sourceBacked, true);
  assert.equal(activated.authority, 0.8);
  assert.equal(dormant.keepAlive, undefined);
  assert.equal(dormant.sourceBacked, undefined);
  assert.equal(dormant.authority, 0.25);
});
