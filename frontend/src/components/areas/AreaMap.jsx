"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper around MapCanvas for an area's centre pin.
 *
 * Next.js forbids `ssr: false` on `next/dynamic` inside a Server Component — the area
 * detail page itself is one, so this thin wrapper exists purely to hold the dynamic
 * import. OfficeMap.jsx does the same thing for the office pin, for the same reason.
 */
const MapCanvas = dynamic(() => import("@/components/property/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-white/5" />,
});

export default function AreaMap({ lat, lng, title }) {
  return <MapCanvas lat={lat} lng={lng} title={title} />;
}
