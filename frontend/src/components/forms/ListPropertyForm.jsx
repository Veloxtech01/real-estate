"use client";

import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { submitEnquiry } from "@/lib/api/client";
import { humanise } from "@/lib/format";

// Bedroom options are a fixed ladder, matching HeroSearchPanel's — a seller picks a
// minimum-shaped number the same way a buyer's filter does, not an exact count field.
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

/**
 * "List your property with us" (§3) — the agency's supply pipeline.
 *
 * Feeds the same enquiry pipeline as every other lead form (`type: "list_property"`,
 * `source: "list_property_page"`, both already whitelisted in the backend's
 * ENQUIRY_TYPES/ENQUIRY_SOURCES). Structured property details go into `requirement` —
 * a free-form field that otherwise has no writer yet — rather than a new model, so the
 * agency can plan stock acquisition the same way the §5.5 no-match alert will.
 *
 * `location` is deliberately free text rather than the existing locations dropdown: a
 * seller's property may be in an area the agency doesn't cover yet, and that is exactly
 * the kind of lead worth capturing to expand supply.
 *
 * @param {object} props
 * @param {string[]} [props.propertyTypes] Machine keys from `GET /api/filters`, so the
 *   select can never offer a type the DB doesn't have.
 * @param {string} [props.heading] Card heading — defaults match content/listYourProperty.js's
 *   form.heading, but stay a prop like EnquiryForm's so the page remains the one source
 *   of copy truth.
 * @param {string} [props.subheading]
 */
export default function ListPropertyForm({
  propertyTypes = [],
  heading = "Tell us about your property",
  subheading = "A few details help us match you with the right buyers or tenants.",
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      listingType: "sale",
      propertyType: "",
      location: "",
      bedrooms: "",
      expectedPrice: "",
      name: "",
      phone: "",
      email: "",
      message: "",
      consentGiven: false,
      marketingOptIn: false,
    },
  });

  // Rent is quoted per annum in this market (scope §8.2) — the price label must say so,
  // not just "price", or a landlord reads it as a monthly figure and understates by 12x.
  const listingType = watch("listingType");
  const priceLabel =
    listingType === "rent" ? "Expected annual rent (₦)" : "Expected sale price (₦)";

  const onSubmit = async (values) => {
    try {
      await submitEnquiry({
        name: values.name,
        phone: values.phone,
        email: values.email,
        message: values.message,
        consentGiven: values.consentGiven,
        marketingOptIn: values.marketingOptIn,
        type: "list_property",
        source: "list_property_page",
        requirement: {
          listingType: values.listingType,
          // Optional fields are omitted entirely when blank, not sent as "" / NaN —
          // an admin reading the lead later shouldn't see a fake "bedrooms": "".
          ...(values.propertyType ? { propertyType: values.propertyType } : {}),
          location: values.location,
          ...(values.bedrooms ? { bedrooms: Number(values.bedrooms) } : {}),
          ...(values.expectedPrice ? { expectedPrice: Number(values.expectedPrice) } : {}),
        },
      });
      toast.success("Thanks — we'll be in touch shortly.");
      reset();
    } catch (error) {
      // The interceptor normalised this: `details` is the API's field error map.
      if (error.details) {
        for (const [field, message] of Object.entries(error.details)) {
          setError(field, { type: "server", message });
        }
        return;
      }
      toast.error(error.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-border bg-surface-raised p-6"
      noValidate
    >
      <h2 className="text-xl text-ink">{heading}</h2>
      <p className="mt-1 text-sm text-muted">{subheading}</p>

      <div className="mt-6 space-y-4">
        {/* Listing intent — first because it changes what the price field means. */}
        <div>
          <label htmlFor="listingType" className="mb-1.5 block text-sm text-ink-soft">
            Listing intent
          </label>
          <select
            id="listingType"
            {...register("listingType", { required: true })}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          >
            <option value="sale">Sell</option>
            <option value="rent">Let (rent out)</option>
          </select>
        </div>

        {/* Property type — optional; a seller may not know the agency's exact term. */}
        <div>
          <label htmlFor="propertyType" className="mb-1.5 block text-sm text-ink-soft">
            Property type <span className="text-muted">(optional)</span>
          </label>
          <select
            id="propertyType"
            {...register("propertyType")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          >
            <option value="">Not sure yet</option>
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {humanise(type)}
              </option>
            ))}
          </select>
        </div>

        {/* Location — free text on purpose; see the component comment above. */}
        <div>
          <label htmlFor="location" className="mb-1.5 block text-sm text-ink-soft">
            Property location (area, city, state)
          </label>
          <input
            id="location"
            type="text"
            {...register("location", { required: "Property location is required" })}
            aria-invalid={Boolean(errors.location)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.location?.message} />
        </div>

        {/* Bedrooms — optional, doesn't apply to land/commercial. */}
        <div>
          <label htmlFor="bedrooms" className="mb-1.5 block text-sm text-ink-soft">
            Bedrooms <span className="text-muted">(if applicable)</span>
          </label>
          <select
            id="bedrooms"
            {...register("bedrooms")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          >
            <option value="">Not applicable</option>
            {BEDROOM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Price/rent — label switches with listing intent. */}
        <div>
          <label htmlFor="expectedPrice" className="mb-1.5 block text-sm text-ink-soft">
            {priceLabel} <span className="text-muted">(optional)</span>
          </label>
          <input
            id="expectedPrice"
            type="number"
            min="0"
            {...register("expectedPrice")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-ink-soft">
            Your name
          </label>
          <input
            id="name"
            type="text"
            {...register("name", { required: "Name is required" })}
            aria-invalid={Boolean(errors.name)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.name?.message} />
        </div>

        {/* Phone — the primary channel, so it is required. */}
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-ink-soft">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            {...register("phone", { required: "Phone number is required" })}
            aria-invalid={Boolean(errors.phone)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.phone?.message} />
        </div>

        {/* Email is genuinely optional. */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
            Email <span className="text-muted">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm text-ink-soft">
            Anything else we should know? <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="message"
            rows={4}
            {...register("message")}
            className="w-full rounded border border-border bg-surface p-3 text-ink"
          />
        </div>

        {/* Consent — explicit, and separate from marketing. */}
        <div className="space-y-3 pt-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              {...register("consentGiven", {
                required: "Please confirm we can contact you",
              })}
              className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            I&apos;m happy for us to contact you about this enquiry.
          </label>
          <FieldError message={errors.consentGiven?.message} />

          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              {...register("marketingOptIn")}
              className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            Send me new listings that match what I&apos;m looking for.
          </label>
        </div>
      </div>

      {/* Button disables and shows progress while the request is in flight. */}
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-6 w-full">
        {isSubmitting ? "Sending…" : "Send details"}
      </Button>
    </form>
  );
}
