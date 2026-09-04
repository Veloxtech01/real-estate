"use client";

import { FormSection, TextField, SelectField, CheckboxField } from "./fields";
import { humanise } from "@/lib/format";

/**
 * Land title and survey status — the first thing a Nigerian buyer filters on.
 *
 * Takes: register, errors, reference, titleType (the watched value).
 */
export default function TitleDeedSection({ register, errors, reference, titleType }) {
  // A gazette number is precisely what a buyer's lawyer searches against, so an
  // excision or gazette title without one is not usable information.
  const needsGazette = ["excision", "gazette"].includes(titleType);

  return (
    <FormSection
      id="title-deed"
      title="Title deed"
      description="Enumerated, never free text — buyers filter on this."
    >
      <SelectField
        name="landTitle.type"
        label="Title type"
        register={register}
        errors={errors}
        options={(reference.titleTypes ?? []).map((value) => ({
          value,
          label: humanise(value),
        }))}
        placeholder="Not recorded"
      />

      {needsGazette && (
        <TextField
          name="landTitle.gazetteNumber"
          label="Gazette number"
          register={register}
          errors={errors}
          rules={{ required: "A gazette number is required for excision or gazette title" }}
        />
      )}

      <CheckboxField
        name="landTitle.freeFromGovernmentAcquisition"
        label="Free from government acquisition"
        register={register}
        hint="The most-asked question on Lagos land after title itself."
      />
      <CheckboxField
        name="landTitle.surveyPlanAvailable"
        label="Survey plan available"
        register={register}
      />
    </FormSection>
  );
}
