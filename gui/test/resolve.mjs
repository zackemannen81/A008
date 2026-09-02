import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const TS_CANDIDATES = [".ts", ".tsx"];

/**
 * The single Node test resolver for the whole GUI tree (A008-0039).
 *
 * Promoted from the `gui/src/chat` resolver, which was already a strict
 * superset of the `gui/src/composer` one. It gives every GUI module test the
 * same three behaviours:
 *
 * - a relative `./x.js` specifier also resolves to `./x.ts` or `./x.tsx`, so
 *   test sources keep the extension `verbatimModuleSyntax` requires;
 * - `.tsx` is compiled with the esbuild that Vite already installs, so a test
 *   can import a React component directly;
 * - a relative CSS side-effect import becomes an empty module instead of a
 *   parse error.
 *
 * No test framework and no bundler is introduced: `node --test` plus esbuild
 * is the whole runner.
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
