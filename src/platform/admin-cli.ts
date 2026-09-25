#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import {
  bearerCredentials,
  cookieCredentials,
  createPlatformV3Client,
  PlatformV3ClientError,
  type ClientFetch,
} from "../../packages/client/src/index.js";

const COMMANDS = [
  "info",
  "list-conversations",
  "get-run",
  "cancel-run",
] as const;

type Command = (typeof COMMANDS)[number];

const USAGE =
  "Usage: platform-admin info [--origin URL]; platform-admin list-conversations --project ID [--origin URL]; platform-admin get-run --run ID [--origin URL]; platform-admin cancel-run --run ID --expected-revision N [--origin URL]. Origin is --origin or A008_PLATFORM_ORIGIN. A008_DEVICE_TOKEN is the only device credential.";

export interface PlatformAdminCliOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  readonly fetch: ClientFetch;
}

class AdminCliError extends Error {
  readonly code = "INVALID_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "AdminCliError";
  }
}

function writeJson(stream: NodeJS.WritableStream, value: unknown): void {
  stream.write(`${JSON.stringify(value)}\n`);
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function flagValue(
  args: readonly string[],
  index: number,
): { readonly value: string; readonly next: number } {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new AdminCliError("Each option needs a value.");
  }
  if (value.trim().length === 0)
    throw new AdminCliError("Each option needs a value.");
  return { value, next: index + 2 };
}

function originFrom(
  explicit: string | undefined,
  env: NodeJS.ProcessEnv,
): string {
  const raw = explicit ?? env.A008_PLATFORM_ORIGIN;
  if (raw === undefined || raw.trim().length === 0) {
    throw new AdminCliError("Origin is required.");
  }
  if (raw !== raw.trim() || /[\s@]/u.test(raw)) {
    throw new AdminCliError(
      raw.includes("@")
        ? "Origin must not contain credentials."
        : "Origin is invalid.",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AdminCliError("Origin is invalid.");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new AdminCliError("Origin must not contain credentials.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AdminCliError("Origin must be an http(s) URL.");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new AdminCliError("Origin must not contain a query or fragment.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new AdminCliError("Origin must not contain a path.");
  }
  return url.origin;
}

function deviceToken(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.A008_DEVICE_TOKEN;
  if (value === undefined || value.length === 0) return undefined;
  if (value.trim() !== value)
    throw new AdminCliError("Device token is invalid.");
  return value;
}

function revisionFrom(raw: string): number {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new AdminCliError(
      "Expected revision must be a non-negative integer.",
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new AdminCliError("Expected revision is out of range.");
  }
  return value;
}

function clientFor(
  origin: string,
  token: string | undefined,
  fetchImpl: ClientFetch,
) {
  return createPlatformV3Client({
    origin,
    fetch: fetchImpl,
    credentials:
      token === undefined ? cookieCredentials() : bearerCredentials(token),
  });
}

function fail(
  stderr: NodeJS.WritableStream,
  code: string,
  message: string,
): number {
  writeJson(stderr, { code, message });
  return 1;
}

export async function runPlatformAdminCli(
  args: readonly string[],
  options: PlatformAdminCliOptions,
): Promise<number> {
  try {
    const [command, ...rest] = args;
    if (command === undefined || !isCommand(command)) {
      throw new AdminCliError(USAGE);
    }
    let originFlag: string | undefined;
    let project: string | undefined;
    let run: string | undefined;
    let expectedRevision: string | undefined;
    for (let index = 0; index < rest.length;) {
      const key = rest[index];
      if (key === undefined || !key.startsWith("--"))
        throw new AdminCliError(USAGE);
      const parsed = flagValue(rest, index);
      if (key === "--origin" && originFlag === undefined)
        originFlag = parsed.value;
      else if (key === "--project" && project === undefined)
        project = parsed.value;
      else if (key === "--run" && run === undefined) run = parsed.value;
      else if (
        key === "--expected-revision" &&
        expectedRevision === undefined
      ) {
        expectedRevision = parsed.value;
      } else throw new AdminCliError("Unknown or duplicate option.");
      index = parsed.next;
    }
    const origin = originFrom(originFlag, options.env);
    if (command === "info") {
      if (
        project !== undefined ||
        run !== undefined ||
        expectedRevision !== undefined
      ) {
        throw new AdminCliError("Unknown or duplicate option.");
      }
      const info = await clientFor(origin, undefined, options.fetch).info();
      writeJson(options.stdout, {
        available: info.available,
        capabilities: info.capabilities,
      });
      return 0;
    }
    const token = deviceToken(options.env);
    const client = clientFor(origin, token, options.fetch);
    if (command === "list-conversations") {
      if (
        project === undefined ||
        run !== undefined ||
        expectedRevision !== undefined
      ) {
        throw new AdminCliError(
          project === undefined
            ? "list-conversations requires --project."
            : "Unknown or duplicate option.",
        );
      }
      const listed = await client.listConversations(project);
      writeJson(options.stdout, { conversations: listed.conversations });
      return 0;
    }
    if (run === undefined)
      throw new AdminCliError(`${command} requires --run.`);
    if (project !== undefined)
      throw new AdminCliError("Unknown or duplicate option.");
    if (command === "get-run") {
      if (expectedRevision !== undefined) {
        throw new AdminCliError("Unknown or duplicate option.");
      }
      const loaded = await client.getRun(run);
      writeJson(options.stdout, { run: loaded.run });
      return 0;
    }
    if (expectedRevision === undefined) {
      throw new AdminCliError("cancel-run requires --expected-revision.");
    }
    const cancelled = await client.cancelRun(run, {
      expectedRevision: revisionFrom(expectedRevision),
    });
    writeJson(options.stdout, { run: cancelled.run });
    return 0;
  } catch (error) {
    if (
      error instanceof PlatformV3ClientError ||
      error instanceof AdminCliError
    ) {
      return fail(options.stderr, error.code, error.message);
    }
    return fail(
      options.stderr,
      "INTERNAL_ERROR",
      "Platform admin command failed.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void runPlatformAdminCli(process.argv.slice(2), {
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
    fetch: globalThis.fetch as unknown as ClientFetch,
  }).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.stderr.write(
        `${JSON.stringify({ code: "INTERNAL_ERROR", message: "Platform admin command failed." })}\n`,
      );
      process.exitCode = 1;
    },
  );
}
