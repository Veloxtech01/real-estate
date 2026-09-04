"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";

import Button from "@/components/ui/Button";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { createProperty, updateProperty } from "@/lib/api/admin";
import { toFormValues, toApiPayload, REGISTERED_PATHS } from "@/lib/propertyForm";
import { mapApiErrors } from "@/lib/apiErrors";
import { humanise } from "@/lib/format";

import BasicsSection from "./property/BasicsSection";
import LocationSection from "./property/LocationSection";
import SpecSection from "./property/SpecSection";
import PricingSection from "./property/PricingSection";
import TitleDeedSection from "./property/TitleDeedSection";
import InfrastructureSection from "./property/InfrastructureSection";
import TagsSection from "./property/TagsSection";
import MediaSection from "./property/MediaSection";
import SeoSection from "./property/SeoSection";

/**
 * The listing editor.
 *
 * One long form rather than a wizard or tabs: the common job is changing one field on
 * an existing listing, and a wizard optimises for the rare one. Tabs would hide a
 * validation error on a panel nobody is looking at.
 *
 * This component owns the form instance, the submit and the error mapping only. Each
 * section is its own component taking `register`/`errors` — nine sections in one file
 * would be unreviewable.
 *
 * Takes: property (object|null — null to create), media (array), reference (the
 *        /admin/reference payload).
 */

const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "spec", label: "Specification" },
  { id: "pricing", label: "Pricing" },
  { id: "title-deed", label: "Title deed" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "tags", label: "Tags" },
  { id: "media", label: "Media" },
  { id: "seo", label: "Search appearance" },
];

export default function PropertyForm({
  property = null,
  media = [],
  reference,
  onSaved,
}) {
  const router = useRouter();
  const { user } = useAdminSession();
  const isAdministrator = user.role === "administrator";
  const isNew = !property;

  // Errors the server raised that no input claimed — shown whole rather than dropped.
  const [formErrors, setFormErrors] = useState([]);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: toFormValues(property) });

  // Watched because other fields' presence depends on them. useWatch subscribes just
  // these, so typing in a text field doesn't re-render the whole form.
  const [listingType, onRequest, locationId, titleType, isGatedEstate] = useWatch({
    control,
    name: [
      "listingType",
      "price.onRequest",
      "location",
      "landTitle.type",
      "infrastructure.isGatedEstate",
    ],
  });

  // The state is never a form field: the server derives it from the area. This is the
  // same derivation, done locally only so the rent limits can be shown before saving.
  const state =
    (reference.locations ?? []).find((area) => String(area._id) === String(locationId))
      ?.state ?? "";

  /**
   * Sends the form to the API.
   *
   * Takes: values (object) — react-hook-form's output.
   * Returns: a promise; navigates on success, maps field errors on failure.
   */
  const onSubmit = async (values) => {
    setFormErrors([]);

    const payload = toApiPayload(values, {
      landUnits: reference.landUnits,
      isAdministrator,
    });

    try {
      if (isNew) {
        const created = await createProperty(payload);
        toast.success(`Created ${created.reference}`);
        // Replace, not push: the create URL should not sit in the back stack behind
        // the record it just made.
        router.replace(`/admin/properties/${created._id}`);
      } else {
        await updateProperty(property._id, payload);
        toast.success("Listing saved");
        // Pulls the server's version back, so the form reloads from server-derived
        // values (slug, state, publishedAt) rather than from what was typed.
        await onSaved?.();
      }
    } catch (error) {
      // The API is the authority. Whatever it rejected is shown exactly as it said it,
      // on the field where possible and in the banner otherwise.
      const unmatched = mapApiErrors(error.details, setError, REGISTERED_PATHS);
      setFormErrors(unmatched.length > 0 ? unmatched : [error.message]);
      toast.error(error.message);
    }
  };

  // Publishing is a per-agent right (§7). The API enforces it regardless; disabling the
  // option is a courtesy so nobody fills in a form only to be refused at the end.
  const canPublish = isAdministrator || user.canPublish;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-28">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/admin/properties"
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Listings
        </Link>

        <h1 className="mt-2 font-display text-2xl text-ink">
          {isNew ? "New listing" : property.title}
        </h1>
        <p className="text-sm text-muted">
          {isNew ? "Reference assigned on save" : property.reference}
          {property?.deletedAt && " · Deleted"}
        </p>
      </div>

      <div className="lg:flex">
        {/* Section rail. Anchor links rather than JS scrolling, so it works before
            hydration and a section is linkable. */}
        <nav
          aria-label="Form sections"
          className="hidden shrink-0 border-r border-border p-5 lg:block lg:w-52"
        >
          <ul className="sticky top-5 space-y-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded px-3 py-2 text-sm text-ink-soft transition-colors duration-200 hover:bg-ink/5 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* The form body */}
        <div className="min-w-0 flex-1 space-y-8 p-5">
          {/* Server messages with no home. Above everything, because they explain a
              save that appeared to do nothing. */}
          {formErrors.length > 0 && (
            <div
              role="alert"
              className="flex gap-3 rounded border border-danger/40 bg-danger/5 p-4"
            >
              <FiAlertCircle className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <div className="text-sm text-ink">
                {formErrors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </div>
          )}

          <BasicsSection
            register={register}
            errors={errors}
            reference={reference}
            isAdministrator={isAdministrator}
          />
          <LocationSection
            register={register}
            errors={errors}
            reference={reference}
            state={state}
          />
          <SpecSection register={register} errors={errors} reference={reference} />
          <PricingSection
            register={register}
            errors={errors}
            reference={reference}
            listingType={listingType}
            onRequest={onRequest}
            state={state}
          />
          <TitleDeedSection
            register={register}
            errors={errors}
            reference={reference}
            titleType={titleType}
          />
          <InfrastructureSection
            register={register}
            errors={errors}
            reference={reference}
            isGatedEstate={isGatedEstate}
          />
          <TagsSection register={register} reference={reference} />
          <MediaSection
            register={register}
            errors={errors}
            control={control}
            media={media}
            // Null while creating: with no listing id there is no Cloudinary folder
            // and no ownership check, so the gallery renders a save-first message.
            propertyId={property?._id ?? null}
            // The same refetch the form uses after a save. Media mutations commit
            // immediately, so the gallery has to be reloaded without a save.
            onMediaChange={onSaved}
          />
          <SeoSection
            register={register}
            errors={errors}
            generated={{
              title: property?.title || "Generated from the listing title",
            }}
          />
        </div>
      </div>

      {/* Save bar. Fixed rather than at the end of the form: nine sections means the
          Save button would otherwise be a very long scroll from most fields. */}
      <div
        className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-raised px-5 py-3"
        style={{ zIndex: "var(--z-dropdown)" }}
      >
        <div className="mr-auto text-xs text-muted">
          {state && <span>{state}</span>}
          {isDirty && <span className="ml-2">Unsaved changes</span>}
          {/* Said plainly rather than left as a mysteriously greyed-out option. */}
          {!canPublish && (
            <span className="ml-2 block sm:inline">
              An administrator publishes your listings.
            </span>
          )}
        </div>

        <label htmlFor="publicationState" className="text-sm text-ink-soft">
          Visibility
        </label>
        <select
          id="publicationState"
          className="min-h-11 rounded border border-border bg-surface-raised px-3 text-sm text-ink"
          {...register("publicationState")}
        >
          {(reference.publicationStates ?? []).map((value) => (
            <option
              key={value}
              value={value}
              // The API 403s an agent without publishing rights; this just stops them
              // filling in the whole form first.
              disabled={value === "published" && !canPublish}
            >
              {humanise(value)}
            </option>
          ))}
        </select>

        <Button type="submit" loading={isSubmitting}>
          {isNew ? "Create listing" : "Save changes"}
        </Button>
      </div>

    </form>
  );
}
