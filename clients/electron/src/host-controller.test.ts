import assert from "node:assert/strict";
import test from "node:test";
import { ensureHost, probeHost, resolveHostEndpoint, type HostEndpoint, type HostProcess, type Probe } from "./host-controller.ts";

function fakeProcess(): HostProcess & { readonly unrefCount: number } {
  const handlers = new Map<string, ((...args: never[]) => void)[]>();
  const proc = {
    unrefCount: 0,
    unref() { this.unrefCount += 1; },
    once(event: string, listener: (...args: never[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]); return this;
    },
    emit(event: string, ...args: never[]) { for (const listener of handlers.get(event) ?? []) listener(...args); },
  };
  return proc as unknown as HostProcess & { readonly unrefCount: number };
}

const endpoint = resolveHostEndpoint({});
test("resolves loopback endpoints and rejects non-loopback/invalid ports", () => {
  assert.deepEqual(endpoint, { host: "127.0.0.1", port: 8787, origin: "http://127.0.0.1:8787" });
  assert.equal(resolveHostEndpoint({ A008_GUI_HOST_BIND: "::1", A008_GUI_HOST_PORT: "9000" }).origin, "http://[::1]:9000");
  assert.throws(() => resolveHostEndpoint({ A008_GUI_HOST_BIND: "192.0.2.1" }), /loopback/u);
  assert.throws(() => resolveHostEndpoint({ A008_GUI_HOST_PORT: "70000" }), /port/u);
});

test("requires A008 host identity and its HTML GUI landing surface", async () => {
  const calls: string[] = [];
  const fetchMock: typeof fetch = async (input) => {
    calls.push(String(input));
    if (String(input).endsWith("/health")) return Response.json({ ok: true, name: "A008-gui-host" });
    return new Response("<!doctype html><html><title>A008</title></html>", { headers: { "content-type": "text/html" } });
  };
  assert.deepEqual(await probeHost(endpoint, 100, fetchMock), { kind: "compatible", origin: endpoint.origin });
  assert.equal(calls.length, 2);
  assert.equal((await probeHost(endpoint, 100, async () => Response.json({ ok: true, name: "other" }))).kind, "incompatible");
});

test("reuses healthy host without spawn", async () => {
  let starts = 0;
  const ready = await ensureHost({ endpoint, probe: async () => ({ kind: "compatible", origin: endpoint.origin }), startHost: () => { starts += 1; return fakeProcess(); } });
  assert.equal(ready.bootstrapped, false); assert.equal(starts, 0);
});

test("starts one host and waits for readiness", async () => {
  let probes = 0; let starts = 0; let child: HostProcess & { readonly unrefCount: number } | undefined;
  const probe: Probe = async () => ++probes < 3 ? { kind: "unavailable", reason: "not ready" } : { kind: "compatible", origin: endpoint.origin };
  const ready = await ensureHost({ endpoint, probe, pollMs: 1, startHost: () => { starts += 1; child = fakeProcess(); return child; } });
  assert.equal(ready.bootstrapped, true); assert.equal(probes, 3); assert.equal(starts, 1); assert.equal(child?.unrefCount, 1);
});

test("rejects an incompatible incumbent without starting another host", async () => {
  let starts = 0;
  await assert.rejects(ensureHost({ endpoint, probe: async () => ({ kind: "incompatible", reason: "wrong service" }), startHost: () => { starts += 1; return fakeProcess(); } }), /wrong service/u);
  assert.equal(starts, 0);
});