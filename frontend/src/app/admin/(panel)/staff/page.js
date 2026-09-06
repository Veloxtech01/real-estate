"use client";

import { FiPlus } from "react-icons/fi";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getStaff } from "@/lib/api/admin";
import StaffTable from "@/components/admin/StaffTable";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The staff roster screen (§7, administrator only).
 *
 * The route itself renders for anyone who navigates to it — the API is the real
 * gate, and an agent hitting it sees the 403 message rather than a blank page,
 * matching the rest of the panel's "courtesy, not security" convention for
 * role-gated UI.
 */
export default function AdminStaffPage() {
  const { data, loading, error, refetch } = useAdminResource(getStaff, []);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Staff</h1>
          <p className="text-sm text-muted">
            {data ? `${data.staff.length} account(s)` : " "}
          </p>
        </div>

        <Button href="/admin/staff/new">
          <FiPlus size={16} aria-hidden="true" />
          New staff account
        </Button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <p className="p-8 text-sm text-danger">{error.message}</p>
      ) : (
        <StaffTable staff={data?.staff ?? []} onChanged={refetch} />
      )}
    </div>
  );
}
