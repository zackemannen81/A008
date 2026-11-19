import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { prepareVisionImage } from "../src/runtime/vision-image.js";
import { modelFacingMcpResult } from "../src/tools/model-tools.js";

test("oversized screenshot becomes a bounded WebP without modifying the original", () => {
  const canvas = createCanvas(1700, 1100);
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(1700, 1100);
  let seed = 1003;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = seed & 255;
    pixels.data[i + 1] = (seed >>> 8) & 255;
    pixels.data[i + 2] = (seed >>> 16) & 255;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const source = canvas.toBuffer("image/png");
  assert.ok(source.length > 1_000_000);
  const before = Buffer.from(source);
  const converted = prepareVisionImage(source, "image/png");
  assert.equal(converted.mediaType, "image/webp");
  assert.ok(
    converted.bytes.length <= 1_000_000,
    String(converted.bytes.length),
  );
  assert.deepEqual(source, before);
});

test("small images and animated GIF attachments retain their original bytes", () => {
  const small = Buffer.from([1, 2, 3, 4]);
  const png = prepareVisionImage(small, "image/png");
  assert.equal(png.mediaType, "image/png");
  assert.deepEqual(png.bytes, small);
  const gif = Buffer.alloc(1_200_000, 12);
  const animated = prepareVisionImage(gif, "image/gif");
  assert.equal(animated.mediaType, "image/gif");
  assert.deepEqual(animated.bytes, gif);
});

test("large undecodable images fail closed with no replacement source", () => {
  assert.throws(
    () => prepareVisionImage(Buffer.alloc(1_200_000, 10), "image/png"),
    /Could not optimize the large image/,
  );
});

test("MCP screenshot result preserves artifact metadata without inline image Base64", () => {
  const metadata = JSON.stringify({
    path: "C:/captures/screen.png",
    width: 1920,
  });
  const result = {
    isError: false,
    content: [
      { type: "text", text: metadata },
      { type: "image", mimeType: "image/png", data: "A".repeat(1_500_000) },
    ],
  };
  const text = modelFacingMcpResult(result);
  assert.ok(text.length < 1000);
  const parsed = JSON.parse(text);
  assert.equal(parsed.isError, false);
  assert.equal(parsed.content[0].text, metadata);
  assert.equal(parsed.content[1].binaryOmitted, true);
  assert.equal(parsed.content[1].approximateBytes, 1_125_000);
  assert.equal(parsed.content[1].data, undefined);
});
