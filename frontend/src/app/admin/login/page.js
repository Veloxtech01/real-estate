"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { login } from "@/lib/api/admin";
import siteConfig from "@/config/site";

/**
 * Staff sign-in.
 *
 * Lives outside the (panel) group because it must render without a session. The proxy
 * guard sends an already-signed-in visitor straight to /admin.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  // Not a field-level error, so it lives outside react-hook-form's error state.
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const onSubmit = async (values) => {
    setFormError(null);

    try {
      await login(values);
      // replace, not push: the login page must not sit in the back history of a
      // signed-in session.
      router.replace("/admin");
    } catch (error) {
      // The API returns ONE generic error for both a wrong password and an unknown
      // account, so the endpoint cannot be used to enumerate accounts. Do not "improve"
      // this by wording the two differently — that would undo the protection.
      // 429 is the login throttle (10 failures / 15 min) and is genuinely different
      // information, so it gets its own message.
      setFormError(
        error.status === 429
          ? "Too many failed attempts. Please wait 15 minutes and try again."
          : "Those details don't match an account.",
      );
    }
  };

  return (
    <Container className="flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm">
        {/* Wordmark from config — no brand string is written into this component. */}
        <p className="font-display text-2xl text-ink">{siteConfig.name}</p>
        <h1 className="mt-2 text-xl text-ink-soft">Staff sign in</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              {...register("email", { required: "Email is required" })}
              aria-invalid={Boolean(errors.email)}
              className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-ink-soft">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password", { required: "Password is required" })}
              aria-invalid={Boolean(errors.password)}
              className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <FieldError message={errors.password?.message} />
          </div>

          {/* Whole-form failure, announced to screen readers. */}
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </Container>
  );
}
