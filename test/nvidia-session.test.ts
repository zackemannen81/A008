import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import type { ChatRequest, ChatTransport } from "../src/core/types.js";
import type { NvidiaChatTransportOptions } from "../src/providers/nvidia/nvidia-chat-transport.js";
import {
  createNvidiaChatSession,
  NVIDIA_ENDPOINT_ENV,
} from "../src/runtime/nvidia-session.js";

test("shared composition rejects a missing key before transport creation", () => {
  let creations = 0;

  assert.throws(
    () =>
      createNvidiaChatSession({
        env: {},
        createTransport: () => {
          creations += 1;
          throw new Error("must not be reached");
        },
      }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.equal(creations, 0);
});

test("shared composition owns model defaults and endpoint mapping", async () => {
  let construction: NvidiaChatTransportOptions | undefined;
  let request: ChatRequest | undefined;
  const transport: ChatTransport = {
    async complete(input) {
      request = input;
      return { message: { role: "assistant", content: "ok" } };
    },
  };
  const session = createNvidiaChatSession({
    env: {
      NVIDIA_API_KEY: "local-test-key",
      [NVIDIA_ENDPOINT_ENV]: "http://127.0.0.1:43123/v1/chat/completions",
    },
    createTransport: (options) => {
      construction = options;
      return transport;
    },
  });

  await session.send("hello");

  assert.equal(construction?.apiKey, "local-test-key");
  assert.equal(
    construction?.endpoint,
    "http://127.0.0.1:43123/v1/chat/completions",
  );
  assert.equal(request?.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
  assert.equal(request?.options?.temperature, 1);
});
