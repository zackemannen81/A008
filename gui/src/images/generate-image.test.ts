import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateImage,
  generatedImageLocatorSrc,
  generatedImageSrc,
} from "./generate-image.js";

test("generateImage posts the prompt and maps the stored locator to a blob URL", async () => {
  const image = await generateImage(
    "a coffee shop interior",
    async (input, init) => {
      assert.equal(String(input), "/v1/images");
      assert.match(String(init?.body), /coffee shop/u);
      return new Response(
        JSON.stringify({
          locator: "source:abc/generated.png",
          sha256: "aa".repeat(32),
          bytes: 12,
          mediaType: "image/png",
          filename: "generated.png",
        }),
      );
    },
  );
  assert.equal(
    generatedImageSrc(image),
    `/v1/blobs/${"aa".repeat(32)}/generated.png`,
  );
});

test("generatedImageLocatorSrc maps a source-store locator and ignores provider URLs", () => {
  const sha = "ab".repeat(32);
  assert.equal(
    generatedImageLocatorSrc(`source://${sha}/storm.png`),
    `/v1/blobs/${sha}/storm.png`,
  );
  assert.equal(
    generatedImageLocatorSrc("https://provider.example/tmp/storm.png"),
    undefined,
  );
});

test("generateImage refuses an empty prompt without fetching", async () => {
  await assert.rejects(
    () =>
      generateImage("  ", async () => {
        throw new Error("should not fetch");
      }),
    /Describe the image/u,
  );
});
