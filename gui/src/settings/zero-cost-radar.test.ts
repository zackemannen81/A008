import assert from "node:assert/strict";
import test from "node:test";
import { loadZeroCostCatalog } from "./zero-cost-radar.js";

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
