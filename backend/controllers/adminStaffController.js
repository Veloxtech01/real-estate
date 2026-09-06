import Agent from "../model/agentModel.js";
import ApiError from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";
import { STAFF_ROLES } from "../utils/constants.js";

/**
 * Admin staff management (§7) — administrator-only CRUD over agentModel.
 *
 * No hard delete anywhere in here: Property/Enquiry/Viewing/Testimonial all reference
 * an agent by id, so removing the document would orphan that history. "Remove a
 * staff member" is always `isActive: false`, which login already checks.
 */

/** Fields a client may set directly via agent.set(). Password, isActive and slug are
 *  handled explicitly below — never through this generic assignment. */
const WRITABLE_FIELDS = [
  "name",
  "email",
  "role",
  "phone",
  "whatsapp",
  "position",
  "bio",
  "photo",
  "areas",
  "registrationNumber",
  "canPublish",
  "isPublic",
];

/** Fields returned on list/detail reads — never `password`. */
const READ_FIELDS =
  "name slug email phone whatsapp role canPublish position bio photo areas registrationNumber isActive isPublic";

/**
 * Copies only permitted fields from a request body.
 *
 * Takes: body (object).
 * Returns: an object containing just the writable fields that were present.
 */
function pickWritable(body = {}) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );
}

/**
 * Builds a slug for `name` that no other agent currently holds.
 *
 * Takes: name (string); excludeId (string, optional) — the agent's own id on an
 *        update, so renaming back to a slug you already hold doesn't collide with
 *        yourself.
 * Returns: a promise resolving to a unique slug — the base form, or `${base}-2`,
 *          `${base}-3`, … the first time two staff members share a name.
 */
async function uniqueAgentSlug(name, excludeId) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (await Agent.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * GET /api/admin/staff — the full roster, active and inactive.
 *
 * Unlike the public /api/agents endpoint, deactivated accounts are included — an
 * administrator has to be able to find someone to reactivate.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { staff } }.
 */
export async function listStaff(_req, res) {
  const staff = await Agent.find({})
    .select(READ_FIELDS)
    .populate("areas", "name slug")
    .sort({ name: 1 })
    .lean();

  res.status(200).json({ success: true, data: { staff } });
}

/**
 * GET /api/admin/staff/:id — one staff record, for the edit form.
 *
 * Takes: (req, res); req.params.id.
 * Returns: nothing; sends { success, data: { staffMember } }.
 * Throws: ApiError 404 when the id doesn't exist.
 */
export async function getStaffMember(req, res) {
  const staffMember = await Agent.findById(req.params.id)
    .select(READ_FIELDS)
    .populate("areas", "name slug")
    .lean();

  if (!staffMember) {
    throw new ApiError(404, "Staff account not found");
  }

  res.status(200).json({ success: true, data: { staffMember } });
}

/**
 * POST /api/admin/staff — create a staff account.
 *
 * Body: { name, email, password, role, phone?, whatsapp?, position?, bio?, photo?,
 *         areas?, registrationNumber?, canPublish?, isPublic? }
 *
 * There is no self-service registration (§7) and no email/reset-token
 * infrastructure in this project — the administrator types the initial password
 * directly, the same minimum-length rule as /api/auth/change-password.
 *
 * Takes: (req, res).
 * Returns: nothing; sends 201 with { success, data: { staffMember } }.
 * Throws: ApiError 400 on missing/invalid fields.
 */
export async function createStaffMember(req, res) {
  const { name, email, password, role } = req.body ?? {};

  const fieldErrors = {};
  if (!name?.trim()) fieldErrors.name = "Name is required";
  if (!email?.trim()) fieldErrors.email = "Email is required";
  if (!password) fieldErrors.password = "Password is required";
  else if (password.length < 8) fieldErrors.password = "Password must be at least 8 characters";
  if (!role) fieldErrors.role = "Role is required";
  else if (!STAFF_ROLES.includes(role)) fieldErrors.role = "Invalid role";

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(400, "Invalid staff details", fieldErrors);
  }

  const data = pickWritable(req.body);
  data.password = password;
  data.slug = await uniqueAgentSlug(name);

  const staffMember = await Agent.create(data);

  // toJSON's transform strips password regardless of how the document was loaded.
  res.status(201).json({ success: true, data: { staffMember } });
}

/**
 * PATCH /api/admin/staff/:id — update a staff account.
 *
 * Body: any of the create fields, plus `password` (a reset — omit to keep the
 * current one) and `isActive` (deactivate/reactivate).
 *
 * Takes: (req, res); req.params.id.
 * Returns: nothing; sends { success, data: { staffMember } }.
 * Throws: ApiError 404 when missing; 400 on an invalid role, a short password, or a
 *         caller trying to deactivate or demote their own account.
 */
export async function updateStaffMember(req, res) {
  const agent = await Agent.findById(req.params.id);

  if (!agent) {
    throw new ApiError(404, "Staff account not found");
  }

  const isSelf = String(agent._id) === String(req.user._id);

  // The one guard standing between a single-admin agency and locking itself out.
  if (isSelf && req.body.isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  if (req.body.role !== undefined) {
    if (!STAFF_ROLES.includes(req.body.role)) {
      throw new ApiError(400, "Invalid role", { role: "Invalid role" });
    }
    if (isSelf && req.body.role !== "administrator") {
      throw new ApiError(400, "You cannot change your own role");
    }
  }

  const data = pickWritable(req.body);

  // Re-slug on a name change, the same behaviour updateProperty already has for a
  // retitled listing — the public profile URL moving is accepted precedent, not new.
  if (data.name && data.name !== agent.name) {
    data.slug = await uniqueAgentSlug(data.name, agent._id);
  }

  // An admin-driven password reset. Assigning (not hashing) it lets the model's own
  // pre-save hook do the hashing, same as every other password write in this app.
  if (typeof req.body.password === "string" && req.body.password.length > 0) {
    if (req.body.password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters", {
        password: "Password must be at least 8 characters",
      });
    }
    agent.password = req.body.password;
  }

  if (typeof req.body.isActive === "boolean") {
    agent.isActive = req.body.isActive;
  }

  // set() rather than findByIdAndUpdate, so validators and the password hash hook
  // both run.
  agent.set(data);
  await agent.save();

  res.status(200).json({ success: true, data: { staffMember: agent } });
}
