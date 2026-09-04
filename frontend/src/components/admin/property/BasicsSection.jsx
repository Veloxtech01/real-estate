"use client";

import { FormSection, TextField, TextAreaField, SelectField } from "./fields";
import { humanise } from "@/lib/format";

/**
 * Identity and marketing copy: what the listing is and who owns it.
 *
 * Takes: register, errors, reference (the /admin/reference payload),
 *        isAdministrator (bool).
 */
export default function BasicsSection({ register, errors, reference, isAdministrator }) {
  /** Enum values are snake_case on the wire; humanise() is what the rest of the panel uses. */
  const asOptions = (values = []) =>
    values.map((value) => ({ value, label: humanise(value) }));

  return (
    <FormSection
      id="basics"
      title="Basics"
      description="What the listing is called and how it is classified."
    >
      <TextField
        name="title"
        label="Listing title"
        register={register}
        errors={errors}
        rules={{ required: "A title is required" }}
        hint="Becomes the public URL, e.g. 4-bedroom-duplex-lekki-phase-1-REF1042"
        className="sm:col-span-2"
      />

      <TextAreaField
        name="description"
        label="Description"
        register={register}
        errors={errors}
        rows={6}
        className="sm:col-span-2"
      />

      <SelectField
        name="listingType"
        label="Listing type"
        register={register}
        errors={errors}
        rules={{ required: "Choose sale or rent" }}
        options={asOptions(reference.listingTypes)}
        // Not clearable: the whole pricing section branches on it.
        placeholder={null}
        hint="Switching this swaps the pricing fields below."
      />

      <SelectField
        name="propertyType"
        label="Property type"
        register={register}
        errors={errors}
        rules={{ required: "Choose a property type" }}
        options={asOptions(reference.propertyTypes)}
        placeholder="Select…"
      />

      <SelectField
        name="status"
        label="Status"
        register={register}
        errors={errors}
        options={asOptions(reference.listingStatuses)}
        placeholder={null}
        hint="Commercial state. A sold listing can stay published for its search traffic."
      />

      {/* Ownership is administrator-only: the API forces an agent's own id regardless,
          so rendering this for them would offer a control that does nothing. */}
      {isAdministrator && (
        <SelectField
          name="agent"
          label="Assigned agent"
          register={register}
          errors={errors}
          options={(reference.agents ?? []).map((agent) => ({
            value: agent._id,
            label: agent.canPublish ? agent.name : `${agent.name} (cannot publish)`,
          }))}
          placeholder="Me"
          hint="Enquiries about this listing route to this agent."
        />
      )}
    </FormSection>
  );
}
