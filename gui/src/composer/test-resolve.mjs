import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    const tsSpecifier = specifier.replace(/\.js$/u, ".ts");
    const tsUrl = new URL(tsSpecifier, context.parentURL);
    if (existsSync(fileURLToPath(tsUrl))) {
      return nextResolve(tsSpecifier, context);
    }
  }
  return nextResolve(specifier, context);
}
