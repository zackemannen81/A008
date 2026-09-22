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
    if (folder === "./packages/protocol") {
      const files = new Set(result[0].files.map((file) => file.path));
      for (const required of [
        "dist/index.js",
        "dist/index.d.ts",
        "README.md",
        "LICENSE",
        "fixtures/v1-compatibility.json",
        "fixtures/v1-http-compatibility.json",
        "schemas/http.openapi.json",
        "schemas/v2-auth.openapi.json",
        "schemas/v2-authenticate.schema.json",
        "schemas/platform-v3.openapi.json",
        ...[
          "platform-v3-info",
          "platform-v3-conversation",
          "platform-v3-run",
          "platform-v3-command-receipt",
          "platform-v3-event",
          "platform-v3-error",
          "platform-v3-error-response",
          "platform-v3-conversation-list-response",
          "platform-v3-conversation-create-request",
          "platform-v3-conversation-response",
          "platform-v3-run-create-request",
          "platform-v3-run-create-response",
          "platform-v3-run-response",
          "platform-v3-run-cancel-request",
          "platform-v3-events-query",
          "platform-v3-events-response",
        ].map((name) => `schemas/${name}.schema.json`),
        ...[
          "v2-session-client-frame",
          "v2-session-command",
          "v2-session-state",
          "v2-session-authenticated",
          "v2-session-result",
          "v2-session-signal",
          "v2-session-server-frame",
        ].map((name) => `schemas/${name}.schema.json`),
        ...[
          "clientMessage",
          "serverMessage",
          "hostServerMessage",
          "sessionSnapshot",
          "modelsResponse",
        ].map((name) => `schemas/${name}.schema.json`),
      ]) {
        assert.ok(files.has(required), `Protocol tarball missing ${required}`);
      }
    }
    return join(directory, result[0].filename);
  };
  const protocol = pack("./packages/protocol");
  const zod = pack("./node_modules/zod");
  const consumer = join(directory, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "isolated-a008-consumer",
      private: true,
      type: "module",
    }),
  );
  // Install both tarballs, not source links; no registry, scripts or user data.
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
      zod,
    ],
    { cwd: consumer, stdio: "pipe" },
  );
  writeFileSync(
    join(consumer, "proof.ts"),
    `import { parseClientMessage, parseServerMessage, clientMessageSchema, validateV1HttpResponse, parseUploadedSource, v1OpenApiDocument, v2TicketRequestSchema, v2AuthOpenApiDocument, v2CommandReceiptSchema, v2ResumeCapabilitySchema, v2SessionCommandSchema, v2SessionServerFrameSchema, platformV3RunCreateRequestSchema, platformV3OpenApiDocument, type ClientMessage, type UploadedSource, type V2SessionCommand, type PlatformV3RunCreateRequest } from '@a008/protocol';
const input: ClientMessage = { type: 'prompt', requestId: 'r', sessionId: 's', text: 'fixture' };
if (!clientMessageSchema.safeParse(input).success || 'error' in parseClientMessage(JSON.stringify(input))) throw new Error('command failed');
if (parseServerMessage({type:'prompt/ok',requestId:'r',sessionId:'s'})?.type !== 'prompt/ok') throw new Error('reply failed');
const upload: UploadedSource = {locator:'source:synthetic',sha256:'synthetic',bytes:0,mediaType:'text/plain',extracted:false};
if (parseUploadedSource(upload).extracted || !validateV1HttpResponse('POST','/v1/upload',200,upload)) throw new Error('HTTP contract failed');
if (!v1OpenApiDocument().paths['/v1/upload']?.post) throw new Error('HTTP description missing');
const v2OpenApi = v2AuthOpenApiDocument();
if (!v2TicketRequestSchema.safeParse({projectId:'A008_v1_project_40000000-0000-4000-8000-000000000016'}).success || !v2OpenApi.paths['/v2/auth/ticket'].post || !v2OpenApi.paths['/v2/projects/{projectId}/commands/{commandId}'].get) throw new Error('V2 auth contract missing');
const v2: V2SessionCommand = {type:'command',requestId:'r2',commandId:'command_fixture',action:'session/new',projectId:'A008_v1_project_40000000-0000-4000-8000-000000000016'};
const resumeCapability = 'resume_abcdefghijklmnopqrstuvwxyz0123456789';
const resume: V2SessionCommand = {type:'command',requestId:'r3',commandId:'command_resume',action:'session/resume',projectId:v2.projectId,sessionId:'session_fixture',payload:{resumeCapability}};
if (!v2SessionCommandSchema.safeParse(v2).success || !v2SessionCommandSchema.safeParse(resume).success || !v2ResumeCapabilitySchema.safeParse(resumeCapability).success || !v2CommandReceiptSchema.safeParse({serverInstanceId:'server_fixture',commandId:v2.commandId,action:v2.action,projectId:v2.projectId,status:'running',startedAt:1}).success || !v2SessionServerFrameSchema.safeParse({type:'result',serverInstanceId:'server_fixture',requestId:'r3',commandId:'command_resume',action:'session/resume',projectId:v2.projectId,sessionId:'session_fixture',resumeCapability}).success) throw new Error('V2 session contract missing');
const v3: PlatformV3RunCreateRequest = {commandId:'command_v3',expectedRevision:0,model:'fixture-model',text:'fixture'};
if (!platformV3RunCreateRequestSchema.safeParse(v3).success || !platformV3OpenApiDocument().paths['/v3/conversations/{conversationId}/runs']?.post) throw new Error('Platform V3 contract missing');
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
  const output = execFileSync(process.execPath, ["proof.js"], {
    cwd: consumer,
    encoding: "utf8",
  });
  assert.equal(output, "");
  console.log(
    "PASS: packed protocol + packed dependency installed offline outside A008; independent TS consumer compiled and ran.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
