import Link from "next/link";
import { FiPhone, FiMessageCircle, FiUser } from "react-icons/fi";

/**
 * Team roster card — links to the agent's own profile/referral page (§3).
 *
 * Unlike AgentCard, this has no `property` context: the WhatsApp message is
 * generic and there is no listing reference line. No seeded demo agent has a
 * `photo` set, so — same as AgentCard — a neutral icon stands in rather than
 * building image-loading logic nothing exercises yet.
 */
export default function TeamCard({ agent }) {
  const whatsapp = agent.whatsapp?.replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hello ${agent.name}, I'd like to talk to you about a property.`,
  );

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ink/5 text-muted"
        aria-hidden="true"
      >
        <FiUser size={32} />
      </div>

      <p className="mt-4 text-lg text-ink">{agent.name}</p>
      {agent.position && <p className="text-sm text-muted">{agent.position}</p>}

      <div className="mt-5 flex justify-center gap-3">
        {agent.phone && (
          <a
            href={`tel:${agent.phone}`}
            aria-label={`Call ${agent.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiPhone size={17} aria-hidden="true" />
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`WhatsApp ${agent.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiMessageCircle size={17} aria-hidden="true" />
          </a>
        )}
      </div>

      <Link
        href={`/team/${agent.slug}`}
        className="mt-5 inline-block text-sm text-accent-text hover:underline"
      >
        View profile
      </Link>
    </div>
  );
}
