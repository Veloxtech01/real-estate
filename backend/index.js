import "dotenv/config";
import cron from "node-cron";

import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import logger from "./utils/logger.js";
import { sendDailyDigest } from "./utils/dailyDigest.js";

/**
 * Server entry point — connects the database, then starts the HTTP listener.
 *
 * Takes: nothing (PORT and MONGODB_URI come from the environment).
 * Returns: nothing; exits the process with code 1 if startup fails.
 */
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Connect before listening so the process doesn't accept traffic it can't
    // serve. Note connectDB() resolves to null (with a warning) when MONGODB_URI
    // is unset, which is the current state of this project — see config/db.js.
    await connectDB();

    const app = createApp();
    const server = app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT} (${process.env.NODE_ENV || "development"})`);
    });

    // §4.3 daily digest — 7:00 AM WAT (Africa/Lagos) daily, independent of the host
    // server's own timezone. sendDailyDigest() handles its own errors, so there is
    // nothing for this callback to catch.
    cron.schedule("0 7 * * *", () => { void sendDailyDigest(); }, {
      timezone: "Africa/Lagos",
    });

    /**
     * Closes the HTTP server and database connection on a termination signal.
     *
     * Without this, an in-flight request is cut off mid-response on every deploy
     * or container restart.
     *
     * Takes: signal (string) — the signal that triggered shutdown.
     * Returns: nothing; exits the process.
     */
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);

      // Stop accepting new connections, let existing responses finish, then drop
      // the DB connection.
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });

      // Backstop: if something holds the event loop open, don't hang forever.
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

start();
