import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Vitest global setup — one in-memory MongoDB shared by every test file.
 *
 * Previously each file started its own instance, which meant seven `mongod`
 * processes competing on start-up and intermittent "failed to start within 10000ms"
 * failures. One instance is both faster and deterministic; per-file isolation comes
 * from each file connecting to its own database name instead (see helpers/db.js).
 */
let server;

/**
 * Starts the shared instance and publishes its URI to the test workers.
 *
 * Takes: ctx — the Vitest global-setup context, whose provide() passes values to
 *        tests via inject().
 * Returns: a promise resolving once the server is listening.
 */
export async function setup({ provide }) {
  server = await MongoMemoryServer.create();
  provide("mongoUri", server.getUri());
}

/**
 * Stops the shared instance once the whole run finishes.
 *
 * Takes: nothing.
 * Returns: a promise resolving once the server has stopped.
 */
export async function teardown() {
  await server?.stop();
}
