import { isIP } from "node:net";

export const GUI_HOST_NAME = "A008-gui-host";
export const DEFAULT_GUI_HOST_BIND = "127.0.0.1";
export const DEFAULT_GUI_HOST_PORT = 8787;

export interface HostEndpoint {
  readonly host: string;
  readonly port: number;
  readonly origin: string;
}

export type HostProbeResult =
  | { readonly kind: "compatible"; readonly origin: string }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "incompatible"; readonly reason: string };

export interface HostProcess {
  readonly exitCode?: number | null;
  readonly signalCode?: NodeJS.Signals | null;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  unref(): void;
}

export type Probe = (endpoint: HostEndpoint, timeoutMs: number) => Promise<HostProbeResult>;
export type StartHost = (endpoint: HostEndpoint) => HostProcess;

export function resolveHostEndpoint(env: NodeJS.ProcessEnv): HostEndpoint {
  const configuredHost = env.A008_GUI_HOST_BIND?.trim() || DEFAULT_GUI_HOST_BIND;
  const host = configuredHost === "0.0.0.0" || configuredHost === "::"
    ? configuredHost === "::" ? "::1" : "127.0.0.1"
    : configuredHost.replace(/^\[|\]$/gu, "");
  if (!isLoopbackHost(host)) throw new Error("A008 GUI host must use a loopback address.");
  const configuredPort = env.A008_GUI_HOST_PORT?.trim();
  const port = configuredPort ? Number(configuredPort) : DEFAULT_GUI_HOST_PORT;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
    throw new Error("A008 GUI host port must be an integer from 1 to 65535.");
  const authorityHost = host.includes(":") ? `[${host}]` : host;
  return { host, port, origin: `http://${authorityHost}:${port}` };
}

function isLoopbackHost(host: string): boolean {
  if (host.toLowerCase() === "localhost") return true;
  const family = isIP(host);
  return family === 4 ? host.startsWith("127.") : family === 6 && host.toLowerCase() === "::1";
}

export async function probeHost(
  endpoint: HostEndpoint,
  timeoutMs = 1_500,
  fetchImpl: typeof fetch = fetch,
): Promise<HostProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const health = await fetchImpl(`${endpoint.origin}/health`, {
      method: "GET", cache: "no-store", redirect: "manual", signal: controller.signal,
    });
    if (!health.ok) return { kind: "incompatible", reason: `Health returned HTTP ${health.status}.` };
    const identity: unknown = await health.json();
    if (!isRecord(identity) || identity.ok !== true || identity.name !== GUI_HOST_NAME)
      return { kind: "incompatible", reason: "Endpoint is not an A008 GUI host." };
    const landing = await fetchImpl(`${endpoint.origin}/`, {
      method: "GET", cache: "no-store", redirect: "manual", signal: controller.signal,
    });
    const type = landing.headers.get("content-type") ?? "";
    if (!landing.ok || !type.toLowerCase().includes("text/html"))
      return { kind: "incompatible", reason: "A008 GUI landing page is unavailable." };
    const html = await landing.text();
    if (!/<html(?:\s|>)/iu.test(html) || !/A008/iu.test(html))
      return { kind: "incompatible", reason: "Endpoint does not serve the A008 GUI." };
    return { kind: "compatible", origin: endpoint.origin };
  } catch (error) {
    return { kind: "unavailable", reason: error instanceof Error ? error.message : "Host probe failed." };
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureHost(options: {
  readonly endpoint: HostEndpoint;
  readonly probe: Probe;
  readonly startHost: StartHost;
  readonly timeoutMs?: number;
  readonly pollMs?: number;
}): Promise<{ readonly origin: string; readonly bootstrapped: boolean }> {
  const initial = await options.probe(options.endpoint, 1_500);
  if (initial.kind === "compatible") return { origin: initial.origin, bootstrapped: false };
  if (initial.kind === "incompatible") throw new Error(initial.reason);

  const child = options.startHost(options.endpoint);
  child.unref();
  let childFailure: string | undefined;
  child.once("error", (error) => { childFailure = error.message; });
  child.once("exit", (code, signal) => {
    childFailure = `A008 GUI host exited before readiness (code ${String(code)}, signal ${String(signal)}).`;
  });

  const deadline = Date.now() + (options.timeoutMs ?? 20_000);
  do {
    const result = await options.probe(options.endpoint, 1_500);
    if (result.kind === "compatible") return { origin: result.origin, bootstrapped: true };
    if (result.kind === "incompatible") throw new Error(result.reason);
    if (childFailure) {
      const incumbent = await options.probe(options.endpoint, 1_500);
      if (incumbent.kind === "compatible") return { origin: incumbent.origin, bootstrapped: false };
      throw new Error(`${childFailure}${options.endpoint ? ` ${result.reason}` : ""}`);
    }
    await delay(options.pollMs ?? 150);
  } while (Date.now() < deadline);

  const finalProbe = await options.probe(options.endpoint, 1_500);
  if (finalProbe.kind === "compatible") return { origin: finalProbe.origin, bootstrapped: true };
  throw new Error(`A008 GUI host did not become ready: ${finalProbe.reason}`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}