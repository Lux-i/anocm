import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // 🔹 Ignore JS, dist, build, node_modules, tests if desired
  {
    ignores: [
      "**/*.js",
      "dist/",
      "build/",
      "node_modules/",
      "**/__tests__/**/*.js", // optional
    ],
  },

  // TypeScript recommended
  ...tseslint.configs.recommended,

  // 🔹 GLOBAL rule overrides
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // allow any
      "@typescript-eslint/no-require-imports": "off", // allow require()
    },
  },

  // 🔹 Node.js environment for TS files
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // 🔹 Jest environment (tests)
  {
    files: ["**/__tests__/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
