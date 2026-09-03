import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/search/SearchBar";
import PropertyGrid from "@/components/property/PropertyGrid";
import { getFeatured, getLocations } from "@/lib/api/server";
import homeContent from "@/content/home";
import siteConfig from "@/config/site";

/**
 * Homepage.
 *
 * Search is the hero, not a slogan over a stock photo: reducing friction to the first
 * search is the whole conversion path for a lead-generation site (design system §1).
 * Server-rendered so the featured listings are in the initial HTML for crawlers.
 */
export default async function HomePage() {
  // Both reads are independent — fetch them together rather than in series.
  //
  // Locations are fetched unfiltered on purpose: `isPublished` gates whether an area
  // has its own landing page, and those are a later slice. These tiles are just
  // pre-filtered searches, so an unpublished area is still a valid destination. Add
  // `{ published: true }` here when /area/[slug] pages exist.
  const [featured, locations] = await Promise.all([getFeatured(6), getLocations()]);

  const properties = featured?.properties ?? [];
  // Show a manageable strip of areas; the full list lives on the search page filter.
  const areas = (locations?.locations ?? []).slice(0, 8);

  return (
    <>
      {/* Hero — oversized display type, then the search bar as the primary CTA. */}
      <Container className="py-20 md:py-28 lg:py-36">
        <div className="max-w-4xl">
          <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            {homeContent.hero.heading}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-ink-soft">
            {homeContent.hero.subheading}
          </p>
        </div>

        <div className="mt-10 max-w-3xl">
          <SearchBar />
        </div>

        {/* Quick entry points beneath the search field. */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/properties?listingType=sale" variant="secondary">
            Homes for sale
          </Button>
          <Button href="/properties?listingType=rent" variant="secondary">
            Homes to let
          </Button>
          <Button href="/properties?propertyType=land" variant="secondary">
            Land
          </Button>
        </div>
      </Container>

      {/* Featured listings. Section is omitted entirely when nothing is featured —
          an empty rail looks like a fault. */}
      {properties.length > 0 && (
        <Section
          eyebrow={homeContent.featured.eyebrow}
          title={homeContent.featured.title}
          description={homeContent.featured.description}
          className="bg-surface-raised"
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

      {/* Browse by area — each tile is a pre-filtered search, not a separate page,
          because area landing pages are a later slice. */}
      {areas.length > 0 && (
        <Section
          eyebrow={homeContent.areas.eyebrow}
          title={homeContent.areas.title}
          description={homeContent.areas.description}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((area) => (
              <Link
                key={area._id}
                href={`/properties?location=${area.slug}`}
                className="group flex min-h-16 items-center justify-between rounded-lg border border-border bg-surface-raised px-5 py-4 transition-colors duration-200 hover:border-accent"
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

      {/* Trust points */}
      <Section
        eyebrow={homeContent.trust.eyebrow}
        title={homeContent.trust.title}
        className="bg-surface-raised"
      >
        <div className="grid gap-10 md:grid-cols-3">
          {homeContent.trust.points.map((point) => (
            <div key={point.title}>
              {/* Gold hairline as the accent — gold text at this size would fail AA. */}
              <div className="mb-5 h-px w-12 bg-accent" />
              <h3 className="text-xl text-ink">{point.title}</h3>
              <p className="mt-3 max-w-[42ch] text-ink-soft">{point.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Seller/landlord CTA — the §3 "list your property" pipeline. Until that page
          exists this dials the office, which is still a lead. */}
      <Section>
        <div className="rounded-lg bg-ink px-8 py-14 text-center md:px-16 md:py-20">
          <h2 className="mx-auto max-w-[24ch] text-3xl text-white md:text-4xl">
            {homeContent.cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[56ch] text-white/70">{homeContent.cta.body}</p>
          <a
            href={`tel:${siteConfig.phone}`}
            className="mt-8 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded bg-white px-7 text-sm font-medium text-ink transition-colors duration-200 hover:bg-white/90"
          >
            {homeContent.cta.action}
            <FiArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Section>
    </>
  );
}
