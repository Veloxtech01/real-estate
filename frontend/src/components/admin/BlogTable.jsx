"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiTrash2, FiRotateCcw } from "react-icons/fi";

import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { deleteBlogPost, restoreBlogPost } from "@/lib/api/admin";
import { formatDate, humanise } from "@/lib/format";

/**
 * The blog table.
 *
 * Every route this reads from is administrator-only (§7), so unlike PropertyTable
 * there is no role branching — whoever can see this screen can act on every row.
 * Mutations call the API directly and then ask the page to refetch, matching
 * PropertyTable's no-optimistic-updates rule.
 *
 * Takes: posts (array), onChanged (function — refetch).
 */
export default function BlogTable({ posts = [], onChanged }) {
  // The row awaiting delete confirmation, or null.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const run = async (id, action, successMessage) => {
    setBusyId(id);
    try {
      await action();
      toast.success(successMessage);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  if (posts.length === 0) {
    return <p className="p-8 text-center text-sm text-muted">No posts match these filters.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="p-3 font-medium">Post</th>
              <th scope="col" className="p-3 font-medium">Author</th>
              <th scope="col" className="p-3 font-medium">Status</th>
              <th scope="col" className="p-3 font-medium">Updated</th>
              <th scope="col" className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {posts.map((post) => {
              const deleted = Boolean(post.deletedAt);
              const busy = busyId === post._id;

              return (
                <tr
                  key={post._id}
                  // Deleted rows stay legible but visibly inactive.
                  className={`border-b border-border ${deleted ? "opacity-55" : ""}`}
                >
                  <td className="p-3">
                    <Link
                      href={`/admin/blog/${post._id}`}
                      className="block truncate text-ink transition-colors duration-200 hover:text-accent-text"
                    >
                      {post.title}
                    </Link>
                    {deleted && <span className="text-xs text-muted">Deleted</span>}
                  </td>

                  <td className="p-3 text-ink-soft">{post.author?.name ?? "—"}</td>

                  <td className="p-3">
                    <Badge tone={post.publicationState === "published" ? "accent" : "muted"}>
                      {humanise(post.publicationState)}
                    </Badge>
                  </td>

                  <td className="p-3 text-ink-soft">{formatDate(post.updatedAt)}</td>

                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {deleted ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(post._id, () => restoreBlogPost(post._id), "Post restored")
                          }
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed"
                        >
                          <FiRotateCcw size={16} aria-hidden="true" />
                          <span className="sr-only">Restore {post.title}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPendingDelete(post)}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-danger disabled:cursor-not-allowed"
                        >
                          <FiTrash2 size={16} aria-hidden="true" />
                          <span className="sr-only">Delete {post.title}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deletion here is soft and reversible, same as a listing's — not the
          permanent NDPA erasure a lead's delete is. */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.title ?? ""}"?`}
        body="The post is unpublished and hidden from the site. You can restore it from this table at any time."
        confirmLabel="Delete post"
        loading={busyId === pendingDelete?._id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const target = pendingDelete;
          await run(target._id, () => deleteBlogPost(target._id), "Post deleted");
          setPendingDelete(null);
        }}
      />
    </>
  );
}
