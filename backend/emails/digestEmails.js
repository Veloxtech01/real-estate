import { layout, escape, formatWhen } from "./layout.js";

/**
 * Email template for the admin daily digest (§4.3).
 *
 * Summarises the last 24h of new enquiries for an administrator, one row per
 * enquiry, each linking straight into the admin inbox's `?id=` row so a click opens
 * the exact record instead of the whole list.
 */

/**
 * Builds the admin daily-digest email.
 *
 * Takes: { enquiries, agencyName, clientUrl } — `enquiries` is an array of plain
 * objects with { _id, name, type, createdAt, propertyLabel }; `propertyLabel` is
 * precomputed by the caller (title/reference, a fallback location, or the type) so
 * this template stays a pure string builder with no DB lookups of its own.
 * Returns: { subject, html }.
 */
export function adminDailyDigest({ enquiries, agencyName, clientUrl }) {
  const count = enquiries.length;
  const subject = `Daily digest: ${count} new ${count === 1 ? "enquiry" : "enquiries"}`;

  const rows = enquiries
    .map(
      (enquiry) => `
    <p style="margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
      <strong>${escape(enquiry.name)}</strong> — ${escape(enquiry.propertyLabel)}<br>
      <span style="color:#64748b;">${escape(formatWhen(enquiry.createdAt))}</span><br>
      <a href="${clientUrl}/admin/enquiries?id=${enquiry._id}">View in admin</a>
    </p>`
    )
    .join("");

  const html = layout(
    `Daily digest — ${escape(agencyName)}`,
    `<p>${count} new ${count === 1 ? "enquiry" : "enquiries"} in the last 24 hours:</p>${rows}`
  );

  return { subject, html };
}
