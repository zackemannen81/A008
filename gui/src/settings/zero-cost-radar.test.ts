import assert from "node:assert/strict";
import test from "node:test";
import {
  addZeroCostModel,
  loadZeroCostCatalog,
  refreshZeroCostCatalog,
  zeroCostImportBlockReason,
} from "./zero-cost-radar.js";

test("Zero Cost Radar accepts the typed read-only catalog", async () => {
  const result = await loadZeroCostCatalog(
    undefined,
    async () =>
      new Response(
        JSON.stringify({
          verifiedAt: "2026-09-19",
          routes: [
            {
              key: "fixture:model",
              provider: "nvidia",
              modelId: "fixture/model",
              name: "Fixture Model",
              baseUrl: "https://example.test/v1",
              apiStyle: "openai-chat-completions",
              access: "free-endpoint",
              lifecycle: "trial",
              inputModalities: ["text"],
              capabilities: ["reasoning"],
              dataPolicy: "review-before-sensitive-use",
              a008ProfileId: "fixture/model",
              verifiedAt: "2026-09-19",
              sourceUrls: ["https://example.test/source"],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0]?.a008ProfileId, "fixture/model");
});

test("Zero Cost Radar rejects incompatible metadata", async () => {
  await assert.rejects(
    () =>
      loadZeroCostCatalog(
        undefined,
        async () =>
          new Response(
            JSON.stringify({
              verifiedAt: "2026-09-19",
              routes: [{ provider: "wat" }],
            }),
            { status: 200 },
          ),
      ),
    /incompatible/u,
  );
});


test("Zero Cost Radar update check uses the explicit host refresh operation", async () => {
  let method = "";
  const result = await refreshZeroCostCatalog(
    undefined,
    async (_input, init) => {
      method = init?.method ?? "GET";
      return new Response(
        JSON.stringify({
          verifiedAt: "2026-09-21",
          routes: [
            {
              key: "nvidia:new-free",
              provider: "nvidia",
              modelId: "nvidia/new-free",
              name: "New Free",
              baseUrl: "https://integrate.api.nvidia.com/v1",
              apiStyle: "openai-chat-completions",
              access: "free-endpoint",
              lifecycle: "trial",
              dataPolicy: "review-before-sensitive-use",
              verifiedAt: "2026-09-21",
              sourceUrls: ["https://example.test/source"],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  assert.equal(method, "POST");
  assert.equal(result.verifiedAt, "2026-09-21");
});

test("Zero Cost Radar import is enabled only for the current NVIDIA chat path", async () => {
  const nvidia = {
    key: "nvidia:new-free",
    provider: "nvidia" as const,
    modelId: "nvidia/new-free",
    name: "New Free",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions" as const,
    access: "free-endpoint" as const,
    lifecycle: "trial" as const,
    dataPolicy: "review-before-sensitive-use" as const,
    verifiedAt: "2026-09-21",
    sourceUrls: ["https://example.test/source"],
  };
  const unsupported = { ...nvidia, key: "openrouter:new", provider: "openrouter" as const };
  assert.equal(zeroCostImportBlockReason(nvidia), undefined);
  assert.match(zeroCostImportBlockReason(unsupported) ?? "", /not wired/u);

  let body = "";
  await addZeroCostModel(nvidia, async (_input, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ added: { id: nvidia.modelId } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.deepEqual(JSON.parse(body), {
    id: "nvidia/new-free",
    provider: "nvidia",
    name: "New Free",
  });
});
