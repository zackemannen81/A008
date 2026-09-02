import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const TS_CANDIDATES = [".ts", ".tsx"];

/**
 * Node test hooks for `gui/src/chat`.
 *
 * Extends the `gui/src/composer` pattern so a Node test can import the React
 * component itself: `./x.js` also resolves to `./x.tsx`, `.tsx` is compiled
 * with the esbuild that Vite already installs, and a CSS side-effect import
 * becomes an empty module instead of a parse error.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".css")) {
    return {
      url: new URL(specifier, context.parentURL).href,
      format: "module",
      shortCircuit: true,
    };
  }

  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    for (const extension of TS_CANDIDATES) {
      const candidate = specifier.replace(/\.js$/u, extension);
      const candidateUrl = new URL(candidate, context.parentURL);
      if (existsSync(fileURLToPath(candidateUrl))) {
        return nextResolve(candidate, context);
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) {
    return { format: "module", source: "export default {};", shortCircuit: true };
  }

  if (url.endsWith(".tsx")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const compiled = transformSync(source, {
      loader: "tsx",
      jsx: "automatic",
      format: "esm",
      target: "es2023",
      sourcefile: url,
    });
    return { format: "module", source: compiled.code, shortCircuit: true };
  }

  return nextLoad(url, context);
}
