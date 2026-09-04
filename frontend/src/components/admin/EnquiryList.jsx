"use client";

import Badge from "@/components/ui/Badge";
import { humanise } from "@/lib/format";

/**
 * Left column of the inbox: one row per lead.
 *
 * Presentational only — it never fetches and holds no state. Selection is owned by the
 * page, which keeps it in the URL.
 */

// Status key -> badge tone. Every badge also carries its label, so status is never
// communicated by colour alone.
const STATUS_TONES = {
  new: "accent",
  contacted: "warning",
  viewing_booked: "success",
  closed: "muted",
};

/** "2h ago" — precise timestamps are noise in a list scanned for freshness. */
function relativeTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function EnquiryList({ enquiries = [], selectedId, onSelect }) {
  if (enquiries.length === 0) {
    return <p className="p-6 text-sm text-muted">No enquiries match these filters.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {enquiries.map((enquiry) => {
        const selected = enquiry._id === selectedId;

        return (
          <li key={enquiry._id}>
            <button
              type="button"
              onClick={() => onSelect(enquiry._id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full cursor-pointer px-5 py-4 text-left transition-colors duration-200 ${
                selected ? "bg-accent/10" : "hover:bg-ink/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-ink">{enquiry.name}</p>
                <Badge tone={STATUS_TONES[enquiry.status] ?? "muted"}>
                  {humanise(enquiry.status)}
                </Badge>
              </div>

              <p className="mt-1 truncate text-sm text-ink-soft">
                {/* A general enquiry has no property — say so rather than showing blank. */}
                {enquiry.property?.title ?? "General enquiry"}
              </p>
              <p className="mt-1 text-xs text-muted">{relativeTime(enquiry.createdAt)}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
