"use client";

import { FormSection, TextField, SelectField } from "./fields";

/**
 * Where the property is.
 *
 * Takes: register, errors, reference, state (the derived state name, or "").
 */
export default function LocationSection({ register, errors, reference, state }) {
  /** Areas grouped by state — the seeded list spans several, and a flat list of 32 is unreadable. */
  const byState = (reference.locations ?? []).reduce((groups, location) => {
    (groups[location.state] ||= []).push(location);
    return groups;
  }, {});

  return (
    <FormSection
      id="location"
      title="Location"
      description="The area drives the state, which in turn drives the statutory rent limits."
    >
      <SelectField
        name="location"
        label="Area"
        register={register}
        errors={errors}
        rules={{ required: "An area is required" }}
        placeholder="Select an area…"
      >
        {Object.entries(byState).map(([stateName, areas]) => (
          <optgroup key={stateName} label={stateName}>
            {areas.map((area) => (
              <option key={area._id} value={area._id}>
                {area.name}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>

      {/* Read-only on purpose. The server derives state from the area; accepting it
          from the form would let a Lagos listing be filed under another state and skip
          the 10% agency-fee cap. */}
      <div>
        <span className="mb-1 block text-sm text-ink-soft">State</span>
        <p className="flex min-h-11 items-center rounded border border-border bg-ink/5 px-3 text-sm text-ink-soft">
          {state || "Set by the chosen area"}
        </p>
        <p className="mt-1 text-xs text-muted">Derived from the area, not editable.</p>
      </div>

      <TextField
        name="landmark"
        label="Landmark"
        register={register}
        errors={errors}
        rules={{ required: "A landmark is required" }}
        hint="e.g. opposite Shoprite, Circle Mall. Many properties have no formal address."
        className="sm:col-span-2"
      />

      <TextField
        name="address"
        label="Street address"
        register={register}
        errors={errors}
        hint="Optional — only where one exists."
        className="sm:col-span-2"
      />

      {/* Latitude first: it is the order coordinates are written and read, even though
          GeoJSON stores them the other way round. */}
      <TextField
        name="_lat"
        label="Latitude"
        type="number"
        step="any"
        register={register}
        errors={errors}
        hint="Optional. Both values are needed for the map pin to appear."
      />

      <TextField
        name="_lng"
        label="Longitude"
        type="number"
        step="any"
        register={register}
        errors={errors}
      />
    </FormSection>
  );
}
