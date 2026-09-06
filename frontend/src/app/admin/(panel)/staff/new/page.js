"use client";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference } from "@/lib/api/admin";
import StaffForm from "@/components/admin/StaffForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Create a staff account (§7, administrator only).
 *
 * Only the role enum is needed from the reference payload — there is no record yet.
 */
export default function NewStaffPage() {
  const { data: reference, loading, error } = useAdminResource(getAdminReference, []);

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="p-8 text-sm text-danger">{error.message}</p>;
  }

  return <StaffForm staffRoles={reference.staffRoles} />;
}
