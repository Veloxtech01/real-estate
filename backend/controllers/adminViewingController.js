import Viewing from "../model/viewingModel.js";
import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { scopeLeadQuery, canManageLead } from "../middleware/auth.js";
import { assertTransition } from "../utils/viewingTransitions.js";
import { sendEmail } from "../utils/emailService.js";
import { VIEWING_STATUSES } from "../utils/constants.js";
import {
  prospectViewingAccepted,
  prospectViewingRejected,
  prospectViewingRescheduled,
} from "../emails/viewingEmails.js";

/**
 * Viewing management (§4.2) — the agency's diary.
 *
 * Status changes go through the transition whitelist in utils/viewingTransitions.js
 * rather than being written straight to the document, so a completed viewing can never
 * be reopened by a stale client.
 */

/**
 * Fields a PATCH may write. `respondedAt` is stamped by the model's pre-save hook and
 * is deliberately absent — it is a response-time metric, not client data.
 */
const WRITABLE_FIELDS = ["status", "scheduledFor", "responseMessage", "notes"];

/**
 * Load one viewing and check the caller may act on it.
 *
 * Takes: id (string), user (req.user), options.withNotes (boolean).
 * Returns: the Viewing document.
 * Throws: ApiError 404 when it does not exist, 403 when it is not the caller's.
 */
async function loadManageable(id, user, { withNotes = false } = {}) {
  const query = Viewing.findById(id);
  if (withNotes) query.select("+notes");

  const viewing = await query;

  if (!viewing) {
    throw new ApiError(404, "Viewing not found");
  }

  if (!canManageLead(user, viewing)) {
    throw new ApiError(403, "You can only manage viewings assigned to you");
  }

  return viewing;
}

/**
 * Email the prospect about a status change. Best-effort.
 *
 * Called AFTER the response is sent: a slow mail provider must never slow a staff
 * member's click, and a mail failure must never undo a status change. Silent when the
 * prospect gave no email — phone is the required field, email is optional.
 *
 * Takes: viewing (Viewing document), status (string).
 * Returns: a promise that always resolves.
 */
async function notifyProspect(viewing, status) {
  if (!viewing.email) return;

  // Only the three outcomes the prospect needs to hear about. "completed" and
  // "cancelled" are internal bookkeeping.
  const builders = {
    accepted: prospectViewingAccepted,
    rejected: prospectViewingRejected,
    rescheduled: prospectViewingRescheduled,
  };

  const build = builders[status];
  if (!build) return;

  try {
    const settings = await Settings.get();
    const agencyName = settings?.agencyName ?? "Our team";

    const { subject, html } = build({ viewing, agencyName });
    await sendEmail({ to: viewing.email, subject, html });
  } catch (error) {
    // Swallowed on purpose — the status change already succeeded and is what matters.
    logger.warn(`Viewing notification failed for ${viewing._id}: ${error.message}`);
  }
}

/**
 * GET /api/admin/viewings — the diary.
 *
 * Takes: (req, res); query: status, agent, property, dateFrom, dateTo, upcoming,
 *        page, limit.
 * Returns: nothing; sends { success, data: { viewings, pagination } }.
 */
export async function listViewings(req, res) {
  const filter = {};

  if (VIEWING_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.agent) filter.agent = req.query.agent;
  if (req.query.property) filter.property = req.query.property;

  // Date window on the requested date, which is what a diary is organised by.
  const requestedFor = {};
  const from = new Date(req.query.dateFrom);
  const to = new Date(req.query.dateTo);
  if (req.query.dateFrom && !Number.isNaN(from.getTime())) requestedFor.$gte = from;
  if (req.query.dateTo && !Number.isNaN(to.getTime())) requestedFor.$lte = to;

  // The default view a staff member wants on opening the page.
  if (req.query.upcoming === "true") {
    requestedFor.$gte = requestedFor.$gte ?? new Date();
  }

  if (Object.keys(requestedFor).length > 0) filter.requestedFor = requestedFor;

  // Applied last: ownership always wins over anything the caller asked for.
  scopeLeadQuery(filter, req.user);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const [viewings, total] = await Promise.all([
    Viewing.find(filter)
      .populate([
        { path: "property", select: "title slug reference" },
        { path: "agent", select: "name slug" },
      ])
      // Soonest first — a diary reads forwards, unlike an inbox.
      .sort({ requestedFor: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Viewing.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      viewings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/admin/viewings/:id — one viewing, including internal notes.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { viewing } }.
 * Throws: ApiError 404 / 403.
 */
export async function getViewing(req, res) {
  const viewing = await loadManageable(req.params.id, req.user, { withNotes: true });

  await viewing.populate([
    { path: "property", select: "title slug reference" },
    { path: "agent", select: "name slug phone" },
  ]);

  res.status(200).json({ success: true, data: { viewing } });
}

/**
 * PATCH /api/admin/viewings/:id — accept, reject, reschedule, complete or cancel.
 *
 * Takes: (req, res); body: status, scheduledFor, responseMessage, notes.
 * Returns: nothing; sends { success, data: { viewing } }.
 * Throws: ApiError 400 on an illegal transition or a bad reschedule, 404 / 403.
 */
export async function updateViewing(req, res) {
  const viewing = await loadManageable(req.params.id, req.user, { withNotes: true });

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );

  const nextStatus = updates.status;
  // Captured before the write so the notification knows whether anything changed.
  const statusChanged = nextStatus != null && nextStatus !== viewing.status;

  if (nextStatus != null) {
    if (!VIEWING_STATUSES.includes(nextStatus)) {
      throw new ApiError(400, `"${nextStatus}" is not a valid viewing status`);
    }

    // Throws 400 on an illegal move; a no-op when the status is unchanged.
    assertTransition(viewing.status, nextStatus);

    if (nextStatus === "accepted") {
      // Accepting the prospect's own suggested time is the common case, so the client
      // does not have to echo it back.
      updates.scheduledFor = updates.scheduledFor ?? viewing.requestedFor;
    }

    if (nextStatus === "rescheduled" && statusChanged) {
      if (!updates.scheduledFor) {
        throw new ApiError(400, "A new date is required to reschedule a viewing");
      }

      const when = new Date(updates.scheduledFor);

      if (Number.isNaN(when.getTime())) {
        throw new ApiError(400, "The new viewing date is not a valid date");
      }

      // A time in the past cannot be a reschedule — it is a data-entry error.
      if (when.getTime() <= Date.now()) {
        throw new ApiError(400, "The new viewing date must be in the future");
      }

      // Moving a viewing to the time it already had is not a reschedule.
      if (viewing.scheduledFor && when.getTime() === viewing.scheduledFor.getTime()) {
        throw new ApiError(400, "The new viewing date must differ from the current one");
      }
    }
  }

  Object.assign(viewing, updates);
  // save() rather than findByIdAndUpdate, so the hook that stamps respondedAt runs.
  await viewing.save();

  res.status(200).json({ success: true, data: { viewing } });

  // After the response: the prospect's email is a courtesy, not part of the write.
  if (statusChanged) {
    void notifyProspect(viewing, nextStatus);
  }
}

/**
 * DELETE /api/admin/viewings/:id — permanent removal. Administrator only.
 *
 * Hard, not soft, for the same NDPA reason as enquiries: the record holds the
 * prospect's name, phone and email.
 *
 * Takes: (req, res).
 * Returns: nothing; sends 204.
 * Throws: ApiError 404.
 */
export async function deleteViewing(req, res) {
  const viewing = await Viewing.findById(req.params.id);

  if (!viewing) {
    throw new ApiError(404, "Viewing not found");
  }

  await viewing.deleteOne();

  logger.info(
    `Viewing ${req.params.id} permanently deleted by ${req.user.email} (${req.user._id})`
  );

  res.status(204).end();
}
