import PropertyCard from "@/components/property/PropertyCard";

/**
 * Responsive listing grid: 1 column on mobile, 2 from sm, 3 from lg.
 *
 * The first three cards are marked `priority` because on a desktop results page they
 * are the above-the-fold row; everything after them lazy-loads.
 */
export default function PropertyGrid({ properties = [] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property, index) => (
        <PropertyCard key={property._id} property={property} priority={index < 3} />
      ))}
    </div>
  );
}
