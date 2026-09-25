import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

declare const process: { readonly execPath: string };
import {
  bearerCredentials,
  type ClientFetch,
} from "../../../packages/client/src/index.js";
import { createPlatformHttp } from "./platform-client.js";
import { createPlatformSurface } from "./platform-surface.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function lineReader(stream: {
  on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}): { next(timeoutMs: number): Promise<string> } {
  let buffer = "";
  const pending: Array<{
    resolve: (line: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  const lines: string[] = [];
  const pump = () => {
    let index = buffer.indexOf("\n");
    while (index >= 0 && pending.length > 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      const waiter = pending.shift();
      if (waiter !== undefined) {
        clearTimeout(waiter.timer);
        waiter.resolve(line);
      }
      index = buffer.indexOf("\n");
    }
    index = buffer.indexOf("\n");
    while (index >= 0) {
      lines.push(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
    }
  };
  stream.on("data", (chunk) => {
    buffer += String(chunk);
    pump();
  });
  stream.on("error", (error) => {
    const waiter = pending.shift();
    if (waiter === undefined) return;
    clearTimeout(waiter.timer);
    waiter.reject(error);
  });
  return {
    next(timeoutMs: number) {
      const queued = lines.shift();
      if (queued !== undefined) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const waiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            const index = pending.indexOf(waiter);
            if (index >= 0) pending.splice(index, 1);
            reject(new Error(`Timed out waiting for host proof output. Partial: ${buffer}`));
          }, timeoutMs),
        };
        pending.push(waiter);
        pump();
      });
    },
  };
}

async function waitFor(label: string, check: () => boolean): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test("real host: a second client observes the run after the first is closed", async () => {
  const server = join(repoRoot, "dist", "src", "gui-host", "server.js");
  let built = true;
  try {
    readFileSync(server, "utf8");
  } catch {
    built = false;
  }
  assert.equal(built, true, "root build is required before the host proof");
  const child = spawn(process.execPath, [join(here, "platform-host-proof.mjs")], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr?.on("data", (chunk: Uint8Array | string) => {
    stderr += String(chunk);
  });
  const stdout = child.stdout;
  if (stdout === null) throw new Error("Host proof stdout is unavailable.");
  const lines = lineReader(stdout);
  const urls: string[] = [];
  try {
    const ready = JSON.parse(await lines.next(30_000)) as {
      port: number;
      credential: string;
      projectId: string;
      model: string;
      prompt: string;
      platformPath: string;
      platformFileExisted: boolean;
    };
    assert.equal(ready.platformPath.startsWith(repoRoot), false);
    assert.equal(ready.platformFileExisted, true);
    const fetchImpl: ClientFetch = async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/cancel")) throw new Error("platform page cancelled a run");
      return fetch(input, init) as unknown as Awaited<ReturnType<ClientFetch>>;
    };
    const http = createPlatformHttp({
      fetch: fetchImpl,
      origin: `http://127.0.0.1:${String(ready.port)}`,
      credentials: bearerCredentials(ready.credential),
    });
    const first = createPlatformSurface({
      http,
      model: ready.model,
      pollIntervalMs: 100,
    });
    await first.activate();
    assert.equal(first.getSnapshot().phase, "ready");
    assert.equal(
      JSON.stringify(first.getSnapshot()).includes(ready.credential),
      false,
    );
    await first.selectProject(ready.projectId);
    await first.createConversation("Observe");
    await first.startRun(ready.prompt);
    const runId = first.getSnapshot().runId;
    assert.notEqual(runId, "");
    first.deactivate();
    const second = createPlatformSurface({
      http,
      model: ready.model,
      pollIntervalMs: 100,
    });
    try {
      await second.activate();
      await second.selectProject(ready.projectId);
      await waitFor("conversation", () => second.getSnapshot().conversations.length > 0);
      const conversationId = second.getSnapshot().conversations[0]?.id ?? "";
      await second.selectConversation(conversationId);
      await waitFor(
        "completed run",
        () =>
          second.getSnapshot().runId === runId &&
          second.getSnapshot().runStatus === "completed",
      );
      const observed = second.getSnapshot();
      assert.equal(observed.runStatus, "completed");
      assert.match(observed.messages.map((message) => message.text).join("\n"), /Fixture answer/u);
      assert.equal(urls.some((url) => url.includes("/cancel")), false);
    } finally {
      second.deactivate();
    }
    child.stdin?.end();
    const summary = JSON.parse(await lines.next(20_000)) as {
      chatCount: number;
      platformFileExisted: boolean;
    };
    assert.equal(summary.chatCount, 1);
    assert.equal(summary.platformFileExisted, true);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 15_000);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch (error) {
    if (stderr.trim().length > 0) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`);
    }
    throw error;
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
