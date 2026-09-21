import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run verify:client.");
const root = resolve(".");
const directory = mkdtempSync(join(tmpdir(), "a008-client-package-"));
try {
  const pack = (folder) => {
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          npmCli,
          "pack",
          folder,
          "--json",
          "--ignore-scripts",
          "--pack-destination",
          directory,
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    if (folder === "./packages/client") {
      const files = new Set(result[0].files.map((file) => file.path));
      for (const required of [
        "dist/index.js",
        "dist/index.d.ts",
        "README.md",
        "LICENSE",
      ]) {
        assert.ok(files.has(required), `Client tarball missing ${required}`);
      }
    }
    return join(directory, result[0].filename);
  };
  const protocol = pack("./packages/protocol");
  const client = pack("./packages/client");
  const zod = pack("./node_modules/zod");
  const consumer = join(directory, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "isolated-a008-client-consumer",
      private: true,
      type: "module",
    }),
  );
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      protocol,
      client,
      zod,
    ],
    { cwd: consumer, stdio: "pipe" },
  );
  writeFileSync(
    join(consumer, "proof.ts"),
    `import { cookieCredentials, bearerCredentials, createGuiSessionClient, createV2SessionClient, V2ClientError } from '@a008/client';
const cookie = cookieCredentials();
if (cookie.kind !== 'cookie' || cookie.applySocketUrl('ws://x/v2/session').includes('access=')) throw new Error('cookie adapter leaked a secret');
const bearer = bearerCredentials('secret');
if (bearer.applySocketUrl('ws://x/v2/session').includes('secret')) throw new Error('bearer adapter put a secret in the URL');
const v1 = createGuiSessionClient({ url: 'ws://127.0.0.1:9/v1/session', credentials: cookie, createRequestId: () => 'r1' });
v1.dispose();
const v2 = createV2SessionClient({
  origin: 'http://127.0.0.1:9',
  projectId: 'A008_v1_project_40000000-0000-4000-8000-000000000016',
  credentials: bearer,
  fetch: async () => { throw new Error('no fetch'); },
  webSocket: class { url=''; readyState=3; send(){} close(){} addEventListener(){} removeEventListener(){} },
});
try { await v2.prompt('x', 'command_a'); } catch {}
try { await v2.prompt('x', 'command_a'); throw new Error('replayed'); } catch (error) {
  if (!(error instanceof V2ClientError) || error.code !== 'COMMAND_CONFLICT') throw error;
}
`,
  );
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "proof.ts",
      "--target",
      "ES2023",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--strict",
      "--skipLibCheck",
    ],
    { cwd: consumer, stdio: "pipe" },
  );
  execFileSync(process.execPath, ["proof.js"], {
    cwd: consumer,
    encoding: "utf8",
  });
  console.log(
    "PASS: packed client + protocol + dependency installed offline outside A008; independent TS consumer compiled and ran.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
