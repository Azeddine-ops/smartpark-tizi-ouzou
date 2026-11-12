import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuration Vitest — exécution : `npx vitest run`.
 * Les tests ciblent la logique métier pure de src/lib (isolée, déterministe).
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
  },
});
