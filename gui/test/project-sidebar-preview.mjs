// Actual host + production GUI using disposable synthetic projects and no live providers.
// Run after root and GUI builds: node gui/test/project-sidebar-preview.mjs
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { isolatedMemoryEnv } from "../../dist/test/helpers.js";
import { startGuiHost } from "../../dist/src/gui-host/server.js";
import { ProjectRuntimeRegistry } from "../../dist/src/engine/project-runtime-registry.js";
import { ProjectConversationStateStore } from "../../dist/src/runtime/conversation-state-store.js";
import { writeProjectRegistry } from "../../dist/src/bootstrap/registry.js";
import { DEFAULT_MODEL_ID } from "../../dist/src/core/model-registry.js";

const fixture = isolatedMemoryEnv({
  A008_CHAT_TRANSPORT: "direct",
  NVIDIA_CHAT_COMPLETIONS_URL: "http://127.0.0.1:1/no-provider",
});
const projects = [
  "A008",
  "oldschool",
  "docs first cp",
  "A008 · Memory module",
  ...Array.from({ length: 14 }, (_, i) => `Example project ${i + 1}`),
].map((name, i) => {
  const rootFolder = join(fixture.directory, `project-${i}`);
  mkdirSync(rootFolder);
  const projectId = `A008_v1_project_${randomUUID()}`;
  const project = {
    projectId,
    name,
    rootFolder,
    createdAt: new Date().toISOString(),
    repository: { initialize: false, name },
    continuity: { docsFirst: false, multiAgent: { enabled: false } },
    memory: { useGlobalA008Memory: true },
  };
  if (i < 3) {
    const store = new ProjectConversationStateStore(
      fixture.sqlitePath,
      projectId,
    );
    for (const title of i === 0
      ? ["Felsök anslutningens reload", "Bygg memory-vyer i GUI"]
      : ["Förbered nästa uppgift"]) {
      store.save({
        conversationId: `A008_v1_conversation_${randomUUID()}`,
        model: DEFAULT_MODEL_ID,
        messages: [
          { role: "user", content: title },
          {
            role: "assistant",
            content:
              "Synthetic saved conversation. This preview uses only temporary fixture data.",
          },
        ],
      });
    }
    store.close();
  }
  return project;
});
const projectsPath = join(fixture.directory, "projects.json");
writeProjectRegistry(projectsPath, { version: 1, currentId: null, projects });
const env = {
  ...fixture.env,
  A008_CATALOG_PATH: join(fixture.directory, "catalog.json"),
};
const registry = new ProjectRuntimeRegistry({ env });
const host = await startGuiHost({
  env,
  projectRegistry: registry,
  cwd: projects[0].rootFolder,
  host: "127.0.0.1",
  port: 5195,
  staticDir: resolve("gui/dist"),
  projectsPath,
  catalogPath: join(fixture.directory, "catalog.json"),
  secretsPath: join(fixture.directory, "secrets.json"),
  sourceStorePath: join(fixture.directory, "sources"),
});
console.log(`Synthetic project sidebar: http://127.0.0.1:${host.port}`);
async function close() {
  await host.close();
  await registry.close();
  const target = resolve(fixture.directory);
  if (
    target.startsWith(resolve(tmpdir()) + "\\") ||
    target.startsWith(resolve(tmpdir()) + "/")
  )
    rmSync(target, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
