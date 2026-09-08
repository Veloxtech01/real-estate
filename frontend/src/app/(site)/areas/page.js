import Link from "next/link";
import { FiArrowRight, FiMapPin } from "react-icons/fi";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { getLocations } from "@/lib/api/server";
import areasContent from "@/content/areas";

// Root layout's title template appends " — {siteConfig.name}" — don't repeat it here.
export const metadata = {
  title: areasContent.title,
  description: areasContent.intro,
};

/**
 * "Areas we cover" (§4.1) — an index of published neighbourhood pages, grouped by
 * state. Only published areas are fetched: an unpublished one has no landing page to
 * link to (its detail route 404s), so listing it here would be a dead link.
 */
export default async function AreasPage() {
  const data = await getLocations({ published: true });
  const locations = data?.locations ?? [];

  // Group by state — the API already sorts { state: 1, name: 1 }, so this is a single
  // pass, not a re-sort.
  const byState = locations.reduce((groups, location) => {
    (groups[location.state] ??= []).push(location);
    return groups;
  }, {});

  return (
    <Section
      eyebrow={areasContent.eyebrow}
      title={areasContent.title}
      description={areasContent.intro}
      tone="light"
    >
      {locations.length > 0 ? (
        <div className="space-y-12">
          {Object.entries(byState).map(([state, areas]) => (
            <div key={state}>
              <h3 className="text-lg text-ink-soft">{state}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((area) => (
                  <Link
                    key={area._id}
                    href={`/areas/${area.slug}`}
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
            </div>
          ))}
        </div>
      ) : (
        // Honest empty state — never a blank page. Same reasoning as EmptyResults, but
        // this is about no areas being published yet, not a search returning nothing.
        <div className="rounded-lg border border-border bg-surface-raised px-6 py-16 text-center">
          <FiMapPin size={32} className="mx-auto text-muted" aria-hidden="true" />
          <h2 className="mt-5 text-2xl text-ink">We haven&apos;t published area guides yet</h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
            Our full catalogue is still searchable by location in the meantime.
          </p>
          <div className="mt-8">
            <Button href="/properties">Browse all listings</Button>
          </div>
        </div>
      )}
    </Section>
  );
}
