"use client";

import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { submitEnquiry } from "@/lib/api/client";

/**
 * Lead capture for a single listing — the conversion point of the entire site.
 *
 * Phone is required and email is not: phone is the primary contact channel in this
 * market. Contact consent is captured explicitly and marketing opt-in is a separate
 * checkbox, because agreeing to a callback is not agreeing to alerts (NDPA 2023,
 * scope §11).
 */
export default function EnquiryForm({ property }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: `I'd like more information about ${property.reference}.`,
      consentGiven: false,
      marketingOptIn: false,
    },
  });

  const onSubmit = async (values) => {
    try {
      await submitEnquiry({
        ...values,
        // The API resolves either a slug or an id; the slug is what we have here.
        property: property.slug,
        type: "property_enquiry",
        source: "property_page",
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
      // No field map means a general failure (rate limit, outage) — say so once.
      toast.error(error.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-border bg-surface-raised p-6"
      noValidate
    >
      <h2 className="text-xl text-ink">Enquire about this property</h2>
      <p className="mt-1 text-sm text-muted">We usually reply the same working day.</p>

      <div className="mt-6 space-y-4">
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

        {/* Email is genuinely optional — do not make it required "for completeness". */}
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

        {/* Message, pre-filled with the reference so the enquiry is never ambiguous. */}
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm text-ink-soft">
            Message
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
        {isSubmitting ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
