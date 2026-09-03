import { FiPhone, FiMessageCircle, FiUser } from "react-icons/fi";
import siteConfig from "@/config/site";

/**
 * The assigned agent, with the two contact routes that actually convert in this market:
 * a phone call and a WhatsApp click-to-chat link (scope §10 — click-to-chat, not the
 * Business API).
 *
 * `agent.photo` is frequently absent on real data, so a neutral icon stands in.
 */
export default function AgentCard({ agent, property }) {
  // Fall back to the agency's own numbers when a listing has no assigned agent.
  const phone = agent?.phone ?? siteConfig.phone;
  const whatsapp = (agent?.whatsapp ?? siteConfig.whatsapp).replace(/\D/g, "");

  // Pre-filling the reference saves the prospect explaining which listing they mean.
  const whatsappMessage = encodeURIComponent(
    `Hello, I'm interested in ${property.title} (${property.reference}).`,
  );

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/5 text-muted">
          <FiUser size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="text-ink">{agent?.name ?? siteConfig.name}</p>
          <p className="text-sm text-muted">{agent?.position ?? "Sales team"}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <a
          href={`tel:${phone}`}
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          Call {phone}
        </a>

        <a
          href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded border border-border px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
