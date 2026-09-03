"use client";

import dynamic from "next/dynamic";
import { FiMapPin } from "react-icons/fi";

/**
 * Map pin for a listing.
 *
 * Loaded client-only: Leaflet reads `window` on import, so server rendering it throws.
 * The skeleton reserves the same height, so nothing reflows when the map arrives.
 */
const MapCanvas = dynamic(() => import("@/components/property/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-ink/5" />,
});

export default function PropertyMap({ coordinates, landmark, title }) {
  // Nigerian addresses geocode unreliably and many listings have no pin at all
  // (scope §10.2) — the landmark is the required field, so it stands alone here.
  const point = coordinates?.coordinates;

  if (!point || point.length !== 2) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-6">
        <FiMapPin size={20} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
        <div>
          <p className="text-ink">{landmark}</p>
          <p className="mt-1 text-sm text-muted">
            No map pin has been set for this listing. Call us for directions.
          </p>
        </div>
      </div>
    );
  }

  // GeoJSON order is [longitude, latitude]; Leaflet wants [lat, lng].
  const [lng, lat] = point;

  return (
    <div>
      <MapCanvas lat={lat} lng={lng} landmark={landmark} title={title} />
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <FiMapPin size={14} aria-hidden="true" />
        {landmark}
      </p>
    </div>
  );
}
