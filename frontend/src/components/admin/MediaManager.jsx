"use client";

import { useRef, useState } from "react";
import { FiCheck, FiImage, FiTrash2, FiUploadCloud } from "react-icons/fi";

import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { deleteMedia, reorderMedia, updateMedia } from "@/lib/api/admin";
import { uploadPropertyImage, ACCEPTED_TYPES } from "@/lib/uploadMedia";

/**
 * The listing gallery: add, order, describe, remove, and choose the cover.
 *
 * Absorbed the old CoverImagePicker rather than sitting beside it — two components
 * owning the same grid drift apart.
 *
 * Every action here except the cover commits immediately and does not wait for the
 * form's Save. A photo is a file on a server, not a form field; tying it to Save means
 * a validation failure elsewhere in a nine-section form silently discards a completed
 * upload. The cover stays a react-hook-form value because it is a property of the
 * listing, not of the image.
 *
 * There are no optimistic updates, matching the rest of the admin panel: a pending
 * state and a short wait beat showing a state the server never accepted.
 *
 * Takes: propertyId (string|null — null before the listing is saved), media (array),
 *        value (media id, the cover), onChange (function, from Controller),
 *        onMediaChange (function, refetches the listing after a mutation).
 */
export default function MediaManager({
  propertyId,
  media = [],
  value,
  onChange,
  onMediaChange,
}) {
  const fileInputRef = useRef(null);

  // Which mutation is in flight, so tiles can disable without a spinner per control.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  /**
   * Runs a mutation, surfacing the API's own message on failure.
   *
   * The message is shown verbatim: the server is the one that knows whether this was
   * a permission problem, a stale gallery or Cloudinary being unreachable.
   *
   * Takes: action (async function).
   * Returns: a promise resolving once the refetch has been requested.
   */
  async function run(action) {
    setBusy(true);
    setError(null);

    try {
      await action();
      onMediaChange?.();
    } catch (mutationError) {
      setError(mutationError.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Uploads the chosen files one after another.
   *
   * Sequential, not parallel: each upload costs a rate-limited signature call, and ten
   * at once would trip the limiter and fail most of them.
   *
   * Takes: fileList (FileList|File[]).
   * Returns: a promise resolving once every file has been attempted.
   */
  async function handleFiles(fileList) {
    const files = [...fileList];
    if (files.length === 0) return;

    setError(null);
    setPending(files.map((file) => ({ name: file.name, progress: 0, failed: false })));

    for (const [index, file] of files.entries()) {
      try {
        await uploadPropertyImage(propertyId, file, {
          onProgress: (progress) =>
            setPending((current) =>
              current.map((item, i) => (i === index ? { ...item, progress } : item)),
            ),
        });
      } catch (uploadError) {
        setPending((current) =>
          current.map((item, i) => (i === index ? { ...item, failed: true } : item)),
        );
        setError(uploadError.message);
      }
    }

    setPending((current) => current.filter((item) => item.failed));
    onMediaChange?.();
  }

  /**
   * Moves one image and persists the whole new order.
   *
   * Takes: from (number), to (number) — indices within `media`.
   * Returns: nothing; the reorder is fired as a mutation.
   */
  function move(from, to) {
    if (to < 0 || to >= media.length || from === to) return;

    const ids = media.map((item) => item._id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);

    // The API requires a full permutation, which is exactly what this produces.
    run(() => reorderMedia(propertyId, ids));
  }

  /**
   * Saves alt text, but only when it actually changed.
   *
   * Takes: item (media object), next (string).
   * Returns: nothing.
   */
  function saveAlt(item, next) {
    const trimmed = next.trim();
    if (trimmed === (item.alt ?? "")) return;

    run(() => updateMedia(propertyId, item._id, { alt: trimmed }));
  }

  // Before the listing is saved there is no id, so no Cloudinary folder and no
  // ownership check. Uploading here would orphan billable assets every time someone
  // abandoned a draft.
  if (!propertyId) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-border px-4 py-10 text-center">
        <FiImage size={24} className="text-muted" aria-hidden="true" />
        <p className="text-sm text-ink-soft">Save the listing first</p>
        <p className="max-w-sm text-xs text-muted">
          Photos attach to a saved listing. Fill in the rest, save, and the gallery
          appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload region — a drop target that is also a real file input, so keyboard
          and screen-reader users get the same control. */}
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className="rounded border border-dashed border-border px-4 py-6 text-center"
      >
        <FiUploadCloud size={22} className="mx-auto text-muted" aria-hidden="true" />
        <label
          htmlFor="media-upload"
          className="mt-2 block cursor-pointer text-sm text-accent-text underline"
        >
          Add photos
        </label>
        <input
          ref={fileInputRef}
          id="media-upload"
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Cleared so re-choosing the same file fires change again.
            event.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-muted">
          or drop them here — JPG, PNG, WebP or AVIF, up to 15MB each
        </p>
      </div>

      {/* In-flight uploads, listed with their own progress so a slow one is visibly
          working rather than apparently stuck. */}
      {pending.length > 0 && (
        <ul className="space-y-1">
          {pending.map((item) => (
            <li key={item.name} className="text-xs text-ink-soft">
              {item.name} — {item.failed ? "failed" : `${item.progress}%`}
            </li>
          ))}
        </ul>
      )}

      {/* The API's message, verbatim — it knows which failure this was. */}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {media.length === 0 ? (
        <p className="text-sm text-muted">No photos yet.</p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Cover image"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {media.map((item, index) => {
            const selected = String(value) === String(item._id);

            return (
              <div
                key={item._id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                className="space-y-2 rounded border border-border p-2"
              >
                {/* The tile itself is the cover radio, as in the picker it replaces. */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Use ${item.alt || "this image"} as the cover`}
                  // Clicking the current cover clears it, so a wrong choice is
                  // undoable without a separate control.
                  onClick={() => onChange(selected ? "" : item._id)}
                  className={`relative block aspect-4/3 w-full cursor-pointer overflow-hidden rounded border-2 transition-colors duration-200 ${
                    selected ? "border-accent" : "border-transparent hover:border-ink-soft"
                  }`}
                >
                  {/* Plain <img>: these are remote Cloudinary URLs in an admin screen
                      with no SEO or LCP stake, and next/image would need every host
                      configured. */}
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.alt || "Property image"}
                    className="h-full w-full object-cover"
                  />

                  {/* Selection is marked with a tick, not colour alone. */}
                  {selected && (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <FiCheck size={14} aria-hidden="true" />
                      <span className="sr-only">Selected as cover</span>
                    </span>
                  )}
                </button>

                {/* Alt text, saved on blur rather than per keystroke. */}
                <input
                  type="text"
                  defaultValue={item.alt ?? ""}
                  aria-label={`Alt text for image ${index + 1}`}
                  placeholder="Describe this photo"
                  disabled={busy}
                  onBlur={(event) => saveAlt(item, event.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-ink"
                />

                <div className="flex items-center justify-between gap-1">
                  {/* Keyboard reordering is not a nicety: HTML5 drag-and-drop is
                      unreachable without a mouse, and gallery order is not optional. */}
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Move image ${index + 1} earlier`}
                      className="rounded border border-border px-2 py-1 text-xs text-ink-soft disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === media.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Move image ${index + 1} later`}
                      className="rounded border border-border px-2 py-1 text-xs text-ink-soft disabled:opacity-40"
                    >
                      →
                    </button>
                  </span>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(item)}
                    aria-label={`Remove image ${index + 1}`}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-danger"
                  >
                    <FiTrash2 size={12} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unlike a listing's soft delete, this destroys the Cloudinary asset — the
          wording has to say which kind of deletion it is. */}
      <ConfirmDialog
        open={Boolean(confirming)}
        title="Remove this photo?"
        body="The image is deleted from Cloudinary as well as from this listing. This cannot be undone — unlike deleting a listing, there is nothing to restore."
        confirmLabel="Remove permanently"
        loading={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const target = confirming;
          setConfirming(null);
          await run(() => deleteMedia(propertyId, target._id));
        }}
      />
    </div>
  );
}
