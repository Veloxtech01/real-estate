import { formatArea, humanise, formatRentPeriod } from "@/lib/format";

/**
 * The specification table for a listing.
 *
 * Rows are built conditionally and empty ones are dropped, so land (no bedrooms) and
 * a flat (no land title) each render a sensible table rather than a grid of dashes.
 */
export default function KeyFacts({ property }) {
  const rows = [];

  rows.push({ label: "Reference", value: property.reference });
  rows.push({ label: "Type", value: humanise(property.propertyType) });

  // Room counts are meaningless on land and commercial stock.
  if (property.bedrooms > 0) {
    rows.push({ label: "Bedrooms", value: property.bedrooms });
    // Bathrooms and toilets are separate counts and genuinely differ — both shown.
    rows.push({ label: "Bathrooms", value: property.bathrooms });
    rows.push({ label: "Toilets", value: property.toilets });
  }

  if (property.boysQuarters > 0) {
    rows.push({ label: "Boys quarters", value: property.boysQuarters });
  }

  if (property.parkingSpaces > 0) {
    rows.push({ label: "Parking", value: `${property.parkingSpaces} spaces` });
  }

  // Always square metres — a "plot" denotes different areas by location.
  const area = formatArea(property.landSizeSqm);
  if (area) rows.push({ label: "Land size", value: area });

  if (property.titleType) {
    rows.push({ label: "Land title", value: humanise(property.titleType) });
  }

  // Rent terms carry real weight here: the advance requirement is often the deciding
  // factor, and it is legally capped at one year in Lagos.
  if (property.listingType === "rent" && property.rent?.advanceYears) {
    rows.push({
      label: "Advance",
      value: `${property.rent.advanceYears} year${property.rent.advanceYears === 1 ? "" : "s"}`,
    });
    rows.push({ label: "Rent period", value: formatRentPeriod(property.rent.period) });
  }

  if (property.landmark) {
    rows.push({ label: "Landmark", value: property.landmark });
  }

  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">{row.label}</dt>
          <dd className="tabular mt-1 text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
