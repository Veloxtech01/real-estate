/**
 * The one content width used across the whole site. Mixing container widths between
 * sections is the fastest way to make a layout look unconsidered (design system §4).
 */
export default function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
