import { defineConfig } from "vitest/config";

// Unit tests for pure helpers (URL/permission rules, formatters). They run in
// Node — no DOM needed; browser APIs are injected or stubbed per test.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
