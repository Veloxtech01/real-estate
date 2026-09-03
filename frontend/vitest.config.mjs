import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the frontend package.
 *
 * Next.js has no vite.config.js, so test config lives in its own file here (unlike
 * the Vite-based sibling projects referenced in CLAUDE.md, where it shared one).
 * Vitest drives the component tests directly through Vite — it does not run the
 * Next.js compiler, so server components and framework-level behaviour (routing,
 * server rendering, data fetching) are not covered here.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "./src/*" alias in jsconfig.json. Vitest doesn't read
      // jsconfig, so without this any component importing via "@/..." fails to resolve.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Component tests need DOM globals; jsdom supplies them.
    environment: "jsdom",
    // Lets tests use describe/it/expect without importing them, and matches the
    // Testing Library setup file below.
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.{js,jsx}", "tests/**/*.test.{js,jsx}"],
    // Build output and dependencies contain no tests of ours.
    exclude: ["node_modules/**", ".next/**"],
  },
});
