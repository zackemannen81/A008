import { ProjectRuntimeRegistry } from "../../src/engine/project-runtime-registry.js";
import { createLocalMemoryRuntime, type LocalMemoryRuntime } from "../../src/runtime/local-memory-runtime.js";
let registry: ProjectRuntimeRegistry | undefined;
let runtime: LocalMemoryRuntime | undefined;
process.on("message", (message: {
  action: "open" | "close";
  env: NodeJS.ProcessEnv;
  cwd: string;
  existing?: { projectId: string; sqlitePath: string };
  direct?: "cli" | "acp";
}) => {
  if (message.action === "close") {
    registry?.close(); runtime?.close(); process.disconnect(); return;
  }
  try {
    if (message.direct) {
      runtime = createLocalMemoryRuntime({ env: message.env, surface: message.direct });
      process.send?.({ ok: true, projectId: runtime.projectId }); return;
    }
    registry = new ProjectRuntimeRegistry({ env: message.env });
    const project = message.existing
      ? registry.attachExisting({ cwd: message.cwd, ...message.existing })
      : registry.openEngine(message.cwd);
    process.send?.({ ok: true, projectId: project.runtime.projectId });
  } catch (error) { process.send?.({ ok: false, error: String(error) }); }
});
