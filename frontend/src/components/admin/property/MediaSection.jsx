"use client";

import { Controller } from "react-hook-form";
import { FormSection, TextField } from "./fields";
import CoverImagePicker from "@/components/admin/CoverImagePicker";

/**
 * Cover image plus the floor plan URL.
 *
 * Floor plan is a plain string on the model, so it stays a URL input even once uploads
 * exist. The cover is a reference to a PropertyMedia record, which is why it is a
 * picker over what the listing already has rather than a pasted URL. The social share
 * image lives in the SEO section, where it is actually used.
 *
 * Takes: register, errors, control (react-hook-form), media (array).
 */
export default function MediaSection({ register, errors, control, media }) {
  return (
    <FormSection
      id="media"
      title="Media"
      description="Choose which existing image leads the listing."
    >
      <div className="sm:col-span-2">
        {/* Not a <label>: a radiogroup has no single control to point at, and the
            picker carries its own aria-label. */}
        <span className="mb-1 block text-sm text-ink-soft">Cover image</span>

        {/* A picture grid isn't an input, so it goes through Controller rather than
            register — the only field in the form that needs it. */}
        <Controller
          name="coverImage"
          control={control}
          render={({ field }) => (
            <CoverImagePicker
              media={media}
              value={field.value}
              onChange={field.onChange}
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
