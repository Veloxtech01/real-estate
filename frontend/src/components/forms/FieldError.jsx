/**
 * Inline validation message, rendered directly beneath its field so the problem and
 * the fix are in the same place. `role="alert"` announces it to screen readers.
 */
export default function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}
