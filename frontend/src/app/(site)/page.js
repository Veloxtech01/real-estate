import Link from "next/link";
import { FiArrowRight, FiShield, FiUser, FiFileText } from "react-icons/fi";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Hero from "@/components/home/Hero";
import StatsBand from "@/components/home/StatsBand";
import Testimonials from "@/components/home/Testimonials";
import PropertyGrid from "@/components/property/PropertyGrid";
import { getFeatured, getLocations, getFilters } from "@/lib/api/server";
import homeContent from "@/content/home";
import siteConfig from "@/config/site";

/**
 * Homepage.
 *
 * Search is the hero, not a slogan over a stock photo: reducing friction to the first
 * search is the whole conversion path for a lead-generation site (design system §1).
 * Server-rendered so the featured listings are in the initial HTML for crawlers.
 *
 * Section grounds alternate — navy hero, ivory featured, navy stats, ivory areas, navy
 * trust, ivory testimonials, navy CTA. That rhythm is the layout's main device: it is
 * also what licenses the gold, which only passes contrast on the dark bands.
 */

// Decorative marks for the three trust points, in content order. Positional rather than
// named in the content file, for the same reason as the stats band's icons.
const TRUST_ICONS = [FiFileText, FiUser, FiShield];

export default async function HomePage() {
  // All three reads are independent — fetch them together rather than in series.
  //
  // Locations are fetched unfiltered on purpose: `isPublished` gates whether an area
  // has its own landing page, and those are a later slice. These tiles are just
  // pre-filtered searches, so an unpublished area is still a valid destination. Add
  // `{ published: true }` here when /area/[slug] pages exist.
  const [featured, locations, filterOptions] = await Promise.all([
    getFeatured(6),
    getLocations(),
    getFilters(),
  ]);

  const properties = featured?.properties ?? [];
  // Show a manageable strip of areas; the full list lives on the search page filter.
  const areas = (locations?.locations ?? []).slice(0, 8);

  return (
    <>
      {/* Hero — photograph under a navy scrim, free-text search, structured panel. */}
      <Hero filterOptions={filterOptions} />

      {/* Featured listings. Section is omitted entirely when nothing is featured —
          an empty rail looks like a fault. */}
      {properties.length > 0 && (
        <Section
          eyebrow={homeContent.featured.eyebrow}
          title={homeContent.featured.title}
          description={homeContent.featured.description}
          tone="light"
        >
          <PropertyGrid properties={properties} />
          <div className="mt-12">
            <Button href="/properties">
              See all listings
              <FiArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </Section>
      )}

      {/* Credibility band on navy — the first hard break from the ivory ground. */}
      <StatsBand />

      {/* Browse by area — each tile is a pre-filtered search, not a separate page,
          because area landing pages are a later slice. */}
      {areas.length > 0 && (
        <Section
          eyebrow={homeContent.areas.eyebrow}
          title={homeContent.areas.title}
          description={homeContent.areas.description}
          tone="light"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((area) => (
              <Link
                key={area._id}
                href={`/properties?location=${area.slug}`}
                className="group flex min-h-16 items-center justify-between rounded-lg border border-border bg-surface-raised px-5 py-4 transition-colors duration-200 hover:border-accent hover:bg-accent/5"
              >
                <span className="text-ink transition-colors duration-200 group-hover:text-accent-text">
                  {area.name}
                </span>
                <FiArrowRight
                  size={16}
                  className="text-muted transition-colors duration-200 group-hover:text-accent-text"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Trust points, on navy so the gold icon discs read. */}
      <Section
        eyebrow={homeContent.trust.eyebrow}
        title={homeContent.trust.title}
        tone="dark"
      >
        <div className="grid gap-10 md:grid-cols-3">
          {homeContent.trust.points.map((point, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div key={point.title}>
                {/* Filled disc rather than the old hairline rule — the whole point of
                    the restyle is that accents have mass instead of being 1px lines. */}
                <div
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-xl text-white">{point.title}</h3>
                <p className="mt-3 max-w-[42ch] text-white/70">{point.body}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Client quotes. Placeholder copy — see content/home.js. */}
      <Testimonials />

      {/* Seller/landlord CTA — the §3 "list your property" pipeline. Until that page
          exists this opens WhatsApp, which is still a lead. */}
      <Section tone="light">
        <div className="on-dark relative isolate overflow-hidden rounded-lg bg-ink px-8 py-14 text-center md:px-16 md:py-20">
          {/* Gold wash behind the panel — decorative depth, no contrast dependency. */}
          <div
            className="absolute inset-0 bg-linear-to-br from-accent/15 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-[24ch] text-3xl text-white md:text-4xl">
              {homeContent.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[56ch] text-white/70">
              {homeContent.cta.body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href={siteConfig.listPropertyHref} variant="accent" size="lg">
                {homeContent.cta.action}
                <FiArrowRight size={16} aria-hidden="true" />
              </Button>
              {/* Phone kept alongside — WhatsApp is not everyone's channel. */}
              <Button
                href={`tel:${siteConfig.phone}`}
                variant="onDarkOutline"
                size="lg"
              >
                {siteConfig.phone}
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
