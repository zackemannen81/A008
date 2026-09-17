import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "coverage/**",
      // Operator scratch space. It is gitignored, so the lint gate must not
      // depend on whatever happens to be sitting in it.
      "tmp/**",
      ".tmp/**",
      ".local/**",
      "test/**",
      "tooling/boundaries/fixtures/**",
    ],
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      globals: globals.node,
    },
  },
);
