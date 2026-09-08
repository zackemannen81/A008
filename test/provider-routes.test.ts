import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultModelRegistry } from "../src/core/model-registry.js";
import {
  handleImageGenerate,
  handleKieCatalogGet,
  handleNvidiaCatalogAdd,
  handleNvidiaCatalogGet,
  handleProviderSettingsPost,
  mergedModels,
  providerSettingsView,
} from "../src/gui-host/provider-routes.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("merged models include user-catalog additions with unverified controls", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-cat-"));
  const catalogPath = join(dir, "catalog.json");
  handleNvidiaCatalogAdd(catalogPath, { id: "nvidia/preview-example", name: "Preview" });
  const models = mergedModels(defaultModelRegistry, catalogPath);
  const added = models.find((model) => model.id === "nvidia/preview-example");
  assert.equal(added?.name, "Preview");
  assert.equal(added?.added, true);
  assert.equal(added?.capabilities.verifiedOn, "unverified");
  assert.ok(models.some((model) => model.id === "nvidia/nemotron-3.5-lightning-30b-a3b" && !model.added));
});

test("catalog browse marks already-added models and never returns the API key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-cat-"));
  const catalogPath = join(dir, "catalog.json");
  const listed = await handleNvidiaCatalogGet({
    apiKey: "nvapi-test",
    fetch: async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "nvidia/nemotron-3.5-lightning-30b-a3b", owned_by: "nvidia" }],
        }),
      ),
    registry: defaultModelRegistry,
    catalogPath,
  });
  const body = JSON.stringify(listed);
  assert.equal(body.includes("nvapi-test"), false);
  assert.match(body, /Free Endpoint/u);
  assert.equal(
    (listed as { models: { id: string; added: boolean }[] }).models[0]?.added,
    true,
  );
});

test("image generate stores a blob and returns a locator, not the credential", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-img-"));
  const catalogPath = join(dir, "catalog.json");
  writeFileSync(catalogPath, JSON.stringify({ version: 1, chatModels: [], image: { model: "x", endpoint: "https://example.test/img" } }));
  const result = await handleImageGenerate({
    apiKey: "nvapi-test",
    kieApiKey: undefined,
    fetch: async () =>
      new Response(JSON.stringify({ artifacts: [{ base64: PNG.toString("base64") }] })),
    catalogPath,
    storeRoot: join(dir, "store"),
    body: { prompt: "a coffee shop interior" },
  });
  assert.match(result.locator, /^source:[a-f0-9]{64}\/generated\.png$/u);
  assert.equal(result.mediaType, "image/png");
  assert.equal(JSON.stringify(result).includes("nvapi-test"), false);
});

test("provider settings report configured without echoing a key", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-sec-"));
  const view = providerSettingsView(
    join(dir, "catalog.json"),
    join(dir, "secrets.json"),
    { NVIDIA_API_KEY: "nvapi-env" },
  );
  assert.equal(view.nvidiaApiKeyConfigured, true);
  assert.equal(view.keySource, "environment");
  assert.equal(view.kieApiKeyConfigured, false);
  assert.equal("nvidiaApiKey" in view, false);
  assert.equal("kieApiKey" in view, false);
});

test("kie catalog is curated and needs no API key", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-kie-cat-"));
  const listed = handleKieCatalogGet(join(dir, "catalog.json"));
  const body = JSON.stringify(listed);
  assert.match(body, /docs\.kie\.ai/u);
  assert.ok(listed.models.some((model) => model.id === "gemini-3-flash" && model.kind === "chat"));
  assert.ok(listed.models.some((model) => model.kind === "video"));
});

test("saving a kie key does not echo it back", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-kie-sec-"));
  const view = handleProviderSettingsPost({
    catalogPath: join(dir, "catalog.json"),
    secretsPath: join(dir, "secrets.json"),
    env: {},
    body: { kieApiKey: "kie-secret-value", chatProvider: "kie" },
  });
  assert.equal(view.kieApiKeyConfigured, true);
  assert.equal(view.chatProvider, "kie");
  assert.equal(JSON.stringify(view).includes("kie-secret-value"), false);
});

test("kie image generate stores a blob and never returns the credential", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-kie-img-"));
  const catalogPath = join(dir, "catalog.json");
  writeFileSync(
    catalogPath,
    JSON.stringify({ version: 1, imageProvider: "kie", kie: { imageModel: "flux-2/flex-text-to-image" } }),
  );
  const result = await handleImageGenerate({
    apiKey: undefined,
    kieApiKey: "kie-secret",
    fetch: async (input) => {
      const url = String(input);
      if (url.includes("createTask")) {
        return new Response(JSON.stringify({ code: 200, data: { taskId: "task_gui" } }));
      }
      if (url.includes("recordInfo")) {
        return new Response(
          JSON.stringify({
            data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/k.png"] }) },
          }),
        );
      }
      if (url === "https://example.test/k.png") {
        return new Response(PNG);
      }
      throw new Error(url);
    },
    catalogPath,
    storeRoot: join(dir, "store"),
    body: { prompt: "a coffee shop interior" },
  });
  assert.match(result.locator, /^source:[a-f0-9]{64}\/generated\.png$/u);
  assert.equal(JSON.stringify(result).includes("kie-secret"), false);
});
