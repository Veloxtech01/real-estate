import Link from "next/link";
import { FiLoader } from "react-icons/fi";

/**
 * The site's only button. Renders as a Next <Link> when `href` is passed, otherwise a
 * <button> — so an internal navigation never becomes a raw <a href>.
 *
 * Gold is deliberately not a fill colour with white text: #ca8a04 fails 4.5:1 against
 * white. Primary is white-on-ink; gold stays an accent (design system §2).
 */

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink-soft",
  secondary:
    "bg-surface-raised text-ink border border-border hover:border-accent hover:text-accent-text",
  ghost: "text-ink hover:text-accent-text",
};

const SIZES = {
  // min-h-11 = 44px, the minimum touch target.
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-7 text-base",
};

export default function Button({
  href,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded font-medium cursor-pointer",
    // Colour/opacity transitions only — a scale transform would shift neighbours.
    "transition-colors duration-200",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");

  // A link cannot be "loading" or "disabled", so those branches only apply to buttons.
  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {/* Progress lives inside the button so the control never looks frozen. */}
      {loading && <FiLoader className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
