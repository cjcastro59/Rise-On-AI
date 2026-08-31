import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for components; pure lib files run in node (faster)
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./tests/coverage",
      include: ["lib/**/*.ts"],
      exclude: ["lib/supabase/**", "node_modules"],
      // Documented targets from Phase 9 plan
      thresholds: {
        statements: 70,
        branches:   65,
        functions:  70,
        lines:      70,
      },
    },
  },
  resolve: {
    alias: {
      // Match Next.js @/ path alias so lib imports resolve correctly
      "@": path.resolve(__dirname, "."),
    },
  },
});
