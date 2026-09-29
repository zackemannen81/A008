import { SessionIpc } from "./session-ipc.js";
import { createAcpRuntime } from "../acp/server.js";
import {
  ProjectRuntimeRegistry,
  type ProjectRuntime,
} from "../engine/project-runtime-registry.js";
import { GuiRunSession } from "./gui-run-session.js";
import {
  openPlatformTextSession,
  completePlatformTextTurn,
} from "./runtime-adapter.js";
import type { SessionProcessRun } from "./session-process.js";
import { killProcessTree } from "../tools/terminal.js";

const instanceId = process.env.A008_SESSION_INSTANCE;
if (!instanceId || !process.send)
  throw new Error("Session worker requires inherited host IPC.");
let project: ProjectRuntime | undefined;
let sessionId: string;
let cwd: string;
let running = false;
let activeRunId: string | undefined;
let gui: GuiRunSession | undefined;
let activityTail: Promise<void> = Promise.resolve();
let activityFailure: unknown;
const registry = new ProjectRuntimeRegistry({ env: process.env });
const memoryRequest = <T>(
  method: string,
  value: unknown,
  signal?: AbortSignal,
): Promise<T> => rpc.request<T>(method, { runId: activeRunId, value }, signal);
const rpc = new SessionIpc(
  {
    send: (value) => process.send?.(value as object),
    on: (_event, listener) => process.on("message", listener),
  },
  instanceId,
  async (method, payload, signal) => {
    if (method === "initialize") {
      if (project) throw new Error("Already initialized.");
      const input = payload as {
        sessionId: string;
        cwd: string;
        projectRoot: string;
        projectId: string;
      };
      if (input.cwd !== process.cwd()) {
        // Windows resolves path casing; compare using the platform's casing rules.
        if (
          process.platform !== "win32" ||
          input.cwd.toLowerCase() !== process.cwd().toLowerCase()
        )
          throw new Error("Worker CWD mismatch.");
      }
      cwd = input.cwd;
      sessionId = input.sessionId;
      const runtime = createAcpRuntime({
        env: { ...process.env, A008_PROJECT_ID: input.projectId },
        cwd,
        stderr: process.stderr,
        remoteMemory: (conversationId) => ({
          reader: {
            read: (request, options) =>
              memoryRequest("memory.read", request, options?.signal),
          },
          coordinator: {
            process: (input, options) =>
              memoryRequest(
                "memory.process",
                { conversationId, input },
                options?.signal,
              ),
            repairAndResume: async () => {
              throw new Error("Memory index repair is owned by the host.");
            },
          },
        }),
        memoryAccess: {
          inspectMemory: (input) => memoryRequest("memory.inspect", input),
          sharedMemoryCapabilities: () =>
            memoryRequest("memory.capabilities", {}),
          recallSharedMemory: (input) => memoryRequest("memory.recall", input),
          writeSharedMemory: (input) => memoryRequest("memory.write", input),
          ingestSource: (input) => memoryRequest("memory.ingest", input),
        },
      });
      project = {
        ...runtime,
        cwd: input.projectRoot,
        binding: {
          cwd: input.projectRoot,
          projectId: input.projectId,
          sqlitePath: ":host-owned:",
        },
      };
      return { processId: process.pid };
    }
    if (method === "permission") {
      const input = payload as { runId: string; id: string; allow: boolean };
      if (!running || input.runId !== activeRunId) return false;
      return gui?.permission(input.id, input.allow) ?? false;
    }
    if (method !== "run" || !project)
      throw new Error("Unsupported or uninitialized session operation.");
    if (running) throw new Error("Session already has an active run.");
    running = true;
    activityTail = Promise.resolve();
    activityFailure = undefined;
    try {
      const run = payload as SessionProcessRun;
      activeRunId = run.runId;
      if (run.tools) {
        gui = new GuiRunSession({
          project,
          registry,
          env: process.env,
          cwd,
          model: run.model,
          parameters: run.parameters,
          recoveryRequired: run.recoveryRequired ?? false,
          conversationId: sessionId,
          history: run.history,
          onActivity: (activity) => {
            activityTail = activityTail.then(async () => {
              if (activityFailure !== undefined) return;
              try {
                await rpc.request("activity", {
                  runId: run.runId,
                  value: activity,
                });
              } catch (error) {
                activityFailure = error;
              }
            });
          },
          continuationCheckpoint: async (checkpoint) => {
            await activityTail;
            if (activityFailure !== undefined) throw activityFailure;
            await rpc.request("continuation.checkpoint", {
              runId: run.runId,
              value: checkpoint,
            });
          },
        });
        return await gui.complete(run.text, signal, run.attachment);
      }
      const session = openPlatformTextSession({
        runtime: project.runtime,
        model: run.model,
        conversationId: sessionId,
        history: run.history,
        cwd,
        parameters: run.parameters,
      });
      const imageAttachment =
        run.attachment === undefined
          ? undefined
          : project.runtime.resolveImageAttachment(run.attachment.locator);
      return await completePlatformTextTurn(
        session,
        run.text,
        signal,
        imageAttachment === undefined ? undefined : [imageAttachment],
      );
    } finally {
      running = false;
      activeRunId = undefined;
      gui = undefined;
    }
  },
);
process.on("disconnect", () => {
  rpc.close();
  // Terminate this owned process tree, including a tool that outlived IPC.
  killProcessTree(process.pid);
});
