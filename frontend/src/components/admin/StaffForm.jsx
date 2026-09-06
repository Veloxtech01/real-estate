"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";

import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { createStaffMember, updateStaffMember } from "@/lib/api/admin";
import { mapApiErrors } from "@/lib/apiErrors";
import { humanise } from "@/lib/format";

// Field paths the API's `details` map can land on directly.
const REGISTERED_PATHS = [
  "name",
  "email",
  "password",
  "role",
  "phone",
  "whatsapp",
  "position",
  "bio",
  "registrationNumber",
];

/**
 * Create/edit a staff account — one form for both, keyed by whether `staffMember` is
 * present, the same split PropertyForm uses for listings.
 *
 * Password is required on create and optional on edit ("leave blank to keep the
 * current password") — an empty string is stripped before the request goes out, so
 * it can never overwrite an existing password with nothing.
 */
export default function StaffForm({ staffMember = null, staffRoles = [], onSaved }) {
  const router = useRouter();
  const isNew = !staffMember;

  // Errors the server raised that no input claimed — shown whole rather than dropped.
  const [formErrors, setFormErrors] = useState([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: staffMember?.name ?? "",
      email: staffMember?.email ?? "",
      password: "",
      role: staffMember?.role ?? "agent",
      phone: staffMember?.phone ?? "",
      whatsapp: staffMember?.whatsapp ?? "",
      position: staffMember?.position ?? "",
      bio: staffMember?.bio ?? "",
      registrationNumber: staffMember?.registrationNumber ?? "",
      canPublish: staffMember?.canPublish ?? false,
      isPublic: staffMember?.isPublic ?? true,
    },
  });

  /**
   * Sends the form to the API.
   *
   * Takes: values (object) — react-hook-form's output.
   * Returns: a promise; navigates on success, maps field errors on failure.
   */
  const onSubmit = async (values) => {
    setFormErrors([]);

    // An empty password field means "leave it alone" on edit — never send it as
    // the new password.
    const { password, ...rest } = values;
    const payload = password ? { ...rest, password } : rest;

    try {
      if (isNew) {
        const created = await createStaffMember(payload);
        toast.success(`${created.name} added`);
        // Replace, not push: the create URL should not sit in the back stack
        // behind the record it just made.
        router.replace(`/admin/staff/${created._id}`);
      } else {
        await updateStaffMember(staffMember._id, payload);
        toast.success("Staff account saved");
        await onSaved?.();
      }
    } catch (error) {
      const unmatched = mapApiErrors(error.details, setError, REGISTERED_PATHS);
      setFormErrors(unmatched.length > 0 ? unmatched : [error.message]);
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Staff
        </Link>

        <h1 className="mt-2 font-display text-2xl text-ink">
          {isNew ? "New staff account" : staffMember.name}
        </h1>
        {!isNew && (
          <p className="text-sm text-muted">
            {staffMember.isActive ? "Active" : "Inactive"}
          </p>
        )}
      </div>

      <div className="max-w-xl space-y-6 p-5">
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

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-ink-soft">
            Full name
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

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register("email", { required: "Email is required" })}
            aria-invalid={Boolean(errors.email)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.email?.message} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm text-ink-soft">
            {isNew ? "Temporary password" : "New password"}
            {!isNew && <span className="text-muted"> (leave blank to keep current)</span>}
          </label>
          <input
            id="password"
            type="text"
            {...register(
              "password",
              isNew
                ? {
                    required: "Password is required",
                    minLength: { value: 8, message: "Password must be at least 8 characters" },
                  }
                : {
                    minLength: { value: 8, message: "Password must be at least 8 characters" },
                  },
            )}
            aria-invalid={Boolean(errors.password)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label htmlFor="role" className="mb-1.5 block text-sm text-ink-soft">
            Role
          </label>
          <select
            id="role"
            {...register("role", { required: true })}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          >
            {/* Enum comes from GET /api/admin/reference — never hardcoded here. */}
            {staffRoles.map((role) => (
              <option key={role} value={role}>
                {humanise(role)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="position" className="mb-1.5 block text-sm text-ink-soft">
            Position <span className="text-muted">(optional)</span>
          </label>
          <input
            id="position"
            type="text"
            placeholder="Senior Sales Consultant"
            {...register("position")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-ink-soft">
            Phone <span className="text-muted">(optional)</span>
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
            WhatsApp <span className="text-muted">(optional)</span>
          </label>
          <input
            id="whatsapp"
            type="tel"
            {...register("whatsapp")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm text-ink-soft">
            Bio <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="bio"
            rows={4}
            {...register("bio")}
            className="w-full rounded border border-border bg-surface p-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="registrationNumber" className="mb-1.5 block text-sm text-ink-soft">
            Registration number <span className="text-muted">(optional)</span>
          </label>
          <input
            id="registrationNumber"
            type="text"
            {...register("registrationNumber")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            {...register("canPublish")}
            className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          Can publish listings directly, without administrator approval
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            {...register("isPublic")}
            className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          Show on the public team page
        </label>
      </div>

      {/* Sticky action bar, matching PropertyForm's. */}
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-surface p-4">
        <Button type="submit" loading={isSubmitting}>
          {isNew ? "Create account" : "Save"}
        </Button>
      </div>
    </form>
  );
}
