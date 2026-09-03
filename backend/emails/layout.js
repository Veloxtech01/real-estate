/**
 * Shared building blocks for every transactional email (§4.3).
 *
 * Extracted so enquiry and viewing templates can live in separate files without one
 * importing the other's internals. Plain, table-free HTML on purpose: these are
 * operational notifications read on a phone, not marketing mail.
 */

/** Shared wrapper so every notification looks consistent without a template engine. */
export function layout(title, bodyHtml) {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
  <h2 style="margin:0 0 16px;">${title}</h2>
  ${bodyHtml}
</body></html>`;
}

/**
 * Escapes user-supplied text before it goes into an HTML email.
 *
 * Lead fields come from a public form, so they are untrusted — unescaped markup would
 * render inside the agent's mail client.
 *
 * Takes: value (unknown).
 * Returns: an HTML-safe string.
 */
export function escape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format a date for a Nigerian reader: weekday, date, month, then the time.
 *
 * Used wherever an appointment time is shown to a prospect. UTC strings are fine for
 * an internal agent notification but read as unfriendly to a customer.
 *
 * Takes: date (Date | string | null).
 * Returns: a formatted string, or a placeholder when there is no date yet.
 */
export function formatWhen(date) {
  if (!date) return "a time to be confirmed";

  return new Date(date).toLocaleString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
