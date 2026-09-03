import { Resend } from "resend";
import logger from "./logger.js";

/**
 * Transactional email sending (§4.3, §10.1).
 *
 * Wraps Resend so call sites never touch the SDK directly, and so a missing API key
 * degrades to a logged no-op instead of throwing. That matters because email is a
 * side effect of an enquiry: a mail outage must never cost the agency the lead
 * itself, which is the only thing that can't be recovered later.
 */

// Instantiated lazily — the key is often absent in development and in tests.
let client;

/**
 * Returns the Resend client, or null when no API key is configured.
 *
 * Takes: nothing.
 * Returns: a Resend instance or null.
 */
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;

  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Sends one transactional email.
 *
 * Takes: { to, subject, html, replyTo } — `to` may be a string or array.
 * Returns: a promise resolving to { sent: boolean, id?: string, reason?: string }.
 *          Never rejects: callers treat email as best-effort.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  const resend = getClient();

  // No key configured: log what would have been sent so a developer can still see
  // the notification fired, without a hard dependency on a third-party service.
  if (!resend) {
    logger.warn(`Email not sent (RESEND_API_KEY unset): "${subject}" to ${to}`);
    return { sent: false, reason: "not_configured" };
  }

  if (!process.env.MAIL_FROM) {
    logger.warn(`Email not sent (MAIL_FROM unset): "${subject}"`);
    return { sent: false, reason: "no_sender" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      // Lets an agent reply straight to the prospect from their inbox.
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      logger.error(`Email send failed: ${error.message}`);
      return { sent: false, reason: error.message };
    }

    return { sent: true, id: data?.id };
  } catch (error) {
    // Swallowed deliberately — see the note above about never losing the lead.
    logger.error(`Email send threw: ${error.message}`);
    return { sent: false, reason: error.message };
  }
}

/**
 * Builds a WhatsApp click-to-chat link (§10.1 — the Business API is deliberately
 * not used; a link is free, immediate and sufficient).
 *
 * Takes: phone (string) — any format; text (string) — the prefilled message.
 * Returns: a wa.me URL, or null when the number is unusable.
 */
export function whatsappLink(phone, text = "") {
  if (!phone) return null;

  // wa.me needs digits only, no plus sign, spaces or dashes.
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
