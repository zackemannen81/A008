import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

export interface SpawnedPlatformHost {
  readonly child: ChildProcess;
  stderr(): string;
  readonly exited: Promise<number | null>;
}

export interface RunningPlatformHost extends SpawnedPlatformHost {
  readonly port: number;
  /** Abrupt process death. This is not a graceful host close. */
  kill(): Promise<number | null>;
  close(): Promise<void>;
}

const serverPath = fileURLToPath(
  new URL("../../src/gui-host/server.js", import.meta.url),
);

/** Real GUI-host OS process. The caller supplies an isolated env. */
export function spawnPlatformHost(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly port?: number;
}): SpawnedPlatformHost {
  let stderr = "";
  const child = spawn(
    process.execPath,
    [
      serverPath,
      "--host",
      "127.0.0.1",
      "--port",
      String(options.port ?? 0),
    ],
    {
      env: options.env,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code));
  });
  return {
    child,
    stderr: () => stderr,
    exited,
  };
}

export async function startPlatformHostProcess(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly port?: number;
  readonly timeoutMs?: number;
}): Promise<RunningPlatformHost> {
  const spawned = spawnPlatformHost(options);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const port = await Promise.race([
    new Promise<number>((resolve, reject) => {
      const timer = setInterval(() => {
        const match =
          /A008-gui-host listening on http:\/\/127\.0\.0\.1:(\d+)/u.exec(
            spawned.stderr(),
          );
        if (match?.[1] !== undefined) {
          clearInterval(timer);
          resolve(Number(match[1]));
        }
      }, 20);
      void spawned.exited.then((code) => {
        clearInterval(timer);
        reject(
          new Error(
            `Platform host exited before listening (${String(code)}): ${spawned.stderr()}`,
          ),
        );
      });
    }),
    new Promise<number>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Timed out starting platform host: ${spawned.stderr()}`)),
        timeoutMs,
      );
    }),
  ]);
  return {
    ...spawned,
    port,
    async kill() {
      if (spawned.child.exitCode !== null || spawned.child.signalCode !== null) {
        return spawned.exited;
      }
      spawned.child.kill();
      return Promise.race([
        spawned.exited,
        new Promise<number | null>((resolve) => {
          setTimeout(() => resolve(null), 5_000);
        }),
      ]);
    },
    async close() {
      if (spawned.child.exitCode !== null || spawned.child.signalCode !== null) return;
      spawned.child.kill();
      await Promise.race([
        once(spawned.child, "exit").then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    },
  };
}
