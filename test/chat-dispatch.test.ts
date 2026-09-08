import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChatSession } from "../src/core/chat-session.js";
import { createDispatchingChatTransport, usesKieChat, usesOpenAiChat } from "../src/runtime/chat-dispatch.js";

function catalogFile(body: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "a008-dispatch-"));
  const path = join(dir, "catalog.json");
  writeFileSync(path, JSON.stringify(body));
  return path;
}

function jsonChat(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    }),
  );
}

test("usesKieChat follows curated ids, catalog provider, and chatProvider fallback", () => {
  const nvidia = catalogFile({ version: 1, chatProvider: "nvidia" });
  const kie = catalogFile({
    version: 1,
    chatProvider: "nvidia",
    chatModels: [{ id: "custom-kie", name: "Custom", provider: "kie", inputModalities: ["text"] }],
  });
  const fallback = catalogFile({ version: 1, chatProvider: "kie" });
  assert.equal(usesKieChat("gemini-3-flash", nvidia), true);
  assert.equal(usesKieChat("nvidia/nemotron-3.5-lightning-30b-a3b", nvidia), false);
  assert.equal(usesKieChat("custom-kie", kie), true);
  assert.equal(usesKieChat("nvidia/nemotron-3.5-lightning-30b-a3b", fallback), true);
  assert.equal(usesOpenAiChat("gpt-5.6-luna", nvidia), true);
  const openaiFallback = catalogFile({ version: 1, chatProvider: "openai" });
  assert.equal(usesOpenAiChat("nvidia/nemotron-3.5-lightning-30b-a3b", openaiFallback), false);
});

test("dispatch posts kie chat to the model URL and NVIDIA chat to NVIDIA", async () => {
  const catalogPath = catalogFile({ version: 1 });
  const urls: string[] = [];
  const transport = createDispatchingChatTransport({
    env: { NVIDIA_API_KEY: "nvapi-test", KIE_API_KEY: "kie-secret", OPENAI_API_KEY: "sk-openai-test" },
    catalogPath,
    timeoutMs: 5_000,
    fetch: async (input) => {
      urls.push(String(input));
      return jsonChat("ok");
    },
  });
  await transport.complete({
    model: "gemini-3-flash",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: false },
  });
  await transport.complete({
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: false },
  });
  await transport.complete({
    model: "gpt-5.6-luna",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: false },
  });
  assert.match(urls[0] ?? "", /api\.kie\.ai\/gemini-3-flash\/v1\/chat\/completions/u);
  assert.match(urls[1] ?? "", /integrate\.api\.nvidia\.com/u);
  assert.match(urls[2] ?? "", /api\.openai\.com\/v1\/chat\/completions/u);
  assert.equal(JSON.stringify(urls).includes("kie-secret"), false);
  assert.equal(JSON.stringify(urls).includes("nvapi-test"), false);
  assert.equal(JSON.stringify(urls).includes("sk-openai-test"), false);
});

test("chatProvider kie rewrites a NVIDIA model id to the configured kie chat model", async () => {
  const catalogPath = catalogFile({
    version: 1,
    chatProvider: "kie",
    kie: { chatModel: "gemini-3-pro" },
  });
  let url = "";
  let body = "";
  const transport = createDispatchingChatTransport({
    env: { KIE_API_KEY: "kie-secret" },
    catalogPath,
    timeoutMs: 5_000,
    fetch: async (input, init) => {
      url = String(input);
      body = String(init?.body ?? "");
      return jsonChat("from kie");
    },
  });
  const result = await transport.complete({
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: false },
  });
  assert.match(url, /api\.kie\.ai\/gemini-3-pro\/v1\/chat\/completions/u);
  assert.match(body, /"model":"gemini-3-pro"/u);
  assert.equal(result.message.content, "from kie");
});

test("NVIDIA and kie HTTP payloads retain the shared single chat instruction", async () => {
  const catalogPath = catalogFile({ version: 1 });
  const bodies: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const transport = createDispatchingChatTransport({
    env: { NVIDIA_API_KEY: "nvapi-test", KIE_API_KEY: "kie-secret" },
    catalogPath, timeoutMs: 5000,
    fetch: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return jsonChat("ok");
    },
  });
  for (const model of ["gemini-3-flash", "nvidia/nemotron-3.5-lightning-30b-a3b"]) {
    const session = new ChatSession({ model, transport, systemMessage: "Explicit base." });
    await session.send("Question", {
      generation: { stream: false },
      invocation: { systemMessages: ["Global instruction."] },
    });
  }
  assert.equal(bodies.length, 2);
  for (const body of bodies) assert.deepEqual(body.messages, [
    { role: "system", content: "Explicit base.\n\nGlobal instruction." },
    { role: "user", content: "Question" },
  ]);
});