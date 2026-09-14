import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run verify:protocol.");
const root = resolve(".");
const directory = mkdtempSync(join(tmpdir(), "a008-protocol-package-"));
try {
  const pack = folder => {
    const result = JSON.parse(execFileSync(process.execPath, [npmCli, "pack", folder, "--json", "--ignore-scripts", "--pack-destination", directory], { cwd: root, encoding: "utf8" }));
    if (folder === "./packages/protocol") {
      const files = new Set(result[0].files.map(file => file.path));
      for (const required of ["dist/index.js", "dist/index.d.ts", "README.md", "LICENSE", "fixtures/v1-compatibility.json", "fixtures/v1-http-compatibility.json", "schemas/http.openapi.json",
        ...["clientMessage", "serverMessage", "hostServerMessage", "sessionSnapshot", "modelsResponse"].map(name => `schemas/${name}.schema.json`)]) {
        assert.ok(files.has(required), `Protocol tarball missing ${required}`);
      }
    }
    return join(directory, result[0].filename);
  };
  const protocol = pack("./packages/protocol");
  const zod = pack("./node_modules/zod");
  const consumer = join(directory, "consumer"); mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "isolated-a008-consumer", private: true, type: "module" }));
  // Install both tarballs, not source links; no registry, scripts or user data.
  execFileSync(process.execPath, [npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", protocol, zod], { cwd: consumer, stdio: "pipe" });
  writeFileSync(join(consumer, "proof.ts"), `import { parseClientMessage, parseServerMessage, clientMessageSchema, validateV1HttpResponse, parseUploadedSource, v1OpenApiDocument, type ClientMessage, type UploadedSource } from '@a008/protocol';
const input: ClientMessage = { type: 'prompt', requestId: 'r', sessionId: 's', text: 'fixture' };
if (!clientMessageSchema.safeParse(input).success || 'error' in parseClientMessage(JSON.stringify(input))) throw new Error('command failed');
if (parseServerMessage({type:'prompt/ok',requestId:'r',sessionId:'s'})?.type !== 'prompt/ok') throw new Error('reply failed');
const upload: UploadedSource = {locator:'source:synthetic',sha256:'synthetic',bytes:0,mediaType:'text/plain',extracted:false};
if (parseUploadedSource(upload).extracted || !validateV1HttpResponse('POST','/v1/upload',200,upload)) throw new Error('HTTP contract failed');
if (!v1OpenApiDocument().paths['/v1/upload']?.post) throw new Error('HTTP description missing');
`);
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "proof.ts", "--target", "ES2023", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--strict", "--skipLibCheck"], { cwd: consumer, stdio: "pipe" });
  const output = execFileSync(process.execPath, ["proof.js"], { cwd: consumer, encoding: "utf8" });
  assert.equal(output, "");
  console.log("PASS: packed protocol + packed dependency installed offline outside A008; independent TS consumer compiled and ran.");
} finally { rmSync(directory, { recursive: true, force: true }); }
