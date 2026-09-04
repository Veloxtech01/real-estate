"use client";

import { FormSection, CheckboxGroup } from "./fields";
import { humanise } from "@/lib/format";

/**
 * The single collapsed taxonomy that replaced amenities / facilities / security /
 * features. It is also the whitelist the AI search validates against, which is why the
 * editor offers the served list rather than free text.
 *
 * Takes: register, reference.
 */
export default function TagsSection({ register, reference }) {
  /** Grouped by category, since a flat list of every amenity is unscannable. */
  const byCategory = (reference.taxonomy ?? []).reduce((groups, term) => {
    (groups[term.category] ||= []).push(term);
    return groups;
  }, {});

  return (
    <FormSection
      id="tags"
      title="Tags"
      description="Amenities, facilities, security and features — the values search filters on."
    >
      {Object.keys(byCategory).length === 0 ? (
        <p className="text-sm text-muted sm:col-span-2">
          No taxonomy terms are configured yet.
        </p>
      ) : (
        Object.entries(byCategory).map(([category, terms]) => (
          <div key={category} className="sm:col-span-2">
            <CheckboxGroup
              name="tags"
              label={humanise(category)}
              register={register}
              columns={3}
              options={terms.map((term) => ({ value: term._id, label: term.name }))}
            />
          </div>
        ))
      )}
    </FormSection>
  );
}
