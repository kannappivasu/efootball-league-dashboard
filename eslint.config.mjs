import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "prisma/dev.db", "next-env.d.ts"],
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    rules: {
      // Avatars may be arbitrary remote URLs or generated data URIs.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
