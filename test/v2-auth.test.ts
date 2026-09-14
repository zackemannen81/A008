import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { v2ErrorSchema, v2InfoSchema, v2TicketResponseSchema } from "../packages/protocol/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { createPinAuthGate } from "../src/gui-host/pin-auth.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { V2Auth, V2AuthError } from "../src/gui-host/v2-auth.js";
import { isolatedMemoryEnv, TEST_PROJECT_ID } from "./helpers.js";

const request = (credential?: string) => ({ headers: credential ? { authorization: `Bearer ${credential}` } : {} }) as IncomingMessage;
const code = (expected: string) => (error: unknown) => error instanceof V2AuthError && error.code === expected;
function fixture() {
  const f = isolatedMemoryEnv(); f.env.A008_DEVICES_PATH = join(f.directory, "devices.sqlite"); f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json"); return f;
}

test("actual local device CLI grants once, stores only hashes and observes expiry/revocation across reopen", () => {
  const f = fixture(), cli = fileURLToPath(new URL("../src/gui-host/device-cli.js", import.meta.url));
  const run = (args: string[]) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { env: { ...process.env, ...f.env }, encoding: "utf8" })) as any;
  try {
    const devices = new DeviceRegistry(f.env);
    assert.equal(devices.list().length, 0); assert.equal(existsSync(devices.path), false);
    const grant = run(["grant", "--name", "Fixture phone", "--project", TEST_PROJECT_ID, "--capability", "session"]);
    assert.ok(typeof grant.credential === "string" && /^a008_device_[A-Za-z0-9_-]{43}$/u.test(grant.credential));
    assert.equal(grant.device.expiresAt - grant.device.createdAt, 30 * 86_400_000);
    assert.ok(!readFileSync(devices.path).includes(Buffer.from(grant.credential)));
    assert.ok(!JSON.stringify(run(["list"])).includes(grant.credential));
    assert.ok(new DeviceRegistry(f.env).authenticate(grant.credential));
    assert.equal(new DeviceRegistry(f.env, () => grant.device.expiresAt).authenticate(grant.credential), undefined);
    assert.equal(run(["revoke", grant.device.id]).revoked, true);
    assert.equal(devices.authenticate(grant.credential), undefined);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("tickets enforce scope, expiry, one use, revocation, session validation and bounded allocation", () => {
  const f = fixture(); let now = 1000;
  const devices = new DeviceRegistry(f.env, () => now);
  const auth = new V2Auth({ devices, pin: createPinAuthGate(undefined), projectExists: id => id === TEST_PROJECT_ID, now: () => now });
  try {
    assert.throws(() => auth.authenticate(request()), code("UNAUTHENTICATED"));
    const grant = devices.grant({ name: "Fixture", projects: [TEST_PROJECT_ID], capabilities: ["session"] });
    const principal = auth.authenticate(request(grant.credential));
    assert.throws(() => auth.authorize(principal, TEST_PROJECT_ID, "shell"), code("FORBIDDEN"));
    assert.throws(() => auth.issue(principal, { projectId: "A008_v1_project_40000000-0000-4000-8000-000000000099" }), code("FORBIDDEN"));
    assert.throws(() => auth.issue(principal, { projectId: TEST_PROJECT_ID, sessionId: "foreign" }), code("SESSION_EXPIRED"));
    const first = auth.issue(principal, { projectId: TEST_PROJECT_ID });
    assert.equal(auth.consume(first.ticket).principal.id, principal.id);
    assert.throws(() => auth.consume(first.ticket), code("UNAUTHENTICATED"));
    const expired = auth.issue(principal, { projectId: TEST_PROJECT_ID }); now += 30_000;
    assert.throws(() => auth.consume(expired.ticket), code("UNAUTHENTICATED"));
    const revoked = auth.issue(principal, { projectId: TEST_PROJECT_ID }); devices.revoke(principal.id);
    assert.throws(() => auth.consume(revoked.ticket), code("UNAUTHENTICATED"));
    const next = devices.grant({ name: "Capacity fixture", projects: [TEST_PROJECT_ID], capabilities: ["session"] });
    const second = auth.authenticate(request(next.credential));
    for (let i = 0; i < 128; i++) auth.issue(second, { projectId: TEST_PROJECT_ID });
    assert.throws(() => auth.issue(second, { projectId: TEST_PROJECT_ID }), code("CAPACITY_EXCEEDED"));
    now += 30_000; assert.ok(auth.issue(second, { projectId: TEST_PROJECT_ID }));
  } finally { auth.clear(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("real V2 discovery/ticket routes require app auth, registered scope and Origin while v1 stays available", async () => {
  const f = fixture();
  const created = executeProjectBootstrap(parseProjectBootstrapConfig({ projectName: "Auth fixture", rootFolder: join(f.directory, "project"), repository: { initialize: false }, continuity: { docsFirst: false, multiAgent: { enabled: false } }, memory: { useGlobalA008Memory: false } }), { registryPath: f.env.A008_PROJECTS_PATH! });
  const devices = new DeviceRegistry(f.env), projectId = created.project.projectId;
  const grant = devices.grant({ name: "Host fixture", projects: [projectId], capabilities: ["session"] });
  const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
  const root = `http://127.0.0.1:${host.port}`;
  const ticket = (headers: Record<string, string>, payload: unknown = { projectId }) => fetch(`${root}/v2/auth/ticket`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  try {
    const info = await (await fetch(`${root}/v2/info`)).json(); assert.ok(v2InfoSchema.safeParse(info).success);
    assert.ok(!JSON.stringify(info).includes(f.directory)); assert.ok(!JSON.stringify(info).includes(projectId));
    assert.equal((await fetch(`${root}/v1/models`)).status, 200);
    const anonymous = await ticket({}); assert.equal(anonymous.status, 401); assert.ok(v2ErrorSchema.safeParse(await anonymous.json()).success);
    const headers = { authorization: `Bearer ${grant.credential}` };
    assert.equal((await ticket({ ...headers, origin: "https://untrusted.example" })).status, 403);
    const allowed = await ticket(headers); assert.equal(allowed.status, 200); assert.ok(v2TicketResponseSchema.safeParse(await allowed.json()).success);
    assert.equal((await ticket(headers, { projectId, sessionId: "missing" })).status, 404);
    devices.revoke(grant.device.id); assert.equal((await ticket(headers)).status, 401);
  } finally { await host.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("configured PIN cookie grants V2 owner profile; invalid Bearer never falls back to cookie", async () => {
  const f = fixture();
  const created = executeProjectBootstrap(parseProjectBootstrapConfig({ projectName: "PIN fixture", rootFolder: join(f.directory, "project"), repository: { initialize: false }, continuity: { docsFirst: false, multiAgent: { enabled: false } }, memory: { useGlobalA008Memory: false } }), { registryPath: f.env.A008_PROJECTS_PATH! });
  const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory, pin: "123456" });
  const root = `http://127.0.0.1:${host.port}`;
  try {
    const login = await fetch(`${root}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: "123456" }) });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const send = (authorization?: string) => fetch(`${root}/v2/auth/ticket`, { method: "POST", headers: { cookie, "content-type": "application/json", ...(authorization ? { authorization } : {}) }, body: JSON.stringify({ projectId: created.project.projectId }) });
    assert.equal((await send()).status, 200); assert.equal((await send("Bearer invalid")).status, 401);
  } finally { await host.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
