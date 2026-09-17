import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchNvidiaCatalog,
  parseNvidiaModelsPayload,
} from "../src/providers/nvidia/nvidia-catalog.js";

test("catalog parser keeps only named model ids", () => {
  const entries = parseNvidiaModelsPayload({
    data: [
      { id: "nvidia/nemotron-3.5-lightning-30b-a3b", owned_by: "nvidia" },
      { id: "  " },
      { owned_by: "nvidia" },
      { id: "black-forest-labs/flux.1-schnell" },
    ],
  });
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [
      "nvidia/nemotron-3.5-lightning-30b-a3b",
      "black-forest-labs/flux.1-schnell",
    ],
  );
});

test("catalog fetch uses the bearer key and refuses an empty key before network", async () => {
  const entries = await fetchNvidiaCatalog("nvapi-test", {
    fetch: async (input, init) => {
      assert.match(String(input), /\/models$/u);
      assert.match(
        String((init?.headers as Record<string, string>).authorization),
        /Bearer nvapi-test/u,
      );
      return new Response(
        JSON.stringify({
          data: [{ id: "meta/muse-glimmer-30b", owned_by: "meta" }],
        }),
      );
    },
  });
  assert.equal(entries[0]?.id, "meta/muse-glimmer-30b");
  await assert.rejects(() => fetchNvidiaCatalog("  "), /NVIDIA_API_KEY/u);
});
