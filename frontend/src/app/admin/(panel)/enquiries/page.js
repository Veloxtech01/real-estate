"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getEnquiries } from "@/lib/api/admin";
import MasterDetail from "@/components/admin/MasterDetail";
import EnquiryList from "@/components/admin/EnquiryList";
import EnquiryDetail from "@/components/admin/EnquiryDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { humanise } from "@/lib/format";

/**
 * The enquiry inbox.
 *
 * Selection and filters live in the URL, the same discipline the public search uses:
 * a lead stays linkable, and the back button behaves.
 */

const STATUS_TABS = ["", "new", "contacted", "viewing_booked", "closed"];

export default function AdminEnquiriesPage() {
  const router = useRouter();
  const params = useSearchParams();

  const selectedId = params.get("id");
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";

  // Re-runs whenever a filter changes; the hook discards stale responses, so fast tab
  // clicking can't render an older result set over a newer one.
  const { data, loading, refetch } = useAdminResource(
    () => getEnquiries({ status: status || undefined, q: q || undefined, limit: 50 }),
    [status, q],
  );

  /** Build the next URL, preserving whatever we aren't changing. */
  const navigate = (changes) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    router.push(`/admin/enquiries?${next.toString()}`);
  };

  const list = (
    <div>
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border p-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || "all"}
            type="button"
            // Changing a filter clears the selection: the selected lead may not be in
            // the new result set, which would leave the detail pane orphaned.
            onClick={() => navigate({ status: tab, id: null })}
            className={`min-h-9 cursor-pointer rounded px-3 text-sm transition-colors duration-200 ${
              status === tab ? "bg-accent/10 text-accent-text" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tab ? humanise(tab) : "All"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="border-b border-border p-3">
        <label htmlFor="lead-search" className="sr-only">
          Search leads
        </label>
        <input
          id="lead-search"
          type="search"
          defaultValue={q}
          placeholder="Name, phone or email"
          // Search on Enter rather than per keystroke — this is a network round trip,
          // and the backend rate-limits.
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate({ q: event.target.value, id: null });
          }}
          className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        />
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <EnquiryList
          enquiries={data?.enquiries ?? []}
          selectedId={selectedId}
          onSelect={(id) => navigate({ id })}
        />
      )}
    </div>
  );

  return (
    <MasterDetail
      hasSelection={Boolean(selectedId)}
      onClearSelection={() => navigate({ id: null })}
      list={list}
      detail={
        selectedId ? (
          <EnquiryDetail
            // Keying by id forces a fresh mount per lead, so the form state cannot
            // carry over from the previously selected row.
            key={selectedId}
            id={selectedId}
            onChanged={refetch}
            onDeleted={() => {
              navigate({ id: null });
              refetch();
            }}
          />
        ) : null
      }
    />
  );
}
