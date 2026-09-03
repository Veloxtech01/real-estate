import { whatsappLink } from "../utils/emailService.js";

/**
 * Email templates for enquiries and viewing requests (§4.3).
 *
 * Plain, table-free HTML on purpose: these are operational notifications read on a
 * phone, not marketing mail, and the agent's next action should be one tap away.
 */

/** Shared wrapper so every notification looks consistent without a template engine. */
function layout(title, bodyHtml) {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
  <h2 style="margin:0 0 16px;">${title}</h2>
  ${bodyHtml}
</body></html>`;
}

/**
 * Escapes user-supplied text before it goes into an HTML email.
 *
 * Enquiry fields come from a public form, so they are untrusted — unescaped markup
 * would render inside the agent's mail client.
 *
 * Takes: value (unknown).
 * Returns: an HTML-safe string.
 */
function escape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notification sent to the assigned agent when an enquiry arrives.
 *
 * Takes: { enquiry, property } — the saved enquiry and its property (may be null).
 * Returns: { subject, html }.
 */
export function agentEnquiryNotification({ enquiry, property }) {
  const propertyLine = property
    ? `<p><strong>Property:</strong> ${escape(property.title)} (${escape(property.reference)})</p>`
    : "<p><strong>Property:</strong> general enquiry</p>";

  // §4.3 requires the click-to-chat link in this email — WhatsApp is how these
  // conversations actually continue in this market.
  const chat = whatsappLink(
    enquiry.phone,
    property
      ? `Hello ${enquiry.name}, thank you for your enquiry about ${property.title}.`
      : `Hello ${enquiry.name}, thank you for your enquiry.`
  );

  const html = layout(
    "New enquiry",
    `
    ${propertyLine}
    <p><strong>Name:</strong> ${escape(enquiry.name)}</p>
    <p><strong>Phone:</strong> ${escape(enquiry.phone)}</p>
    ${enquiry.email ? `<p><strong>Email:</strong> ${escape(enquiry.email)}</p>` : ""}
    ${enquiry.message ? `<p><strong>Message:</strong><br>${escape(enquiry.message)}</p>` : ""}
    ${chat ? `<p><a href="${chat}" style="display:inline-block;padding:10px 16px;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;">Reply on WhatsApp</a></p>` : ""}
  `
  );

  return { subject: `New enquiry from ${enquiry.name}`, html };
}

/**
 * Confirmation sent to the prospect.
 *
 * Takes: { enquiry, property, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectEnquiryConfirmation({ enquiry, property, agencyName }) {
  const html = layout(
    "We've received your enquiry",
    `
    <p>Hello ${escape(enquiry.name)},</p>
    <p>Thank you for contacting ${escape(agencyName)}. ${
      property
        ? `We have received your enquiry about <strong>${escape(property.title)}</strong>.`
        : "We have received your enquiry."
    }</p>
    <p>One of our agents will be in touch shortly.</p>
  `
  );

  return { subject: `We've received your enquiry — ${agencyName}`, html };
}

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
