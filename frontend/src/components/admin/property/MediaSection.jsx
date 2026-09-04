"use client";

import { Controller } from "react-hook-form";
import { FormSection, TextField } from "./fields";
import MediaManager from "@/components/admin/MediaManager";

/**
 * The listing gallery plus the floor plan URL.
 *
 * Floor plan stays a URL input: it is a plain string on the model, and file upload for
 * it is out of scope for this slice. The gallery is a full manager — upload, order,
 * alt text, delete — because photographs are the listing's main content.
 *
 * The cover is the one thing here that is a form field. It is a reference to a
 * PropertyMedia record, so it saves with the listing; everything else the manager does
 * commits immediately (see MediaManager for why).
 *
 * Takes: register, errors, control (react-hook-form), media (array),
 *        propertyId (string|null), onMediaChange (function).
 */
export default function MediaSection({
  register,
  errors,
  control,
  media,
  propertyId,
  onMediaChange,
}) {
  return (
    <FormSection
      id="media"
      title="Media"
      description="Add photographs, put them in order, and choose which one leads the listing."
    >
      <div className="sm:col-span-2">
        {/* Not a <label>: a radiogroup has no single control to point at, and the
            gallery carries its own aria-label. */}
        <span className="mb-1 block text-sm text-ink-soft">Photos</span>

        {/* A picture grid isn't an input, so the cover goes through Controller rather
            than register — the only field in the form that needs it. */}
        <Controller
          name="coverImage"
          control={control}
          render={({ field }) => (
            <MediaManager
              propertyId={propertyId}
              media={media}
              value={field.value}
              onChange={field.onChange}
              onMediaChange={onMediaChange}
            />
          )}
        />
      </div>

      <TextField
        name="floorPlan"
        label="Floor plan URL"
        type="url"
        register={register}
        errors={errors}
        className="sm:col-span-2"
      />
    </FormSection>
  );
}
