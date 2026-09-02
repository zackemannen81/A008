import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  looksLikeChainOfThought,
  NvidiaReasoningNormalizer,
  splitLeakedContent,
  verifiedFinalAnswer,
} from "../src/providers/nvidia/reasoning-normalizer.js";

const live = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../test/fixtures/nvidia-live-reasoning-leak.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  readonly reasoning: string;
  readonly leakedContent: string;
  readonly expectedAnswer: string;
  readonly transitions: readonly string[];
};

test("live leak content looks like chain-of-thought and splits at the answer marker", () => {
  assert.equal(looksLikeChainOfThought(live.leakedContent), true);
  const split = splitLeakedContent(live.leakedContent);
  assert.equal(split.answer, live.expectedAnswer);
  assert.match(split.reasoningLeak, /I'll generate the response/u);
  assert.equal(split.answer.includes(live.reasoning), false);
  assert.equal(split.answer.startsWith("Hej!"), true);
});

test("clean short answers after reasoning stay content", () => {
  const normalizer = new NvidiaReasoningNormalizer();
  const deltas = [
    ...normalizer.push("reasoning_content", "think "),
    ...normalizer.push("content", "Hello"),
    ...normalizer.push("content", " world"),
  ];
  const parts = normalizer.finish();
  assert.deepEqual(
    deltas.map((delta) => `${delta.type}:${delta.text}`),
    ["reasoning:think ", "content:Hello", "content: world"],
  );
  assert.equal(parts.reasoning, "think ");
  assert.equal(parts.content, "Hello world");
  assert.deepEqual(
    parts.transitions.map((entry) => entry.channel),
    ["reasoning_content", "content"],
  );
});

test("think tags inside content are stripped into reasoning", () => {
  const split = splitLeakedContent("<think>secret plan</think>\nVisible answer");
  assert.match(split.reasoningLeak, /secret plan/u);
  assert.equal(split.answer, "Visible answer");
});

test("verifiedFinalAnswer never returns leaked reasoning", () => {
  const answer = verifiedFinalAnswer({
    message: { role: "assistant", content: live.leakedContent },
    reasoning: live.reasoning,
  });
  assert.equal(answer, live.expectedAnswer);
  assert.equal(answer.includes(live.reasoning), false);
});
