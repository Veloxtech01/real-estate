import { notFound } from "next/navigation";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import PropertyGrid from "@/components/property/PropertyGrid";
import AreaMap from "@/components/areas/AreaMap";
import { getLocation, getProperties } from "@/lib/api/server";

/**
 * Per-area metadata: title, description. Next 16: `params` is a Promise.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getLocation(slug);
  // A missing/unpublished area gets generic metadata; the page itself will 404.
  if (!data?.location) return { title: "Area not found" };

  const { location } = data;
  return {
    title: location.metaTitle || `${location.name} — Areas we cover`,
    description:
      location.metaDescription ||
      location.description ||
      `Homes and land in ${location.name}, ${location.state}.`,
  };
}

/**
 * Area detail page (§4.1) — neighbourhood copy plus a live grid of that area's
 * available listings.
 *
 * `getLocation` 404s (returns null) for an unknown OR unpublished slug — the backend
 * enforces the same draft/deleted parity every other public resource has, so this page
 * doesn't need its own isPublished check.
 */
export default async function AreaPage({ params }) {
  const { slug } = await params;

  const data = await getLocation(slug);
  if (!data?.location) notFound();

  const { location, propertyCount } = data;

  // Only fetch the grid once we know the area exists — no point running a properties
  // query for a page that's about to 404.
  const results = await getProperties({ location: slug, limit: 12, sort: "newest" });
  const properties = results?.properties ?? [];

  // centre is optional — no fabricated coordinates, so the map is simply absent when
  // a location has none, same as siteConfig.officeCoordinates being the only pin that
  // always exists.
  const [lng, lat] = location.centre?.coordinates ?? [];

  return (
    <>
      <Section eyebrow="Areas we cover" title={location.name} tone="dark">
        <p className="text-white/60">{location.state}</p>

        {location.description && (
          <p className="mt-6 max-w-[68ch] whitespace-pre-line text-white/80">
            {location.description}
          </p>
        )}

        {lat != null && lng != null && (
          <div className="mt-8 max-w-2xl">
            <AreaMap lat={lat} lng={lng} title={location.name} />
          </div>
        )}
      </Section>

      <Section tone="light">
        <p className="tabular text-ink-soft">
          {propertyCount} {propertyCount === 1 ? "listing" : "listings"} in{" "}
          {location.name}
        </p>

        <div className="mt-6">
          {properties.length > 0 ? (
            <PropertyGrid properties={properties} />
          ) : (
            // No live listings right now — still a real page, so offer a route onward
            // rather than an empty grid.
            <div className="rounded-lg border border-border bg-surface-raised px-6 py-16 text-center">
              <h2 className="text-2xl text-ink">No listings in this area right now</h2>
              <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
                New stock is added regularly — in the meantime, browse everywhere we
                cover.
              </p>
              <div className="mt-8">
                <Button href="/properties">Browse all listings</Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
