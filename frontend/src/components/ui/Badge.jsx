/**
 * Small status/label pill. Always renders its text: status is never communicated by
 * colour alone (accessibility floor, design system §5).
 */

const TONES = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  muted: "bg-ink/5 text-ink-soft",
  accent: "bg-accent/10 text-accent-text",
};

export default function Badge({ tone = "muted", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium uppercase tracking-[0.06em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
