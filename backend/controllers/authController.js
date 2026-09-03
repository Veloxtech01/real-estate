import Agent from "../model/agentModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { AUTH_COOKIE, signToken, authCookieOptions } from "../utils/tokens.js";

/**
 * Staff authentication (§4.2 "secure login").
 *
 * Login only — there is no registration endpoint by design (§7): administrators
 * create staff accounts, which removes an entire category of spam and identity
 * verification work.
 */

/**
 * Shapes an account for a response.
 *
 * Takes: agent (Agent document).
 * Returns: the public-safe subset. The password is already select:false and stripped
 *          in toJSON, but naming the shape here keeps future schema fields from
 *          leaking into a session response by default.
 */
function serialiseAgent(agent) {
  return {
    id: agent._id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    canPublish: agent.canPublish,
  };
}

/**
 * POST /api/auth/login — exchange credentials for a session cookie.
 *
 * Body: { email, password }
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sets the auth cookie and sends { success, data: { user } }.
 * Throws: ApiError 400 on missing fields, 401 on bad credentials.
 */
export async function login(req, res) {
  const { email, password } = req.body ?? {};

  if (!email?.trim() || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Password is select:false on the schema, so it must be requested explicitly.
  const agent = await Agent.findOne({ email: email.trim().toLowerCase() }).select("+password");

  /**
   * One generic message for "no such account" and "wrong password".
   *
   * Distinguishing them would turn this endpoint into an account-enumeration oracle:
   * an attacker could confirm which staff addresses exist before attacking them.
   */
  const invalid = new ApiError(401, "Invalid email or password");

  if (!agent) throw invalid;

  const matches = await agent.comparePassword(password);
  if (!matches) throw invalid;

  // A deactivated account keeps its credentials but must not be able to sign in.
  if (!agent.isActive) {
    throw new ApiError(403, "This account has been deactivated");
  }

  res.cookie(AUTH_COOKIE, signToken(agent), authCookieOptions());

  // Best-effort: a failed timestamp write must not fail the login.
  Agent.updateOne({ _id: agent._id }, { $set: { lastLoginAt: new Date() } }).catch((error) => {
    logger.warn(`Failed to record login time: ${error.message}`);
  });

  res.status(200).json({ success: true, data: { user: serialiseAgent(agent) } });
}

/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: null }.
 */
export async function logout(_req, res) {
  // Options must match those the cookie was set with, or the browser keeps it.
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions(), maxAge: undefined });

  res.status(200).json({ success: true, data: null });
}

/**
 * GET /api/auth/me — the current session.
 *
 * Lets the admin panel restore state on reload without keeping user data in
 * client-readable storage.
 *
 * Takes: (req, res) — requireAuth has already attached req.user.
 * Returns: nothing; sends { success, data: { user } }.
 */
export async function getCurrentUser(req, res) {
  res.status(200).json({ success: true, data: { user: serialiseAgent(req.user) } });
}

/**
 * POST /api/auth/change-password — change your own password.
 *
 * Body: { currentPassword, newPassword }
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: null } and clears the session.
 * Throws: ApiError 400 on a weak or missing password, 401 when the current password
 *         is wrong.
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current and new passwords are required");
  }

  // Mirrors the schema's minimum, checked here so the failure is a clear 400 rather
  // than a Mongoose validation error after the hash has already been computed.
  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const agent = await Agent.findById(req.user._id).select("+password");

  if (!(await agent.comparePassword(currentPassword))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  // Assigning triggers the pre-save hash hook; never hash here.
  agent.password = newPassword;
  await agent.save();

  /**
   * Sign the user out after a password change.
   *
   * The old token stays cryptographically valid until it expires, so if the change
   * was prompted by a suspected compromise, forcing a fresh login is the only
   * meaningful response available without a token blocklist.
   */
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions(), maxAge: undefined });

  res.status(200).json({ success: true, data: null });
}
