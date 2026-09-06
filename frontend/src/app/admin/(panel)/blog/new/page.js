"use client";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference } from "@/lib/api/admin";
import BlogForm from "@/components/admin/BlogForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Create a blog post (§4.2, §7 administrator only).
 *
 * Only the author roster and the publication-state enum are needed from the
 * reference payload — there is no record yet.
 */
export default function NewBlogPostPage() {
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

  return (
    <BlogForm
      staffAuthors={reference.agents ?? []}
      publicationStates={reference.publicationStates}
    />
  );
}
