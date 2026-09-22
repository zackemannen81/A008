import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultModelRegistry } from "../src/core/model-registry.js";
import {
  McpProbeMemory,
  McpRuntimeLedger,
  mcpHealthView,
} from "../src/gui-host/mcp-health.js";
import {
  configuredMcpServers,
  handleMcpServersPost,
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

test("MCP configuration persists enabled stdio servers and rejects unsupported transport", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-mcp-"));
  const catalogPath = join(dir, "catalog.json");
  const saved = handleMcpServersPost(catalogPath, {
    servers: [
      {
        name: "fixture",
        command: process.execPath,
        args: ["fixture.mjs"],
        env: [{ name: "MODE", value: "test" }],
        enabled: true,
      },
      {
        name: "disabled",
        command: process.execPath,
        args: [],
        env: [],
        enabled: false,
      },
    ],
  });
  assert.equal(saved.servers.length, 2);
  assert.equal(configuredMcpServers(catalogPath).length, 1);
  assert.throws(
    () =>
      handleMcpServersPost(catalogPath, {
        servers: [{ name: "remote", url: "https://example.test" }],
      }),
    /MCP server/u,
  );
});
test("MCP health reports restart only while a session holds another catalog", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-mcp-health-"));
  const catalogPath = join(dir, "catalog.json");
  const server = {
    name: "fixture",
    command: "node",
    args: ["a"],
    env: [] as { name: string; value: string }[],
    enabled: true,
  };
  handleMcpServersPost(catalogPath, { servers: [server] });
  const ledger = new McpRuntimeLedger();
  const probes = new McpProbeMemory();
  const view = () => mcpHealthView({ catalogPath, ledger, probes });
  assert.equal(view().restartRequired, false);
  assert.equal(view().servers[0]?.status, "untested");
  ledger.note("s1", [{ ...server, args: ["a"] }]);
  assert.equal(view().restartRequired, false);
  handleMcpServersPost(catalogPath, {
    servers: [{ ...server, args: ["b"] }],
  });
  const drifted = view();
  assert.equal(drifted.restartRequired, true);
  assert.equal(drifted.servers[0]?.status, "restart_required");
  assert.deepEqual(drifted.servers[0]?.lines, [
    "configuration saved",
    "active chat still uses previous MCP catalog",
  ]);
  probes.remember(
    { name: "fixture", command: "node", args: ["b"], env: [] },
    {
      status: "failed",
      stage: "handshake",
      testedAt: "2026-09-22T00:00:00.000Z",
      lines: ["process started", "MCP handshake failed"],
    },
  );
  assert.equal(view().servers[0]?.status, "failed");
  ledger.release("s1");
  assert.equal(view().restartRequired, false);
  assert.equal(view().servers[0]?.status, "failed");
});

test("merged models include user-catalog additions with unverified controls", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-cat-"));
  const catalogPath = join(dir, "catalog.json");
  handleNvidiaCatalogAdd(catalogPath, {
    id: "nvidia/preview-example",
    name: "Preview",
  });
  handleNvidiaCatalogAdd(catalogPath, {
    id: "nvidia/preview-example",
    name: "Preview",
  });
  const models = mergedModels(defaultModelRegistry, catalogPath);
  assert.equal(
    models.filter((model) => model.id === "nvidia/preview-example").length,
    1,
  );
  const added = models.find((model) => model.id === "nvidia/preview-example");
  assert.equal(added?.name, "Preview");
  assert.equal(added?.added, true);
  assert.equal(added?.capabilities.verifiedOn, "unverified");
  assert.ok(
    models.some(
      (model) =>
        model.id === "nvidia/nemotron-3.5-lightning-30b-a3b" && !model.added,
    ),
  );
});

test("catalog browse marks already-added models and never returns the API key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-cat-"));
  const catalogPath = join(dir, "catalog.json");
  const listed = await handleNvidiaCatalogGet({
    apiKey: "nvapi-test",
    fetch: async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "nvidia/nemotron-3.5-lightning-30b-a3b", owned_by: "nvidia" },
          ],
        }),
      ),
    registry: defaultModelRegistry,
    catalogPath,
  });
  const body = JSON.stringify(listed);
  assert.equal(body.includes("nvapi-test"), false);
  assert.match(body, /Free Endpoint/u);
  assert.equal(listed.models[0]?.added, true);
});

test("image generate stores a blob and returns a locator, not the credential", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-img-"));
  const catalogPath = join(dir, "catalog.json");
  writeFileSync(
    catalogPath,
    JSON.stringify({
      version: 1,
      chatModels: [],
      image: { model: "x", endpoint: "https://example.test/img" },
    }),
  );
  const result = await handleImageGenerate({
    apiKey: "nvapi-test",
    kieApiKey: undefined,
    fetch: async () =>
      new Response(
        JSON.stringify({ artifacts: [{ base64: PNG.toString("base64") }] }),
      ),
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
  assert.equal(view.openAiApiKeyConfigured, false);
  assert.equal("nvidiaApiKey" in view, false);
  assert.equal("kieApiKey" in view, false);
  assert.equal("openAiApiKey" in view, false);
});

test("kie catalog is curated and needs no API key", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-kie-cat-"));
  const listed = handleKieCatalogGet(join(dir, "catalog.json"));
  const body = JSON.stringify(listed);
  assert.match(body, /docs\.kie\.ai/u);
  assert.ok(
    listed.models.some(
      (model) => model.id === "gemini-3-flash" && model.kind === "chat",
    ),
  );
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

test("saving an OpenAI key is write-only and can select OpenAI chat", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-openai-sec-"));
  const view = handleProviderSettingsPost({
    catalogPath: join(dir, "catalog.json"),
    secretsPath: join(dir, "secrets.json"),
    env: {},
    body: { openAiApiKey: "sk-openai-secret-value", chatProvider: "openai" },
  });
  assert.equal(view.openAiApiKeyConfigured, true);
  assert.equal(view.chatProvider, "openai");
  assert.equal(view.openAiKeySource, "secrets-file");
  assert.equal(JSON.stringify(view).includes("sk-openai-secret-value"), false);
});

test("kie image generate stores a blob and never returns the credential", async () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-kie-img-"));
  const catalogPath = join(dir, "catalog.json");
  writeFileSync(
    catalogPath,
    JSON.stringify({
      version: 1,
      imageProvider: "kie",
      kie: { imageModel: "flux-2/flex-text-to-image" },
    }),
  );
  const result = await handleImageGenerate({
    apiKey: undefined,
    kieApiKey: "kie-secret",
    fetch: async (input) => {
      const url = String(input);
      if (url.includes("createTask")) {
        return new Response(
          JSON.stringify({ code: 200, data: { taskId: "task_gui" } }),
        );
      }
      if (url.includes("recordInfo")) {
        return new Response(
          JSON.stringify({
            data: {
              state: "success",
              resultJson: JSON.stringify({
                resultUrls: ["https://example.test/k.png"],
              }),
            },
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


test("compatible provider keys are write-only and preserve source metadata", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-compatible-sec-"));
  const catalogPath = join(dir, "catalog.json");
  const secretsPath = join(dir, "secrets.json");
  const view = handleProviderSettingsPost({
    catalogPath,
    secretsPath,
    env: { GROQ_API_KEY: "groq-env-secret" },
    body: {
      openRouterApiKey: "openrouter-secret-value",
      geminiApiKey: "gemini-secret-value",
      openCodeApiKey: "opencode-secret-value",
    },
  });
  assert.equal(view.openRouterApiKeyConfigured, true);
  assert.equal(view.openRouterKeySource, "secrets-file");
  assert.equal(view.groqApiKeyConfigured, true);
  assert.equal(view.groqKeySource, "environment");
  assert.equal(view.geminiApiKeyConfigured, true);
  assert.equal(view.geminiKeySource, "secrets-file");
  assert.equal(view.openCodeApiKeyConfigured, true);
  assert.equal(view.openCodeKeySource, "secrets-file");
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes("openrouter-secret-value"), false);
  assert.equal(serialized.includes("groq-env-secret"), false);
  assert.equal(serialized.includes("gemini-secret-value"), false);
  assert.equal(serialized.includes("opencode-secret-value"), false);
});


test("legacy catalog add route refuses compatible-provider injection", () => {
  const dir = mkdtempSync(join(tmpdir(), "a008-legacy-cat-"));
  assert.throws(
    () =>
      handleNvidiaCatalogAdd(join(dir, "catalog.json"), {
        id: "openrouter/not-allowed-here",
        name: "Wrong Route",
        provider: "openrouter",
      }),
    /ZeroCostRadar import route/u,
  );
});
