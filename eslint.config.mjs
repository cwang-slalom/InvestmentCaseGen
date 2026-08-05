import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "backend/**",
      "coverage/**",
      "data/**",
      "dist/**",
      "frontend/dist/**",
      "node_modules/**",
      "outputs/**",
      "src/**",
      "tsconfig.tsbuildinfo"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        File: "readonly",
        Response: "readonly",
        setTimeout: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
