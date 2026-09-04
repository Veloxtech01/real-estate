import Section from "@/components/ui/Section";
import TeamCard from "@/components/team/TeamCard";
import { getAgents } from "@/lib/api/server";
import siteConfig from "@/config/site";

export const metadata = {
  title: `Meet the team | ${siteConfig.name}`,
  description: "The consultants behind every listing.",
};

/**
 * Team roster (§3) — trust signals and the entry point to each agent's own
 * profile/referral page.
 */
export default async function TeamPage() {
  const data = await getAgents();
  const agents = data?.agents ?? [];

  return (
    <Section eyebrow="Meet the team" title="The people behind every listing" tone="light">
      {agents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <TeamCard key={agent._id} agent={agent} />
          ))}
        </div>
      ) : (
        // An empty roster must not render as a broken grid — the seed always
        // produces public agents, but a fresh client copy might not yet.
        <p className="text-ink-soft">Our team profiles will be here shortly — call us in the meantime.</p>
      )}
    </Section>
  );
}
