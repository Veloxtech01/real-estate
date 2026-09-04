import { FiHome, FiKey, FiClipboard, FiTool, FiTrendingUp, FiMap } from "react-icons/fi";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import servicesContent from "@/content/services";
import siteConfig from "@/config/site";

// Positional icon set, one per entry in servicesContent.items — same pattern as
// the homepage trust band's TRUST_ICONS.
const SERVICE_ICONS = [FiHome, FiKey, FiClipboard, FiTool, FiTrendingUp, FiMap];

export const metadata = {
  title: `Services | ${siteConfig.name}`,
  description: servicesContent.description,
};

/**
 * Services hub (§3) — one page covering all six services rather than six
 * individual pages; see the design spec's services-scope decision.
 */
export default function ServicesPage() {
  return (
    <>
      <Section
        eyebrow={servicesContent.eyebrow}
        title={servicesContent.title}
        description={servicesContent.description}
        tone="dark"
        centered
      />

      <Section tone="light">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {servicesContent.items.map((service, index) => {
            const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length];
            return (
              <div
                key={service.slug}
                className="rounded-lg border border-border bg-surface-raised p-6"
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent-text ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-xl text-ink">{service.title}</h3>
                <p className="mt-3 text-ink-soft">{service.blurb}</p>
                <Button href={service.href} variant="ghost" className="mt-5">
                  Learn more
                </Button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section tone="dark" centered>
        <h2 className="text-3xl text-white md:text-4xl">{servicesContent.cta.title}</h2>
        <p className="mx-auto mt-4 max-w-[56ch] text-white/70">{servicesContent.cta.body}</p>
        <div className="mt-8 flex justify-center">
          <Button href="/contact" variant="accent" size="lg">
            {servicesContent.cta.action}
          </Button>
        </div>
      </Section>
    </>
  );
}
