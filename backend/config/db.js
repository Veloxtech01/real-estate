import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Opens the shared Mongoose connection.
 *
 * Takes: nothing — reads MONGODB_URI from the environment (never hardcoded; see
 *        CLAUDE.md, secrets come from process.env only).
 * Returns: a promise resolving to the Mongoose connection, or null when no URI is
 *          configured (see the deliberate no-URI behaviour below).
 * Throws: rethrows any connection error so the caller decides whether to exit.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // No database exists for this project yet (no cluster/db names decided — see
  // CLAUDE.md "Environments"). Rather than crash-looping a scaffold that has no DB
  // to talk to, we warn loudly and let the HTTP layer boot. Once a cluster exists
  // this branch should become a hard failure instead.
  if (!uri) {
    logger.warn(
      "MONGODB_URI is not set — starting WITHOUT a database connection. " +
        "Any route that touches Mongoose will fail until this is configured."
    );
    return null;
  }

  // Fail fast on a bad host instead of buffering queries for the default 30s,
  // which otherwise surfaces as a confusing request timeout rather than a
  // connection error.
  mongoose.set("bufferCommands", false);

  /**
   * The database name is set explicitly rather than left to the URI path.
   *
   * This project shares an Atlas cluster with sibling projects, and an Atlas
   * connection string copied from the UI has no database path — Mongoose would
   * silently use "test". On a shared cluster that means reading and writing another
   * project's data, with no error to notice. Being explicit turns a silent
   * cross-project write into an obvious misconfiguration.
   */
  const dbName = process.env.MONGODB_DB_NAME;

  if (!dbName) {
    logger.warn(
      "MONGODB_DB_NAME is not set — the database will come from the connection " +
        "string, which defaults to 'test' on a shared cluster."
    );
  }

  try {
    const connection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      ...(dbName ? { dbName } : {}),
    });

    logger.info(
      `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
    );
    return connection;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Closes the Mongoose connection during shutdown.
 *
 * Takes: nothing.
 * Returns: a promise that resolves once the connection is closed. Safe to call when
 *          no connection was ever opened.
 */
export async function disconnectDB() {
  // readyState 0 === disconnected; skip the call so shutdown stays idempotent.
  if (mongoose.connection.readyState === 0) return;

  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}
