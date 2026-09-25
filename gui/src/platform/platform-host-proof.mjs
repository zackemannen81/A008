import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { executeProjectBootstrap } from "../../../dist/src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../../../dist/src/bootstrap/validate.js";
import { DEFAULT_MODEL_ID } from "../../../dist/src/core/model-registry.js";
import { DeviceRegistry } from "../../../dist/src/gui-host/device-registry.js";
import { startGuiHost } from "../../../dist/src/gui-host/server.js";
import { startSessionControlProvider } from "../../../dist/test/fixtures/session-control-provider.js";
import { isolatedMemoryEnv } from "../../../dist/test/helpers.js";

const prompt = "DELAY-ANSWER platform surface";

function operationOf(payload) {
  const content = payload.messages?.at(-1)?.content;
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content);
    return typeof parsed.operation === "string" ? parsed.operation : undefined;
  } catch {
    return undefined;
  }
}

function providerUserText(content) {
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    /* raw chat text */
  }
  return content;
}

function chatCount(requests) {
  return requests.filter((payload) => {
    if (operationOf(payload) !== undefined) return false;
    return providerUserText(payload.messages?.at(-1)?.content) === prompt;
  }).length;
}

const provider = await startSessionControlProvider();
const fixture = isolatedMemoryEnv({
  NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
  A008_PLATFORM_SCAN_MS: "40",
  A008_PLATFORM_LEASE_MS: "4000",
  A008_PLATFORM_RENEW_MS: "400",
  A008_PLATFORM_TURN_TIMEOUT_MS: "20000",
  A008_PLATFORM_SHUTDOWN_DRAIN_MS: "4000",
});
fixture.env.PATH = process.env.PATH;
fixture.env.A008_DEVICES_PATH = join(fixture.directory, "devices.sqlite");
fixture.env.A008_PROJECTS_PATH = join(fixture.directory, "projects.json");
fixture.env.A008_CATALOG_PATH = join(fixture.directory, "catalog.json");
fixture.env.A008_SECRETS_PATH = join(fixture.directory, "secrets.json");
fixture.env.A008_PLATFORM_PATH = join(fixture.directory, "platform.sqlite");
const platformPath = fixture.env.A008_PLATFORM_PATH;
let host;
try {
  const project = executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: "platform-gui",
      rootFolder: join(fixture.directory, "platform-gui"),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: fixture.env.A008_PROJECTS_PATH },
  ).project;
  const grant = new DeviceRegistry(fixture.env).grant({
    name: "platform-gui",
    projects: [project.projectId],
    capabilities: ["session"],
  });
  host = await startGuiHost({
    env: fixture.env,
    port: 0,
    cwd: fixture.directory,
    platformPath,
  });
  process.stdout.write(
    `${JSON.stringify({
      port: host.port,
      credential: grant.credential,
      projectId: project.projectId,
      model: DEFAULT_MODEL_ID,
      prompt,
      platformPath,
      platformFileExisted: existsSync(platformPath),
    })}\n`,
  );
  process.stdin.resume();
  await new Promise((resolve) => {
    process.stdin.once("end", resolve);
    process.stdin.once("close", resolve);
  });
  const summary = {
    chatCount: chatCount(provider.requests),
    platformFileExisted: existsSync(platformPath),
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await host?.close();
  await provider.close();
  rmSync(fixture.directory, { recursive: true, force: true });
}
