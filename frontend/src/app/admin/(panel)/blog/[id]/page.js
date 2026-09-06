"use client";

import { use } from "react";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminReference, getBlogPost } from "@/lib/api/admin";
import BlogForm from "@/components/admin/BlogForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Edit a blog post (§4.2, §7 administrator only).
 *
 * Two reads, kept separate: the author roster and publication-state enum are the
 * same for every post, the record is not — a save only needs to refetch the record.
 *
 * `params` is a promise in Next 16 — unwrapped with React's use().
 */
export default function EditBlogPostPage({ params }) {
  const { id } = use(params);

  const { data: reference, loading: loadingReference } = useAdminResource(
    getAdminReference,
    [],
  );

  const {
    data: post,
    loading: loadingPost,
    error,
    refetch,
  } = useAdminResource(() => getBlogPost(id), [id]);

  if (loadingReference || loadingPost) {
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
    // Keyed by id so navigating between posts remounts the form rather than
    // leaving the previous record's values in it.
    <BlogForm
      key={id}
      post={post}
      staffAuthors={reference.agents ?? []}
      publicationStates={reference.publicationStates}
      onSaved={refetch}
    />
  );
}
