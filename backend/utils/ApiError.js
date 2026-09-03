/**
 * Error type carrying an HTTP status code.
 *
 * Controllers `throw new ApiError(404, "Property not found")` instead of sending
 * ad-hoc error responses, so every failure leaves through the single error handler
 * and comes back in the same JSON shape (see CLAUDE.md backend conventions).
 *
 * Takes: statusCode (number), message (string), details (optional — e.g. field-level
 *        validation errors surfaced to the client).
 * Returns: an Error instance with `statusCode`, `details` and `isOperational` set.
 */
export default class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    // Marks this as an error we raised deliberately, as opposed to an unexpected
    // crash. The error handler uses it to decide whether the message is safe to
    // show a client.
    this.isOperational = true;

    // Keep the constructor itself out of the captured stack trace.
    Error.captureStackTrace(this, this.constructor);
  }
}
