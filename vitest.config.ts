import { defineConfig } from "vitest/config";

export default defineConfig({
  // testTimeout: the whole-world tests build the city and the coastal neighborhood with the strip of #496 (≈ 40 % more work); 5 s left no margin on a loaded host
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node", passWithNoTests: true, testTimeout: 15_000 },
});
