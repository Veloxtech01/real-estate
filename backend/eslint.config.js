import js from "@eslint/js";
import globals from "globals";

/**
 * ESLint flat config for the backend package.
 *
 * Flat config is the only supported format in ESLint 9+ — there is no .eslintrc here.
 * (The frontend uses oxlint instead; see CLAUDE.md.)
 */
export default [
  // Never lint dependencies or coverage output.
  {
    ignores: ["node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module", // package.json sets "type": "module"
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Unused args are common in Express signatures (e.g. the mandatory 4th
      // param on error middleware); allow them when prefixed with an underscore.
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Logging goes through utils/logger.js, not console.
      "no-console": "warn",
    },
  },
];
