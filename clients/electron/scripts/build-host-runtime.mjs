import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const electronRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(electronRoot, "../..");
const artifactRoot = join(electronRoot, "artifacts");
const stagedRuntime = join(artifactRoot, "a008-engine-win32-x64");
const scratchRoot = mkdtempSync(join(tmpdir(), "a008-electron-runtime-"));
const engineOutput = join(scratchRoot, "a008-engine-win32-x64");
try {
  const npmCommand = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const npmArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm", "run", "package:engine", "--", engineOutput]
    : ["run", "package:engine", "--", engineOutput];
  execFileSync(npmCommand, npmArgs, {
    cwd: repositoryRoot,
    env: { ...process.env, npm_execpath: join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js") },
    stdio: "inherit",
  });
  if (!existsSync(join(engineOutput, "runtime", "node.exe")) ||
      !existsSync(join(engineOutput, "dist", "src", "gui-host", "server.js")) ||
      !existsSync(join(engineOutput, "gui", "dist", "index.html"))) {
    throw new Error("Portable Windows x64 GUI host runtime is incomplete.");
  }
  mkdirSync(artifactRoot, { recursive: true });
  rmSync(stagedRuntime, { recursive: true, force: true });
  cpSync(engineOutput, stagedRuntime, { recursive: true });
  console.log(`Staged Windows x64 host resources: ${stagedRuntime}`);
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}