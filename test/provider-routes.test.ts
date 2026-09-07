import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultModelRegistry } from "../src/core/model-registry.js";
import {
  handleImageGenerate,
  handleNvidiaCatalogAdd,
  handleNvidiaCatalogGet,
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
  assert.equal("nvidiaApiKey" in view, false);
});
