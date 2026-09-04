"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper around MapCanvas for the office pin.
 *
 * Next.js forbids `ssr: false` on `next/dynamic` inside a Server Component — the
 * contact page itself is one, so this thin wrapper exists purely to hold the
 * dynamic import. PropertyMap.jsx does the same thing for listing pins, for the
 * same reason.
 */
const MapCanvas = dynamic(() => import("@/components/property/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-ink/5" />,
});

export default function OfficeMap({ lat, lng, landmark, title }) {
  return <MapCanvas lat={lat} lng={lng} landmark={landmark} title={title} />;
}
