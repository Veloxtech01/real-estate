import Agent from "../model/agentModel.js";
import ApiError from "../utils/ApiError.js";
import { AUTH_COOKIE, verifyToken } from "../utils/tokens.js";

/**
 * Authentication and authorisation middleware.
 *
 * There is no self-service registration (§7) — every account is created by an
 * administrator — so these guards protect the admin surface only. Nothing public
 * should ever mount them.
 */

/**
 * Requires a valid session, and attaches the account to req.user.
 *
 * Takes: (req, _res, next) — reads the auth cookie.
 * Returns: nothing; calls next() or forwards a 401.
 * Throws: ApiError 401 when the token is missing, invalid, expired, or belongs to an
 *         account that has since been deactivated or deleted.
 */
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    // Invalid and expired are deliberately indistinguishable to the caller.
    return next(new ApiError(401, "Session expired or invalid"));
  }

  /**
   * The account is re-loaded on every request rather than trusted from the token.
   *
   * A JWT is valid until it expires, so without this a deactivated or demoted staff
   * member would keep full access for up to seven days after being removed.
   */
  const agent = await Agent.findById(payload.sub).select("name email role canPublish isActive");

  if (!agent || !agent.isActive) {
    return next(new ApiError(401, "Account is no longer active"));
  }

  req.user = agent;
  return next();
}

/**
 * Restricts a route to specific roles.
 *
 * Takes: ...roles (string[]) — e.g. authorizeRole("administrator").
 * Returns: Express middleware.
 * Throws: ApiError 403 when the authenticated account's role isn't permitted.
 */
export function authorizeRole(...roles) {
  return (req, _res, next) => {
    // Ordering bug guard: without requireAuth first there is nobody to authorise.
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to do that"));
    }

    return next();
  };
}

/**
 * Whether an account may act on a given listing.
 *
 * §7: an administrator manages all listings; an agent creates and edits only their
 * own. Centralised here so no controller reimplements it slightly differently.
 *
 * Takes: user (req.user), property (Property document).
 * Returns: true when permitted.
 */
export function canManageProperty(user, property) {
  if (user.role === "administrator") return true;

  return String(property.agent) === String(user._id);
}

/**
 * Restrict a lead list query to what the caller may see.
 *
 * An administrator sees every lead. An agent sees only leads assigned to them, which
 * deliberately excludes *unassigned* leads — a contact-page enquiry or a valuation
 * request belongs to nobody until an administrator assigns it, so no agent should be
 * reading the prospect's phone number in the meantime.
 *
 * MUST be applied last when building a query. Applying it before caller-supplied
 * filters would let `?agent=<colleague id>` overwrite it and widen the scope.
 *
 * Takes: query (object) — the Mongoose filter being assembled; user (req.user).
 * Returns: the same query object, for chaining.
 */
export function scopeLeadQuery(query, user) {
  if (user.role !== "administrator") {
    query.agent = user._id;
  }

  return query;
}

/**
 * Whether this account may read or act on one lead (enquiry or viewing).
 *
 * Mirrors canManageProperty. An agent gets false for a colleague's lead *and* for an
 * unassigned one — the same answer, so the response does not distinguish them.
 *
 * Takes: user (req.user), lead (Enquiry or Viewing document).
 * Returns: true when permitted.
 */
export function canManageLead(user, lead) {
  if (user.role === "administrator") return true;

  // An unassigned lead has no agent — String(undefined) must not accidentally match.
  if (!lead.agent) return false;

  return String(lead.agent) === String(user._id);
}
