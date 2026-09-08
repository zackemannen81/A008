import assert from "node:assert/strict";
import test from "node:test";
import {
  KieJobTransport,
  parseKieCreateTask,
  parseKieResultUrls,
} from "../src/providers/kie/kie-jobs.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("parses createTask and success resultUrls", () => {
  assert.equal(parseKieCreateTask({ code: 200, data: { taskId: "task_1" } }), "task_1");
  assert.deepEqual(
    parseKieResultUrls({
      data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/a.png"] }) },
    }),
    ["https://example.test/a.png"],
  );
  assert.deepEqual(
    parseKieResultUrls({ data: { state: "generating" } }),
    [],
  );
  assert.throws(
    () => parseKieResultUrls({ data: { state: "fail", failMsg: "nsfw" } }),
    /nsfw/u,
  );
});

test("job transport polls until a result URL can be downloaded", async () => {
  let polls = 0;
  const transport = new KieJobTransport({
    apiKey: "kie-secret",
    pollMs: 0,
    timeoutMs: 10_000,
    now: () => polls * 1000,
    sleep: async () => undefined,
    fetch: async (input) => {
      const url = String(input);
      if (url.includes("createTask")) {
        return new Response(JSON.stringify({ code: 200, data: { taskId: "task_img" } }));
      }
      if (url.includes("recordInfo")) {
        polls += 1;
        if (polls < 2) return new Response(JSON.stringify({ data: { state: "generating" } }));
        return new Response(
          JSON.stringify({
            data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://example.test/out.png"] }) },
          }),
        );
      }
      if (url === "https://example.test/out.png") {
        return new Response(PNG);
      }
      throw new Error(url);
    },
  });
  const result = await transport.generateImage("flux-2/flex-text-to-image", "a coffee shop interior");
  assert.equal(result.mediaType, "image/png");
  assert.equal(result.bytes.equals(PNG), true);
  assert.ok(polls >= 2);
});
