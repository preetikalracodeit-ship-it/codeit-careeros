import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup-env.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    pool: "forks",
  },
});
