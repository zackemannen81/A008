import {
  executeShellCommand as executeShellFromClient,
  formatShellHostResult,
  SHELL_ENDPOINT,
} from "../../../packages/client/src/index.js";
export {
  ShellCommandError,
  type ShellHostResult,
} from "../../../packages/protocol/src/index.js";
export { SHELL_ENDPOINT, formatShellHostResult };
import { guiHttp } from "../client.js";

export interface RunShellCommandOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly endpoint?: string;
}

export async function executeShellCommand(
  command: string,
  options: RunShellCommandOptions = {},
) {
  void options.endpoint;
  return executeShellFromClient(guiHttp(options.fetch ?? fetch), command);
}

export async function runShellCommand(
  command: string,
  options: RunShellCommandOptions = {},
): Promise<string> {
  const result = await executeShellCommand(command, options);
  return formatShellHostResult(result);
}
