import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ChatSession } from "../src/core/chat-session.js";
import { generatedImagePart } from "../src/core/chat-content.js";
import type { ChatTransport } from "../src/core/types.js";
import { EngineHost } from "../src/engine/engine-host.js";
import { ModelToolSession } from "../src/tools/model-tools.js";
import { DEFAULT_RUNTIME_BUDGETS as budgets } from "../src/core/runtime-preferences.js";
import { isolatedMemoryEnv } from "./helpers.js";
import type { GeneratedImage } from "../packages/protocol/src/index.js";

function storedImage(name: string): GeneratedImage {
  const sha = name.padEnd(64, "a").slice(0, 64);
  return {
    locator: `source://${sha}/${name}.png`,
    sha256: sha,
    bytes: 12,
    mediaType: "image/png",
    filename: `${name}.png`,
  };
}

function imagePart(content: ChatSession["messages"][number]["content"] | undefined) {
  return content === undefined ? undefined : generatedImagePart(content);
}

function imageStatuses(session: ChatSession): readonly string[] {
  return session.messages.flatMap((message) => {
    const part = generatedImagePart(message.content);
    return part === undefined ? [] : [`${part.generationId}:${part.status}`];
  });
}

async function waitUntil(
  predicate: () => boolean,
  label: string,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test("manual generation reserves one pending image and later text stays after it", async () => {
  const transport: ChatTransport = {
    async complete() {
      return { message: { role: "assistant", content: "it will look dark" } };
    },
  };
  const session = new ChatSession({ model: "fixture", transport });
  session.reserveGeneratedImage("image_1", "a dark apartment");
  await session.send("I think it will be quite dark.");
  assert.deepEqual(imageStatuses(session), ["image_1:pending"]);
  assert.equal(session.messages[1]?.content, "I think it will be quite dark.");
  assert.equal(
    session.resolveGeneratedImage("image_1", {
      status: "completed",
      ...storedImage("apartment"),
    }),
    true,
  );
  assert.deepEqual(
    session.messages.map((message) =>
      generatedImagePart(message.content)?.status ?? message.content,
    ),
    [
      "completed",
      "I think it will be quite dark.",
      "it will look dark",
    ],
  );
  assert.equal(
    imagePart(session.messages[0]?.content)?.locator,
    storedImage("apartment").locator,
  );
});

test("two image jobs completing in reverse still occupy their original positions", () => {
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete() {
        return { message: { role: "assistant", content: "ok" } };
      },
    },
  });
  session.reserveGeneratedImage("image_1", "description one");
  session.reserveGeneratedImage("image_2", "description two");
  session.resolveGeneratedImage("image_2", {
    status: "completed",
    ...storedImage("two"),
  });
  session.resolveGeneratedImage("image_1", {
    status: "completed",
    ...storedImage("one"),
  });
  const parts = session.messages.map((message) =>
    generatedImagePart(message.content),
  );
  assert.equal(parts[0]?.generationId, "image_1");
  assert.equal(parts[0]?.locator, storedImage("one").locator);
  assert.equal(parts[1]?.generationId, "image_2");
  assert.equal(parts[1]?.locator, storedImage("two").locator);
});

test("failed generation and duplicate completion stay on the reserved item", () => {
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete() {
        return { message: { role: "assistant", content: "ok" } };
      },
    },
  });
  session.reserveGeneratedImage("image_fail", "storm");
  session.resolveGeneratedImage("image_fail", {
    status: "failed",
    error: "provider unavailable",
  });
  session.resolveGeneratedImage("image_fail", {
    status: "completed",
    ...storedImage("should-not-win"),
  });
  const part = imagePart(session.messages[0]?.content);
  assert.equal(part?.status, "failed");
  assert.equal(part?.error, "provider unavailable");
  assert.equal(part?.locator, undefined);
  assert.equal(session.messages.length, 1);
});

test("model generate_image uses the same reserve/resolve pipeline as manual generation", async () => {
  const cwd = join(isolatedMemoryEnv().directory, "tools");
  mkdirSync(cwd);
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete(request) {
        const last = request.messages.at(-1);
        if (last?.role === "tool") {
          return {
            message: {
              role: "assistant",
              content: "Image generation started.",
            },
          };
        }
        if (last?.role === "user" && last.content.includes("Skapa")) {
          return {
            message: { role: "assistant", content: "" },
            toolCalls: [
              {
                id: "call-image",
                name: "generate_image",
                arguments: JSON.stringify({
                  prompt: "a lonely lighthouse during a storm",
                }),
              },
            ],
          };
        }
        return { message: { role: "assistant", content: "Haha, ja" } };
      },
    },
  });
  const tools = new ModelToolSession({
    cwd,
    env: process.env,
    generateImage: async (prompt) => {
      session.reserveGeneratedImage("image_tool", prompt);
    },
  });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    await session.send("Skapa en bild av en fyr i storm.", { tools: port });
    assert.deepEqual(imageStatuses(session), ["image_tool:pending"]);
    await session.send("Den kommer bli fet");
    session.resolveGeneratedImage("image_tool", {
      status: "completed",
      ...storedImage("lighthouse"),
    });
    const kinds = session.messages.map((message) =>
      generatedImagePart(message.content)
        ? "image"
        : `${message.role}:${message.content}`,
    );
    assert.deepEqual(kinds, [
      "user:Skapa en bild av en fyr i storm.",
      "image",
      "assistant:Image generation started.",
      "user:Den kommer bli fet",
      "assistant:Haha, ja",
    ]);
  } finally {
    await tools.close();
  }
});

test("ordinary non-image chat does not invoke generate_image", async () => {
  let generated = 0;
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete() {
        return { message: { role: "assistant", content: "hello" } };
      },
    },
  });
  const tools = new ModelToolSession({
    cwd: process.cwd(),
    env: process.env,
    generateImage: async () => {
      generated += 1;
    },
  });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    await session.send("hello there", { tools: port });
    assert.equal(generated, 0);
    assert.equal(imageStatuses(session).length, 0);
  } finally {
    await tools.close();
  }
});

test("engine host manual generation and reconstruction share one source-store item", async () => {
  const held: Array<{
    prompt: string;
    resolve: (image: GeneratedImage) => void;
    reject: (error: Error) => void;
    signal: AbortSignal;
  }> = [];
  const fixture = isolatedMemoryEnv();
  fixture.env.A008_ENGINE_DATA_PATH = join(fixture.directory, "engine");
  const workspace = join(fixture.directory, "project");
  mkdirSync(workspace);
  const engine = new EngineHost({
    env: fixture.env,
    createPanels: false,
    generateImage: ({ prompt, signal }) =>
      new Promise((resolve, reject) => {
        held.push({ prompt, resolve, reject, signal });
        signal.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  });
  try {
    const created = await engine.newSession({
      cwd: workspace,
      mcpServers: [],
    });
    const first = engine.generateImage(
      created.sessionId,
      "description one",
    );
    const second = engine.generateImage(
      created.sessionId,
      "description two",
    );
    assert.equal(
      imagePart(first.state.messages[0]?.content)?.status,
      "pending",
    );
    assert.equal(first.state.messages.length, 1);
    assert.equal(second.state.messages.length, 2);
    await waitUntil(() => held.length === 2, "both image provider jobs");
    held[1]?.reject(new Error("provider unavailable"));
    await waitUntil(() => {
      const current = engine.control(created.sessionId, { action: "inspect" });
      return imagePart(current.messages[1]?.content)?.status === "failed";
    }, "second image failure");
    held[0]?.resolve(storedImage("one"));
    await waitUntil(() => {
      const current = engine.control(created.sessionId, { action: "inspect" });
      return (
        imagePart(current.messages[0]?.content)?.status === "completed"
      );
    }, "first image completion");
    const reconstructed = engine.control(created.sessionId, {
      action: "inspect",
    });
    assert.equal(reconstructed.messages.length, 2);
    assert.equal(
      imagePart(reconstructed.messages[0]?.content)?.generationId,
      first.generationId,
    );
    assert.equal(
      imagePart(reconstructed.messages[0]?.content)?.locator,
      storedImage("one").locator,
    );
    assert.equal(
      imagePart(reconstructed.messages[1]?.content)?.generationId,
      second.generationId,
    );
    assert.equal(
      imagePart(reconstructed.messages[1]?.content)?.status,
      "failed",
    );
    assert.match(
      JSON.stringify(reconstructed.messages),
      /source:\/\//u,
    );
    assert.equal(JSON.stringify(reconstructed.messages).includes("http"), false);
    engine.generateImage(created.sessionId, "will cancel");
    await waitUntil(() => held.length === 3, "cancelled image job started");
    await engine.closeSession(created.sessionId);
    assert.equal(held[2]?.signal.aborted, true);
  } finally {
    await engine.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
