import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { isolatedMemoryEnv } from "./helpers.js";
import {
  bearerCredentials,
  createV2SessionClient,
  loadV2Info,
  type ClientFetch,
  type GuiWebSocketConstructor,
} from "../packages/client/src/index.js";

test("isolated host fixtures default to a missing temporary catalog", () => {
  const fixture = isolatedMemoryEnv();
  const overridden = isolatedMemoryEnv({
    A008_CATALOG_PATH: join(fixture.directory, "override-catalog.json"),
  });
  try {
    const catalogPath = join(fixture.directory, "catalog.json");
    assert.equal(fixture.env.A008_CATALOG_PATH, catalogPath);
    assert.equal(existsSync(catalogPath), false);
    assert.equal(
      overridden.env.A008_CATALOG_PATH,
      join(fixture.directory, "override-catalog.json"),
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
    rmSync(overridden.directory, { recursive: true, force: true });
  }
});

test(
  "independent V2 SDK client authenticates, prompts and inspects a real host",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = isolatedMemoryEnv();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;
    f.env.A008_DEVICES_PATH = join(f.directory, "devices.sqlite");
    f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json");
    assert.equal(f.env.A008_CATALOG_PATH, join(f.directory, "catalog.json"));
    assert.equal(existsSync(String(f.env.A008_CATALOG_PATH)), false);
    const project = executeProjectBootstrap(
      parseProjectBootstrapConfig({
        projectName: "SDK fixture",
        rootFolder: join(f.directory, "sdk-fixture"),
        repository: { initialize: false },
        continuity: { docsFirst: false, multiAgent: { enabled: false } },
        memory: { useGlobalA008Memory: false },
      }),
      { registryPath: f.env.A008_PROJECTS_PATH },
    ).project;
    const grant = new DeviceRegistry(f.env).grant({
      name: "SDK client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    try {
      const origin = `http://127.0.0.1:${String(host.port)}`;
      const credentials = bearerCredentials(grant.credential);
      const info = await loadV2Info({
        fetch: globalThis.fetch as unknown as ClientFetch,
        credentials,
        origin,
      });
      assert.equal(info.protocol, "a008.v2");
      assert.ok(info.features.includes("session.restart-uncertainty"));

      const client = createV2SessionClient({
        origin,
        projectId: project.projectId,
        credentials,
        fetch: globalThis.fetch as unknown as ClientFetch,
        webSocket: WebSocket as unknown as GuiWebSocketConstructor,
        createId: () => `id_${Math.random().toString(36).slice(2)}`,
      });
      const opened = await client.connect();
      assert.equal(opened.projectId, project.projectId);
      assert.ok(opened.sessionId.length > 0);
      const prompted = await client.prompt("Hello through the SDK");
      assert.equal(prompted.messages.at(-1)?.role, "assistant");
      const inspected = await client.inspect();
      assert.equal(inspected.messages.length, prompted.messages.length);
      client.dispose();
    } finally {
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
