import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import PropertyGallery from "@/components/property/PropertyGallery";
import PropertyGrid from "@/components/property/PropertyGrid";
import KeyFacts from "@/components/property/KeyFacts";
import AgentCard from "@/components/property/AgentCard";
import PropertyMap from "@/components/property/PropertyMap";
import EnquiryForm from "@/components/forms/EnquiryForm";
import { getProperty, getSettings } from "@/lib/api/server";
import { priceOf, statusLabel, coverImageOf } from "@/lib/property";
import { humanise } from "@/lib/format";
import { propertyMetadata, propertyJsonLd, breadcrumbJsonLd } from "@/lib/seo";

/**
 * Per-listing metadata: title, description, canonical URL and the Open Graph image.
 * Next 16: `params` is a Promise.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getProperty(slug);
  // A missing listing gets generic metadata; the page itself will 404.
  if (!data?.property) return { title: "Property not found" };
  return propertyMetadata(data.property);
}

/**
 * Property detail page — the conversion endpoint of the whole site.
 *
 * Server-rendered: this is the page organic search lands on, so the content, price and
 * structured data must all be in the initial HTML.
 */
export default async function PropertyPage({ params }) {
  const { slug } = await params;

  // The disclaimer is the one piece of chrome still read from the API — it carries
  // legal exposure (scope §11) and must match what the backend holds.
  const [data, settings] = await Promise.all([getProperty(slug), getSettings()]);

  // Drafts and soft-deleted listings return 404 from the API and must 404 here too —
  // a different response would leak that the reference exists.
  if (!data?.property) notFound();

  const { property, gallery = [], similar = [] } = data;
  const price = priceOf(property);
  const status = statusLabel(property.status);
  const cover = coverImageOf(property);

  // Gallery falls back to the cover image so a single-image listing still shows one.
  const images = gallery.length > 0 ? gallery : [{ _id: "cover", url: cover.url, alt: cover.alt }];

  return (
    <>
      {/* Structured data for the listing and its breadcrumb trail. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertyJsonLd(property)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(property)) }}
      />

      <Container className="py-8 md:py-12">
        {/* Breadcrumb — also the fastest route back to a broader search. */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm text-muted">
          <Link href="/" className="transition-colors duration-200 hover:text-ink">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/properties" className="transition-colors duration-200 hover:text-ink">
            Properties
          </Link>
          {property.location?.slug && (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/properties?location=${property.location.slug}`}
                className="transition-colors duration-200 hover:text-ink"
              >
                {property.location.name}
              </Link>
            </>
          )}
        </nav>

        <PropertyGallery images={images} title={property.title} />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
          {/* Main column */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone="muted">{humanise(property.propertyType)}</Badge>
              <Badge tone="muted">
                {property.listingType === "rent" ? "To let" : "For sale"}
              </Badge>
            </div>

            <h1 className="mt-4 text-3xl text-ink md:text-4xl">{property.title}</h1>
            <p className="mt-3 text-ink-soft">
              {property.location?.name}, {property.state} — {property.landmark}
            </p>

            {/* Price block. The rent period is always spelled out. */}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="tabular font-display text-4xl text-ink">{price.label}</span>
              {price.suffix && <span className="text-ink-soft">{price.suffix}</span>}
              {price.isNegotiable && <Badge tone="accent">Negotiable</Badge>}
            </div>

            <div className="mt-10">
              <h2 className="text-2xl text-ink">About this property</h2>
              {/* Capped line length keeps the description readable. */}
              <p className="mt-4 max-w-[68ch] whitespace-pre-line text-ink-soft">
                {property.description}
              </p>
            </div>

            <div className="mt-10">
              <h2 className="mb-5 text-2xl text-ink">Key facts</h2>
              <KeyFacts property={property} />
            </div>

            {/* Amenities come back as taxonomy terms with ready-made names. */}
            {property.tags?.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-5 text-2xl text-ink">Features and amenities</h2>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {property.tags.map((tag) => (
                    <li key={tag._id} className="flex items-center gap-2 text-ink-soft">
                      <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                      {tag.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10">
              <h2 className="mb-5 text-2xl text-ink">Location</h2>
              <PropertyMap
                coordinates={property.coordinates}
                landmark={property.landmark}
                title={property.title}
              />
            </div>

            {/* Statutory disclaimer — required on every property page (scope §11). */}
            {settings?.settings?.listingDisclaimer && (
              <p className="mt-12 max-w-[68ch] border-t border-border pt-6 text-sm text-muted">
                {settings.settings.listingDisclaimer}
              </p>
            )}
          </div>

          {/* Contact rail — sticky on desktop so the conversion path is always visible. */}
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <AgentCard agent={property.agent} property={property} />
            <EnquiryForm property={property} />
          </aside>
        </div>
      </Container>

      {/* Similar listings keep a visitor moving when this one is not right. */}
      {similar.length > 0 && (
        <Container className="pb-20">
          <h2 className="mb-8 text-2xl text-ink">Similar properties</h2>
          <PropertyGrid properties={similar} />
        </Container>
      )}
    </>
  );
}
