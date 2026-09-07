import { FiTrendingUp, FiShield, FiDollarSign } from "react-icons/fi";
import Section from "@/components/ui/Section";
import ListPropertyForm from "@/components/forms/ListPropertyForm";
import { getFilters } from "@/lib/api/server";
import listYourPropertyContent from "@/content/listYourProperty";

// Positional icon set for the trust points — same pattern as about/page.js's
// VALUE_ICONS: icons live in the page, not the content module.
const TRUST_ICONS = [FiTrendingUp, FiShield, FiDollarSign];

// Root layout's title template appends " — {siteConfig.name}" — don't repeat it here.
export const metadata = {
  title: "List your property",
  description: listYourPropertyContent.intro,
};

/**
 * "List your property with us" (§3) — the agency's supply pipeline, and per the scope
 * doc "arguably the most commercially valuable page" on the site.
 *
 * Reuses the existing enquiry pipeline end to end: no new model, route or controller.
 * `propertyTypes` comes from the same GET /api/filters read the homepage's hero panel
 * already makes, so the form can never offer a type the DB doesn't have.
 */
export default async function ListYourPropertyPage() {
  const filters = await getFilters();

  return (
    <>
      <Section
        eyebrow={listYourPropertyContent.eyebrow}
        title={listYourPropertyContent.title}
        description={listYourPropertyContent.intro}
        tone="dark"
      >
        <div className="max-w-[68ch]">
          <h3 className="text-xl text-white">{listYourPropertyContent.pitch.heading}</h3>
          <p className="mt-3 text-white/70">{listYourPropertyContent.pitch.body}</p>
        </div>

        {/* Seller-facing trust points — distinct from About's buyer-facing ones. */}
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {listYourPropertyContent.trustPoints.map((point, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div key={point.title}>
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

      <Section tone="light">
        <div className="mx-auto max-w-xl">
          <ListPropertyForm
            propertyTypes={filters?.propertyTypes ?? []}
            heading={listYourPropertyContent.form.heading}
            subheading={listYourPropertyContent.form.subheading}
          />
        </div>
      </Section>
    </>
  );
}
