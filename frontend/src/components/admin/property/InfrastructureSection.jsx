"use client";

import {
  FormSection,
  TextField,
  SelectField,
  CheckboxField,
  CheckboxGroup,
} from "./fields";
import { humanise } from "@/lib/format";

/**
 * Power, water, flood and road — functional filters in this market, not extra detail.
 *
 * A listing with no stated power arrangements is not comparable to one on 24-hour
 * estate supply, and flood history genuinely differentiates properties in Lekki and
 * Ajah.
 *
 * Takes: register, errors, reference, isGatedEstate (watched).
 */
export default function InfrastructureSection({
  register,
  errors,
  reference,
  isGatedEstate,
}) {
  const asOptions = (values = []) =>
    values.map((value) => ({ value, label: humanise(value) }));

  return (
    <FormSection
      id="infrastructure"
      title="Infrastructure"
      description="Power and water take several values at once — a grid band plus a generator is normal."
    >
      <div className="sm:col-span-2 grid gap-5 sm:grid-cols-2">
        <CheckboxGroup
          name="infrastructure.power"
          label="Power"
          register={register}
          options={asOptions(reference.powerSources)}
        />
        <CheckboxGroup
          name="infrastructure.water"
          label="Water"
          register={register}
          options={asOptions(reference.waterSources)}
        />
      </div>

      <SelectField
        name="infrastructure.metering"
        label="Metering"
        register={register}
        errors={errors}
        options={asOptions(reference.meteringTypes)}
        placeholder="Not recorded"
      />

      <SelectField
        name="infrastructure.floodRisk"
        label="Flood risk"
        register={register}
        errors={errors}
        options={asOptions(reference.floodRiskLevels)}
        placeholder="Not assessed"
        hint="An assessment. Flood history below is a fact of record."
      />

      <SelectField
        name="infrastructure.roadCondition"
        label="Road condition"
        register={register}
        errors={errors}
        options={asOptions(reference.roadConditions)}
        placeholder="Not recorded"
      />

      <TextField
        name="infrastructure.distanceToTarredRoadM"
        label="Distance to tarred road (m)"
        type="number"
        step="any"
        register={register}
        errors={errors}
        rules={{ min: { value: 0, message: "Cannot be negative" } }}
        hint="Matters where the last kilometre is impassable in the rains."
      />

      <CheckboxField
        name="infrastructure.hasFloodHistory"
        label="Has flooded before"
        register={register}
      />

      <CheckboxField
        name="infrastructure.isGatedEstate"
        label="In a gated estate"
        register={register}
      />

      {/* Only meaningful once the estate box is ticked. */}
      {isGatedEstate && (
        <TextField
          name="infrastructure.estateName"
          label="Estate name"
          register={register}
          errors={errors}
        />
      )}
    </FormSection>
  );
}
