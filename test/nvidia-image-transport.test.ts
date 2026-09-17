import assert from "node:assert/strict";
import test from "node:test";
import {
  NvidiaImageTransport,
  parseNvidiaImagePayload,
} from "../src/providers/nvidia/nvidia-image-transport.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("parses NVIDIA artifacts and OpenAI b64_json image payloads", () => {
  const fromNim = parseNvidiaImagePayload({
    artifacts: [{ base64: PNG.toString("base64") }],
  });
  assert.equal(fromNim.mediaType, "image/png");
  assert.equal(fromNim.bytes.equals(PNG), true);
  const fromOpenai = parseNvidiaImagePayload({
    data: [{ b64_json: PNG.toString("base64") }],
  });
  assert.equal(fromOpenai.bytes.equals(PNG), true);
});

test("image transport posts prompt to the configured endpoint without leaking the key in errors", async () => {
  let url = "";
  let body = "";
  const transport = new NvidiaImageTransport({
    apiKey: "nvapi-secret-test-key",
    endpoint: "https://example.test/genai",
    fetch: async (input, init) => {
      url = String(input);
      body = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ artifacts: [{ base64: PNG.toString("base64") }] }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    },
  });
  const result = await transport.generate({ prompt: "a coffee shop interior" });
  assert.equal(url, "https://example.test/genai");
  assert.match(body, /coffee shop/u);
  assert.equal(result.mediaType, "image/png");
  assert.throws(
    () => new NvidiaImageTransport({ apiKey: "   " }),
    /NVIDIA_API_KEY/u,
  );
});
