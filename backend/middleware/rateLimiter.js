import rateLimit from "express-rate-limit";

/**
 * Shared rate limiters.
 *
 * These exist up front because the scope doc treats rate limiting as a requirement,
 * not a nicety: the AI search endpoint (§5.6) is a public box that spends money per
 * call, and the Phase 2 OTP endpoint (§10.1) sends paid SMS. Both are abusable
 * without a cap.
 *
 * Takes: nothing (each export is pre-configured middleware).
 * Returns: Express middleware functions.
 */

// Baseline limiter for the whole API — generous enough that ordinary browsing is
// never affected, low enough to blunt scraping of the listings endpoints.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: "draft-7", // RateLimit-* response headers
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

/**
 * Tight limiter for endpoints that cost money or send mail on each call —
 * AI search, enquiry submission, viewing requests, OTP.
 *
 * Deliberately separate from apiLimiter so the expensive paths can be tuned
 * without loosening protection everywhere else.
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests for this action, please try again shortly.",
  },
});
