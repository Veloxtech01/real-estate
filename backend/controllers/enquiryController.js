import Enquiry from "../model/enquiryModel.js";
import Viewing from "../model/viewingModel.js";
import Property from "../model/propertyModel.js";
import Agent from "../model/agentModel.js";
import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { sendEmail } from "../utils/emailService.js";
import {
  agentEnquiryNotification,
  prospectEnquiryConfirmation,
} from "../emails/enquiryEmails.js";
import {
  agentViewingNotification,
  prospectViewingConfirmation,
} from "../emails/viewingEmails.js";
import { ENQUIRY_TYPES, ENQUIRY_SOURCES } from "../utils/constants.js";

/**
 * Lead capture — the commercial purpose of the entire site (§1).
 *
 * The governing rule in here: **saving the lead must never fail because of a side
 * effect.** Email, analytics and view counts are all best-effort; the enquiry itself
 * is the only thing that cannot be reconstructed if it is lost.
 */

/**
 * Resolves the property an enquiry refers to, by id or slug.
 *
 * Takes: identifier (string | undefined) — a property id or SEO slug.
 * Returns: a promise resolving to the Property document, or null.
 * Throws: ApiError 404 when an identifier was supplied but matches nothing — a
 *         silent null there would file the lead against no property at all.
 */
async function resolveProperty(identifier) {
  if (!identifier) return null;

  const property = await Property.findOne({
    // Accept either, because the front end has the slug on a detail page and the id
    // in a search result.
    $or: [
      { slug: String(identifier) },
      ...(/^[0-9a-fA-F]{24}$/.test(identifier) ? [{ _id: identifier }] : []),
    ],
    deletedAt: null,
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
}

/**
 * Picks the recipient for an agent notification.
 *
 * Takes: agentId (ObjectId | null).
 * Returns: a promise resolving to { email, name } or null when there is nobody to
 *          notify — an unassigned listing falls back to the agency inbox.
 */
async function resolveNotificationRecipient(agentId) {
  if (agentId) {
    const agent = await Agent.findById(agentId).select("name email isActive");
    // A deactivated agent's inbox may be unmonitored; fall through to the agency.
    if (agent?.isActive) return { email: agent.email, name: agent.name };
  }

  const settings = await Settings.get();
  return settings.email ? { email: settings.email, name: settings.agencyName } : null;
}

/**
 * POST /api/enquiries — submit an enquiry.
 *
 * Body: { name, phone, email?, message?, type?, source?, property?, requirement?,
 *         consentGiven?, marketingOptIn? }
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends 201 with { success, data: { enquiry } }.
 * Throws: ApiError 400 on missing required fields, 404 on an unknown property.
 */
export async function createEnquiry(req, res) {
  const { name, phone, email, message, requirement } = req.body ?? {};

  // Validated at the boundary before anything touches the database.
  if (!name?.trim() || !phone?.trim()) {
    throw new ApiError(400, "Name and phone number are required", {
      ...(name?.trim() ? {} : { name: "Name is required" }),
      ...(phone?.trim() ? {} : { phone: "Phone number is required" }),
    });
  }

  // Unknown enum values are replaced with defaults rather than rejected — a stale
  // front end shouldn't cost the agency a lead over a source label.
  const type = ENQUIRY_TYPES.includes(req.body.type) ? req.body.type : "property_enquiry";
  const source = ENQUIRY_SOURCES.includes(req.body.source) ? req.body.source : "contact_page";

  const property = await resolveProperty(req.body.property);

  const consentGiven = req.body.consentGiven === true;

  const enquiry = await Enquiry.create({
    type,
    source,
    property: property?._id ?? null,
    // Denormalised now so reassigning the listing later doesn't move historic leads.
    agent: property?.agent ?? null,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim(),
    message: message?.trim(),
    // The §5.5 no-match alert stores the unmet requirement so the agency can match it
    // against new stock.
    requirement,
    consentGiven,
    // NDPA (§11): record when consent was given, not merely that it was.
    consentedAt: consentGiven ? new Date() : undefined,
    marketingOptIn: req.body.marketingOptIn === true,
  });

  // Respond before the mail round trip — the visitor shouldn't wait on Resend.
  res.status(201).json({
    success: true,
    data: {
      enquiry: {
        id: enquiry._id,
        type: enquiry.type,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
      },
    },
  });

  // --- Best-effort notifications (§4.3) ---------------------------------------
  void (async () => {
    try {
      const settings = await Settings.get();
      const recipient = await resolveNotificationRecipient(enquiry.agent);

      if (recipient) {
        const { subject, html } = agentEnquiryNotification({ enquiry, property });
        await sendEmail({
          to: recipient.email,
          subject,
          html,
          // So the agent can reply straight to the prospect.
          replyTo: enquiry.email,
        });
      }

      if (enquiry.email) {
        const confirmation = prospectEnquiryConfirmation({
          enquiry,
          property,
          agencyName: settings.agencyName,
        });
        await sendEmail({
          to: enquiry.email,
          subject: confirmation.subject,
          html: confirmation.html,
        });
      }
    } catch (error) {
      // Never surfaced to the visitor: the lead is already saved.
      logger.error(`Enquiry notification failed: ${error.message}`);
    }
  })();
}

/**
 * POST /api/viewings — request a viewing.
 *
 * Body: { property, name, phone, email?, requestedFor, enquiry? }
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends 201 with { success, data: { viewing } }.
 * Throws: ApiError 400 on invalid input, 404 on an unknown property.
 */
export async function createViewing(req, res) {
  const { name, phone, email, requestedFor } = req.body ?? {};

  if (!name?.trim() || !phone?.trim()) {
    throw new ApiError(400, "Name and phone number are required");
  }

  const requestedDate = new Date(requestedFor);
  if (Number.isNaN(requestedDate.getTime())) {
    throw new ApiError(400, "A valid requested date is required");
  }

  // A viewing in the past is a data-entry error, not a request anyone can fulfil.
  if (requestedDate.getTime() < Date.now()) {
    throw new ApiError(400, "Requested date must be in the future");
  }

  const property = await resolveProperty(req.body.property);
  if (!property) {
    throw new ApiError(400, "A property is required for a viewing request");
  }

  const viewing = await Viewing.create({
    property: property._id,
    agent: property.agent ?? null,
    enquiry: req.body.enquiry || null,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim(),
    requestedFor: requestedDate,
  });

  res.status(201).json({
    success: true,
    data: {
      viewing: {
        id: viewing._id,
        status: viewing.status,
        requestedFor: viewing.requestedFor,
      },
    },
  });

  // --- Best-effort notifications (§4.3) ---------------------------------------
  void (async () => {
    try {
      const settings = await Settings.get();
      const recipient = await resolveNotificationRecipient(viewing.agent);

      if (recipient) {
        const { subject, html } = agentViewingNotification({ viewing, property });
        await sendEmail({ to: recipient.email, subject, html, replyTo: viewing.email });
      }

      if (viewing.email) {
        const confirmation = prospectViewingConfirmation({
          viewing,
          property,
          agencyName: settings.agencyName,
        });
        await sendEmail({
          to: viewing.email,
          subject: confirmation.subject,
          html: confirmation.html,
        });
      }
    } catch (error) {
      logger.error(`Viewing notification failed: ${error.message}`);
    }
  })();
}
