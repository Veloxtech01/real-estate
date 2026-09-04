"use client";

import { FormSection, TextField, SelectField, CheckboxField } from "./fields";
import { humanise } from "@/lib/format";
import { rentRulesFor } from "@/lib/propertyForm";

/**
 * Price for a sale, or the full rent terms for a letting.
 *
 * The two never render together: the model rejects rent terms on a sale outright, and
 * a single price field cannot express what a Nigerian tenant actually pays on day one
 * (rent + agency fee + legal fee + caution deposit + service charge, quoted per annum).
 *
 * Takes: register, errors, reference, listingType, onRequest (bool), state (string).
 */
export default function PricingSection({
  register,
  errors,
  reference,
  listingType,
  onRequest,
  state,
}) {
  const isRent = listingType === "rent";

  // Advisory only — propertyModel's pre("validate") is the authority. This exists so a
  // Lagos listing flags an 11% fee before paying for the round trip.
  const rules = rentRulesFor(state, reference.stateRentRules);

  const asOptions = (values = []) =>
    values.map((value) => ({ value, label: humanise(value) }));

  return (
    <FormSection
      id="pricing"
      title={isRent ? "Rent terms" : "Price"}
      description={
        isRent
          ? `Statutory limits for ${state || "this state"}: agency fee up to ${rules.maxAgencyFeePct}%, advance up to ${rules.maxAdvanceYears} year(s).`
          : "Price on request is a real state, not a zero — the amount is left unset."
      }
    >
      {isRent ? (
        <>
          <TextField
            name="rent.amount"
            label="Rent amount"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{
              required: "Rent amount is required for a rental",
              min: { value: 0, message: "Cannot be negative" },
            }}
          />
          <SelectField
            name="rent.period"
            label="Period"
            register={register}
            errors={errors}
            options={asOptions(reference.rentPeriods)}
            placeholder={null}
            hint="Per annum is the Nigerian norm."
          />

          <TextField
            name="rent.advanceYears"
            label="Advance (years)"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{
              min: { value: 0, message: "Cannot be negative" },
              max: {
                value: rules.maxAdvanceYears,
                message: `Advance rent cannot exceed ${rules.maxAdvanceYears} year(s) in ${state}`,
              },
            }}
          />
          <TextField
            name="rent.agencyFeePct"
            label="Agency fee (%)"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{
              min: { value: 0, message: "Cannot be negative" },
              max: {
                value: rules.maxAgencyFeePct,
                message: `Agency fee cannot exceed ${rules.maxAgencyFeePct}% in ${state}`,
              },
            }}
          />

          <TextField
            name="rent.legalFeePct"
            label="Legal fee (%)"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{ min: { value: 0, message: "Cannot be negative" } }}
          />
          <TextField
            name="rent.cautionDeposit"
            label="Caution deposit"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{ min: { value: 0, message: "Cannot be negative" } }}
          />

          <TextField
            name="rent.serviceCharge"
            label="Service charge"
            type="number"
            step="any"
            register={register}
            errors={errors}
            rules={{ min: { value: 0, message: "Cannot be negative" } }}
          />
          {/* Its own period: estate service charges bill on a different cycle to rent. */}
          <SelectField
            name="rent.serviceChargePeriod"
            label="Service charge period"
            register={register}
            errors={errors}
            options={asOptions(reference.chargePeriods)}
            placeholder="Not charged"
          />
        </>
      ) : (
        <>
          <TextField
            name="price.amount"
            label="Price"
            type="number"
            step="any"
            register={register}
            errors={errors}
            // Required unless on request — mirroring the model's own cross-field rule.
            rules={{
              validate: (value) =>
                onRequest ||
                (value !== "" && value !== null && value !== undefined) ||
                "Price is required unless the listing is price-on-request",
              min: { value: 0, message: "Cannot be negative" },
            }}
            // Disabled rather than hidden, so it is obvious why the figure went away.
            disabled={onRequest}
          />
          <SelectField
            name="price.currency"
            label="Currency"
            register={register}
            errors={errors}
            options={reference.currencies ?? []}
            placeholder={null}
            hint="High-end Lagos and Abuja stock is often quoted in USD."
          />

          <CheckboxField
            name="price.isNegotiable"
            label="Price is negotiable"
            register={register}
          />
          <CheckboxField
            name="price.onRequest"
            label="Price on request"
            register={register}
            hint="Hides the figure publicly and clears the amount above."
          />
        </>
      )}
    </FormSection>
  );
}
