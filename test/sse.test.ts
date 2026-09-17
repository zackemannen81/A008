import assert from "node:assert/strict";
import test from "node:test";
import { parseSseData } from "../src/providers/nvidia/sse.js";
import { byteStream, splitBytes } from "./helpers.js";

test("SSE parser survives arbitrary byte boundaries and CRLF", async () => {
  const source = [
    ": keepalive\r\n",
    "data: first\r\n\r\n",
    "data: second line 1\n",
    "data: second line 2\n\n",
    "data: [DONE]\n\n",
  ].join("");
  const values: string[] = [];

  for await (const value of parseSseData(
    byteStream(splitBytes(source, [1, 7, 2, 5])),
  )) {
    values.push(value);
  }

  assert.deepEqual(values, ["first", "second line 1\nsecond line 2", "[DONE]"]);
});

test("SSE parser yields a trailing event without a blank terminator", async () => {
  const values: string[] = [];
  for await (const value of parseSseData(byteStream(["data: trailing"]))) {
    values.push(value);
  }
  assert.deepEqual(values, ["trailing"]);
});
