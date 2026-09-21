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
  assert.equal(profile.executionProvider, "nvidia");
  assert.equal(profile.defaults.maxTokens, 16384);
  assert.equal(Object.hasOwn(profile.defaults, "enableThinking"), false);
  const dir = mkdtempSync(join(tmpdir(), "a008-catalog-"));
  const path = join(dir, "catalog.json");
  saveUserCatalog(
    path,
    addUserChatModel(catalog, {
      id: "nvidia/other",
      name: "Other",
      provider: "nvidia",
      inputModalities: ["text"],
    }),
  );
  const loaded = loadUserCatalog(path);
  assert.equal(loaded.chatModels.length, 2);
  assert.equal(loaded.image.endpoint, "https://example.test/image");
  assert.equal(catalog.chatProvider, "nvidia");
  assert.equal(catalog.imageProvider, "nvidia");
  assert.equal(catalog.kie.chatModel, "gemini-3-flash");
  assert.deepEqual(catalog.mcpServers, []);
});

test("user catalog persists validated stdio MCP servers and rejects unsupported shapes", () => {
  const catalog = parseUserCatalog({
    version: 1,
    mcpServers: [
      {
        name: "fixture",
        command: process.execPath,
        args: ["server.mjs"],
        env: [{ name: "FIXTURE_MODE", value: "test" }],
        enabled: false,
      },
    ],
  });
  assert.equal(catalog.mcpServers[0]?.enabled, false);
  assert.throws(
    () =>
      parseUserCatalog({
        version: 1,
        mcpServers: [{ name: "remote", url: "https://example.test" }],
      }),
    /MCP server/u,
  );
  assert.throws(
    () =>
      parseUserCatalog({
        version: 1,
        mcpServers: [
          { name: "same", command: "a", args: [], env: [] },
          { name: "same", command: "b", args: [], env: [] },
        ],
      }),
    /unique/u,
  );
});

test("secrets file stores a key and loads it without exposing it in thrown parse errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-secrets-"));
  const path = join(dir, "secrets.json");
  saveProviderSecrets(path, {
    nvidiaApiKey: "nvapi-stored-key",
    kieApiKey: undefined,
    openAiApiKey: undefined,
  });
  assert.equal(loadProviderSecrets(path).nvidiaApiKey, "nvapi-stored-key");
  assert.equal(loadProviderSecrets(path).kieApiKey, undefined);
  saveProviderSecrets(path, {
    nvidiaApiKey: "nvapi-stored-key",
    kieApiKey: "kie-stored-key",
    openAiApiKey: "sk-stored-key",
  });
  assert.equal(loadProviderSecrets(path).kieApiKey, "kie-stored-key");
  assert.equal(loadProviderSecrets(path).openAiApiKey, "sk-stored-key");
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /nvapi-stored-key/u);
  assert.match(raw, /kie-stored-key/u);
  assert.match(raw, /sk-stored-key/u);
});

test("user catalog accepts OpenAI for chat without widening image providers", () => {
  const catalog = parseUserCatalog({
    version: 1,
    chatProvider: "openai",
    imageProvider: "openai",
  });
  assert.equal(catalog.chatProvider, "openai");
  assert.equal(catalog.imageProvider, "nvidia");
});


test("compatible user models persist exact route metadata and reject route substitution", () => {
  const catalog = parseUserCatalog({
    version: 1,
    chatModels: [
      {
        id: "openrouter/free-model",
        name: "OpenRouter Free",
        provider: "openrouter",
        inputModalities: ["text"],
        baseUrl: "https://openrouter.ai/api/v1/",
        apiStyle: "openai-chat-completions",
      },
    ],
  });
  assert.deepEqual(catalog.chatModels[0], {
    id: "openrouter/free-model",
    name: "OpenRouter Free",
    provider: "openrouter",
    inputModalities: ["text"],
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
  });
  assert.equal(userModelProfile(catalog.chatModels[0]!).executionProvider, "openrouter");

  const dir = mkdtempSync(join(tmpdir(), "a008-compatible-catalog-"));
  const path = join(dir, "catalog.json");
  saveUserCatalog(path, catalog);
  assert.deepEqual(loadUserCatalog(path).chatModels, catalog.chatModels);

  assert.throws(
    () =>
      parseUserCatalog({
        version: 1,
        chatModels: [
          {
            id: "openrouter/wrong-endpoint",
            name: "Wrong Endpoint",
            provider: "openrouter",
            inputModalities: ["text"],
            baseUrl: "https://example.test/v1",
            apiStyle: "openai-chat-completions",
          },
        ],
      }),
    /Unsupported openrouter base URL/u,
  );
  assert.throws(
    () =>
      parseUserCatalog({
        version: 1,
        chatModels: [
          {
            id: "openrouter/responses-only",
            name: "Responses Only",
            provider: "openrouter",
            inputModalities: ["text"],
            baseUrl: "https://openrouter.ai/api/v1",
            apiStyle: "openai-responses",
          },
        ],
      }),
    /unsupported API style/u,
  );
  assert.throws(
    () =>
      parseUserCatalog({
        version: 1,
        chatModels: [
          {
            id: "mystery/model",
            name: "Mystery",
            provider: "mystery",
            inputModalities: ["text"],
          },
        ],
      }),
    /Unsupported catalog execution provider/u,
  );
});
