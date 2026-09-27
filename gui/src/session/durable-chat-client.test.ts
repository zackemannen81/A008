import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { cookieCredentials } from "../../../packages/client/src/index.js";
import { DurableChatClient, durableChatHttp } from "./durable-chat-client.js";

test("standalone sidebar uses durable creation and selection while runs are busy", () => {
  const hook = readFileSync(
    fileURLToPath(new URL("./use-gui-session.ts", import.meta.url)),
    "utf8",
  );
  const sidebar = readFileSync(
    fileURLToPath(new URL("../projects/project-sidebar.tsx", import.meta.url)),
    "utf8",
  );
  assert.match(
    hook,
    /engineAccessToken\(\) \|\| options \? useLegacyGuiSession\(options\) : useDurableChat\(\)/u,
  );
  assert.match(sidebar, /props\.session\.durable\.sidebar\(\)/u);
  assert.match(
    sidebar,
    /props\.session\.durable\.selectChat\(project\.projectId/u,
  );
  assert.match(
    sidebar,
    /!props\.session\.durable && (?:Boolean\()?props\.session\.busy/u,
  );
});

test("durable SDK requests keep GUI routes for both relative and absolute URLs", async () => {
  const urls: string[] = [];
  const http = durableChatHttp({
    origin: "",
    credentials: cookieCredentials(),
    fetch: async (url) => {
      urls.push(url);
      return Response.json({});
    },
  });
  await http.fetch("/v3/projects/project/conversations");
  await http.fetch("http://localhost:1234/v3/runs/run?after=2");
  assert.deepEqual(urls, [
    "/v1/chat/v3/projects/project/conversations",
    "http://localhost:1234/v1/chat/v3/runs/run?after=2",
  ]);
});

test("disconnect during initial discovery cannot open a chat or restart observation", async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  const urls: string[] = [];
  const client = new DurableChatClient(
    {
      origin: "",
      credentials: cookieCredentials(),
      fetch: async (url) => {
        urls.push(url);
        return new Promise<Response>((resolve) => {
          release = resolve;
          started();
        });
      },
    },
    { read: () => undefined, write() {} },
  );
  const connecting = client.connect();
  await fetching;
  client.dispose();
  release(Response.json({ models: [] }));
  await connecting;
  assert.deepEqual(urls, ["/v1/models"]);
});
