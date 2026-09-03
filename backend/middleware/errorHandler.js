import mongoose from "mongoose";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

/**
 * 404 handler for unmatched routes.
 *
 * Mounted after every route so anything that falls through becomes a normal
 * ApiError travelling to the error handler below, rather than Express's default
 * HTML error page.
 *
 * Takes: (req, _res, next) — standard Express middleware signature.
 * Returns: nothing; forwards a 404 ApiError via next().
 */
export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized error-handling middleware — the only place that formats an error
 * response. Must be mounted last.
 *
 * Express 5 forwards rejected promises from async handlers here automatically, so
 * controllers can just `throw` without a try/catch wrapper.
 *
 * Takes: (err, _req, res, _next) — Express error-middleware signature.
 * Returns: nothing; sends the JSON error response.
 */
// _next is unused but must stay: Express identifies error middleware by arity (4 args).
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  // Translate Mongoose failures into client-meaningful statuses. Without this a
  // bad ObjectId in a URL would read as a 500 (our fault) rather than a 400.
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    // Flatten to { field: message } so the client can render errors next to inputs.
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for '${err.path}'`;
  } else if (err.code === 11000) {
    // Duplicate key — surface which field collided, not the raw driver message.
    statusCode = 409;
    message = `Duplicate value for '${Object.keys(err.keyValue ?? {}).join(", ")}'`;
  }

  // 5xx means we broke something: log the full stack. 4xx is the caller's problem
  // and would otherwise flood the logs with routine validation noise.
  if (statusCode >= 500) {
    logger.error(err.stack || err.message);
  } else {
    logger.warn(`${statusCode} ${message}`);
  }

  // Never leak an unexpected internal message (or a stack) to a client in
  // production — those can expose file paths and connection details.
  const isProduction = process.env.NODE_ENV === "production";
  const safeMessage =
    statusCode >= 500 && isProduction ? "Internal server error" : message;

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    // Only present when there's something actionable, e.g. field validation errors.
    ...(details ? { details } : {}),
    // Stack is a development-only debugging aid.
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
