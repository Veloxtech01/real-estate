import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { inject } from "vitest";

/**
 * Database helpers for integration tests.
 *
 * Each suite gets a real MongoDB rather than a mocked Mongoose, because what's worth
 * testing here — index uniqueness, enum validation, cross-field validators — is
 * enforced by the driver and the server, not by our code.
 *
 * The server itself is started once for the whole run by tests/globalSetup.js; each
 * test file connects to its own database on that instance, so files stay isolated
 * without paying to boot a `mongod` apiece.
 */

/**
 * Connects Mongoose to a fresh database on the shared in-memory server.
 *
 * Takes: nothing.
 * Returns: a promise resolving once the connection is open.
 */
export async function connectTestDB() {
  // A unique name per call, so two test files can never see each other's documents
  // even when Vitest runs them in parallel.
  await mongoose.connect(inject("mongoUri"), { dbName: `test-${randomUUID()}` });
}

/**
 * Drops all data between tests so cases can't leak state into each other.
 *
 * Takes: nothing.
 * Returns: a promise resolving once every collection is emptied.
 */
export async function clearTestDB() {
  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

/**
 * Drops this file's database and closes its connection.
 *
 * Takes: nothing.
 * Returns: a promise resolving once the connection is closed. The shared server is
 *          left running — globalSetup owns its lifecycle.
 */
export async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}
