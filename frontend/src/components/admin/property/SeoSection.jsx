"use client";

import { FormSection, TextField, TextAreaField } from "./fields";

/**
 * Per-listing search-result overrides.
 *
 * All three are optional: the public pages generate a title, description and image
 * from the listing itself when these are empty. The generated values are shown as
 * placeholders so staff can see what they are replacing before they replace it.
 *
 * Takes: register, errors, generated ({ title, description }).
 */
export default function SeoSection({ register, errors, generated }) {
  return (
    <FormSection
      id="seo"
      title="Search appearance"
      description="Leave blank to use the generated values shown."
    >
      <TextField
        name="metaTitle"
        label="Meta title"
        register={register}
        errors={errors}
        placeholder={generated.title}
        className="sm:col-span-2"
      />

      <TextAreaField
        name="metaDescription"
        label="Meta description"
        register={register}
        errors={errors}
        rows={3}
        hint="Around 155 characters is what Google shows."
        className="sm:col-span-2"
      />

      <TextField
        name="ogImage"
        label="Social share image URL"
        type="url"
        register={register}
        errors={errors}
        hint="Falls back to the cover image when empty."
        className="sm:col-span-2"
      />
    </FormSection>
  );
}
