import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  request as forwardRequest,
  type IncomingMessage,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  bearerCredentials,
  createPlatformV3Client,
  type ClientFetch,
  type PlatformV3Client,
} from "../packages/client/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DEFAULT_MODEL_ID } from "../src/core/model-registry.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";

const CLI = fileURLToPath(
  new URL("../src/platform/admin-cli.js", import.meta.url),
);
const MODEL = DEFAULT_MODEL_ID;
const CAPABILITIES = [
  "durable-conversations",
  "durable-runs",
  "command-receipts",
  "event-polling",
  "background-text-runs",
  "restart-uncertainty",
];

interface Hop {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: string;
}

function processEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    Path: process.env.Path,
    PATHEXT: process.env.PATHEXT,
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    ComSpec: process.env.ComSpec,
    COMSPEC: process.env.COMSPEC,
    ...extra,
  };
}

function hostEnv(endpoint?: string) {
  const fixture = isolatedMemoryEnv({
    ...(endpoint === undefined
      ? {}
      : { NVIDIA_CHAT_COMPLETIONS_URL: endpoint }),
    A008_PLATFORM_SCAN_MS: "40",
    A008_PLATFORM_LEASE_MS: "4000",
    A008_PLATFORM_RENEW_MS: "400",
    A008_PLATFORM_TURN_TIMEOUT_MS: "20000",
    A008_PLATFORM_SHUTDOWN_DRAIN_MS: "2000",
  });
  fixture.env.PATH = process.env.PATH;
  fixture.env.A008_DEVICES_PATH = join(fixture.directory, "devices.sqlite");
  fixture.env.A008_PROJECTS_PATH = join(fixture.directory, "projects.json");
  fixture.env.A008_CATALOG_PATH = join(fixture.directory, "catalog.json");
  fixture.env.A008_SECRETS_PATH = join(fixture.directory, "secrets.json");
  fixture.env.A008_PLATFORM_PATH = join(fixture.directory, "platform.sqlite");
  return fixture;
}

function bootstrap(env: NodeJS.ProcessEnv, directory: string, name: string) {
  return executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: name,
      rootFolder: join(directory, name),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: env.A008_PROJECTS_PATH ?? "" },
  ).project;
}

function sqliteNames(directory: string): readonly string[] {
  return readdirSync(directory).filter((name) => name.endsWith(".sqlite"));
}

function operationOf(payload: Record<string, any>): string | undefined {
  const content = payload.messages?.at(-1)?.content;
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content) as { readonly operation?: unknown };
    return typeof parsed.operation === "string" ? parsed.operation : undefined;
  } catch {
    return undefined;
  }
}

function providerUserText(content: unknown): string | undefined {
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content) as { readonly message?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    /* raw chat text */
  }
  return content;
}

function chatCount(
  requests: readonly Record<string, any>[],
  prompt: string,
): number {
  return requests.filter((payload) => {
    if (operationOf(payload) !== undefined) return false;
    return providerUserText(payload.messages?.at(-1)?.content) === prompt;
  }).length;
}

function forwardedHeaders(
  request: IncomingMessage,
  body: Buffer,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (
      key === "host" ||
      key === "connection" ||
      key === "content-length" ||
      key === "transfer-encoding"
    ) {
      continue;
    }
    if (typeof value === "string") headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(", ");
  }
  headers["content-length"] = String(body.length);
  return headers;
}

async function startProxy(targetPort: number) {
  const hops: Hop[] = [];
  let dropCancel = false;
  let hangup = false;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("error", () => undefined);
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      const path = request.url ?? "/";
      const method = request.method ?? "GET";
      const authorization = request.headers.authorization;
      hops.push({
        method,
        path,
        authorization:
          typeof authorization === "string" ? authorization : undefined,
        body: body.toString("utf8"),
      });
      if (hangup) {
        response.destroy();
        return;
      }
      const upstream = forwardRequest(
        {
          hostname: "127.0.0.1",
          port: targetPort,
          path,
          method,
          headers: forwardedHeaders(request, body),
        },
        (up) => {
          const cancel = method === "POST" && path.includes("/cancel");
          if (cancel && dropCancel) {
            up.resume();
            response.destroy();
            return;
          }
          response.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (!response.destroyed && !response.headersSent)
          response.writeHead(502).end();
      });
      upstream.end(body);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Admin CLI proxy failed to bind.");
  }
  return {
    port: address.port,
    hops,
    setDropCancel(value: boolean) {
      dropCancel = value;
    },
    setHangup(value: boolean) {
      hangup = value;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function runCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function errorCode(stderr: string): string {
  const parsed = JSON.parse(stderr) as { readonly code?: unknown };
  assert.ok(typeof parsed.code === "string");
  return parsed.code;
}

async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 20_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test("platform admin info reports an unavailable host without opening a database", async () => {
  const fixture = hostEnv();
  delete fixture.env.A008_PLATFORM_PATH;
  const host = await startGuiHost({
    env: fixture.env,
    port: 0,
    cwd: fixture.directory,
  });
  const proxy = await startProxy(host.port);
  const cliDir = mkdtempSync(join(tmpdir(), "A008-admin-cli-"));
  const origin = `http://127.0.0.1:${String(proxy.port)}`;
  writeFileSync(
    join(cliDir, ".env.local"),
    `A008_PLATFORM_ORIGIN=${origin}\nA008_DEVICE_TOKEN=from-dotenv-local\n`,
  );
  try {
    const ignored = await runCli(["info"], processEnv(), cliDir);
    assert.equal(ignored.code, 1);
    assert.equal(errorCode(ignored.stderr), "INVALID_REQUEST");
    assert.equal(proxy.hops.length, 0);
    assert.equal(ignored.stdout.includes("from-dotenv-local"), false);
    assert.equal(ignored.stderr.includes("from-dotenv-local"), false);

    const info = await runCli(
      ["info", "--origin", origin],
      processEnv({ A008_DEVICE_TOKEN: "should-not-be-sent" }),
      cliDir,
    );
    assert.equal(info.code, 0);
    assert.deepEqual(JSON.parse(info.stdout), {
      available: false,
      capabilities: [],
    });
    assert.equal(info.stdout.includes("should-not-be-sent"), false);
    assert.equal(info.stdout.includes(fixture.directory), false);
    assert.equal(info.stdout.includes("protocolVersion"), false);
    assert.equal(proxy.hops.length, 1);
    assert.equal(proxy.hops[0]?.method, "GET");
    assert.equal(proxy.hops[0]?.path, "/v3/info");
    assert.equal(proxy.hops[0]?.authorization, undefined);

    const listed = await runCli(
      [
        "list-conversations",
        "--project",
        "missing-project",
        "--origin",
        origin,
      ],
      processEnv({ A008_DEVICE_TOKEN: "unused-token" }),
      cliDir,
    );
    assert.equal(listed.code, 1);
    assert.equal(errorCode(listed.stderr), "NOT_FOUND");
    assert.equal(proxy.hops.length, 2);
    assert.equal(proxy.hops[1]?.authorization, "Bearer unused-token");
    assert.equal(existsSync(join(fixture.directory, "platform.sqlite")), false);
    assert.deepEqual(sqliteNames(cliDir), []);

    const credentialUrl = await runCli(
      [
        "info",
        "--origin",
        `http://user:secret@127.0.0.1:${String(proxy.port)}`,
      ],
      processEnv(),
      cliDir,
    );
    assert.equal(credentialUrl.code, 1);
    assert.equal(errorCode(credentialUrl.stderr), "INVALID_REQUEST");
    assert.equal(credentialUrl.stderr.includes("secret"), false);
    assert.equal(proxy.hops.length, 2);

    const query = await runCli(
      ["info", "--origin", `${origin}?token=query-secret`],
      processEnv(),
      cliDir,
    );
    assert.equal(query.code, 1);
    assert.equal(errorCode(query.stderr), "INVALID_REQUEST");
    assert.equal(query.stderr.includes("query-secret"), false);
    assert.equal(proxy.hops.length, 2);

    const flagged = await runCli(
      ["info", "--origin", origin, "--token", "flag-secret"],
      processEnv(),
      cliDir,
    );
    assert.equal(flagged.code, 1);
    assert.equal(errorCode(flagged.stderr), "INVALID_REQUEST");
    assert.equal(flagged.stderr.includes("flag-secret"), false);
    assert.equal(proxy.hops.length, 2);

    for (const command of [
      "grant",
      "revoke",
      "backup",
      "import",
      "reconcile",
    ]) {
      const refused = await runCli(
        [command, "--origin", origin],
        processEnv(),
        cliDir,
      );
      assert.equal(refused.code, 1);
      assert.equal(errorCode(refused.stderr), "INVALID_REQUEST");
    }
    assert.equal(proxy.hops.length, 2);

    proxy.setHangup(true);
    const down = await runCli(
      ["info", "--origin", origin],
      processEnv(),
      cliDir,
    );
    assert.equal(down.code, 1);
    assert.equal(errorCode(down.stderr), "TRANSPORT_ERROR");
    assert.equal(proxy.hops.length, 3);
    assert.deepEqual(sqliteNames(cliDir), []);
  } finally {
    await proxy.close();
    await host.close();
    rmSync(fixture.directory, { recursive: true, force: true });
    rmSync(cliDir, { recursive: true, force: true });
  }
});

test(
  "platform admin CLI lists, reads and cancels one real-host run without retrying",
  { timeout: 60_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint);
    const project = bootstrap(fixture.env, fixture.directory, "admin");
    const granted = new DeviceRegistry(fixture.env).grant({
      name: "platform-admin",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const platformPath = fixture.env.A008_PLATFORM_PATH;
    if (platformPath === undefined) throw new Error("missing platform path");
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
      platformPath,
    });
    const proxy = await startProxy(host.port);
    const cliDir = mkdtempSync(join(tmpdir(), "A008-admin-cli-"));
    const origin = `http://127.0.0.1:${String(proxy.port)}`;
    const direct: PlatformV3Client = createPlatformV3Client({
      origin: `http://127.0.0.1:${String(host.port)}`,
      credentials: bearerCredentials(granted.credential),
      fetch: globalThis.fetch as unknown as ClientFetch,
    });
    const env = processEnv({
      A008_PLATFORM_ORIGIN: origin,
      A008_DEVICE_TOKEN: granted.credential,
    });
    try {
      const info = await runCli(["info"], env, cliDir);
      assert.equal(info.code, 0);
      assert.deepEqual(JSON.parse(info.stdout), {
        available: true,
        capabilities: CAPABILITIES,
      });
      assert.equal(info.stdout.includes(granted.credential), false);
      assert.equal(info.stdout.includes(fixture.directory), false);
      assert.equal(proxy.hops.at(-1)?.authorization, undefined);

      const anonymous = await runCli(
        ["list-conversations", "--project", project.projectId],
        processEnv({ A008_PLATFORM_ORIGIN: origin }),
        cliDir,
      );
      assert.equal(anonymous.code, 1);
      assert.equal(errorCode(anonymous.stderr), "UNAUTHENTICATED");
      assert.equal(proxy.hops.at(-1)?.authorization, undefined);
      assert.equal(anonymous.stderr.includes(granted.credential), false);
      assert.deepEqual(sqliteNames(cliDir), []);

      const created = await direct.createConversation(project.projectId, {
        title: "Admin",
      });
      const prompt = "WAIT-TURN admin cancel";
      const accepted = await direct.createRun(created.conversation.id, {
        commandId: "admin-cancel",
        expectedRevision: 0,
        model: MODEL,
        text: prompt,
      });
      await waitFor(
        "running cancel target",
        async () =>
          (await direct.getRun(accepted.run.id)).run.status === "running",
      );

      const listed = await runCli(
        ["list-conversations", "--project", project.projectId],
        env,
        cliDir,
      );
      assert.equal(listed.code, 0);
      assert.equal(proxy.hops.at(-1)?.method, "GET");
      assert.equal(
        proxy.hops.at(-1)?.authorization,
        `Bearer ${granted.credential}`,
      );
      const conversations = (
        JSON.parse(listed.stdout) as {
          readonly conversations: readonly { readonly id: string }[];
        }
      ).conversations;
      assert.equal(
        conversations.some(
          (conversation) => conversation.id === created.conversation.id,
        ),
        true,
      );

      const loaded = await runCli(
        ["get-run", "--run", accepted.run.id],
        env,
        cliDir,
      );
      assert.equal(loaded.code, 0);
      const loadedRun = (
        JSON.parse(loaded.stdout) as {
          readonly run: {
            readonly id: string;
            readonly status: string;
            readonly revision: number;
          };
        }
      ).run;
      assert.equal(loadedRun.id, accepted.run.id);
      assert.equal(loadedRun.status, "running");
      assert.equal(proxy.hops.at(-1)?.method, "GET");

      const cancelBefore = proxy.hops.length;
      const cancelled = await runCli(
        [
          "cancel-run",
          "--run",
          accepted.run.id,
          "--expected-revision",
          String(loadedRun.revision),
        ],
        env,
        cliDir,
      );
      assert.equal(cancelled.code, 0);
      const cancelHops = proxy.hops.slice(cancelBefore);
      assert.equal(cancelHops.length, 1);
      assert.equal(cancelHops[0]?.method, "POST");
      assert.equal(cancelHops[0]?.path.endsWith("/cancel"), true);
      assert.deepEqual(JSON.parse(cancelHops[0]?.body ?? ""), {
        expectedRevision: loadedRun.revision,
      });
      assert.equal(
        (
          JSON.parse(cancelled.stdout) as {
            readonly run: { readonly status: string };
          }
        ).run.status,
        "cancel_requested",
      );
      assert.equal(chatCount(provider.requests, prompt), 1);
      assert.equal(cancelled.stdout.includes(granted.credential), false);

      const secondBefore = proxy.hops.length;
      const second = await runCli(
        [
          "cancel-run",
          "--run",
          accepted.run.id,
          "--expected-revision",
          String(loadedRun.revision),
        ],
        env,
        cliDir,
      );
      assert.equal(proxy.hops.length, secondBefore + 1);
      assert.equal(proxy.hops.at(-1)?.method, "POST");
      assert.equal(proxy.hops.at(-1)?.path.endsWith("/cancel"), true);
      if (second.code === 0) {
        const status = (
          JSON.parse(second.stdout) as {
            readonly run: { readonly status: string };
          }
        ).run.status;
        assert.ok(status === "cancel_requested" || status === "cancelled");
      } else {
        assert.equal(second.code, 1);
        assert.equal(errorCode(second.stderr), "REVISION_CONFLICT");
      }
      assert.equal(chatCount(provider.requests, prompt), 1);

      const other = await direct.createConversation(project.projectId, {
        title: "Lost",
      });
      const lostPrompt = "WAIT-TURN admin lost";
      const lostRun = await direct.createRun(other.conversation.id, {
        commandId: "admin-lost",
        expectedRevision: 0,
        model: MODEL,
        text: lostPrompt,
      });
      await waitFor(
        "running lost-response target",
        async () =>
          (await direct.getRun(lostRun.run.id)).run.status === "running",
      );
      const lostRevision = (await direct.getRun(lostRun.run.id)).run.revision;
      proxy.setDropCancel(true);
      const lostBefore = proxy.hops.length;
      const lost = await runCli(
        [
          "cancel-run",
          "--run",
          lostRun.run.id,
          "--expected-revision",
          String(lostRevision),
        ],
        env,
        cliDir,
      );
      proxy.setDropCancel(false);
      assert.equal(lost.code, 1);
      assert.equal(errorCode(lost.stderr), "TRANSPORT_ERROR");
      const lostHops = proxy.hops.slice(lostBefore);
      assert.equal(lostHops.length, 1);
      assert.equal(lostHops[0]?.method, "POST");
      assert.equal(lostHops[0]?.path.endsWith("/cancel"), true);
      const after = await direct.getRun(lostRun.run.id);
      assert.ok(
        after.run.status === "cancel_requested" ||
          after.run.status === "cancelled",
      );
      assert.equal(chatCount(provider.requests, lostPrompt), 1);
      assert.equal(lost.stdout.includes(granted.credential), false);
      assert.equal(lost.stderr.includes(granted.credential), false);
      assert.equal(lost.stderr.includes(lostPrompt), false);
      assert.deepEqual(sqliteNames(cliDir), []);
    } finally {
      proxy.setDropCancel(false);
      await proxy.close();
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
      rmSync(cliDir, { recursive: true, force: true });
    }
  },
);
