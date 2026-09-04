"use client";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference } from "@/lib/api/admin";
import PropertyForm from "@/components/admin/PropertyForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Create a listing.
 *
 * Only the reference payload is needed — there is no record yet, so there is no
 * gallery either; the media section says as much until the listing is saved.
 */
export default function NewPropertyPage() {
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

  // Without the enums the form would render empty selects and silently save nothing
  // useful, so it isn't rendered at all.
  if (error) {
    return <p className="p-8 text-sm text-danger">{error.message}</p>;
  }

  return <PropertyForm reference={reference} />;
}
