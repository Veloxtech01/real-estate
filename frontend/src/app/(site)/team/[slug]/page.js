import { notFound } from "next/navigation";
import { FiPhone, FiMessageCircle } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { getAgent } from "@/lib/api/server";

/** Next 16: params is a Promise. A missing/private/inactive agent gets generic metadata. */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getAgent(slug);
  if (!data?.agent) return { title: "Agent not found" };
  return {
    title: data.agent.name,
    description: data.agent.bio || `Get in touch with ${data.agent.name}.`,
  };
}

/**
 * Agent profile — the §3 referral landing page.
 *
 * Call/WhatsApp only, deliberately — a property-less enquiry form here needs
 * `createEnquiry` to accept an `agent` id directly, which it does not yet (see the
 * design spec's Deferred section). Adding that is a backend change, not this task.
 */
export default async function AgentProfilePage({ params }) {
  const { slug } = await params;
  const data = await getAgent(slug);

  // A private, inactive, or unknown slug all resolve to the same null here,
  // and must all 404 identically — no response may leak which case it was.
  if (!data?.agent) notFound();

  const { agent } = data;
  const whatsapp = agent.whatsapp?.replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hello ${agent.name}, I'd like to talk to you about a property.`,
  );

  return (
    <Container className="py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-ink md:text-4xl">{agent.name}</h1>
        {agent.position && <p className="mt-2 text-ink-soft">{agent.position}</p>}
        {agent.areas?.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Covers {agent.areas.map((area) => area.name).join(", ")}
          </p>
        )}
        {agent.bio && <p className="mt-6 max-w-[60ch] text-ink-soft">{agent.bio}</p>}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {agent.phone && (
            <Button href={`tel:${agent.phone}`} size="lg">
              <FiPhone size={16} aria-hidden="true" />
              Call {agent.phone}
            </Button>
          )}
          {whatsapp && (
            <Button
              href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
              variant="secondary"
              size="lg"
            >
              <FiMessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Container>
  );
}
