/** Types for the real-host proof only. The GUI package does not depend on @types/node. */
declare module "node:child_process" {
  interface ProofStream {
    on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  }
  export interface ProofChild {
    stdout: ProofStream | null;
    stderr: ProofStream | null;
    stdin: { end(): void } | null;
    exitCode: number | null;
    kill(): void;
    on(event: "exit", listener: () => void): void;
  }
  export function spawn(
    command: string,
    args: readonly string[],
    options: {
      cwd: string;
      stdio: ["pipe", "pipe", "pipe"];
      windowsHide: boolean;
    },
  ): ProofChild;
}
