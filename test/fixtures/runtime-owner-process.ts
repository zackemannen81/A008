import { ProjectRuntimeRegistry } from "../../src/engine/project-runtime-registry.js";
let registry: ProjectRuntimeRegistry | undefined;
process.on("message", (message: {
  action: "open" | "close";
  env: NodeJS.ProcessEnv;
  cwd: string;
  existing?: { projectId: string; sqlitePath: string };
}) => {
  if (message.action === "close") {
    registry?.close(); process.disconnect(); return;
  }
  try {
    registry = new ProjectRuntimeRegistry({ env: message.env });
    const project = message.existing
      ? registry.attachExisting({ cwd: message.cwd, ...message.existing })
      : registry.openEngine(message.cwd);
    process.send?.({ ok: true, projectId: project.runtime.projectId });
  } catch (error) { process.send?.({ ok: false, error: String(error) }); }
});
