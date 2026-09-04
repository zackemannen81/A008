import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  DEFAULT_MODEL_ID,
  acceptsModality,
  defaultModelRegistry,
  ModelRegistry,
} from "../src/core/model-registry.js";
import type { ModelProfile } from "../src/core/types.js";

test("default registry exposes the verified NVIDIA profile", () => {
  // The registry holds more than one model now, so the assertion is about the
  // default profile rather than about the list having one entry.
  const profile = defaultModelRegistry.require(DEFAULT_MODEL_ID);
  assert.equal(profile.defaults.stream, true);
  assert.equal(profile.defaults.reasoningBudget, 16_384);
  assert.ok(defaultModelRegistry.list().length >= 1);
});

test("registry rejects duplicate model identifiers", () => {
  const profile: ModelProfile = {
    id: "provider/model",
    name: "Model",
    provider: "provider",
    defaults: {},
    inputModalities: ["text"],
  };

  assert.throws(
    () => new ModelRegistry([profile, profile]),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

test("registry reports unknown models with a typed error", () => {
  assert.throws(
    () => defaultModelRegistry.require("missing/model"),
    (error: unknown) =>
      error instanceof ChatError && error.code === "unknown_model",
  );
});

test("every shipped profile declares its modalities and when it was verified", () => {
  for (const profile of defaultModelRegistry.list()) {
    assert.ok(
      profile.inputModalities.length > 0,
      `${profile.id} must declare at least text`,
    );
    assert.ok(
      profile.inputModalities.includes("text"),
      `${profile.id} must accept text`,
    );
    // A profile without a verification date is a guess, and a guess in this
    // registry becomes a provider error at the worst moment.
    assert.match(
      profile.verifiedOn ?? "",
      /^\d{4}-\d{2}-\d{2}$/u,
      `${profile.id} must record when its numbers were checked`,
    );
  }
});

test("the omni profile is selectable and declares image input", () => {
  const omni = defaultModelRegistry.require(
    "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  );

  assert.equal(acceptsModality(omni, "image"), true);
  assert.equal(acceptsModality(omni, "video"), true);
  assert.equal(acceptsModality(omni, "audio"), true);
  // The text-only default model is the contrast that makes the field useful.
  assert.equal(
    acceptsModality(defaultModelRegistry.require(DEFAULT_MODEL_ID), "image"),
    false,
  );
});

test("the model id is matched exactly, case included", () => {
  // The vendor publishes NVFP4, BF16 and FP8 as separate ids, and the omni id
  // is capitalised where the lightning id is not. A lookup that quietly
  // lower-cased would resolve one model to another.
  assert.throws(
    () =>
      defaultModelRegistry.require(
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning-nvfp4",
      ),
    (error: unknown) => error instanceof ChatError && error.code === "unknown_model",
  );
});
