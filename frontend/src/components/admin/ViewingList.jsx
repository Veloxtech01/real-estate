"use client";

import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Left column of the diary: one row per viewing, soonest first.
 *
 * Presentational only. Unlike the inbox this leads with the date, because a diary is
 * scanned by when, not by who.
 */
export default function ViewingList({ viewings = [], selectedId, onSelect }) {
  if (viewings.length === 0) {
    return <p className="p-6 text-sm text-muted">No viewings match these filters.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {viewings.map((viewing) => {
        const selected = viewing._id === selectedId;
        // The agreed time once there is one, otherwise what the prospect asked for.
        const when = viewing.scheduledFor ?? viewing.requestedFor;

        return (
          <li key={viewing._id}>
            <button
              type="button"
              onClick={() => onSelect(viewing._id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full cursor-pointer px-5 py-4 text-left transition-colors duration-200 ${
                selected ? "bg-accent/10" : "hover:bg-ink/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="tabular text-sm text-ink">
                  {new Date(when).toLocaleString("en-NG", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <Badge tone={STATUS_TONES[viewing.status] ?? "muted"}>
                  {STATUS_LABELS[viewing.status] ?? viewing.status}
                </Badge>
              </div>

              <p className="mt-1 text-ink">{viewing.name}</p>
              <p className="mt-1 truncate text-sm text-muted">
                {viewing.property?.title ?? "Property removed"}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
