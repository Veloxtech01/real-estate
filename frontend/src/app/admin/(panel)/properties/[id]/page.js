"use client";

import { use } from "react";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference, getProperty } from "@/lib/api/admin";
import PropertyForm from "@/components/admin/PropertyForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Edit a listing.
 *
 * Two reads, kept as separate resources rather than one combined fetcher: the
 * reference payload is the same for every listing and the record is not, so a save
 * refetches only the record.
 *
 * `params` is a promise in Next 16 — unwrapped with React's use().
 */
export default function EditPropertyPage({ params }) {
  const { id } = use(params);

  const { data: reference, loading: loadingReference } = useAdminResource(
    getAdminReference,
    [],
  );

  const {
    data,
    loading: loadingProperty,
    error,
    refetch,
  } = useAdminResource(() => getProperty(id), [id]);

  if (loadingReference || loadingProperty) {
    return (
      <div className="space-y-4 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </div>
    );
  }

  // Covers both a missing listing (404) and a colleague's listing (403). The API's
  // message is shown verbatim — it is the one that knows which.
  if (error) {
    return <p className="p-8 text-sm text-danger">{error.message}</p>;
  }

  return (
    <PropertyForm
      // Keyed by id so navigating between listings remounts the form rather than
      // leaving the previous record's values in it.
      key={id}
      property={data.property}
      media={data.media}
      reference={reference}
      onSaved={refetch}
    />
  );
}
