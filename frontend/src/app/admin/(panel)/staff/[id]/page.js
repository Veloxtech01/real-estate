"use client";

import { use } from "react";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference, getStaffMember } from "@/lib/api/admin";
import StaffForm from "@/components/admin/StaffForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Edit a staff account (§7, administrator only).
 *
 * Two reads, kept separate: the role enum is the same for every account, the record
 * is not — a save only needs to refetch the record.
 *
 * `params` is a promise in Next 16 — unwrapped with React's use().
 */
export default function EditStaffPage({ params }) {
  const { id } = use(params);

  const { data: reference, loading: loadingReference } = useAdminResource(
    getAdminReference,
    [],
  );

  const {
    data: staffMember,
    loading: loadingStaffMember,
    error,
    refetch,
  } = useAdminResource(() => getStaffMember(id), [id]);

  if (loadingReference || loadingStaffMember) {
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

  return (
    // Keyed by id so navigating between accounts remounts the form rather than
    // leaving the previous record's values in it.
    <StaffForm
      key={id}
      staffMember={staffMember}
      staffRoles={reference.staffRoles}
      onSaved={refetch}
    />
  );
}
