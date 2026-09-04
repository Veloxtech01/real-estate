"use client";

import { FormSection, TextField, SelectField } from "./fields";
import { humanise } from "@/lib/format";

/**
 * Counts and areas.
 *
 * Takes: register, errors, reference.
 */
export default function SpecSection({ register, errors, reference }) {
  const nonNegative = { min: { value: 0, message: "Cannot be negative" } };

  return (
    <FormSection
      id="spec"
      title="Specification"
      description="Bathrooms and toilets are separate counts here, as Nigerian listings quote both."
    >
      <TextField
        name="bedrooms"
        label="Bedrooms"
        type="number"
        register={register}
        errors={errors}
        rules={nonNegative}
      />
      <TextField
        name="bathrooms"
        label="Bathrooms"
        type="number"
        register={register}
        errors={errors}
        rules={nonNegative}
      />
      <TextField
        name="toilets"
        label="Toilets"
        type="number"
        register={register}
        errors={errors}
        rules={nonNegative}
      />
      <TextField
        name="boysQuarters"
        label="Boys' quarters"
        type="number"
        register={register}
        errors={errors}
        rules={nonNegative}
      />
      <TextField
        name="parkingSpaces"
        label="Parking spaces"
        type="number"
        register={register}
        errors={errors}
        rules={nonNegative}
      />
      <TextField
        name="builtAreaSqm"
        label="Built area (sqm)"
        type="number"
        step="any"
        register={register}
        errors={errors}
        rules={nonNegative}
      />

      {/* Land size takes a unit because agents quote plots and acres, but only square
          metres are stored: a "plot" is ~648 sqm generally and ~464 in parts of Lagos,
          so the number alone would mean different areas in different listings. */}
      <TextField
        name="_landSizeValue"
        label="Land size"
        type="number"
        step="any"
        register={register}
        errors={errors}
        rules={nonNegative}
        hint="Converted to square metres on save."
      />
      <SelectField
        name="_landSizeUnit"
        label="Land size unit"
        register={register}
        errors={errors}
        options={Object.keys(reference.landUnits ?? { sqm: 1 }).map((unit) => ({
          value: unit,
          label: humanise(unit),
        }))}
        placeholder={null}
      />

      <TextField
        name="yearBuilt"
        label="Year built"
        type="number"
        register={register}
        errors={errors}
        rules={{ min: { value: 1800, message: "Must be 1800 or later" } }}
      />
    </FormSection>
  );
}
