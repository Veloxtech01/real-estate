import { whatsappLink } from "../utils/emailService.js";
import { layout, escape, formatWhen } from "./layout.js";

/**
 * Email templates for viewing requests and their outcomes (§4.3).
 *
 * Split from enquiryEmails.js by resource, matching how controllers and routes are
 * organised. The first two templates were moved here unchanged; the three response
 * templates below are new and cover what a prospect hears after staff act.
 */

/**
 * Notification sent to the agent when a viewing is requested.
 *
 * Takes: { viewing, property }.
 * Returns: { subject, html }.
 */
export function agentViewingNotification({ viewing, property }) {
  const chat = whatsappLink(
    viewing.phone,
    `Hello ${viewing.name}, regarding your viewing request${property ? ` for ${property.title}` : ""}.`
  );

  const html = layout(
    "New viewing request",
    `
    ${property ? `<p><strong>Property:</strong> ${escape(property.title)} (${escape(property.reference)})</p>` : ""}
    <p><strong>Name:</strong> ${escape(viewing.name)}</p>
    <p><strong>Phone:</strong> ${escape(viewing.phone)}</p>
    <p><strong>Requested for:</strong> ${new Date(viewing.requestedFor).toUTCString()}</p>
    ${chat ? `<p><a href="${chat}">Reply on WhatsApp</a></p>` : ""}
  `
  );

  return { subject: `Viewing request from ${viewing.name}`, html };
}

/**
 * Confirmation sent to the prospect who requested a viewing.
 *
 * Takes: { viewing, property, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingConfirmation({ viewing, property, agencyName }) {
  const html = layout(
    "Your viewing request",
    `
    <p>Hello ${escape(viewing.name)},</p>
    <p>We have received your request to view ${
      property ? `<strong>${escape(property.title)}</strong>` : "a property"
    } on ${new Date(viewing.requestedFor).toUTCString()}.</p>
    <p>We will confirm the appointment shortly.</p>
    <p>— ${escape(agencyName)}</p>
  `
  );

  return { subject: `Your viewing request — ${agencyName}`, html };
}

/**
 * Sent when staff accept a viewing request.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingAccepted({ viewing, agencyName }) {
  const when = formatWhen(viewing.scheduledFor);

  const html = layout(
    "Your viewing is confirmed",
    `
    <p>Hello ${escape(viewing.name)},</p>
    <p>Your viewing is confirmed for <strong>${escape(when)}</strong>.</p>
    ${viewing.responseMessage ? `<p>${escape(viewing.responseMessage)}</p>` : ""}
    <p>If you need to change the time, reply to this email or give us a call.</p>
    <p>— ${escape(agencyName)}</p>
  `
  );

  return { subject: `Your viewing is confirmed — ${when}`, html };
}

/**
 * Sent when staff decline a viewing request.
 *
 * responseMessage carries the reason, so the prospect isn't left guessing why the
 * state changed. The closing line keeps the lead alive rather than ending the thread.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingRejected({ viewing, agencyName }) {
  const html = layout(
    "About your viewing request",
    `
    <p>Hello ${escape(viewing.name)},</p>
    <p>We're sorry — we aren't able to arrange that viewing.</p>
    ${viewing.responseMessage ? `<p>${escape(viewing.responseMessage)}</p>` : ""}
    <p>We'd still be glad to help you find something suitable. Just reply to this email.</p>
    <p>— ${escape(agencyName)}</p>
  `
  );

  return { subject: "About your viewing request", html };
}

/**
 * Sent when staff propose a different time.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingRescheduled({ viewing, agencyName }) {
  const when = formatWhen(viewing.scheduledFor);

  const html = layout(
    "A new time for your viewing",
    `
    <p>Hello ${escape(viewing.name)},</p>
    <p>We've proposed a new time for your viewing: <strong>${escape(when)}</strong>.</p>
    ${viewing.responseMessage ? `<p>${escape(viewing.responseMessage)}</p>` : ""}
    <p>Let us know if that works for you.</p>
    <p>— ${escape(agencyName)}</p>
  `
  );

  return { subject: `A new time for your viewing — ${when}`, html };
}
