import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.tsbuildinfo",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unused code is a real signal in this codebase (we found several dead
      // props and variables), so it must fail CI — but `_`-prefixed args stay
      // allowed for intentionally ignored callback parameters.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // The builder deliberately reads/writes DOM refs inside effects with
      // hand-managed dependency lists; flag them without blocking the build.
      "react-hooks/exhaustive-deps": "warn",
      // Images here are blob: URLs from the composer, LLM-generated assets and
      // cross-origin avatars. next/image brings no optimisation for those and
      // would require an open remotePatterns allowlist.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
