import { defineConfig } from "vitest/config";

/**
 * Vitest config for the backend package.
 *
 * Tests run in the Node environment (this package never touches a DOM) and use
 * supertest against createApp(), so no port is bound. One in-memory MongoDB is
 * started for the whole run by tests/globalSetup.js and shared across files.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],

    // Starts/stops the single shared MongoDB instance.
    globalSetup: ["./tests/globalSetup.js"],

    // Seeding 200 demo listings in a beforeAll comfortably exceeds the 5s default.
    testTimeout: 30000,
    // Hooks need their own allowance: the default 10s was tripping on suites that
    // seed the full demo dataset before their first test.
    hookTimeout: 120000,

    restoreMocks: true,
  },
});
