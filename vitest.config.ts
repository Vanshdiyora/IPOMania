import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/security/**/*.test.ts",
      "tests/ui/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "packages/financial-engine/src/**/*.ts",
        "packages/validation/src/**/*.ts",
        "workers/api/src/**/*.ts",
      ],
      exclude: ["**/*.d.ts", "**/index.ts"],
    },
  },
});
