import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2] && resolve(process.argv[2]);
if (!output || existsSync(output))
  throw new Error(
    "Provide a new, nonexistent output directory outside the source repository.",
  );
const rel = relative(root, output);
if (!rel.startsWith("..") && !isAbsolute(rel))
  throw new Error("Engine output must be outside the source repository.");
for (const file of [
  "dist/src/engine/server.js",
  "gui/dist/index.html",
]) {
  if (!existsSync(join(root, file)))
    throw new Error(`Build the runtime and GUI first: missing ${file}`);
}
// npm's locked production closure, not the whole development node_modules tree.
const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error("Run with npm run package:engine -- <output-directory>.");
const packages = execFileSync(
  process.execPath,
  [npmCli, "ls", "--omit=dev", "--all", "--parseable"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const licenseUrl = `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`;
const response = await fetch(licenseUrl);
if (!response.ok)
  throw new Error(
    `Cannot obtain matching Node license: HTTP ${response.status}`,
  );
const nodeLicense = await response.text();
if (!nodeLicense.includes("Copyright Node.js contributors"))
  throw new Error("Unexpected Node license content.");
mkdirSync(output, { recursive: true });
for (const name of [
  "dist/src",
  "dist/packages/protocol/src",
  "gui/dist",
  "LICENSE",
  "agent007.brain.json",
])
  cpSync(join(root, name), join(output, name), { recursive: true });
writeFileSync(
  join(output, "README.md"),
  "# A008 portable runtime\n\nThis package contains the shared runtime and A008 web GUI.\n\nThe companion client discovers agent007.brain.json and launches the bundled Node executable. Provider credentials remain in the launching environment; user data stays outside this package.\n\nENGINE_BUILD.json records source revision, platform, runtime and dependencies. License notices remain with A008 code, dependencies, GUI and Node runtime.\n",
);
mkdirSync(join(output, "licenses"));
for (const name of ["react", "react-dom", "scheduler"])
  cpSync(
    join(root, "gui/node_modules", name, "LICENSE"),
    join(output, "licenses", `${name}.txt`),
  );
cpSync(
  join(root, "node_modules/zod/LICENSE"),
  join(output, "licenses/zod.txt"),
);
const inventory = [];
for (const source of packages) {
  const name = relative(root, source);
  if (
    !name.startsWith(`node_modules`) ||
    name.includes("..") ||
    isAbsolute(name)
  )
    throw new Error("Dependency outside the package boundary.");
  const packageJsonPath = join(source, "package.json");
  const info = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof info.name !== "string" || typeof info.version !== "string")
    throw new Error(`Invalid locked package manifest: ${name}`);
  const packageOutput = join(output, name);
  mkdirSync(dirname(packageOutput), { recursive: true });
  if (name === "node_modules/@a008/protocol") {
    cpSync(join(root, "packages/protocol"), packageOutput, { recursive: true, dereference: true });
  } else {
    cpSync(source, packageOutput, { recursive: true, dereference: true });
  }
  inventory.push({
    name: info.name,
    version: info.version,
    license: info.license ?? "See package notices",
    path: name.replaceAll("\\", "/"),
  });
}
const nodeName = process.platform === "win32" ? "node.exe" : "node";
mkdirSync(join(output, "runtime"));
cpSync(process.execPath, join(output, "runtime", nodeName));
writeFileSync(join(output, "runtime", "LICENSE"), nodeLicense);
const manifest = JSON.parse(
  readFileSync(join(output, "agent007.brain.json"), "utf8"),
);
manifest.transports[0].launch.command = `./runtime/${nodeName}`;
writeFileSync(
  join(output, "agent007.brain.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const original = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(output, "package.json"),
  JSON.stringify(
    {
      name: original.name,
      version: original.version,
      private: true,
      type: "module",
      license: original.license,
      dependencies: original.dependencies,
      bin: original.bin,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(output, "ENGINE_BUILD.json"),
  JSON.stringify(
    {
      version: original.version,
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      nodeLicense: licenseUrl,
      nodeSha256: createHash("sha256")
        .update(readFileSync(process.execPath))
        .digest("hex"),
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      sourceDirty:
        execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
          cwd: root,
          encoding: "utf8",
        }).trim().length > 0,
      dependencies: inventory,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Engine bundle: ${output}\n${inventory.length} production packages; Node ${process.version}; ${process.platform}/${process.arch}.`,
);
