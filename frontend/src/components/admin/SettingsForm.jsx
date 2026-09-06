"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { FiAlertCircle } from "react-icons/fi";

import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { updateAdminSettings } from "@/lib/api/admin";
import { mapApiErrors } from "@/lib/apiErrors";
import { humanise } from "@/lib/format";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// The core brand tokens, matching THEME_COLOR_KEYS in adminSettingsController.js —
// status/structural colors (muted, taupe, border, text, success, warning, danger)
// stay direct-DB-write only, since they aren't brand identity a client rebrand changes.
const COLOR_TOKENS = [
  { key: "ink", label: "Ink (primary navy)" },
  { key: "ink-deep", label: "Ink deep" },
  { key: "ink-raised", label: "Ink raised" },
  { key: "ink-soft", label: "Ink soft" },
  { key: "accent", label: "Accent (gold)" },
  { key: "accent-text", label: "Accent text" },
  { key: "accent-hover", label: "Accent hover" },
  { key: "surface", label: "Surface (ivory)" },
  { key: "surface-raised", label: "Surface raised" },
];

// Field paths the API's `details` map can land on directly.
const REGISTERED_PATHS = [
  "agencyName",
  "email",
  "aiSearch.monthlySpendCapUsd",
  "aiSearch.timeoutMs",
  ...COLOR_TOKENS.map((token) => `theme.colors.${token.key}`),
];

/** "Body: Number" per line -> [{ body, number }]. Mirrors BlogForm's comma-list
 *  convention (this codebase's established pattern for a free-text list, rather than
 *  introducing useFieldArray for the first time for one rarely-edited field). */
function textToRegistrationNumbers(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [body, ...rest] = line.split(":");
      return { body: body.trim(), number: rest.join(":").trim() };
    });
}

/** [{ body, number }] -> "Body: Number" per line, for the textarea's default value. */
function registrationNumbersToText(list = []) {
  return list.map((row) => `${row.body}: ${row.number}`).join("\n");
}

/** officeHours array (only the days present) -> one form entry per fixed day, so the
 *  form always renders all 7 rows regardless of what is currently stored. */
function officeHoursToForm(officeHours = []) {
  const byDay = Object.fromEntries(officeHours.map((row) => [row.day, row]));
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      {
        opensAt: byDay[day]?.opensAt ?? "",
        closesAt: byDay[day]?.closesAt ?? "",
        isClosed: byDay[day]?.isClosed ?? false,
      },
    ]),
  );
}

/** Form's per-day object -> the officeHours array the API expects. A closed day omits
 *  its times, matching the schema comment ("closed days simply omit the times"). */
function formToOfficeHours(values = {}) {
  return DAYS.map((day) => ({
    day,
    isClosed: Boolean(values[day]?.isClosed),
    ...(values[day]?.isClosed
      ? {}
      : {
          opensAt: values[day]?.opensAt || undefined,
          closesAt: values[day]?.closesAt || undefined,
        }),
  }));
}

/**
 * A paired color-picker + hex text input, kept in sync through Controller — colors
 * aren't a plain input, the same reason MediaSection's cover field uses Controller
 * rather than register.
 */
function ColorField({ name, label, control, error }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        // <input type="color"> rejects anything but a full 6-digit hex, so an empty
        // or partial value falls back to black for the picker only — the text field
        // still shows exactly what was typed.
        const pickerValue = /^#[0-9a-fA-F]{6}$/.test(field.value ?? "") ? field.value : "#000000";
        return (
          <div>
            <label htmlFor={name} className="mb-1.5 block text-sm text-ink-soft">
              {label}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={`${label} picker`}
                value={pickerValue}
                onChange={(event) => field.onChange(event.target.value)}
                className="h-11 w-11 shrink-0 cursor-pointer rounded border border-border bg-surface"
              />
              <input
                id={name}
                type="text"
                placeholder="#c6a15b"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
                aria-invalid={Boolean(error)}
                className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
              />
            </div>
            <FieldError message={error?.message} />
          </div>
        );
      }}
    />
  );
}

/**
 * Edits the Settings singleton — agency identity, contact, branding, AI search
 * controls, and compliance/analytics ids. One long form, no tabs: a validation error
 * on a section the administrator isn't looking at must not go unnoticed, same
 * reasoning as the listing editor.
 */
export default function SettingsForm({ settings, onSaved }) {
  // Errors the server raised that no input claimed — shown whole rather than dropped.
  const [formErrors, setFormErrors] = useState([]);

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      agencyName: settings.agencyName ?? "",
      tagline: settings.tagline ?? "",
      lasreraNumber: settings.lasreraNumber ?? "",
      registrationNumbersText: registrationNumbersToText(settings.registrationNumbers),
      email: settings.email ?? "",
      phone: settings.phone ?? "",
      whatsapp: settings.whatsapp ?? "",
      address: settings.address ?? "",
      footerText: settings.footerText ?? "",
      officeHours: officeHoursToForm(settings.officeHours),
      socialLinks: {
        facebook: settings.socialLinks?.facebook ?? "",
        instagram: settings.socialLinks?.instagram ?? "",
        x: settings.socialLinks?.x ?? "",
        linkedin: settings.socialLinks?.linkedin ?? "",
        youtube: settings.socialLinks?.youtube ?? "",
        tiktok: settings.socialLinks?.tiktok ?? "",
      },
      theme: {
        colors: Object.fromEntries(
          COLOR_TOKENS.map((token) => [token.key, settings.theme?.colors?.[token.key] ?? ""]),
        ),
        fontHeading: settings.theme?.fontHeading ?? "",
        fontBody: settings.theme?.fontBody ?? "",
        logoUrl: settings.theme?.logoUrl ?? "",
        logoDarkUrl: settings.theme?.logoDarkUrl ?? "",
        faviconUrl: settings.theme?.faviconUrl ?? "",
      },
      aiSearch: {
        enabled: settings.aiSearch?.enabled ?? false,
        monthlySpendCapUsd: settings.aiSearch?.monthlySpendCapUsd ?? 0,
        timeoutMs: settings.aiSearch?.timeoutMs ?? 2000,
      },
      listingDisclaimer: settings.listingDisclaimer ?? "",
      ndpcRegistrationNumber: settings.ndpcRegistrationNumber ?? "",
      googleAnalyticsId: settings.googleAnalyticsId ?? "",
      googleSearchConsoleId: settings.googleSearchConsoleId ?? "",
    },
  });

  /**
   * Sends the whole form to the API — same convention as StaffForm/BlogForm, which
   * submit every field rather than a dirty-only diff. Safe here too: theme and
   * aiSearch are deep-merged server-side, and the flat fields (officeHours,
   * socialLinks, registrationNumbers) are fully reconstructed from the loaded record,
   * so resending an unchanged value is a no-op.
   */
  const onSubmit = async (values) => {
    setFormErrors([]);

    const patch = {
      agencyName: values.agencyName,
      tagline: values.tagline || undefined,
      lasreraNumber: values.lasreraNumber || undefined,
      registrationNumbers: textToRegistrationNumbers(values.registrationNumbersText),
      email: values.email || undefined,
      phone: values.phone || undefined,
      whatsapp: values.whatsapp || undefined,
      address: values.address || undefined,
      footerText: values.footerText || undefined,
      officeHours: formToOfficeHours(values.officeHours),
      socialLinks: values.socialLinks,
      theme: {
        colors: Object.fromEntries(
          COLOR_TOKENS.map((token) => [token.key, values.theme.colors[token.key] || undefined]).filter(
            ([, value]) => value !== undefined,
          ),
        ),
        fontHeading: values.theme.fontHeading || undefined,
        fontBody: values.theme.fontBody || undefined,
        logoUrl: values.theme.logoUrl || undefined,
        logoDarkUrl: values.theme.logoDarkUrl || undefined,
        faviconUrl: values.theme.faviconUrl || undefined,
      },
      aiSearch: {
        enabled: values.aiSearch.enabled,
        monthlySpendCapUsd: Number(values.aiSearch.monthlySpendCapUsd),
        timeoutMs: Number(values.aiSearch.timeoutMs),
      },
      listingDisclaimer: values.listingDisclaimer || undefined,
      ndpcRegistrationNumber: values.ndpcRegistrationNumber || undefined,
      googleAnalyticsId: values.googleAnalyticsId || undefined,
      googleSearchConsoleId: values.googleSearchConsoleId || undefined,
    };

    try {
      const updated = await updateAdminSettings(patch);
      toast.success("Settings saved");

      // Best-effort: clears the public site's 1-hour settings cache so a changed
      // brand color shows up on the next page load. A failure here must never
      // block reporting the save, which already succeeded.
      try {
        await fetch("/api/revalidate", { method: "POST" });
      } catch {
        // Ignored — worst case, the change appears once the cache naturally expires.
      }

      await onSaved?.(updated);
    } catch (error) {
      const unmatched = mapApiErrors(error.details, setError, REGISTERED_PATHS);
      setFormErrors(unmatched.length > 0 ? unmatched : [error.message]);
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <p className="text-sm text-muted">Site identity, branding and operational controls.</p>
      </div>

      <div className="max-w-2xl space-y-10 p-5">
        {/* Server messages with no home. Above everything, because they explain a
            save that appeared to do nothing. */}
        {formErrors.length > 0 && (
          <div role="alert" className="flex gap-3 rounded border border-danger/40 bg-danger/5 p-4">
            <FiAlertCircle className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div className="text-sm text-ink">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        )}

        {/* --- Agency identity --------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Agency identity</h2>

          <div>
            <label htmlFor="agencyName" className="mb-1.5 block text-sm text-ink-soft">
              Agency name
            </label>
            <input
              id="agencyName"
              type="text"
              {...register("agencyName", { required: "Agency name is required" })}
              aria-invalid={Boolean(errors.agencyName)}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
            <FieldError message={errors.agencyName?.message} />
          </div>

          <div>
            <label htmlFor="tagline" className="mb-1.5 block text-sm text-ink-soft">
              Tagline <span className="text-muted">(optional)</span>
            </label>
            <input
              id="tagline"
              type="text"
              {...register("tagline")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="lasreraNumber" className="mb-1.5 block text-sm text-ink-soft">
              LASRERA number <span className="text-muted">(optional)</span>
            </label>
            <input
              id="lasreraNumber"
              type="text"
              {...register("lasreraNumber")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="registrationNumbersText" className="mb-1.5 block text-sm text-ink-soft">
              Other registration numbers <span className="text-muted">(one per line, "Body: Number")</span>
            </label>
            <textarea
              id="registrationNumbersText"
              rows={3}
              placeholder={"NIESV: 12345\nREDAN: 67890"}
              {...register("registrationNumbersText")}
              className="w-full rounded border border-border bg-surface p-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="footerText" className="mb-1.5 block text-sm text-ink-soft">
              Footer text <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="footerText"
              rows={2}
              {...register("footerText")}
              className="w-full rounded border border-border bg-surface p-3 text-ink"
            />
          </div>
        </section>

        {/* --- Contact ------------------------------------------------------------ */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Contact</h2>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm text-ink-soft">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              {...register("phone")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="whatsapp" className="mb-1.5 block text-sm text-ink-soft">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              type="tel"
              {...register("whatsapp")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="address" className="mb-1.5 block text-sm text-ink-soft">
              Address
            </label>
            <textarea
              id="address"
              rows={2}
              {...register("address")}
              className="w-full rounded border border-border bg-surface p-3 text-ink"
            />
          </div>

          {/* Office hours — 7 fixed rows, one per day, so the schema's "closed days
              simply omit the times" rule maps to one checkbox per row. */}
          <div>
            <span className="mb-1.5 block text-sm text-ink-soft">Office hours</span>
            <div className="space-y-2">
              {DAYS.map((day) => {
                // Re-renders this row only when its own isClosed value changes.
                const isClosed = watch(`officeHours.${day}.isClosed`);
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-ink">{humanise(day)}</span>
                    <input
                      type="time"
                      disabled={isClosed}
                      {...register(`officeHours.${day}.opensAt`)}
                      className="min-h-11 rounded border border-border bg-surface px-2 text-sm text-ink disabled:opacity-50"
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="time"
                      disabled={isClosed}
                      {...register(`officeHours.${day}.closesAt`)}
                      className="min-h-11 rounded border border-border bg-surface px-2 text-sm text-ink disabled:opacity-50"
                    />
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        {...register(`officeHours.${day}.isClosed`)}
                        className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                      />
                      Closed
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              ["facebook", "Facebook"],
              ["instagram", "Instagram"],
              ["x", "X (Twitter)"],
              ["linkedin", "LinkedIn"],
              ["youtube", "YouTube"],
              ["tiktok", "TikTok"],
            ].map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`social-${key}`} className="mb-1.5 block text-sm text-ink-soft">
                  {label}
                </label>
                <input
                  id={`social-${key}`}
                  type="url"
                  {...register(`socialLinks.${key}`)}
                  className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
                />
              </div>
            ))}
          </div>
        </section>

        {/* --- Branding ------------------------------------------------------------ */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Branding</h2>
          <p className="text-sm text-muted">
            Colors apply live to the public site and admin panel. Fonts are stored but not yet
            applied to the live site — a separate change is needed to swap the self-hosted fonts.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COLOR_TOKENS.map((token) => (
              <ColorField
                key={token.key}
                name={`theme.colors.${token.key}`}
                label={token.label}
                control={control}
                error={errors.theme?.colors?.[token.key]}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fontHeading" className="mb-1.5 block text-sm text-ink-soft">
                Heading font <span className="text-muted">(not yet applied)</span>
              </label>
              <input
                id="fontHeading"
                type="text"
                {...register("theme.fontHeading")}
                className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
              />
            </div>
            <div>
              <label htmlFor="fontBody" className="mb-1.5 block text-sm text-ink-soft">
                Body font <span className="text-muted">(not yet applied)</span>
              </label>
              <input
                id="fontBody"
                type="text"
                {...register("theme.fontBody")}
                className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
              />
            </div>
          </div>

          {[
            ["logoUrl", "Logo URL"],
            ["logoDarkUrl", "Logo URL (dark backgrounds)"],
            ["faviconUrl", "Favicon URL"],
          ].map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key} className="mb-1.5 block text-sm text-ink-soft">
                {label}
              </label>
              <input
                id={key}
                type="url"
                {...register(`theme.${key}`)}
                className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
              />
            </div>
          ))}
        </section>

        {/* --- AI search controls --------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">AI search controls</h2>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              {...register("aiSearch.enabled")}
              className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            Enable AI-assisted natural-language search
          </label>

          <div>
            <label htmlFor="monthlySpendCapUsd" className="mb-1.5 block text-sm text-ink-soft">
              Monthly spend cap (USD)
            </label>
            <input
              id="monthlySpendCapUsd"
              type="number"
              min="0"
              step="0.01"
              {...register("aiSearch.monthlySpendCapUsd", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.aiSearch?.monthlySpendCapUsd)}
              className="min-h-11 w-full max-w-xs rounded border border-border bg-surface px-3 text-ink"
            />
            <FieldError message={errors.aiSearch?.monthlySpendCapUsd?.message} />
          </div>

          <div>
            <label htmlFor="timeoutMs" className="mb-1.5 block text-sm text-ink-soft">
              Request timeout (ms)
            </label>
            <input
              id="timeoutMs"
              type="number"
              min="0"
              step="1"
              {...register("aiSearch.timeoutMs", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.aiSearch?.timeoutMs)}
              className="min-h-11 w-full max-w-xs rounded border border-border bg-surface px-3 text-ink"
            />
            <FieldError message={errors.aiSearch?.timeoutMs?.message} />
          </div>

          {/* Read-only — currentSpendUsd is never a form field, never submitted. */}
          <p className="text-sm text-muted">
            ${(settings.aiSearch?.currentSpendUsd ?? 0).toFixed(2)} spent this month, of a $
            {(settings.aiSearch?.monthlySpendCapUsd ?? 0).toFixed(2)} cap.
          </p>
        </section>

        {/* --- Compliance & analytics --------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Compliance & analytics</h2>

          <div>
            <label htmlFor="listingDisclaimer" className="mb-1.5 block text-sm text-ink-soft">
              Listing disclaimer
            </label>
            <textarea
              id="listingDisclaimer"
              rows={3}
              {...register("listingDisclaimer")}
              className="w-full rounded border border-border bg-surface p-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="ndpcRegistrationNumber" className="mb-1.5 block text-sm text-ink-soft">
              NDPC registration number <span className="text-muted">(optional)</span>
            </label>
            <input
              id="ndpcRegistrationNumber"
              type="text"
              {...register("ndpcRegistrationNumber")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="googleAnalyticsId" className="mb-1.5 block text-sm text-ink-soft">
              Google Analytics ID <span className="text-muted">(optional)</span>
            </label>
            <input
              id="googleAnalyticsId"
              type="text"
              {...register("googleAnalyticsId")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>

          <div>
            <label htmlFor="googleSearchConsoleId" className="mb-1.5 block text-sm text-ink-soft">
              Google Search Console ID <span className="text-muted">(optional)</span>
            </label>
            <input
              id="googleSearchConsoleId"
              type="text"
              {...register("googleSearchConsoleId")}
              className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
            />
          </div>
        </section>
      </div>

      {/* Sticky action bar, matching StaffForm/PropertyForm's. */}
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-surface p-4">
        <Button type="submit" loading={isSubmitting}>
          Save
        </Button>
      </div>
    </form>
  );
}
