import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain ESM Node scripts (z. B. create-skin/bin.mjs) laufen direkt in Node:
    // process/URL/etc. sind globale Node-Runtime-Symbole.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", URL: "readonly" },
    },
  },
  prettier,
);
