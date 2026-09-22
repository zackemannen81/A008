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

test("Zero Cost Radar import follows executable provider and API-style routes", async () => {
  const base = {
    modelId: "fixture/free",
    name: "Fixture Free",
    apiStyle: "openai-chat-completions" as const,
    access: "free-endpoint" as const,
    lifecycle: "trial" as const,
    dataPolicy: "review-before-sensitive-use" as const,
    verifiedAt: "2026-09-21",
    sourceUrls: ["https://example.test/source"],
  };
  const routes = [
    {
      ...base,
      key: "nvidia:free",
      provider: "nvidia" as const,
      baseUrl: "https://integrate.api.nvidia.com/v1",
    },
    {
      ...base,
      key: "openrouter:free",
      provider: "openrouter" as const,
      baseUrl: "https://openrouter.ai/api/v1",
    },
    {
      ...base,
      key: "groq:free",
      provider: "groq" as const,
      baseUrl: "https://api.groq.com/openai/v1",
    },
    {
      ...base,
      key: "google:free",
      provider: "google" as const,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    {
      ...base,
      key: "opencode:free",
      provider: "opencode" as const,
      baseUrl: "https://opencode.ai/zen/v1",
    },
  ];
  for (const route of routes) {
    assert.equal(zeroCostImportBlockReason(route), undefined);
  }
  assert.match(
    zeroCostImportBlockReason({
      ...routes[1]!,
      baseUrl: "https://example.test/v1",
    }) ?? "",
    /validated provider endpoint/u,
  );
  assert.match(
    zeroCostImportBlockReason({
      ...routes[1]!,
      apiStyle: "openai-responses",
    }) ?? "",
    /not wired/u,
  );

  let body = "";
  await addZeroCostModel(routes[1]!, async (_input, init) => {
    body = String(init?.body ?? "");
    return new Response(
      JSON.stringify({ added: { id: routes[1]!.modelId } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  });
  assert.deepEqual(JSON.parse(body), { key: "openrouter:free" });
});
