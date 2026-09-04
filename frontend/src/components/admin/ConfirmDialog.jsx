"use client";

import Button from "@/components/ui/Button";

/**
 * Confirmation for an irreversible action.
 *
 * Used only for deletion, which on leads is a HARD delete for NDPA erasure — there is
 * no restore, unlike the soft delete on listings. The body text must say so plainly.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete permanently",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-ink/60 p-4"
      style={{ zIndex: "var(--z-lightbox)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md rounded-lg bg-surface-raised p-6">
        <h2 id="confirm-title" className="text-xl text-ink">
          {title}
        </h2>
        <p className="mt-3 text-sm text-ink-soft">{body}</p>

        <div className="mt-8 flex justify-end gap-3">
          {/* Cancel first in the DOM so a keyboard user reaches the safe option first. */}
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
