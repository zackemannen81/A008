import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  addUserChatModel,
  loadUserCatalog,
  parseUserCatalog,
  saveUserCatalog,
  userModelProfile,
} from "../src/core/user-catalog.js";
import {
  loadProviderSecrets,
  saveProviderSecrets,
} from "../src/core/provider-secrets.js";

test("user catalog round-trips added chat models and image settings", () => {
  const catalog = parseUserCatalog({
    version: 1,
    chatModels: [
      {
        id: "nvidia/example-preview",
        name: "Example preview",
        provider: "nvidia",
        inputModalities: ["text"],
      },
    ],
    image: {
      model: "black-forest-labs/flux.1-schnell",
      endpoint: "https://example.test/image",
    },
  });
  const profile = userModelProfile(catalog.chatModels[0]!);
  assert.equal(profile.id, "nvidia/example-preview");
  assert.equal(profile.defaults.maxTokens, 16384);
  const dir = mkdtempSync(join(tmpdir(), "a008-catalog-"));
  const path = join(dir, "catalog.json");
  saveUserCatalog(path, addUserChatModel(catalog, {
    id: "nvidia/other",
    name: "Other",
    provider: "nvidia",
    inputModalities: ["text"],
  }));
  const loaded = loadUserCatalog(path);
  assert.equal(loaded.chatModels.length, 2);
  assert.equal(loaded.image.endpoint, "https://example.test/image");
});

test("secrets file stores a key and loads it without exposing it in thrown parse errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-secrets-"));
  const path = join(dir, "secrets.json");
  saveProviderSecrets(path, { nvidiaApiKey: "nvapi-stored-key" });
  assert.equal(loadProviderSecrets(path).nvidiaApiKey, "nvapi-stored-key");
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /nvapi-stored-key/u);
});
