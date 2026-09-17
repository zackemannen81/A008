import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import { byteStream } from "./helpers.js";

const live = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../test/fixtures/nvidia-live-reasoning-leak.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as {
  readonly characterization: string;
  readonly transitions: readonly string[];
  readonly reasoning: string;
  readonly leakedContent: string;
  readonly expectedAnswer: string;
};

function liveSse(): string {
  return [
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: live.reasoning } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: live.leakedContent }, finish_reason: "stop" }] })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
}

test("live NVIDIA SSE channel transitions are reasoning_content then leaked content", () => {
  assert.deepEqual(live.transitions, ["reasoning_content", "content"]);
  assert.match(
    live.characterization,
    /reasoning_content carries only a short CoT prefix/u,
  );
  assert.equal(live.reasoning.length, 146);
  assert.equal(live.leakedContent.includes(live.expectedAnswer), true);
  assert.equal(live.reasoning.includes(live.expectedAnswer), false);
});

test("NVIDIA transport normalizes the live leak so only the user-visible answer is content", async () => {
  const deltas: string[] = [];
  const transport = new NvidiaChatTransport({
    apiKey: "test-token",
    fetch: async () =>
      new Response(byteStream([liveSse()]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
  });
  const result = await transport.complete(
    {
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      messages: [{ role: "user", content: "Tja läget?" }],
      options: { stream: true, enableThinking: true },
    },
    {
      onDelta: (delta) =>
        deltas.push(`${delta.type}:${delta.text.slice(0, 24)}`),
    },
  );

  assert.equal(result.message.content, live.expectedAnswer);
  assert.equal(result.message.content.includes(live.reasoning), false);
  assert.match(result.reasoning ?? "", /thinking process/u);
  assert.match(result.reasoning ?? "", /I'll generate the response/u);
  assert.equal(
    deltas.some(
      (delta) =>
        delta.startsWith("content:") && delta.includes("thinking process"),
    ),
    false,
  );
  assert.equal(
    deltas.filter((delta) => delta.startsWith("content:")).join(""),
    `content:${live.expectedAnswer.slice(0, 24)}`,
  );
});
