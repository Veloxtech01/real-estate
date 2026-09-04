"use client";

import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getEnquiryStats, getViewings } from "@/lib/api/admin";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Admin dashboard — where a staff member orients on arrival.
 *
 * Both reads are already scoped to the caller by the API, so an agent sees their own
 * numbers with no filtering here.
 */

// Order matters: it is the pipeline, left to right.
const STAT_ORDER = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "viewing_booked", label: "Viewing booked" },
  { key: "closed", label: "Closed" },
];

export default function AdminDashboardPage() {
  const { user } = useAdminSession();

  const stats = useAdminResource(() => getEnquiryStats(), []);
  const viewings = useAdminResource(() => getViewings({ upcoming: true, limit: 5 }), []);

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl text-ink">Welcome back, {user.name.split(" ")[0]}</h1>

      {/* Enquiry pipeline. Each tile links into the inbox pre-filtered. */}
      <section className="mt-8">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Enquiries
        </h2>

        {stats.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_ORDER.map((stat) => (
              <Skeleton key={stat.key} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_ORDER.map((stat) => (
              <Link
                key={stat.key}
                href={`/admin/enquiries?status=${stat.key}`}
                className="group rounded-lg border border-border bg-surface-raised p-5 transition-colors duration-200 hover:border-accent"
              >
                <p className="text-xs uppercase tracking-[0.08em] text-muted">
                  {stat.label}
                </p>
                {/* Tabular figures so the row of numbers aligns. */}
                <p className="tabular mt-2 font-display text-3xl text-ink">
                  {stats.data?.stats?.[stat.key] ?? 0}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Next few viewings — the other thing a staff member checks on arrival. */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
            Upcoming viewings
          </h2>
          <Link
            href="/admin/viewings"
            className="flex items-center gap-1.5 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
          >
            View all
            <FiArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {viewings.loading ? (
          <Skeleton className="h-40" />
        ) : viewings.data?.viewings?.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
            {viewings.data.viewings.map((viewing) => (
              <li key={viewing._id}>
                <Link
                  href={`/admin/viewings?id=${viewing._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors duration-200 hover:bg-ink/5"
                >
                  <div>
                    <p className="text-ink">{viewing.name}</p>
                    <p className="text-sm text-muted">
                      {viewing.property?.title ?? "Property removed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="tabular text-sm text-ink-soft">
                      {new Date(viewing.requestedFor).toLocaleString("en-NG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge tone={STATUS_TONES[viewing.status]}>
                      {STATUS_LABELS[viewing.status]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-surface-raised px-5 py-8 text-center text-sm text-muted">
            No viewings scheduled.
          </p>
        )}
      </section>
    </div>
  );
}
