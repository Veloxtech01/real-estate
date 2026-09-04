"use client";

import { FiCheck, FiImage } from "react-icons/fi";

/**
 * Chooses which of a listing's existing images is the cover.
 *
 * There is no upload here on purpose: Cloudinary is not configured yet, so this slice
 * can only work with media that already exists. A listing created in this editor is
 * complete except for its photographs.
 *
 * Controlled rather than registered, because a picture grid is not an input — the
 * parent holds the value through react-hook-form's Controller.
 *
 * Takes: media (array of PropertyMedia), value (media id string),
 *        onChange (function).
 */
export default function CoverImagePicker({ media = [], value, onChange }) {
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-border px-4 py-10 text-center">
        <FiImage size={24} className="text-muted" aria-hidden="true" />
        <p className="text-sm text-ink-soft">No images yet</p>
        <p className="max-w-sm text-xs text-muted">
          Photo upload arrives with the media slice. Everything else about this listing
          can be saved and published now.
        </p>
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Cover image"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {media.map((item) => {
        const selected = String(value) === String(item._id);

        return (
          <button
            key={item._id}
            type="button"
            role="radio"
            aria-checked={selected}
            // Clicking the current cover clears it, so a wrong choice is undoable
            // without a separate control.
            onClick={() => onChange(selected ? "" : item._id)}
            className={`relative aspect-4/3 cursor-pointer overflow-hidden rounded border-2 transition-colors duration-200 ${
              selected ? "border-accent" : "border-border hover:border-ink-soft"
            }`}
          >
            {/* Plain <img>: these are remote Cloudinary URLs in an admin screen with no
                SEO or LCP stake, and next/image would need every host configured. */}
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
        );
      })}
    </div>
  );
}
