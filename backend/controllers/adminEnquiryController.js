import Enquiry from "../model/enquiryModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildSearchRegex } from "../utils/escapeRegex.js";
import { scopeLeadQuery, canManageLead } from "../middleware/auth.js";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  ENQUIRY_SOURCES,
} from "../utils/constants.js";

/**
 * The enquiry inbox (§4.2).
 *
 * Every lead the public site captures lands here. Access is governed by the §7
 * ownership rule: an agent works their own leads, an administrator sees everything
 * including leads nobody has been assigned yet.
 */

/**
 * Fields a PATCH may write.
 *
 * `contactedAt` and `closedAt` are stamped by the model's pre-save hook and must never
 * be accepted from a client — they are the agency's response-time metric, and a
 * writable timestamp is a falsifiable one. Identity fields (name/phone/email) are what
 * the prospect submitted and are not staff-editable.
 */
const WRITABLE_FIELDS = ["status", "notes", "agent"];

/**
 * Load one enquiry and check the caller may act on it.
 *
 * Takes: id (string), user (req.user), options.withNotes (boolean).
 * Returns: the Enquiry document.
 * Throws: ApiError 404 when it does not exist, 403 when it is not the caller's.
 */
async function loadManageable(id, user, { withNotes = false } = {}) {
  const query = Enquiry.findById(id);
  // notes is select:false on the schema, so it must be asked for explicitly.
  if (withNotes) query.select("+notes");

  const enquiry = await query;

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  // 403 rather than 404: these are authenticated colleagues, not anonymous probes,
  // and the clearer error is more useful than hiding existence from staff.
  if (!canManageLead(user, enquiry)) {
    throw new ApiError(403, "You can only manage leads assigned to you");
  }

  return enquiry;
}

/**
 * Build the shared list filter from the query string.
 *
 * Ownership scoping is applied by the caller AFTER this returns, so a caller-supplied
 * `agent` can never widen it.
 *
 * Takes: query (req.query).
 * Returns: a Mongoose filter object.
 */
function buildEnquiryFilter(query) {
  const filter = {};

  // Enum filters are validated against constants.js — an unknown value is ignored
  // rather than 400ing, so a stale admin UI never breaks the inbox.
  if (ENQUIRY_STATUSES.includes(query.status)) filter.status = query.status;
  if (ENQUIRY_TYPES.includes(query.type)) filter.type = query.type;
  if (ENQUIRY_SOURCES.includes(query.source)) filter.source = query.source;

  if (query.agent) filter.agent = query.agent;
  if (query.property) filter.property = query.property;

  if (query.q) {
    const pattern = buildSearchRegex(String(query.q).trim());
    // The three fields staff actually search a lead by.
    filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }];
  }

  // Date range on createdAt. An unparseable date is dropped rather than producing an
  // Invalid Date, which Mongo would reject with an unhelpful cast error.
  const createdAt = {};
  const from = new Date(query.dateFrom);
  const to = new Date(query.dateTo);
  if (query.dateFrom && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (query.dateTo && !Number.isNaN(to.getTime())) createdAt.$lte = to;
  if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

  return filter;
}

/**
 * GET /api/admin/enquiries — the inbox.
 *
 * Takes: (req, res); query: status, type, source, agent, property, q, dateFrom,
 *        dateTo, sort, page, limit.
 * Returns: nothing; sends { success, data: { enquiries, pagination } }.
 */
export async function listEnquiries(req, res) {
  const filter = buildEnquiryFilter(req.query);

  // Applied last: ownership always wins over anything the caller asked for.
  scopeLeadQuery(filter, req.user);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  // Newest first is inbox order. "oldest" is for working a backlog from the top.
  const sort = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate([
        { path: "property", select: "title slug reference" },
        { path: "agent", select: "name slug" },
      ])
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      enquiries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/admin/enquiries/stats — counts by status for the inbox badge.
 *
 * Must be declared before /:id in the router, or "stats" is read as an id.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { stats } } with every status key present.
 */
export async function enquiryStats(req, res) {
  const filter = scopeLeadQuery({}, req.user);

  const grouped = await Enquiry.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  // Seed every status at zero first, so the frontend never renders "undefined" for a
  // status that happens to have no leads today.
  const stats = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0]));
  let total = 0;

  for (const row of grouped) {
    stats[row._id] = row.count;
    total += row.count;
  }

  stats.total = total;

  res.status(200).json({ success: true, data: { stats } });
}

/**
 * GET /api/admin/enquiries/:id — one lead, including internal notes.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { enquiry } }.
 * Throws: ApiError 404 / 403.
 */
export async function getEnquiry(req, res) {
  const enquiry = await loadManageable(req.params.id, req.user, { withNotes: true });

  await enquiry.populate([
    { path: "property", select: "title slug reference" },
    { path: "agent", select: "name slug phone" },
  ]);

  res.status(200).json({ success: true, data: { enquiry } });
}

/**
 * PATCH /api/admin/enquiries/:id — move a lead through the pipeline.
 *
 * Takes: (req, res); body: status, notes, agent.
 * Returns: nothing; sends { success, data: { enquiry } }.
 * Throws: ApiError 400 on an invalid status, 403 when an agent tries to reassign.
 */
export async function updateEnquiry(req, res) {
  const enquiry = await loadManageable(req.params.id, req.user, { withNotes: true });

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );

  // Reassignment is an administrator's call. An agent must not be able to hand a lead
  // away to avoid it, nor claim one that was never theirs.
  if ("agent" in updates && req.user.role !== "administrator") {
    throw new ApiError(403, "Only an administrator can reassign a lead");
  }

  if ("status" in updates && !ENQUIRY_STATUSES.includes(updates.status)) {
    throw new ApiError(400, `"${updates.status}" is not a valid enquiry status`);
  }

  Object.assign(enquiry, updates);
  // save() rather than findByIdAndUpdate, so the pre-save hook that stamps
  // contactedAt/closedAt actually runs.
  await enquiry.save();

  res.status(200).json({ success: true, data: { enquiry } });
}

/**
 * DELETE /api/admin/enquiries/:id — permanent removal. Administrator only.
 *
 * Hard, not soft: NDPA 2023 erasure means the personal data is gone. A tombstone
 * retaining name, phone and email would not satisfy an erasure request.
 *
 * Takes: (req, res).
 * Returns: nothing; sends 204.
 * Throws: ApiError 404.
 */
export async function deleteEnquiry(req, res) {
  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  await enquiry.deleteOne();

  // Erasure is irreversible, so leave an audit trail of who did it — without logging
  // the personal data that was just erased.
  logger.info(
    `Enquiry ${req.params.id} permanently deleted by ${req.user.email} (${req.user._id})`
  );

  res.status(204).end();
}
