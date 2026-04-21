import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react()],
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.ts",
      "client/src/**/*.spec.ts",
      "client/src/**/*.test.tsx",
      "client/src/**/*.spec.tsx",
    ],
    env: {
      NODE_ENV: "test",
    },
    testTimeout: 30000,
    // Use jsdom for any .tsx test files (React component tests)
    // setupFiles is NOT used globally — jest-dom is imported per-file in .tsx tests
    environmentMatchGlobs: [
      ["client/src/**/*.test.tsx", "jsdom"],
      ["client/src/**/*.spec.tsx", "jsdom"],
    ],
  },
});
