import {
  executeShellCommand,
  formatShellHostResult,
  runShellCommand,
  SHELL_ENDPOINT,
  ShellCommandError,
} from "./run-shell-command.js";

interface FetchCall {
  readonly input: string;
  readonly method: string | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly headers: Record<string, string>;
  readonly body: string | undefined;
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers === undefined) {
    return out;
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key.toLowerCase()] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function jsonResponse(body: unknown, status = 200, statusText = ""): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "content-type": "application/json" },
  });
}

function hostResult(overrides: Partial<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}> = {}) {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    timedOut: false,
    truncated: false,
    ...overrides,
  };
}

function fakeHost(
  handler: (call: FetchCall) => Response | Promise<Response>,
): { readonly fetch: typeof fetch; readonly calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call: FetchCall = {
      input: requestUrl(input),
      method: init?.method,
      credentials: init?.credentials,
      headers: headerRecord(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return await handler(call);
  };
  return { fetch: fetchImpl, calls };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertMatch(actual: string, pattern: RegExp, message: string): void {
  if (!pattern.test(actual)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} did not match ${pattern}`);
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  check: (error: unknown) => boolean,
  message: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (!check(error)) {
      throw new Error(`${message}: rejected with unexpected value ${String(error)}`);
    }
    return;
  }
  throw new Error(`${message}: expected rejection`);
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

export async function runTerminalModuleTests(): Promise<void> {
  await runCase("posts trimmed command JSON to /v1/shell", async () => {
    const host = fakeHost(() => jsonResponse(hostResult({ stdout: "ok\n" })));
    const text = await runShellCommand("  echo ok  ", { fetch: host.fetch });
    assertEqual(host.calls.length, 1, "one fetch");
    const call = host.calls[0];
    assert(call !== undefined, "recorded call");
    assertEqual(call.input, SHELL_ENDPOINT, "endpoint");
    assertEqual(call.method, "POST", "method");
    assertEqual(call.credentials, "same-origin", "same-origin PIN cookie retained");
    assertEqual(call.headers["content-type"], "application/json", "json content-type");
    assertEqual(call.headers["accept"], "application/json", "json accept");
    assertEqual(call.headers["authorization"], undefined, "no authorization header");
    assertEqual(call.body, JSON.stringify({ command: "echo ok" }), "body");
    assertMatch(text, /exit: 0/u, "exit");
    assertMatch(text, /stdout:/u, "stdout label");
    assertMatch(text, /^ok$/m, "stdout body");
  });

  await runCase("does not execute the command in the client", async () => {
    const payload = "throw new Error('browser-exec')";
    const host = fakeHost((call) => {
      const body = JSON.parse(call.body ?? "null") as { command?: string };
      assertEqual(body.command, payload, "command forwarded");
      return jsonResponse(hostResult({ stdout: "from-host\n" }));
    });
    const text = await runShellCommand(payload, { fetch: host.fetch });
    assertMatch(text, /from-host/u, "host stdout");
    assert(!text.includes("browser-exec"), "command text is not the result");
  });

  await runCase("rejects an empty command without fetching", async () => {
    const host = fakeHost(() => jsonResponse(hostResult()));
    await assertRejects(
      () => runShellCommand("   ", { fetch: host.fetch }),
      (error) =>
        error instanceof ShellCommandError &&
        error.message === "Terminal command must not be empty.",
      "empty command",
    );
    assertEqual(host.calls.length, 0, "no fetch");
  });

  await runCase("formats stderr, timeout, truncation, and null exit", async () => {
    const result = await executeShellCommand("slow", {
      fetch: fakeHost(() =>
        jsonResponse(
          hostResult({
            stdout: "",
            stderr: "boom\n",
            exitCode: null,
            timedOut: true,
            truncated: true,
          }),
        ),
      ).fetch,
    });
    assertEqual(result.exitCode, null, "null exit");
    assertEqual(result.timedOut, true, "timedOut");
    assertEqual(result.truncated, true, "truncated");
    const text = formatShellHostResult(result);
    assertMatch(text, /exit: null \(timed out\)/u, "timed out exit");
    assertMatch(text, /output truncated/u, "truncated");
    assertMatch(text, /stderr:\nboom/u, "stderr");
  });

  await runCase("formats empty stdout and stderr as no output", async () => {
    const text = formatShellHostResult(hostResult());
    assertEqual(text, "exit: 0\n(no output)\n", "empty output");
  });

  await runCase("maps HTTP error JSON message", async () => {
    const host = fakeHost(() =>
      jsonResponse({ message: "cwd missing" }, 400, "Bad Request"),
    );
    await assertRejects(
      () => runShellCommand("pwd", { fetch: host.fetch }),
      (error) =>
        error instanceof ShellCommandError &&
        error.message === "GUI host shell failed (400): cwd missing",
      "http error",
    );
  });

  await runCase("maps network failure", async () => {
    const host = fakeHost(() => {
      throw new TypeError("Failed to fetch");
    });
    await assertRejects(
      () => runShellCommand("pwd", { fetch: host.fetch }),
      (error) =>
        error instanceof ShellCommandError &&
        error.message === "Failed to reach the A008 GUI host shell." &&
        error.cause instanceof TypeError,
      "network error",
    );
  });

  await runCase("rejects malformed host JSON", async () => {
    await assertRejects(
      () =>
        executeShellCommand("pwd", {
          fetch: fakeHost(() => jsonResponse({ stdout: 1 })).fetch,
        }),
      (error) =>
        error instanceof ShellCommandError &&
        error.message === "GUI host shell result field 'stdout' must be a string.",
      "malformed result",
    );
  });

  await runCase("never sends NVIDIA_API_KEY in the shell request", async () => {
    const host = fakeHost(() => jsonResponse(hostResult({ stdout: "ok\n" })));
    await runShellCommand("echo ok", { fetch: host.fetch });
    const call = host.calls[0];
    assert(call !== undefined, "recorded call");
    const serialized = JSON.stringify(call).toLowerCase();
    assert(!serialized.includes("nvidia_api_key"), "no key name");
    assert(!serialized.includes("authorization"), "no authorization");
  });

  console.log("9 passed");
}

function isDirectNodeRun(): boolean {
  const proc = (globalThis as { process?: { argv?: string[] } }).process;
  const argv1 = proc?.argv?.[1];
  if (typeof argv1 !== "string" || argv1.length === 0) {
    return false;
  }
  const normalized = argv1.replaceAll("\\", "/");
  return (
    normalized.endsWith("/run-shell-command.test.js") ||
    normalized.endsWith("/run-shell-command.test.ts")
  );
}

if (isDirectNodeRun()) {
  void runTerminalModuleTests().then(
    () => undefined,
    (error: unknown) => {
      console.error(error);
      const proc = (globalThis as { process?: { exit?: (code: number) => void } })
        .process;
      proc?.exit?.(1);
    },
  );
}
