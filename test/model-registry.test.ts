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
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
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

test("the model id is matched exactly", () => {
  // The vendor's model card names a different id than its API sample —
  // `...-NVFP4` versus the lower-case path form. A008 ships the one the
  // endpoint accepts, and a near miss must fail loudly rather than resolve.
  for (const near of [
    "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning-nvfp4",
    "moonshotai/kimi-k2",
  ]) {
    assert.throws(
      () => defaultModelRegistry.require(near),
      (error: unknown) => error instanceof ChatError && error.code === "unknown_model",
      near,
    );
  }
});

test("every image-capable model is reachable and every text model is honest", () => {
  const withImage = defaultModelRegistry
    .list()
    .filter((profile) => acceptsModality(profile, "image"))
    .map((profile) => profile.id);

  assert.deepEqual(withImage.sort(), [
    "moonshotai/kimi-k3",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  ]);

  // Only the omni model claims video and audio.
  assert.deepEqual(
    defaultModelRegistry
      .list()
      .filter((profile) => acceptsModality(profile, "audio"))
      .map((profile) => profile.id),
    ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  );
});

test("a reasoning budget is declared only where the vendor documents one", () => {
  for (const profile of defaultModelRegistry.list()) {
    if (profile.defaults.reasoningBudget === undefined) {
      continue;
    }
    assert.equal(
      profile.defaults.enableThinking,
      true,
      `${profile.id} declares a reasoning budget without thinking enabled`,
    );
  }
});
