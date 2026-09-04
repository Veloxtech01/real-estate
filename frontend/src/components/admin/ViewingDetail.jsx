"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiPhone, FiMessageCircle } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { getViewing, updateViewing, deleteViewing } from "@/lib/api/admin";
import { actionsFor, STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Right column of the diary: one viewing and the transitions available from its
 * current status.
 *
 * Which buttons render comes from the frontend transition table; what is actually
 * ALLOWED comes from the backend. When they disagree the API's 400 is shown verbatim —
 * see the note in lib/viewingTransitions.js.
 *
 * @param {string} id The selected viewing.
 * @param {() => void} onChanged Called after a change, so the list re-reads.
 * @param {() => void} onDeleted Called after a deletion, so the page clears selection.
 */
export default function ViewingDetail({ id, onChanged, onDeleted }) {
  const { user } = useAdminSession();
  const { data, loading, error } = useAdminResource(() => getViewing(id), [id]);

  const [responseMessage, setResponseMessage] = useState("");
  const [notes, setNotes] = useState("");
  // Which action is mid-flight, so only that button shows a spinner.
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState(null);
  // The reschedule form is revealed rather than always shown — it only applies to one
  // of the available actions.
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const viewing = data?.viewing;

  // Seed the form whenever a different viewing loads.
  useEffect(() => {
    if (!viewing) return;
    setResponseMessage(viewing.responseMessage ?? "");
    setNotes(viewing.notes ?? "");
    setActionError(null);
    setRescheduling(false);
    setNewTime("");
  }, [viewing]);

  /**
   * Apply one transition.
   *
   * `scheduledFor` is sent only for a reschedule — on accept it is deliberately
   * omitted so the API inherits `requestedFor`, which is the common case.
   */
  const applyStatus = async (status, scheduledFor) => {
    setPending(status);
    setActionError(null);

    try {
      await updateViewing(id, {
        status,
        ...(scheduledFor ? { scheduledFor } : {}),
        responseMessage,
        notes,
      });
      toast.success("Viewing updated.");
      setRescheduling(false);
      onChanged();
    } catch (caught) {
      // The backend transition table is the authority — show its wording as-is.
      setActionError(caught.message);
    } finally {
      setPending(null);
    }
  };

  /** Submit the reschedule form. */
  const onReschedule = () => {
    if (!newTime) {
      setActionError("A new date is required to propose a different time.");
      return;
    }

    if (new Date(newTime).getTime() <= Date.now()) {
      // Checked here for a fast error; the API checks it again and is the authority.
      setActionError("The new time must be in the future.");
      return;
    }

    applyStatus("rescheduled", new Date(newTime).toISOString());
  };

  const onDelete = async () => {
    setDeleting(true);

    try {
      await deleteViewing(id);
      toast.success("Viewing deleted.");
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

  if (error || !viewing) {
    return <p className="p-6 text-sm text-danger">{error?.message ?? "Viewing not found."}</p>;
  }

  const actions = actionsFor(viewing.status);
  const whatsapp = viewing.phone.replace(/\D/g, "");

  return (
    <div className="p-6 lg:p-8">
      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-ink">{viewing.name}</h2>
          <p className="mt-1 text-sm text-muted">{viewing.phone}</p>
        </div>
        <Badge tone={STATUS_TONES[viewing.status] ?? "muted"}>
          {STATUS_LABELS[viewing.status] ?? viewing.status}
        </Badge>
      </div>

      {/* Requested vs agreed. Both are shown so staff can see how far it moved. */}
      <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <div className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">Requested for</dt>
          <dd className="tabular mt-1 text-ink">
            {new Date(viewing.requestedFor).toLocaleString("en-NG")}
          </dd>
        </div>
        <div className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">Scheduled for</dt>
          <dd className="tabular mt-1 text-ink">
            {viewing.scheduledFor
              ? new Date(viewing.scheduledFor).toLocaleString("en-NG")
              : "Not yet confirmed"}
          </dd>
        </div>
      </dl>

      {/* Contact actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`tel:${viewing.phone}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          Call
        </a>
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
      </div>

      {/* Which listing */}
      {viewing.property && (
        <div className="mt-8 rounded-lg border border-border bg-surface-raised p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Property</p>
          <Link
            href={`/property/${viewing.property.slug}`}
            target="_blank"
            className="mt-1 block text-ink transition-colors duration-200 hover:text-accent-text"
          >
            {viewing.property.title} ({viewing.property.reference})
          </Link>
        </div>
      )}

      {/* Response controls */}
      <div className="mt-10 space-y-4 border-t border-border pt-8">
        <div>
          <label htmlFor="responseMessage" className="mb-1.5 block text-sm text-ink-soft">
            Message to the prospect
          </label>
          <textarea
            id="responseMessage"
            rows={3}
            value={responseMessage}
            onChange={(event) => setResponseMessage(event.target.value)}
            placeholder="Included in the email they receive."
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="viewing-notes" className="mb-1.5 block text-sm text-ink-soft">
            Internal notes
          </label>
          <textarea
            id="viewing-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
        </div>

        {/* Reschedule needs a date, so it reveals a field instead of firing straight off. */}
        {rescheduling && (
          <div>
            <label htmlFor="newTime" className="mb-1.5 block text-sm text-ink-soft">
              New date and time
            </label>
            <input
              id="newTime"
              type="datetime-local"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="min-h-11 rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <div className="mt-3 flex gap-3">
              <Button onClick={onReschedule} loading={pending === "rescheduled"}>
                Confirm new time
              </Button>
              <Button variant="secondary" onClick={() => setRescheduling(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Whole-action failure, including a rejected transition. */}
        {actionError && (
          <p role="alert" className="text-sm text-danger">
            {actionError}
          </p>
        )}

        {/* Only the transitions legal from the current status. */}
        <div className="flex flex-wrap gap-3 pt-2">
          {actions.length === 0 ? (
            <p className="text-sm text-muted">
              This viewing is {STATUS_LABELS[viewing.status].toLowerCase()} — no further
              action is possible.
            </p>
          ) : (
            actions.map((action) =>
              action.status === "rescheduled" ? (
                <Button
                  key={action.status}
                  variant={action.tone}
                  onClick={() => setRescheduling(true)}
                >
                  {action.label}
                </Button>
              ) : (
                <Button
                  key={action.status}
                  variant={action.tone}
                  loading={pending === action.status}
                  onClick={() => applyStatus(action.status)}
                >
                  {action.label}
                </Button>
              ),
            )
          )}

          {/* Administrator-only. The API enforces this regardless. */}
          {user.role === "administrator" && (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this viewing?"
        body="This permanently erases the prospect's name, phone number and email. It cannot be undone, and there is no restore."
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </div>
  );
}
