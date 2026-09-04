"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getViewings } from "@/lib/api/admin";
import MasterDetail from "@/components/admin/MasterDetail";
import ViewingList from "@/components/admin/ViewingList";
import ViewingDetail from "@/components/admin/ViewingDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { STATUS_LABELS } from "@/lib/viewingTransitions";

/**
 * The viewing diary.
 *
 * Defaults to upcoming-only, which is the view a staff member wants on arrival. Like
 * the inbox, selection and filters live in the URL.
 */

const STATUS_TABS = ["", "requested", "accepted", "rescheduled", "completed"];

export default function AdminViewingsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const selectedId = params.get("id");
  const status = params.get("status") ?? "";
  // Absent means upcoming-only; "false" is the explicit opt-out for seeing history.
  const upcoming = params.get("upcoming") !== "false";

  const { data, loading, refetch } = useAdminResource(
    () =>
      getViewings({
        status: status || undefined,
        upcoming: upcoming || undefined,
        limit: 50,
      }),
    [status, upcoming],
  );

  /** Build the next URL, preserving whatever we aren't changing. */
  const navigate = (changes) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    router.push(`/admin/viewings?${next.toString()}`);
  };

  const list = (
    <div>
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border p-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || "all"}
            type="button"
            // Clear the selection: the chosen viewing may not survive the new filter.
            onClick={() => navigate({ status: tab, id: null })}
            className={`min-h-9 cursor-pointer rounded px-3 text-sm transition-colors duration-200 ${
              status === tab ? "bg-accent/10 text-accent-text" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tab ? STATUS_LABELS[tab] : "All"}
          </button>
        ))}
      </div>

      {/* Past viewings are hidden by default but must remain reachable. */}
      <div className="border-b border-border p-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(event) =>
              navigate({ upcoming: event.target.checked ? null : "false", id: null })
            }
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          Upcoming only
        </label>
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <ViewingList
          viewings={data?.viewings ?? []}
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
          <ViewingDetail
            // Fresh mount per viewing, so form state cannot carry over.
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
