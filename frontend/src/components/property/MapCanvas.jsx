"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/**
 * The actual Leaflet canvas. Split from PropertyMap so the parent can load it with
 * ssr:false — Leaflet touches `window` at import time and cannot be server-rendered.
 *
 * OpenStreetMap tiles: free, and avoids Google Maps' dollar-denominated per-view
 * billing (scope §10).
 */

// Leaflet's default marker icon resolves image paths relative to its own CSS, which the
// bundler rewrites — the icons 404 without an explicit definition. A divIcon also lets
// the pin use the theme's accent token rather than a bundled PNG.
const markerIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--color-accent);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapCanvas({ lat, lng, landmark, title }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      // Scroll-wheel zoom is off: a map that swallows page scroll is a usability trap.
      scrollWheelZoom={false}
      className="h-80 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={markerIcon}>
        <Popup>
          {title}
          {landmark ? ` — ${landmark}` : ""}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
