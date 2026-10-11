import { defineConfig } from "vitest/config";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@codelens/types": r("packages/types/src/index.ts"),
      "@codelens/analyzer": r("packages/analyzer/src/index.ts"),
      "@codelens/rules": r("packages/rules/src/index.ts"),
      "@codelens/ai": r("packages/ai/src/index.ts"),
      "@codelens/github": r("packages/github/src/index.ts"),
      "@codelens/config": r("packages/config/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
});
