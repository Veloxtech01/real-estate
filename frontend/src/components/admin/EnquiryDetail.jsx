"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiPhone, FiMessageCircle, FiMail } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import FieldError from "@/components/forms/FieldError";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { getEnquiry, updateEnquiry, deleteEnquiry } from "@/lib/api/admin";
import { humanise } from "@/lib/format";

/**
 * Right column of the inbox: the full lead, plus the controls that act on it.
 *
 * @param {string} id The selected enquiry.
 * @param {() => void} onChanged Called after a save, so the list re-reads — it shows
 *   status too and would otherwise go stale.
 * @param {() => void} onDeleted Called after a deletion, so the page clears selection.
 */
export default function EnquiryDetail({ id, onChanged, onDeleted }) {
  const { user } = useAdminSession();
  const { data, loading, error } = useAdminResource(() => getEnquiry(id), [id]);

  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const enquiry = data?.enquiry;

  // Seed the form whenever a different lead loads. Without this, switching rows would
  // leave the previous lead's status sitting in the select.
  useEffect(() => {
    if (!enquiry) return;
    setStatus(enquiry.status);
    setNotes(enquiry.notes ?? "");
    setFieldErrors(null);
  }, [enquiry]);

  const onSave = async () => {
    setSaving(true);
    setFieldErrors(null);

    try {
      await updateEnquiry(id, { status, notes });
      toast.success("Lead updated.");
      onChanged();
    } catch (caught) {
      // `details` is the API's field-level map; anything else is a general failure.
      if (caught.details) setFieldErrors(caught.details);
      else toast.error(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);

    try {
      await deleteEnquiry(id);
      toast.success("Lead deleted.");
      setConfirmOpen(false);
      onDeleted();
    } catch (caught) {
      toast.error(caught.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error || !enquiry) {
    return <p className="p-6 text-sm text-danger">{error?.message ?? "Lead not found."}</p>;
  }

  // WhatsApp click-to-chat, pre-filled so the prospect isn't asked to re-explain.
  const whatsapp = enquiry.phone.replace(/\D/g, "");
  const message = encodeURIComponent(
    `Hello ${enquiry.name}, regarding your enquiry${
      enquiry.property ? ` about ${enquiry.property.title}` : ""
    }.`,
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-ink">{enquiry.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {humanise(enquiry.type)} · via {humanise(enquiry.source)}
          </p>
        </div>
        <Badge tone="muted">{humanise(enquiry.status)}</Badge>
      </div>

      {/* Contact actions — phone first, the primary channel in this market. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`tel:${enquiry.phone}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          {enquiry.phone}
        </a>
        <a
          href={`https://wa.me/${whatsapp}?text=${message}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
        {/* Email is optional on this model — only offer it when there is one. */}
        {enquiry.email && (
          <a
            href={`mailto:${enquiry.email}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiMail size={16} aria-hidden="true" />
            {enquiry.email}
          </a>
        )}
      </div>

      {/* Which listing, if any */}
      {enquiry.property && (
        <div className="mt-8 rounded-lg border border-border bg-surface-raised p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Property</p>
          <Link
            href={`/property/${enquiry.property.slug}`}
            target="_blank"
            className="mt-1 block text-ink transition-colors duration-200 hover:text-accent-text"
          >
            {enquiry.property.title} ({enquiry.property.reference})
          </Link>
        </div>
      )}

      {/* What they wrote */}
      {enquiry.message && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Message</p>
          <p className="mt-2 max-w-[68ch] whitespace-pre-line text-ink-soft">
            {enquiry.message}
          </p>
        </div>
      )}

      {/* Pipeline controls */}
      <div className="mt-10 space-y-4 border-t border-border pt-8">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm text-ink-soft">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 w-full max-w-xs cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
          >
            {["new", "contacted", "viewing_booked", "closed"].map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.status} />
        </div>

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm text-ink-soft">
            Internal notes
          </label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
          <FieldError message={fieldErrors?.notes} />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={onSave} loading={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          {/* Administrator-only. The API enforces this regardless of what renders. */}
          {user.role === "administrator" && (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this lead?"
        body="This permanently erases the prospect's name, phone number and email. It cannot be undone, and there is no restore."
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </div>
  );
}
