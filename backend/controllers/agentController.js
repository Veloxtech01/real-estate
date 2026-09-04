import Agent from "../model/agentModel.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public agent directory — the §3 "meet the team" page and each agent's own
 * profile/referral landing page.
 *
 * An explicit inclusion whitelist (rather than excluding the private fields) is
 * what keeps `email`, `role`, `canPublish` and `lastLoginAt` off this API even if
 * a new private field is added to the model later — an exclusion list would leak
 * it by default.
 */
const PUBLIC_FIELDS = "name slug photo position bio phone whatsapp registrationNumber areas";

/**
 * GET /api/agents — the team roster.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { agents } }, public + active only.
 */
export async function listAgents(_req, res) {
  const agents = await Agent.find({ isPublic: true, isActive: true })
    .select(PUBLIC_FIELDS)
    .populate("areas", "name slug")
    .sort({ name: 1 })
    .lean();

  res.status(200).json({ success: true, data: { agents } });
}

/**
 * GET /api/agents/:slug — one agent's public profile.
 *
 * Takes: (req, res); req.params.slug.
 * Returns: nothing; sends { success, data: { agent } }.
 * Throws: ApiError 404 for a private agent, an inactive one, or an unknown slug —
 *         all three are indistinguishable, matching the rule already used for
 *         draft/soft-deleted properties (a different response would leak that a
 *         hidden record exists).
 */
export async function getAgentBySlug(req, res) {
  const agent = await Agent.findOne({
    slug: req.params.slug,
    isPublic: true,
    isActive: true,
  })
    .select(PUBLIC_FIELDS)
    .populate("areas", "name slug")
    .lean();

  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  res.status(200).json({ success: true, data: { agent } });
}
