"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";

import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { createBlogPost, updateBlogPost } from "@/lib/api/admin";
import { mapApiErrors } from "@/lib/apiErrors";
import { humanise } from "@/lib/format";

// Field paths the API's `details` map can land on directly.
const REGISTERED_PATHS = ["title", "body"];

/** "a, b,  c" -> ["a", "b", "c"] — drops blanks from stray commas. */
function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Create/edit a blog post — one form for both, keyed by whether `post` is present,
 * the same split StaffForm and PropertyForm use.
 *
 * categories/tags are plain comma-separated text here rather than a multi-select:
 * this codebase has no existing free-text-list control (Property's own "tags" field
 * is actually taxonomy checkboxes, a different concept), so this introduces the
 * small pattern rather than reusing one that doesn't fit.
 */
export default function BlogForm({ post = null, staffAuthors = [], publicationStates = [], onSaved }) {
  const router = useRouter();
  const isNew = !post;

  // Errors the server raised that no input claimed — shown whole rather than dropped.
  const [formErrors, setFormErrors] = useState([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: post?.title ?? "",
      excerpt: post?.excerpt ?? "",
      body: post?.body ?? "",
      coverImage: post?.coverImage ?? "",
      author: post?.author?._id ?? "",
      categories: (post?.categories ?? []).join(", "),
      tags: (post?.tags ?? []).join(", "),
      metaTitle: post?.metaTitle ?? "",
      metaDescription: post?.metaDescription ?? "",
      ogImage: post?.ogImage ?? "",
      publicationState: post?.publicationState ?? "draft",
    },
  });

  /**
   * Sends the form to the API.
   *
   * Takes: values (object) — react-hook-form's output.
   * Returns: a promise; navigates on success, maps field errors on failure.
   */
  const onSubmit = async (values) => {
    setFormErrors([]);

    const payload = {
      ...values,
      author: values.author || null,
      categories: parseList(values.categories),
      tags: parseList(values.tags),
    };

    try {
      if (isNew) {
        const created = await createBlogPost(payload);
        toast.success(`"${created.title}" created`);
        // Replace, not push: the create URL should not sit in the back stack
        // behind the record it just made.
        router.replace(`/admin/blog/${created._id}`);
      } else {
        await updateBlogPost(post._id, payload);
        toast.success("Post saved");
        await onSaved?.();
      }
    } catch (error) {
      const unmatched = mapApiErrors(error.details, setError, REGISTERED_PATHS);
      setFormErrors(unmatched.length > 0 ? unmatched : [error.message]);
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Blog
        </Link>

        <h1 className="mt-2 font-display text-2xl text-ink">
          {isNew ? "New post" : post.title}
        </h1>
      </div>

      <div className="max-w-2xl space-y-6 p-5">
        {/* Server messages with no home. Above everything, because they explain a
            save that appeared to do nothing. */}
        {formErrors.length > 0 && (
          <div role="alert" className="flex gap-3 rounded border border-danger/40 bg-danger/5 p-4">
            <FiAlertCircle className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div className="text-sm text-ink">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm text-ink-soft">
            Title
          </label>
          <input
            id="title"
            type="text"
            {...register("title", { required: "Title is required" })}
            aria-invalid={Boolean(errors.title)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.title?.message} />
        </div>

        <div>
          <label htmlFor="excerpt" className="mb-1.5 block text-sm text-ink-soft">
            Excerpt <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="excerpt"
            rows={2}
            {...register("excerpt")}
            className="w-full rounded border border-border bg-surface p-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="body" className="mb-1.5 block text-sm text-ink-soft">
            Body <span className="text-muted">(Markdown)</span>
          </label>
          <textarea
            id="body"
            rows={16}
            {...register("body", { required: "Body is required" })}
            aria-invalid={Boolean(errors.body)}
            className="w-full rounded border border-border bg-surface p-3 font-mono text-sm text-ink"
          />
          <FieldError message={errors.body?.message} />
        </div>

        <div>
          <label htmlFor="coverImage" className="mb-1.5 block text-sm text-ink-soft">
            Cover image URL <span className="text-muted">(optional)</span>
          </label>
          <input
            id="coverImage"
            type="url"
            {...register("coverImage")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="author" className="mb-1.5 block text-sm text-ink-soft">
            Author <span className="text-muted">(optional)</span>
          </label>
          <select
            id="author"
            {...register("author")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          >
            <option value="">No author</option>
            {/* Sourced from GET /api/admin/reference — never a hardcoded roster. */}
            {staffAuthors.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="categories" className="mb-1.5 block text-sm text-ink-soft">
              Categories <span className="text-muted">(comma-separated)</span>
            </label>
            <input
              id="categories"
              type="text"
              placeholder="Market Trends, Lekki"
              {...register("categories")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="tags" className="mb-1.5 block text-sm text-ink-soft">
              Tags <span className="text-muted">(comma-separated)</span>
            </label>
            <input
              id="tags"
              type="text"
              placeholder="rent, lekki"
              {...register("tags")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>
        </div>

        {/* Search appearance — same optional-override idea as PropertyForm's
            SeoSection, without a dedicated section wrapper: this form is short
            enough not to need one. */}
        <div className="space-y-4 border-t border-border pt-6">
          <p className="text-sm text-ink-soft">
            Search appearance <span className="text-muted">(optional — falls back to the title/excerpt)</span>
          </p>

          <div>
            <label htmlFor="metaTitle" className="mb-1.5 block text-sm text-ink-soft">
              Meta title
            </label>
            <input
              id="metaTitle"
              type="text"
              {...register("metaTitle")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="metaDescription" className="mb-1.5 block text-sm text-ink-soft">
              Meta description
            </label>
            <textarea
              id="metaDescription"
              rows={3}
              {...register("metaDescription")}
              className="w-full rounded border border-border bg-surface p-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="ogImage" className="mb-1.5 block text-sm text-ink-soft">
              Social share image URL
            </label>
            <input
              id="ogImage"
              type="url"
              {...register("ogImage")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <label htmlFor="publicationState" className="mb-1.5 block text-sm text-ink-soft">
            Visibility
          </label>
          <select
            id="publicationState"
            {...register("publicationState")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink sm:w-auto"
          >
            {/* Enum comes from GET /api/admin/reference — never hardcoded here. */}
            {publicationStates.map((state) => (
              <option key={state} value={state}>
                {humanise(state)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sticky action bar, matching StaffForm's and PropertyForm's. */}
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-surface p-4">
        <Button type="submit" loading={isSubmitting}>
          {isNew ? "Create post" : "Save"}
        </Button>
      </div>
    </form>
  );
}
