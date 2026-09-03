import jwt from "jsonwebtoken";

/**
 * JWT issuing/verification and the auth cookie contract.
 *
 * Tokens are delivered in an httpOnly cookie rather than a response body, so page
 * scripts can never read them — the front end sends them automatically via the
 * shared Axios instance's `withCredentials: true`.
 */

/** Cookie name, referenced by both the setter and the auth middleware. */
export const AUTH_COOKIE = "re_token";

/**
 * Signs an access token for a staff account.
 *
 * Takes: agent (Agent document) — needs _id and role.
 * Returns: the signed JWT.
 * Throws: Error when JWT_SECRET is unset — refusing to run is correct here, since
 *         the alternative is signing with a guessable key.
 */
export function signToken(agent) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  // Role is embedded so authorizeRole can decide without a database round trip, but
  // it is re-checked against the loaded account on every request (see auth.js) —
  // a demoted agent must lose access before their token expires.
  return jwt.sign({ sub: String(agent._id), role: agent.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

/**
 * Verifies a token.
 *
 * Takes: token (string).
 * Returns: the decoded payload.
 * Throws: the underlying jsonwebtoken error when invalid or expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Cookie options for the auth cookie.
 *
 * Takes: nothing — reads NODE_ENV and COOKIE_SAMESITE.
 * Returns: an options object for res.cookie().
 */
export function authCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    // Not readable by page scripts — the main reason for cookie auth over
    // localStorage.
    httpOnly: true,
    // HTTPS-only in production; must stay off locally or the cookie is dropped.
    secure: isProduction,
    /**
     * "lax" covers the normal deployment (site and API on the same registrable
     * domain) and local development across ports. A genuinely cross-site API needs
     * "none", which additionally requires secure:true — hence the env override
     * rather than a hardcoded value.
     */
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
