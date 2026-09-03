import siteConfig from "@/config/site";
import { coverImageOf, priceOf, isRental } from "@/lib/property";
import { humanise } from "@/lib/format";

/**
 * SEO helpers — page metadata and structured data.
 *
 * Organic search is the primary acquisition channel (scope §4.4), so this is a product
 * requirement rather than polish. Structured data is generated from the API record, so
 * it can never disagree with what the page displays.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Next `metadata` object for a listing: title, description, canonical, OG image. */
export function propertyMetadata(property) {
  const price = priceOf(property);
  const cover = coverImageOf(property);
  const url = `${SITE_URL}/property/${property.slug}`;

  // Front-load the facts a searcher scans in a result: type, area, price.
  const description = `${humanise(property.propertyType)} ${
    isRental(property) ? "to let" : "for sale"
  } in ${property.location?.name}, ${property.state}. ${price.label}${
    price.suffix ? ` ${price.suffix}` : ""
  }. ${property.description?.slice(0, 120) ?? ""}`.trim();

  return {
    title: property.title,
    description,
    // Canonical prevents filter-parameter variants competing with the listing itself.
    alternates: { canonical: url },
    openGraph: {
      title: property.title,
      description,
      url,
      type: "website",
      // A local placeholder is still a valid share image — better than none.
      images: [{ url: cover.url, alt: cover.alt }],
    },
  };
}

/** `RealEstateListing` structured data for a single property. */
export function propertyJsonLd(property) {
  const cover = coverImageOf(property);
  const rental = isRental(property);
  const amount = rental ? property.rent?.amount : property.price?.amount;

  const data = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: property.description,
    url: `${SITE_URL}/property/${property.slug}`,
    image: cover.url,
    datePosted: property.publishedAt,
    address: {
      "@type": "PostalAddress",
      addressLocality: property.location?.name,
      addressRegion: property.state,
      addressCountry: "NG",
    },
  };

  // Only emit an offer when there is a real figure — "price on request" is a genuine
  // state and inventing a 0 here would be a false claim in search results.
  if (amount != null) {
    data.offers = {
      "@type": "Offer",
      price: amount,
      priceCurrency: property.price?.currency ?? "NGN",
      availability:
        property.status === "available"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    };
  }

  if (property.bedrooms > 0) {
    data.numberOfBedrooms = property.bedrooms;
    data.numberOfBathroomsTotal = property.bathrooms;
  }

  if (property.landSizeSqm) {
    data.floorSize = {
      "@type": "QuantitativeValue",
      value: property.landSizeSqm,
      unitCode: "MTK", // UN/CEFACT code for square metre
    };
  }

  return data;
}

/** Breadcrumb trail matching the visible navigation on the detail page. */
export function breadcrumbJsonLd(property) {
  const items = [
    { name: "Home", url: SITE_URL },
    { name: "Properties", url: `${SITE_URL}/properties` },
  ];

  if (property.location?.slug) {
    items.push({
      name: property.location.name,
      url: `${SITE_URL}/properties?location=${property.location.slug}`,
    });
  }

  items.push({ name: property.title, url: `${SITE_URL}/property/${property.slug}` });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Site-level `RealEstateAgent` data, emitted once from the root layout. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    description: siteConfig.description,
    url: SITE_URL,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: { "@type": "PostalAddress", streetAddress: siteConfig.address, addressCountry: "NG" },
    sameAs: Object.values(siteConfig.socials).filter(Boolean),
  };
}
