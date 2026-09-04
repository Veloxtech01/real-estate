"use client";

import { useId } from "react";

/**
 * Form primitives for the listing editor.
 *
 * Nine sections repeat the same label/control/error arrangement roughly sixty times.
 * These exist so a section component is a list of fields rather than a wall of
 * identical Tailwind, and so the error and required treatment is decided once.
 *
 * They are deliberately thin wrappers over `register()` — react-hook-form stays
 * uncontrolled, which is the whole reason a form this size performs.
 */

/** Shared input chrome. min-h-11 is the 44px touch target the design system sets. */
const CONTROL =
  "min-h-11 w-full rounded border bg-surface-raised px-3 text-sm text-ink transition-colors duration-200";

/**
 * Resolves a possibly-nested error out of react-hook-form's errors object.
 *
 * Field names are dotted paths (`rent.agencyFeePct`), so errors nest to match.
 *
 * Takes: errors (object), name (string).
 * Returns: the error object for that path, or undefined.
 */
export function errorAt(errors, name) {
  return name.split(".").reduce((node, key) => node?.[key], errors);
}

/**
 * Label + control + error message wrapper.
 *
 * Takes: label, htmlFor, error (object|undefined), hint (string), required (bool),
 *        className, children.
 */
export function Field({ label, htmlFor, error, hint, required, className = "", children }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-ink-soft">
        {label}
        {/* The asterisk is decorative; aria-required on the control is what carries. */}
        {required && <span aria-hidden="true" className="text-danger"> *</span>}
      </label>

      {children}

      {/* Hint yields to the error — showing both makes the row twice as tall and buries
          the message that actually needs reading. */}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error.message}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Text, number, url or date input bound to react-hook-form.
 *
 * Takes: name, label, register, errors, rules, type, and any input props.
 */
export function TextField({
  name,
  label,
  register,
  errors,
  rules = {},
  type = "text",
  hint,
  className = "",
  ...props
}) {
  const id = useId();
  const error = errorAt(errors, name);

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={Boolean(rules.required)}
      className={className}
    >
      <input
        id={id}
        type={type}
        aria-required={rules.required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        className={`${CONTROL} ${error ? "border-danger" : "border-border"}`}
        {...register(name, rules)}
        {...props}
      />
    </Field>
  );
}

/**
 * Multi-line text input.
 *
 * Separate from TextField rather than a `type` on it, because a textarea takes rows
 * and never takes min/max/step.
 */
export function TextAreaField({
  name,
  label,
  register,
  errors,
  rules = {},
  rows = 5,
  hint,
  className = "",
}) {
  const id = useId();
  const error = errorAt(errors, name);

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={Boolean(rules.required)}
      className={className}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        className={`w-full rounded border bg-surface-raised px-3 py-2 text-sm text-ink ${
          error ? "border-danger" : "border-border"
        }`}
        {...register(name, rules)}
      />
    </Field>
  );
}

/**
 * Single select.
 *
 * Takes: options as either strings or { value, label } objects — enum lists arrive as
 * bare strings from the reference endpoint, while locations arrive as records.
 */
export function SelectField({
  name,
  label,
  register,
  errors,
  rules = {},
  options = [],
  placeholder = "—",
  hint,
  className = "",
  children,
}) {
  const id = useId();
  const error = errorAt(errors, name);

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={Boolean(rules.required)}
      className={className}
    >
      <select
        id={id}
        aria-required={rules.required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        className={`${CONTROL} ${error ? "border-danger" : "border-border"}`}
        {...register(name, rules)}
      >
        {/* An empty first option is what makes "not recorded" expressible; the payload
            builder drops the empty string rather than sending an invalid enum. */}
        {placeholder !== null && <option value="">{placeholder}</option>}

        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}

        {/* Grouped options (locations by state) are passed as children instead. */}
        {children}
      </select>
    </Field>
  );
}

/** Single checkbox with its label to the right, as checkboxes read. */
export function CheckboxField({ name, label, register, hint, className = "" }) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          {...register(name)}
        />
        {label}
      </label>
      {hint && <p className="mt-1 ml-6 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * A set of checkboxes writing to one array field (power sources, water sources, tags).
 *
 * Registering several checkboxes under the same name is how react-hook-form produces
 * an array — no controller or local state needed.
 */
export function CheckboxGroup({ name, label, register, options = [], columns = 2 }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink-soft">{label}</legend>
      <div
        className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;

          return (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                value={value}
                className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                {...register(name)}
              />
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * A titled block within the long form.
 *
 * The id is the anchor the section rail scrolls to; scroll-mt keeps the heading clear
 * of the sticky top bar.
 */
export function FormSection({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-8">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
