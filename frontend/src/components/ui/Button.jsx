import Link from "next/link";
import { FiLoader } from "react-icons/fi";

/**
 * The site's only button. Renders as a Next <Link> when `href` is passed, otherwise a
 * <button> — so an internal navigation never becomes a raw <a href>.
 *
 * Gold is never a fill with WHITE text: #c6a15b is 1.9:1 against white. As a fill it
 * always carries navy text (6.6:1), which is why `accent` is text-ink and not text-white.
 * The three `on*` variants exist because a navy section needs its own set — reusing
 * `secondary` on navy produces an ivory card on a navy ground, which reads as a bug.
 */

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink-soft",
  secondary:
    "bg-surface-raised text-ink border border-border hover:border-accent hover:text-accent-text",
  ghost: "text-ink hover:text-accent-text",
  // Gold fill, navy label. The loudest control on the site — one per view at most.
  accent: "bg-accent text-ink hover:bg-accent-hover",
  // For navy grounds: a gold outline that fills gold on hover, label flipping to navy.
  onDarkOutline:
    "border border-accent text-accent hover:bg-accent hover:text-ink",
  // For navy grounds: an ivory fill, used where the gold is already spent elsewhere.
  onDarkSolid: "bg-surface text-ink hover:bg-white",
  // For navy grounds: a quiet text control.
  onDarkGhost: "text-white/80 hover:text-accent",
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
    // tel:, mailto: and off-site URLs are not app routes — routing them through <Link>
    // buys nothing and breaks the dialler on mobile. Everything else stays a <Link>, so
    // the "never a raw <a> for an internal route" rule still holds.
    const isExternal = /^(https?:|tel:|mailto:)/.test(href);

    if (isExternal) {
      const isHttp = href.startsWith("http");
      return (
        <a
          href={href}
          // Only http(s) links open in a new tab; a tel: link must stay in place.
          target={isHttp ? "_blank" : undefined}
          rel={isHttp ? "noreferrer noopener" : undefined}
          className={classes}
          {...props}
        >
          {children}
        </a>
      );
    }

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
