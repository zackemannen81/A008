import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  DEFAULT_MODEL_ID,
  ModelRegistry,
  defaultModelRegistry,
} from "../src/core/model-registry.js";
import type { ModelProfile } from "../src/core/types.js";

test("default registry exposes the verified NVIDIA profile", () => {
  const profiles = defaultModelRegistry.list();
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0]?.id, DEFAULT_MODEL_ID);
  assert.equal(profiles[0]?.defaults.stream, true);
  assert.equal(profiles[0]?.defaults.reasoningBudget, 16_384);
});

test("registry rejects duplicate model identifiers", () => {
  const profile: ModelProfile = {
    id: "provider/model",
    name: "Model",
    provider: "provider",
    defaults: {},
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
