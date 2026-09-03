import winston from "winston";

/**
 * Application-wide Winston logger.
 *
 * Central logger so no code path uses bare console.log — that matters here because
 * request/error output eventually needs to go somewhere machine-readable (see the
 * scope doc's §10.4 operational requirements: error + uptime monitoring).
 *
 * Takes: nothing (configured from process.env at import time).
 * Returns: a configured Winston logger instance.
 */

// In production we emit JSON so a log aggregator can parse it; in development a
// human-readable coloured line is far easier to scan in a terminal.
const isProduction = process.env.NODE_ENV === "production";

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  // Print the stack when an Error was logged, otherwise just the message.
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  // LOG_LEVEL lets us turn up verbosity in an environment without a code change.
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
  // Don't let a logging failure take the HTTP server down with it.
  exitOnError: false,
});

export default logger;
