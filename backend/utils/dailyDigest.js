import Agent from "../model/agentModel.js";
import Property from "../model/propertyModel.js";
import Enquiry from "../model/enquiryModel.js";
import Settings from "../model/settingsModel.js";
import logger from "./logger.js";
import { sendEmail } from "./emailService.js";
import { adminDailyDigest } from "../emails/digestEmails.js";

/**
 * §4.3 daily digest — a summary email of new enquiries sent to administrators once a
 * day (scheduled from index.js via node-cron). Enquiries-only, matching the scope
 * doc's wording; viewings already get their own immediate notifications.
 */

/**
 * Builds a short display label for an enquiry's subject — the property it names, or
 * a fallback when there is none.
 *
 * Takes: enquiry (Enquiry document), property (Property document | null).
 * Returns: a display string.
 */
function propertyLabelFor(enquiry, property) {
  if (property) return `${property.title} (${property.reference})`;
  if (enquiry.requirement?.location) return enquiry.requirement.location;
  return enquiry.type;
}

/**
 * Finds enquiries created since a given time, newest first, with a display label
 * for the property/area each one concerns.
 *
 * Takes: since (Date).
 * Returns: a promise resolving to an array of { _id, name, type, createdAt,
 *          propertyLabel } — everything the digest template needs and nothing more.
 */
export async function getDigestEnquiries(since) {
  const enquiries = await Enquiry.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 });

  // Property ids are looked up individually rather than via populate() so a deleted
  // property still resolves to something sensible (its last known title) instead of
  // populate() silently returning null and losing the label.
  const propertyIds = [...new Set(enquiries.filter((e) => e.property).map((e) => String(e.property)))];
  const properties = propertyIds.length
    ? await Property.find({ _id: { $in: propertyIds } }).select("title reference")
    : [];
  const propertiesById = new Map(properties.map((p) => [String(p._id), p]));

  return enquiries.map((enquiry) => ({
    _id: enquiry._id,
    name: enquiry.name,
    type: enquiry.type,
    createdAt: enquiry.createdAt,
    propertyLabel: propertyLabelFor(enquiry, propertiesById.get(String(enquiry.property))),
  }));
}

/**
 * Sends the daily digest to every active administrator, if there is anything new to
 * report. Never throws — a bug here must not crash the scheduled cron tick or the
 * server process.
 *
 * Takes: nothing.
 * Returns: a promise resolving once every send has been attempted.
 */
export async function sendDailyDigest() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const enquiries = await getDigestEnquiries(since);

    // Nothing new: skip the admin lookup and send no email at all (§4.3 decision —
    // no "quiet day" heartbeat).
    if (enquiries.length === 0) return;

    const [admins, settings] = await Promise.all([
      Agent.find({ role: "administrator", isActive: true }).select("name email"),
      Settings.get(),
    ]);

    const { subject, html } = adminDailyDigest({
      enquiries,
      agencyName: settings.agencyName,
      clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
    });

    // One admin's failed send must not stop the others.
    await Promise.all(
      admins.map(async (admin) => {
        try {
          await sendEmail({ to: admin.email, subject, html });
        } catch (error) {
          logger.error(`Daily digest send failed for ${admin.email}: ${error.message}`);
        }
      })
    );
  } catch (error) {
    logger.error(`Daily digest failed: ${error.message}`);
  }
}
